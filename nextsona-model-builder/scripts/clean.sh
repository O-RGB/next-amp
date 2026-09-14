#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Cleaning builder directories..."
rm -rf work/
rm -rf dist/
echo "Clean complete."
