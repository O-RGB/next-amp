package dsp

/*
#cgo CFLAGS: -O3 -ffast-math
#include "stft_core.h"
#include <string.h>
*/
import "C"
import (
	"unsafe"
)

const (
	FFTSize      = 2048
	HopSize      = 512
	NumBins      = 1024
	ChunkFrames  = 16
	ChunkSamples = ChunkFrames * HopSize      // 8192
	TailSamples  = 1536                       // 3 * 512
	TotalInput   = ChunkSamples + TailSamples // 9728
	TotalOutput  = ChunkSamples + TailSamples // 9728
	MaxFrames    = 64
)

type Engine struct {
	inHistoryL  [TailSamples]float32
	inHistoryR  [TailSamples]float32
	outTailL    [TailSamples]float32
	outTailR    [TailSamples]float32
	outBufL     [ChunkSamples]float32
	outBufR     [ChunkSamples]float32
	maxHistory  [4]float32
	maxPos      int
	initialized bool
}

func NewEngine() *Engine {
	C.stft_init()
	e := &Engine{
		maxHistory:  [4]float32{1e-4, 1e-4, 1e-4, 1e-4},
		initialized: true,
	}
	e.Reset()
	return e
}

func (e *Engine) Reset() {
	C.stft_reset()
	for i := range e.inHistoryL {
		e.inHistoryL[i] = 0
		e.inHistoryR[i] = 0
		e.outTailL[i] = 0
		e.outTailR[i] = 0
	}
	for i := range e.outBufL {
		e.outBufL[i] = 0
		e.outBufR[i] = 0
	}
	e.maxHistory = [4]float32{1e-4, 1e-4, 1e-4, 1e-4}
	e.maxPos = 0
}

// StepForward feeds 8192 new samples and computes forward STFT + rolling spectrogram
// Returns a slice of 131,072 normalized floats ready for ONNX input [1, 1024, 64, 2]
func (e *Engine) StepForward(rawL, rawR []float32) []float32 {
	inPtr0 := (*[TotalInput]float32)(unsafe.Pointer(C.stft_get_input_ptr(0)))
	inPtr1 := (*[TotalInput]float32)(unsafe.Pointer(C.stft_get_input_ptr(1)))

	// 1. Sliding input: 1536 history + 8192 current
	copy(inPtr0[0:TailSamples], e.inHistoryL[:])
	copy(inPtr0[TailSamples:TotalInput], rawL)
	copy(e.inHistoryL[:], rawL[ChunkSamples-TailSamples:ChunkSamples])

	copy(inPtr1[0:TailSamples], e.inHistoryR[:])
	copy(inPtr1[TailSamples:TotalInput], rawR)
	copy(e.inHistoryR[:], rawR[ChunkSamples-TailSamples:ChunkSamples])

	// 2. Forward STFT
	C.stft_forward(C.int(ChunkFrames))

	// 3. Peak tracking (zero-allocation ring buffer)
	chunkPeak := float32(C.stft_get_chunk_peak())
	e.maxHistory[e.maxPos] = chunkPeak
	e.maxPos = (e.maxPos + 1) & 3

	globalMax := float32(1e-4)
	for _, v := range e.maxHistory {
		if v > globalMax {
			globalMax = v
		}
	}
	invMax := 1.0 / globalMax

	// 4. Prepare norm input [1024][64][2] (131,072 floats)
	C.stft_prepare_norm_input(C.float(invMax))
	normPtr := (*[NumBins * MaxFrames * 2]float32)(unsafe.Pointer(C.stft_get_norm_input_ptr()))
	return normPtr[:]
}

// StepBackward applies the neural network output, inverse STFTs, and overlap-adds
// outData: raw ONNX output of shape [1, 1024, 64, 2] (131,072 floats)
// mode: 0=bypass, 1=karaoke, 2=acapella (wire protocol values)
// delayChunks: 0 for instant zero-delay real-time, 1 for 1-chunk lookahead
func (e *Engine) StepBackward(rawOutput []float32, delayChunks int, mode int, strength float32) ([]float32, []float32) {
	sliceStart := 48 - (16 * delayChunks)
	if sliceStart < 0 || sliceStart > 48 {
		sliceStart = 48
	}

	// Fast C SIMD Sigmoid extraction (0.04ms)
	C.stft_extract_sigmoid_mask((*C.float)(unsafe.Pointer(&rawOutput[0])), C.int(sliceStart))

	// The model outputs the accompaniment/instrumental mask. Keep this mapping
	// identical to the app's WASM path: Karaoke applies that mask (native mode 1)
	// while Acapella applies its complement (native mode 0).
	cMode := 2 // native mode 2 = bypass for invalid/bypass protocol values
	switch mode {
	case 1: // Karaoke: keep accompaniment, remove vocals.
		cMode = 1
	case 2: // Acapella: keep vocals, remove accompaniment.
		cMode = 0
	}
	if delayChunks == 0 {
		C.stft_apply_mask(C.int(ChunkFrames), C.int(cMode), C.float(strength))
	} else {
		C.stft_apply_mask_delayed(C.int(delayChunks), C.int(ChunkFrames), C.int(cMode), C.float(strength))
	}

	// Backward iSTFT
	C.stft_backward(C.int(ChunkFrames))

	outPtr0 := (*[TotalOutput]float32)(unsafe.Pointer(C.stft_get_output_ptr(0)))
	outPtr1 := (*[TotalOutput]float32)(unsafe.Pointer(C.stft_get_output_ptr(1)))

	// Zero-allocation Overlap-Add: reuse preallocated outBufL and outBufR
	for i := 0; i < TailSamples; i++ {
		e.outBufL[i] = outPtr0[i] + e.outTailL[i]
		e.outBufR[i] = outPtr1[i] + e.outTailR[i]
	}
	copy(e.outBufL[TailSamples:], outPtr0[TailSamples:ChunkSamples])
	copy(e.outBufR[TailSamples:], outPtr1[TailSamples:ChunkSamples])

	// Save tail for next chunk
	copy(e.outTailL[:], outPtr0[ChunkSamples:TotalOutput])
	copy(e.outTailR[:], outPtr1[ChunkSamples:TotalOutput])

	return e.outBufL[:], e.outBufR[:]
}
