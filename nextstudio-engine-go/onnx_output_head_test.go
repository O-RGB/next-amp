package main

import (
	"bytes"
	"math"
	"os"
	"testing"

	ort "github.com/yalue/onnxruntime_go"
	"nextstudio-engine-go/dsp"
)

func TestRewriteONNXOutputWindow(t *testing.T) {
	modelData, err := os.ReadFile("model.onnx")
	if err != nil {
		t.Fatalf("read model.onnx: %v", err)
	}

	compact, applied, err := rewriteONNXOutputWindow(modelData)
	if err != nil {
		t.Fatalf("rewrite model: %v", err)
	}
	if !applied {
		t.Fatal("expected the known model graph to receive a compact output head")
	}
	if len(compact) <= len(modelData) {
		t.Fatalf("compact graph did not retain its added output nodes: original=%d compact=%d", len(modelData), len(compact))
	}

	second, appliedAgain, err := rewriteONNXOutputWindow(compact)
	if err != nil {
		t.Fatalf("rewrite compact model: %v", err)
	}
	if appliedAgain {
		t.Fatal("compact output rewrite must be idempotent")
	}
	if !bytes.Equal(second, compact) {
		t.Fatal("idempotent rewrite changed the compact model")
	}

	fields, err := parseONNXFields(compact)
	if err != nil {
		t.Fatalf("parse compact model: %v", err)
	}
	graphBytes := firstONNXBytes(fields, 7)
	if len(graphBytes) == 0 {
		t.Fatal("compact model has no graph")
	}
	graphFields, err := parseONNXFields(graphBytes)
	if err != nil {
		t.Fatalf("parse compact graph: %v", err)
	}

	var sawSlice, sawROISlice, sawDecoderLayerSlice, sawProjectionSlice, sawCompactOutput bool
	for _, field := range graphFields {
		if field.number == 1 && field.wire == 2 {
			nodeFields, parseErr := parseONNXFields(field.value)
			if parseErr != nil {
				t.Fatalf("parse compact node: %v", parseErr)
			}
			if string(firstONNXBytes(nodeFields, 4)) == "Slice" {
				outputs := allONNXBytes(nodeFields, 2)
				if len(outputs) == 1 && string(outputs[0]) == compactOutputName {
					sawSlice = true
				}
				if len(outputs) == 1 && string(outputs[0]) == compactROIPrefix+"decoder_input:0" {
					sawROISlice = true
				}
				if len(outputs) == 1 && string(outputs[0]) == compactROIPrefix+"decoder_layer_input:0" {
					sawDecoderLayerSlice = true
				}
				if len(outputs) == 1 && string(outputs[0]) == compactROIPrefix+"projection_input:0" {
					sawProjectionSlice = true
				}
			}
		}
		if field.number == 12 && field.wire == 2 {
			valueInfo, parseErr := parseONNXFields(field.value)
			if parseErr != nil {
				t.Fatalf("parse compact output: %v", parseErr)
			}
			if string(firstONNXBytes(valueInfo, 1)) == compactOutputName {
				sawCompactOutput = true
			}
		}
	}
	if !sawDecoderLayerSlice || !sawProjectionSlice || sawSlice || sawROISlice || !sawCompactOutput {
		t.Fatalf("compact graph missing Slice/output: outputSlice=%v roiSlice=%v decoderSlice=%v projectionSlice=%v output=%v", sawSlice, sawROISlice, sawDecoderLayerSlice, sawProjectionSlice, sawCompactOutput)
	}
}

func TestCompactONNXOutputRuntime(t *testing.T) {
	if os.Getenv("NEXTSTUDIO_RUN_COMPACT_ONNX") != "1" {
		t.Skip("set NEXTSTUDIO_RUN_COMPACT_ONNX=1 to run the native compact-output session")
	}
	if !CompactModelOutputEnabled {
		t.Skip("compact-output candidate is disabled in the production quality-baseline profile")
	}

	libPath, err := findOrExtractLibrary()
	if err != nil {
		t.Fatalf("find runtime: %v", err)
	}
	modelData, err := loadDecryptedModel()
	if err != nil {
		t.Fatalf("load model: %v", err)
	}
	compactModel, applied, err := rewriteONNXOutputWindow(modelData)
	if err != nil || !applied {
		t.Fatalf("rewrite model: applied=%v err=%v", applied, err)
	}

	ort.SetSharedLibraryPath(libPath)
	if err := ort.InitializeEnvironment(); err != nil {
		t.Fatalf("initialize ORT: %v", err)
	}
	defer ort.DestroyEnvironment()

	dev := AccelerationOption{Type: DeviceCPU, Name: "CPU", DisplayName: "CPU compact test"}
	opts, _, err := createSessionOptions(dev)
	if err != nil {
		t.Fatalf("session options: %v", err)
	}
	defer opts.Destroy()

	input, err := ort.NewTensor(ort.NewShape(1, 1024, 64, 2), make([]float32, 1*1024*64*2))
	if err != nil {
		t.Fatalf("input tensor: %v", err)
	}
	defer input.Destroy()
	output, err := ort.NewEmptyTensor[float32](ort.NewShape(1, 1024, compactOutputFrames, 2))
	if err != nil {
		t.Fatalf("output tensor: %v", err)
	}
	defer output.Destroy()

	session, err := ort.NewAdvancedSessionWithONNXData(
		compactModel,
		[]string{"input"},
		[]string{compactOutputName},
		[]ort.Value{input},
		[]ort.Value{output},
		opts,
	)
	if err != nil {
		t.Fatalf("compact session: %v", err)
	}
	defer session.Destroy()
	if err := session.Run(); err != nil {
		t.Fatalf("compact inference: %v", err)
	}
	if got, want := len(output.GetData()), 1024*compactOutputFrames*2; got != want {
		t.Fatalf("compact output length=%d, want %d", got, want)
	}

	fullSession, fullInput, fullOutput, _, err := createORTSessionWithOutputFrames(
		modelData, dev, dsp.MaxFrames, "Identity",
	)
	if err != nil {
		t.Fatalf("full reference session: %v", err)
	}
	defer fullSession.Destroy()
	defer fullInput.Destroy()
	defer fullOutput.Destroy()
	copy(fullInput.GetData(), input.GetData())
	if err := fullSession.Run(); err != nil {
		t.Fatalf("full reference inference: %v", err)
	}
	var maxAbs, maskMaxAbs float64
	fullData := fullOutput.GetData()
	compactData := output.GetData()
	for bin := 0; bin < dsp.NumBins; bin++ {
		for frame := 0; frame < compactOutputFrames; frame++ {
			for channel := 0; channel < 2; channel++ {
				fullIndex := ((bin*dsp.MaxFrames)+(compactOutputStart+frame))*2 + channel
				compactIndex := ((bin*compactOutputFrames)+frame)*2 + channel
				fullValue := float64(fullData[fullIndex])
				compactValue := float64(compactData[compactIndex])
				maxAbs = math.Max(maxAbs, math.Abs(fullValue-compactValue))
				fullMask := 1.0 / (1.0 + math.Exp(-fullValue))
				compactMask := 1.0 / (1.0 + math.Exp(-compactValue))
				maskMaxAbs = math.Max(maskMaxAbs, math.Abs(fullMask-compactMask))
			}
		}
	}
	if maxAbs > 1e-6 {
		t.Fatalf("compact output differs from full output: maxAbs=%g", maxAbs)
	}
	if maskMaxAbs > 1e-7 {
		t.Fatalf("compact sigmoid mask differs from full output: maxAbs=%g", maskMaxAbs)
	}

	fullEngine := dsp.NewEngine()
	fullEngine.StepForward(make([]float32, dsp.ChunkSamples), make([]float32, dsp.ChunkSamples))
	fullL, fullR := fullEngine.StepBackward(fullData, 1, 1, 1.0)
	compactEngine := dsp.NewEngine()
	compactEngine.StepForward(make([]float32, dsp.ChunkSamples), make([]float32, dsp.ChunkSamples))
	compactL, compactR := compactEngine.StepBackward(compactData, 1, 1, 1.0)
	if len(compactL) != dsp.ChunkSamples || len(compactR) != dsp.ChunkSamples {
		t.Fatalf("compact DSP output lengths=(%d,%d), want %d", len(compactL), len(compactR), dsp.ChunkSamples)
	}
	var pcmMaxAbs float64
	for i := range fullL {
		pcmMaxAbs = math.Max(pcmMaxAbs, math.Abs(float64(fullL[i]-compactL[i])))
		pcmMaxAbs = math.Max(pcmMaxAbs, math.Abs(float64(fullR[i]-compactR[i])))
	}
	if pcmMaxAbs > 1e-6 {
		t.Fatalf("compact DSP PCM differs from full output: maxAbs=%g", pcmMaxAbs)
	}
}
