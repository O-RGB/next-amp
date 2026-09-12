package main

import (
	"math"
	"testing"
)

func TestValidateModelOutput(t *testing.T) {
	valid := make([]float32, 1024*64*2)
	valid[len(valid)/2] = 0.25
	if err := validateModelOutput(valid, true); err != nil {
		t.Fatalf("valid output rejected: %v", err)
	}

	if err := validateModelOutput(make([]float32, len(valid)), true); err == nil {
		t.Fatal("empty output was accepted")
	}

	nonFinite := make([]float32, len(valid))
	nonFinite[17] = float32(math.NaN())
	if err := validateModelOutput(nonFinite, false); err == nil {
		t.Fatal("non-finite output was accepted")
	}

	if err := validateModelOutput(valid[:len(valid)-1], false); err == nil {
		t.Fatal("wrong output shape was accepted")
	}
}
