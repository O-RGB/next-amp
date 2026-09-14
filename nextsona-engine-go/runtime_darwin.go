//go:build darwin

package main

import (
	_ "embed"
)

//go:embed assets/libonnxruntime.dylib.gz
var embeddedRuntimeLib []byte

const (
	embeddedRuntimeName = "libonnxruntime.dylib"
	embeddedRuntimeSize = 33332888
)
