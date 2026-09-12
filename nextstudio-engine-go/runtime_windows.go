//go:build windows

package main

import (
	_ "embed"
)

//go:embed assets/onnxruntime.dll.gz
var embeddedRuntimeLib []byte

const (
	embeddedRuntimeName = "onnxruntime.dll"
	embeddedRuntimeSize = 11569696
)
