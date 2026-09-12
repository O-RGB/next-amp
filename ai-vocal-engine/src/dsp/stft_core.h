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
#define REFERENCE_SPECTRUM_FRAMES 18
#define REFERENCE_MAG_FRAMES 16
#define REFERENCE_MAG_START_FRAME 2
#define REFERENCE_ROLLING_ADVANCE 15
#define REFERENCE_CHUNK_SAMPLES (REFERENCE_ROLLING_ADVANCE * HOP_SIZE) // 15 * 512 = 7680 samples
#define REFERENCE_INPUT_HISTORY_SAMPLES 512
#define REFERENCE_OUTPUT_OFFSET_SAMPLES 384
#define QUEUE_CAPACITY 4

// B1 candidate: keep the implementation compiled in, but leave it disabled
// until the runtime explicitly supplies a positive floor through the setter.
// This makes the candidate rollback-safe and preserves the current baseline.
#ifndef ENABLE_ATTENUATION_FLOOR
#define ENABLE_ATTENUATION_FLOOR 0
#endif
#ifndef ENABLE_ASYMMETRIC_SMOOTHING
#define ENABLE_ASYMMETRIC_SMOOTHING 0
#endif
#ifndef ENABLE_TRANSIENT_GATE
#define ENABLE_TRANSIENT_GATE 0
#endif

// Initialization
void stft_init(void);

// Buffer Pointers (Zero-Copy Transfer between JS/AudioWorklet and WASM Heap)
float* stft_get_input_ptr(int channel);
float* stft_get_output_ptr(int channel);
float* stft_get_magnitudes_ptr(int channel);
float* stft_get_reference_magnitudes_ptr(int channel);
float* stft_get_mask_ptr(int channel);
float* stft_get_spec_real_ptr(int channel);
float* stft_get_interleaved_mags_ptr(void);
float stft_get_chunk_peak(void);
float* stft_get_norm_input_ptr(void);
float stft_get_rolling_max(void);
void stft_prepare_norm_input(float inv_max);

// Processing steps
void stft_forward(int num_frames);
void stft_forward_reference(void);
void stft_apply_mask(int num_frames, int mode, float strength);
void stft_apply_mask_delayed(int delay_chunks, int num_frames, int mode, float strength);
void stft_backward(int num_frames);
void stft_backward_masked(int delay_chunks, int num_frames, int mode, float strength);
void stft_set_attenuation_floor(float epsilon);
void stft_set_smoothing_alphas(float fast, float slow);
void stft_set_transient_threshold(float threshold);

// Smart Energy Gating / Vocal Activity Detection (VAD)
float stft_get_vocal_energy(int num_frames);

// Reset state (e.g. on seek / pause)
void stft_reset(void);

#ifdef __cplusplus
}
#endif

#endif // STFT_CORE_H
