package main

import (
	"encoding/binary"
	"math"
	"testing"
)

func TestAudioPacketKeepsStreamToken(t *testing.T) {
	left := []float32{0.25, -0.5}
	right := []float32{-0.75, 1.0}
	buf := make([]byte, HeaderBytes+len(left)*8)
	packed := packChannelSamples(17, 1, 0xabcd, left, right, buf)

	if got := binary.LittleEndian.Uint32(packed[0:4]); got != 17 {
		t.Fatalf("chunk index = %d, want 17", got)
	}
	if got := packed[4]; got != 1 {
		t.Fatalf("mode = %d, want 1", got)
	}
	if got := binary.LittleEndian.Uint16(packed[6:8]); got != 0xabcd {
		t.Fatalf("stream token = %#x, want %#x", got, uint16(0xabcd))
	}
	if got := math.Float32frombits(binary.LittleEndian.Uint32(packed[8:12])); got != left[0] {
		t.Fatalf("left sample = %g, want %g", got, left[0])
	}
	rightOffset := HeaderBytes + len(left)*4
	if got := math.Float32frombits(binary.LittleEndian.Uint32(packed[rightOffset : rightOffset+4])); got != right[0] {
		t.Fatalf("right sample = %g, want %g", got, right[0])
	}
}

func TestSilentPacketKeepsStreamToken(t *testing.T) {
	buf := make([]byte, HeaderBytes+4*8)
	packed := packSilentSamples(23, 2, 0x1234, 4, buf)
	if got := binary.LittleEndian.Uint16(packed[6:8]); got != 0x1234 {
		t.Fatalf("silent stream token = %#x, want %#x", got, uint16(0x1234))
	}
	for i, sample := range packed[HeaderBytes:] {
		if sample != 0 {
			t.Fatalf("silent payload byte %d = %d, want 0", i, sample)
		}
	}
}
