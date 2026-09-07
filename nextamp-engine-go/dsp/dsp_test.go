package dsp

import "testing"

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
