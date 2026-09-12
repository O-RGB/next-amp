package dsp

import (
	"math"
	"testing"
)

func TestSilenceGateKeepsDelayedTimeline(t *testing.T) {
	e := NewEngine()
	silence := make([]float32, ChunkSamples)

	if got := e.StepForward(silence, silence); len(got) != NumBins*MaxFrames*2 {
		t.Fatalf("unexpected normalized input length: %d", len(got))
	}
	if e.TargetChunkIsDigitalSilence(1, 3.25e-5) {
		t.Fatal("delayed target must not be considered available before one chunk exists")
	}

	e.StepForward(silence, silence)
	if !e.TargetChunkIsDigitalSilence(1, 3.25e-5) {
		t.Fatal("second silent chunk should expose the first chunk as a digital-silence target")
	}

	outL, outR := e.StepBackwardSilence(1)
	if len(outL) != ChunkSamples || len(outR) != ChunkSamples {
		t.Fatalf("unexpected silence output length: %d/%d", len(outL), len(outR))
	}
	for i, sample := range outL {
		if sample != 0 || outR[i] != 0 {
			t.Fatalf("silence timeline produced non-zero output at sample %d: %g/%g", i, sample, outR[i])
		}
	}
}

func TestSilenceGateDoesNotSkipAudibleChunk(t *testing.T) {
	e := NewEngine()
	audible := make([]float32, ChunkSamples)
	for i := range audible {
		audible[i] = float32(math.Sin(2*math.Pi*440*float64(i)/44100)) * 0.5
	}

	e.StepForward(audible, audible)
	if e.TargetChunkIsDigitalSilence(1, 3.25e-5) {
		t.Fatal("first audible chunk must not be considered available before one chunk exists")
	}

	e.StepForward(audible, audible)
	if e.TargetChunkIsDigitalSilence(1, 3.25e-5) {
		t.Fatal("audible delayed target must not be skipped by the digital-silence gate")
	}
}
