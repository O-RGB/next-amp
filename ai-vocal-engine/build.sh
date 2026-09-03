#!/usr/bin/env bash
set -e

# ==============================================================================
# NEXTAMP AI VOCAL ENGINE: AUTOMATED BUILD PIPELINE
# Compiles high-performance C DSP into WASM SIMD128 and copies to extension.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="${SCRIPT_DIR}/dist"
EXT_MODULES_DIR="${SCRIPT_DIR}/../next-amp-extension/modules/ai-vocal"

echo "============================================================"
echo "⚡ BUILDING NEXTAMP AI VOCAL ENGINE (WASM SIMD128 DSP) ⚡"
echo "============================================================"

# Check if emcc is installed
if ! command -v emcc &> /dev/null; then
    echo "❌ Error: emcc (Emscripten) not found in PATH."
    echo "Please install Emscripten (e.g. brew install emscripten) or source emsdk."
    exit 1
fi

mkdir -p "${DIST_DIR}"
mkdir -p "${EXT_MODULES_DIR}"

EXPORTED_FUNCS="['_stft_init','_stft_reset','_stft_get_input_ptr','_stft_get_output_ptr','_stft_get_magnitudes_ptr','_stft_get_mask_ptr','_stft_get_spec_real_ptr','_stft_get_spec_imag_ptr','_stft_forward','_stft_apply_mask','_stft_backward']"

# 1. Build High-Performance SIMD128 WASM Module
echo "1. Compiling stft_simd.wasm with Wasm SIMD128 & LTO..."
emcc -O3 -msimd128 -flto --no-entry \
    -s STANDALONE_WASM=1 \
    -s "EXPORTED_FUNCTIONS=${EXPORTED_FUNCS}" \
    -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
    -s INITIAL_MEMORY=4194304 \
    -o "${DIST_DIR}/stft_simd.wasm" \
    "${SCRIPT_DIR}/src/dsp/stft_core.c"

# 2. Build Fallback Scalar WASM Module (for legacy browsers/CPUs without SIMD)
echo "2. Compiling stft_scalar.wasm fallback (pure scalar)..."
emcc -O3 -flto --no-entry \
    -s STANDALONE_WASM=1 \
    -s "EXPORTED_FUNCTIONS=${EXPORTED_FUNCS}" \
    -s ERROR_ON_UNDEFINED_SYMBOLS=0 \
    -s INITIAL_MEMORY=4194304 \
    -o "${DIST_DIR}/stft_scalar.wasm" \
    "${SCRIPT_DIR}/src/dsp/stft_core.c"

# 3. Copy artifacts directly into next-amp-extension/modules/ai-vocal
echo "3. Synchronizing artifacts to NextAmp Extension modules..."
cp -v "${DIST_DIR}/stft_simd.wasm" "${EXT_MODULES_DIR}/"
cp -v "${DIST_DIR}/stft_scalar.wasm" "${EXT_MODULES_DIR}/"
cp -v "${DIST_DIR}/stft_simd.wasm" "${SCRIPT_DIR}/demo/"
cp -v "${DIST_DIR}/stft_scalar.wasm" "${SCRIPT_DIR}/demo/"
if [ -f "${SCRIPT_DIR}/src/runtime/vocal-separator.js" ]; then
    cp -v "${SCRIPT_DIR}/src/runtime/vocal-separator.js" "${EXT_MODULES_DIR}/"
fi
if [ -f "${SCRIPT_DIR}/src/runtime/vocal-processor.worklet.js" ]; then
    cp -v "${SCRIPT_DIR}/src/runtime/vocal-processor.worklet.js" "${EXT_MODULES_DIR}/"
fi

echo "============================================================"
echo "✓ BUILD SUCCESSFUL!"
echo "WASM SIMD Size:   $(wc -c < "${DIST_DIR}/stft_simd.wasm" | tr -d ' ') bytes"
echo "WASM Scalar Size: $(wc -c < "${DIST_DIR}/stft_scalar.wasm" | tr -d ' ') bytes"
echo "Target Extension: ${EXT_MODULES_DIR}"
echo "============================================================"

# 4. Run Automated Verification Test
echo "4. Running Automated DSP Verification Test..."
node "${SCRIPT_DIR}/test/test_wasm_dsp.js"
