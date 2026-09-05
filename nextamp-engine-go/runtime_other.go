//go:build !darwin && !windows

package main

var embeddedRuntimeLib []byte

const (
	embeddedRuntimeName = "libonnxruntime.so"
	embeddedRuntimeSize = 0
)
