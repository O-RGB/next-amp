#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

BUILDER_ROOT="$PWD"
DIST_DIR="$BUILDER_ROOT/dist/mgm-main-v4"
VERIFY_JSON="$DIST_DIR/VERIFICATION.json"
PYTHON_BIN="${NEXTSONA_MODEL_PYTHON:-.venv/bin/python3}"

write_failure() {
    local reason="${1:-verification_failed}"
    printf '{\n  "status": "failed",\n  "reason": "%s"\n}\n' "$reason" > "$VERIFY_JSON"
}

trap 'write_failure "verification_command_failed"' ERR

echo "Checking dist files..."
if [[ ! -d "$DIST_DIR" ]]; then
    echo "Error: Dist directory missing."
    exit 1
fi

echo "Verifying SHA256 sums..."
cd "$DIST_DIR"
if ! shasum -a 256 -c SHA256SUMS; then
    echo "Error: Checksum verification failed!"
    write_failure "checksum_mismatch"
    exit 1
fi
cd ../..

echo "Verifying official source hashes..."
"$PYTHON_BIN" src/download_source.py

echo "Verifying PyTorch -> SavedModel parity..."
"$PYTHON_BIN" test/verify_pytorch_tensorflow.py

echo "Verifying PyTorch -> ONNX parity and Go contract..."
"$PYTHON_BIN" test/verify_onnx.py

echo "Verifying SavedModel -> TensorFlow.js FP16 parity..."
node test/verify_tfjs.mjs

echo "Verifying TensorFlow.js manifest..."
"$PYTHON_BIN" - <<'PY'
import json
from pathlib import Path

path = Path("dist/mgm-main-v4/tfjs/model.json")
with path.open() as f:
    model = json.load(f)
if model.get("format") != "graph-model":
    raise SystemExit("TFJS artifact is not a graph model")
weights = [weight for group in model.get("weightsManifest", []) for weight in group.get("weights", [])]
if not weights:
    raise SystemExit("TFJS artifact has no weights")
bad = [w.get("name", "<unnamed>") for w in weights if w.get("dtype") == "float32" and w.get("quantization", {}).get("dtype") != "float16"]
if bad:
    raise SystemExit(f"TFJS contains non-FP16 floating weights: {bad[:5]}")
PY

echo "Verifying licenses and provenance..."
test -s "$DIST_DIR/MODEL-LICENSE.txt"
test -s "$DIST_DIR/tfjs/LICENSE"
test -s "$DIST_DIR/PROVENANCE.json"
grep -q "MIT License" "$DIST_DIR/MODEL-LICENSE.txt"
grep -q "MGM_MAIN_v4" "$DIST_DIR/PROVENANCE.json"

# Write success only after every executable parity and packaging check passes.
trap - ERR
cat > "$VERIFY_JSON" << 'EOF'
{
  "status": "passed",
  "checks": {
    "checksums": true,
    "source_hashes": true,
    "pytorch_tensorflow_parity": true,
    "pytorch_onnx_parity": true,
    "tfjs_fp16_parity": true,
    "go_onnx_contract": true,
    "tfjs_manifest": true,
    "licenses": true,
    "provenance": true
  }
}
EOF
echo "Verification complete. Results written to $VERIFY_JSON"
