#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

DIST_DIR="dist/mgm-main-v4"
VERIFY_JSON="$DIST_DIR/VERIFICATION.json"
TARGET_EXT="../next-amp-extension/model"
TARGET_GO="../nextstudio-engine-go/model.onnx"
PYTHON_BIN="${NEXTSTUDIO_MODEL_PYTHON:-.venv/bin/python3}"

echo "Checking verification status..."
if [[ ! -f "$VERIFY_JSON" ]]; then
    echo "Error: VERIFICATION.json not found. Run verify.sh first."
    exit 1
fi

if ! "$PYTHON_BIN" -c 'import json,sys; sys.exit(0 if json.load(open(sys.argv[1])).get("status") == "passed" else 1)' "$VERIFY_JSON"; then
    echo "Error: Verification failed. Aborting deployment."
    exit 1
fi

echo "Rechecking artifact checksums..."
(cd "$DIST_DIR" && shasum -a 256 -c SHA256SUMS)

if [[ -d "../nextstudio-engine-go" ]]; then
    echo "Deploying and packing Go Engine model ($TARGET_GO)..."
    GO_BACKUP="$(mktemp -d "../nextstudio-engine-go/.model-deploy-backup.XXXXXX")"
    cp "$TARGET_GO" "$GO_BACKUP/model.onnx" 2>/dev/null || true
    cp "../nextstudio-engine-go/assets/model.enc" "$GO_BACKUP/model.enc" 2>/dev/null || true
    cp "../nextstudio-engine-go/key_gen.go" "$GO_BACKUP/key_gen.go" 2>/dev/null || true
    cp "../nextstudio-engine-go/MODEL-LICENSE.txt" "$GO_BACKUP/MODEL-LICENSE.txt" 2>/dev/null || true
    if ! cp "$DIST_DIR/onnx/model.onnx" "$TARGET_GO" ||
       ! cp "$DIST_DIR/MODEL-LICENSE.txt" "../nextstudio-engine-go/MODEL-LICENSE.txt" ||
       ! (cd ../nextstudio-engine-go && go run packer/pack.go); then
        echo "Error: Go model packing failed; restoring previous Go assets."
        cp "$GO_BACKUP/model.onnx" "$TARGET_GO" 2>/dev/null || true
        cp "$GO_BACKUP/model.enc" "../nextstudio-engine-go/assets/model.enc" 2>/dev/null || true
        cp "$GO_BACKUP/key_gen.go" "../nextstudio-engine-go/key_gen.go" 2>/dev/null || true
        cp "$GO_BACKUP/MODEL-LICENSE.txt" "../nextstudio-engine-go/MODEL-LICENSE.txt" 2>/dev/null || true
        rm -rf "$GO_BACKUP"
        exit 1
    fi
    rm -rf "$GO_BACKUP"
fi

echo "Deploying to Extension ($TARGET_EXT)..."
EXT_STAGE="$(mktemp -d "../next-amp-extension/.model-deploy-stage.XXXXXX")"
EXT_BACKUP="$(mktemp -d "../next-amp-extension/.model-deploy-backup.XXXXXX")"
rmdir "$EXT_BACKUP"
cp "$DIST_DIR/tfjs/model.json" "$EXT_STAGE/"
cp "$DIST_DIR/tfjs/group1-shard1of1.bin" "$EXT_STAGE/"
cp "$DIST_DIR/tfjs/LICENSE" "$EXT_STAGE/"
if [[ -d "$TARGET_EXT" ]]; then
    mv "$TARGET_EXT" "$EXT_BACKUP"
fi
if ! mv "$EXT_STAGE" "$TARGET_EXT"; then
    echo "Error: Extension model swap failed; restoring previous model."
    if [[ -d "$EXT_BACKUP" ]]; then mv "$EXT_BACKUP" "$TARGET_EXT"; fi
    exit 1
fi
rm -rf "$EXT_BACKUP"

echo "Deployment complete."
