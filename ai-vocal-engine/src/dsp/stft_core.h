#ifndef STFT_CORE_H
#define STFT_CORE_H

#ifdef __cplusplus
extern "C" {
#endif

#define FFT_SIZE 2048
#define HOP_SIZE 512
#define NUM_BINS 1024
#define MAX_FRAMES 64
#define DEFAULT_CHUNK_FRAMES 16
#define CHUNK_SAMPLES (DEFAULT_CHUNK_FRAMES * HOP_SIZE) // 16 * 512 = 8192 samples
#define QUEUE_CAPACITY 4

// Initialization
void stft_init(void);

// Buffer Pointers (Zero-Copy Transfer between JS/AudioWorklet and WASM Heap)
float* stft_get_input_ptr(int channel);
float* stft_get_output_ptr(int channel);
float* stft_get_magnitudes_ptr(int channel);
float* stft_get_mask_ptr(int channel);
float* stft_get_spec_real_ptr(int channel);
float* stft_get_interleaved_mags_ptr(void);
float stft_get_chunk_peak(void);
float* stft_get_norm_input_ptr(void);
void stft_prepare_norm_input(float inv_max);

// Processing steps
void stft_forward(int num_frames);
void stft_apply_mask(int num_frames, int mode, float strength);
void stft_apply_mask_delayed(int delay_chunks, int num_frames, int mode, float strength);
void stft_backward(int num_frames);

// Smart Energy Gating / Vocal Activity Detection (VAD)
float stft_get_vocal_energy(int num_frames);

// Reset state (e.g. on seek / pause)
void stft_reset(void);

#ifdef __cplusplus
}
#endif

#endif // STFT_CORE_H
