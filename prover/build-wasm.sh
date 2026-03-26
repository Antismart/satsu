#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "Building Satsu STARK prover to WASM..."
wasm-pack build --target web --out-dir ../circuits/build/wasm --release

echo ""
echo "WASM build complete: circuits/build/wasm/"
ls -la ../circuits/build/wasm/
