# NextAmp AI Vocal Engine

Ultra-lightweight, high-performance real-time AI Vocal Remover and Stem Separation engine for NextAmp.

## Directory Structure

```
ai-vocal-engine/
├── build.sh                     # Automated build & sync script
├── dist/                        # Compiled WASM binaries
│   ├── stft_simd.wasm          # 14 KB (SIMD128 accelerated)
│   └── stft_scalar.wasm        # 13 KB (Fallback for non-SIMD devices)
├── src/
│   ├── dsp/                     # C++ / C Real-Time DSP Core
│   │   ├── stft_core.c          # Radix-2 Real FFT, Hann Windowing, Overlap-Add
│   │   └── stft_core.h
│   ├── model/                   # Model conversion & ONNX export scripts
│   └── runtime/                 # Web Audio runtime modules
│       ├── vocal-processor.worklet.js   # AudioWorkletProcessor
│       └── vocal-separator.js           # High-level controller
└── test/
    └── test_wasm_dsp.js         # Automated mathematical verification & benchmark
```

## Quick Start / Build

Run the automated build script:
```bash
./build.sh
```

This will:
1. Compile `stft_core.c` with Emscripten (`-O3 -msimd128 -flto`).
2. Generate `stft_simd.wasm` (14 KB) and `stft_scalar.wasm` (13 KB).
3. Automatically synchronize build artifacts directly into `next-amp-extension/modules/ai-vocal/`.
4. Run automated unit tests verifying SNR reconstruction (> 130 dB) and speed benchmarks (> 70x real-time).
