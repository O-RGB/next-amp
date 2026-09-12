#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=================================================="
echo "    NEXTSTUDIO ENGINE STANDALONE SINGLE-BINARY BUILDER"
echo "=================================================="

# 1. Pack & Encrypt model + libraries only when a source asset is newer.
# The packer intentionally uses a fresh AES key/nonce, so repacking on every
# build creates meaningless tracked diffs and needlessly rewrites the model.
needs_pack=0
if [[ ! -f assets/model.enc || ! -f assets/libonnxruntime.dylib.gz || ! -f assets/onnxruntime.dll.gz || ! -f key_gen.go ]]; then
  needs_pack=1
fi
if [[ -f model.onnx && -f assets/model.enc && model.onnx -nt assets/model.enc ]]; then
  needs_pack=1
fi
if [[ -f libonnxruntime.dylib && -f assets/libonnxruntime.dylib.gz && libonnxruntime.dylib -nt assets/libonnxruntime.dylib.gz ]]; then
  needs_pack=1
fi
if [[ -f onnxruntime.dll && -f assets/onnxruntime.dll.gz && onnxruntime.dll -nt assets/onnxruntime.dll.gz ]]; then
  needs_pack=1
fi

if [[ "$needs_pack" -eq 1 && -f model.onnx && -f libonnxruntime.dylib && -f onnxruntime.dll ]]; then
  echo "[*] Step 1: Compressing and encrypting AI assets..."
  go run packer/pack.go
else
  echo "[*] Step 1: Using existing packaged AI assets..."
  if [[ ! -f assets/model.enc || ! -f assets/libonnxruntime.dylib.gz || ! -f assets/onnxruntime.dll.gz || ! -f key_gen.go ]]; then
    echo "[!] Missing packaged assets. Provide model.onnx and both ONNX Runtime libraries, or restore assets/ and key_gen.go."
    exit 1
  fi
fi

# 2. Build macOS standalone binary
echo "[*] Step 2: Compiling macOS standalone binary (Apple Silicon & Intel)..."
go build -ldflags="-s -w" -o nextamp-engine .

# 3. Build Windows standalone binary
echo "[*] Step 3: Cross-compiling Windows standalone executable (x64)..."
CC="zig cc -target x86_64-windows-gnu" CXX="zig c++ -target x86_64-windows-gnu" GOOS=windows GOARCH=amd64 CGO_ENABLED=1 go build -ldflags="-s -w" -o nextamp-engine.exe .

echo ""
echo "=================================================="
echo "    BUILD SUCCESSFUL! STANDALONE BINARIES CREATED:"
echo "=================================================="
ls -lh nextamp-engine nextamp-engine.exe
echo ""
echo "[✔] Done! Both executables are 100% self-contained."
