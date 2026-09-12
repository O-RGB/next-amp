package main

import (
	"fmt"
	"math"
	"os"
	"runtime"
	"sort"
	"testing"
	"time"

	ort "github.com/yalue/onnxruntime_go"
)

// Run with:
//
//	NEXTSTUDIO_RUN_COREML_BENCH=1 go test -run TestCoreMLComputeUnits -v
//
// This is deliberately opt-in because it compiles several CoreML sessions and
// can take a few seconds. It compares the same FP32 graph and exact input shape
// under each CoreML compute-unit policy; it does not change production defaults.
func TestCoreMLComputeUnits(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("CoreML is only available on macOS")
	}
	if os.Getenv("NEXTSTUDIO_RUN_COREML_BENCH") != "1" {
		t.Skip("set NEXTSTUDIO_RUN_COREML_BENCH=1 to run the opt-in provider benchmark")
	}

	libPath, err := findOrExtractLibrary()
	if err != nil {
		t.Fatalf("find runtime: %v", err)
	}
	modelData, err := loadDecryptedModel()
	if err != nil {
		t.Fatalf("load model: %v", err)
	}
	ort.SetSharedLibraryPath(libPath)
	if err := ort.InitializeEnvironment(); err != nil {
		t.Fatalf("initialize ORT: %v", err)
	}
	defer ort.DestroyEnvironment()

	device := AccelerationOption{
		Type:        DeviceCoreML,
		Name:        "CoreML",
		DisplayName: "CoreML benchmark",
	}
	// Keep a CPU reference for the same FP32 graph/input. CoreML is allowed
	// normal provider rounding, but a provider candidate must not materially
	// change the mask values used by the separator.
	cpuSession, cpuInput, cpuOutput, _, err := createORTSessionWithOptions(modelData, AccelerationOption{
		Type:        DeviceCPU,
		Name:        "CPU",
		DisplayName: "CPU benchmark",
	}, "")
	if err != nil {
		t.Fatalf("create CPU reference session: %v", err)
	}
	cpuInputData := cpuInput.GetData()
	fillBenchmarkInput(cpuInputData)
	if err := cpuSession.Run(); err != nil {
		t.Fatalf("CPU reference run: %v", err)
	}
	cpuReference := append([]float32(nil), cpuOutput.GetData()...)
	cpuSession.Destroy()
	cpuInput.Destroy()
	cpuOutput.Destroy()

	candidates := []string{"ALL", "CPUAndNeuralEngine", "CPUAndGPU"}
	for _, units := range candidates {
		units := units
		t.Run(units, func(t *testing.T) {
			session, input, output, _, err := createORTSessionWithOptions(modelData, device, units)
			if err != nil {
				t.Fatalf("create session: %v", err)
			}
			defer session.Destroy()
			defer input.Destroy()
			defer output.Destroy()

			// The session input is zero-filled by construction. A deterministic
			// non-zero pattern prevents a provider from taking an unusually cheap
			// all-zero fast path while keeping this benchmark repeatable.
			inputData := input.GetData()
			fillBenchmarkInput(inputData)
			for i := 0; i < 2; i++ {
				if err := session.Run(); err != nil {
					t.Fatalf("warmup run %d: %v", i, err)
				}
			}

			const runs = 7
			times := make([]float64, 0, runs)
			for i := 0; i < runs; i++ {
				start := time.Now()
				if err := session.Run(); err != nil {
					t.Fatalf("measured run %d: %v", i, err)
				}
				times = append(times, float64(time.Since(start).Microseconds())/1000.0)
			}
			sort.Float64s(times)
			maxAbs, rmse := compareFloat32(cpuReference, output.GetData())
			maskMaxAbs, maskRMSE := compareSigmoid(cpuReference, output.GetData())
			fmt.Printf("COREML_UNITS=%s median=%.2fms p95=%.2fms logitsMaxAbs=%.9g logitsRMSE=%.9g maskMaxAbs=%.9g maskRMSE=%.9g samples=%v\n", units, times[len(times)/2], times[len(times)-1], maxAbs, rmse, maskMaxAbs, maskRMSE, times)
		})
	}
}

func fillBenchmarkInput(data []float32) {
	for i := range data {
		data[i] = float32((i%127)-63) / 127.0
	}
}

func compareFloat32(reference, candidate []float32) (float64, float64) {
	if len(reference) != len(candidate) {
		return math.Inf(1), math.Inf(1)
	}
	var maxAbs, sumSquared float64
	for i := range reference {
		delta := float64(candidate[i] - reference[i])
		abs := math.Abs(delta)
		if abs > maxAbs {
			maxAbs = abs
		}
		sumSquared += delta * delta
	}
	return maxAbs, math.Sqrt(sumSquared / float64(len(reference)))
}

func compareSigmoid(reference, candidate []float32) (float64, float64) {
	if len(reference) != len(candidate) {
		return math.Inf(1), math.Inf(1)
	}
	var maxAbs, sumSquared float64
	for i := range reference {
		r := 1.0 / (1.0 + math.Exp(-float64(reference[i])))
		c := 1.0 / (1.0 + math.Exp(-float64(candidate[i])))
		delta := c - r
		abs := math.Abs(delta)
		if abs > maxAbs {
			maxAbs = abs
		}
		sumSquared += delta * delta
	}
	return maxAbs, math.Sqrt(sumSquared / float64(len(reference)))
}

func createORTSessionWithOptions(modelData []byte, dev AccelerationOption, computeUnits string) (*ort.AdvancedSession, *ort.Tensor[float32], *ort.Tensor[float32], string, error) {
	opts, deviceLabel, err := createSessionOptionsForCoreML(dev, computeUnits, false)
	if err != nil {
		return nil, nil, nil, "", err
	}
	defer opts.Destroy()

	inputShape := ort.NewShape(1, 1024, 64, 2)
	inputTensor, err := ort.NewTensor(inputShape, make([]float32, 1*1024*64*2))
	if err != nil {
		return nil, nil, nil, "", err
	}
	outputShape := ort.NewShape(1, 1024, 64, 2)
	outputTensor, err := ort.NewEmptyTensor[float32](outputShape)
	if err != nil {
		inputTensor.Destroy()
		return nil, nil, nil, "", err
	}
	session, err := ort.NewAdvancedSessionWithONNXData(
		modelData,
		[]string{"input"},
		[]string{"Identity"},
		[]ort.Value{inputTensor},
		[]ort.Value{outputTensor},
		opts,
	)
	if err != nil {
		outputTensor.Destroy()
		inputTensor.Destroy()
		return nil, nil, nil, "", err
	}
	return session, inputTensor, outputTensor, deviceLabel, nil
}
