#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

PYTHON_BIN="${NEXTSTUDIO_MODEL_PYTHON:-.venv/bin/python3}"
TFJS_CONVERTER_BIN="${NEXTSTUDIO_TFJS_CONVERTER:-.venv/bin/tensorflowjs_converter}"

if [[ ! -x "$PYTHON_BIN" ]]; then
    echo "Error: Python environment not found at $PYTHON_BIN"
    exit 1
fi

FETCH_ONLY=0
if [[ "${1:-}" == "--fetch-only" ]]; then
    FETCH_ONLY=1
fi

echo "Phase 1: Downloading source..."
"$PYTHON_BIN" src/download_source.py

if [[ $FETCH_ONLY -eq 1 ]]; then
    echo "Fetch only complete."
    exit 0
fi

# Generated output must start clean. Otherwise an interrupted ONNX export can
# leave an external-data sidecar or a stale verification report in dist/.
rm -rf work/saved_model work/fixtures dist/mgm-main-v4
mkdir -p work/saved_model work/fixtures
mkdir -p dist/mgm-main-v4/tfjs dist/mgm-main-v4/onnx

echo "Phase 2: Exporting TensorFlow SavedModel..."
"$PYTHON_BIN" src/export_saved_model.py

echo "Phase 3: Converting to TensorFlow.js FP16..."
env PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python "$TFJS_CONVERTER_BIN" \
  --input_format=tf_saved_model \
  --output_format=tfjs_graph_model \
  --signature_name=serving_default \
  --saved_model_tags=serve \
  --quantize_float16 \
  --weight_shard_size_bytes=33554432 \
  work/saved_model \
  dist/mgm-main-v4/tfjs
"$PYTHON_BIN" src/canonicalize_tfjs.py dist/mgm-main-v4/tfjs/model.json

echo "Phase 4: Exporting ONNX..."
"$PYTHON_BIN" src/export_onnx.py

echo "Phase 5: Generating Provenance..."
"$PYTHON_BIN" src/generate_provenance.py

echo "Phase 6: Preparing Licenses..."
cat > dist/mgm-main-v4/MODEL-LICENSE.txt << 'EOF'
MGM_MAIN_v4 Converted Model
Converted to TensorFlow.js/ONNX by NextFeeder Labs
Source Model: MGM_MAIN_v4.pth from Ultimate Vocal Remover
Source Architecture: CascadedASPPNet v4 by tsurumeso

Disclaimer: Not endorsed by or affiliated with the original upstream authors.

=== Ultimate Vocal Remover License ===
EOF
cat licenses/UVR-MIT.txt >> dist/mgm-main-v4/MODEL-LICENSE.txt
echo -e "\n=== Architecture License ===\n" >> dist/mgm-main-v4/MODEL-LICENSE.txt
cat licenses/TSURUMESO-MIT.txt >> dist/mgm-main-v4/MODEL-LICENSE.txt
cp dist/mgm-main-v4/MODEL-LICENSE.txt dist/mgm-main-v4/tfjs/LICENSE

echo "Phase 7: Computing Hashes..."
cd dist/mgm-main-v4
find . -type f -not -name "SHA256SUMS" -exec shasum -a 256 {} + > SHA256SUMS
cd ../..

echo "Build complete."
