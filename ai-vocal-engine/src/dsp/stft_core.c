#include "stft_core.h"
#include <math.h>
#include <string.h>
#include <stdlib.h>

#if defined(__wasm_simd128__)
#include <wasm_simd128.h>
#define USE_SIMD 1
#else
#define USE_SIMD 0
#endif

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// Precomputed tables
static float g_window[FFT_SIZE];
static unsigned short g_bit_reverse[FFT_SIZE];
static float g_twiddle_cos[FFT_SIZE / 2];
static float g_twiddle_sin[FFT_SIZE / 2];
static int g_initialized = 0;

// Internal Ring Buffers (Stereo: 2 channels)
// We need FFT_SIZE + CHUNK_SAMPLES of history to slide
#define BUFFER_CAPACITY (FFT_SIZE + (MAX_FRAMES * HOP_SIZE))

static float g_input_pcm[2][BUFFER_CAPACITY];
static float g_output_pcm[2][BUFFER_CAPACITY];
static int g_input_write_pos = 0;
static int g_output_read_pos = 0;

// Frame Magnitudes: [2 channels][MAX_FRAMES][NUM_BINS]
static float g_magnitudes[2][MAX_FRAMES * NUM_BINS];

// Mask from Neural Network: [2 channels][MAX_FRAMES][NUM_BINS]
static float g_mask[2][MAX_FRAMES * NUM_BINS];

// Complex Spectrum Storage: [2 channels][MAX_FRAMES][FFT_SIZE] (real and imag)
static float g_spec_real[2][MAX_FRAMES][NUM_BINS];
static float g_spec_imag[2][MAX_FRAMES][NUM_BINS];

// Working buffer for in-place FFT
static float g_work_real[FFT_SIZE];
static float g_work_imag[FFT_SIZE];

// Bit-reversal helper
static unsigned short reverse_bits(unsigned short x, int bits) {
    unsigned short y = 0;
    for (int i = 0; i < bits; i++) {
        y = (y << 1) | (x & 1);
        x >>= 1;
    }
    return y;
}

// In-place Radix-2 Complex FFT
static void fft_radix2(float* real, float* imag, int n, int inverse) {
    // 1. Bit-reversal permutation
    for (int i = 0; i < n; i++) {
        int j = g_bit_reverse[i];
        if (i < j) {
            float tr = real[i]; real[i] = real[j]; real[j] = tr;
            float ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
        }
    }

    // 2. Cooley-Tukey Butterflies
    for (int len = 2; len <= n; len <<= 1) {
        int half_len = len >> 1;
        int step = n / len;
        float sign = inverse ? 1.0f : -1.0f;

        for (int i = 0; i < n; i += len) {
            for (int j = 0; j < half_len; j++) {
                int twiddle_idx = j * step;
                float wr = g_twiddle_cos[twiddle_idx];
                float wi = sign * g_twiddle_sin[twiddle_idx];

                int u_idx = i + j;
                int v_idx = i + j + half_len;

                float vr = real[v_idx] * wr - imag[v_idx] * wi;
                float vi = real[v_idx] * wi + imag[v_idx] * wr;

                float ur = real[u_idx];
                float ui = imag[u_idx];

                real[u_idx] = ur + vr;
                imag[u_idx] = ui + vi;
                real[v_idx] = ur - vr;
                imag[v_idx] = ui - vi;
            }
        }
    }

    // 3. Scale on inverse
    if (inverse) {
        float inv_n = 1.0f / (float)n;
#if USE_SIMD
        v128_t scale_vec = wasm_f32x4_splat(inv_n);
        for (int i = 0; i < n; i += 4) {
            wasm_v128_store(&real[i], wasm_f32x4_mul(wasm_v128_load(&real[i]), scale_vec));
            wasm_v128_store(&imag[i], wasm_f32x4_mul(wasm_v128_load(&imag[i]), scale_vec));
        }
#else
        for (int i = 0; i < n; i++) {
            real[i] *= inv_n;
            imag[i] *= inv_n;
        }
#endif
    }
}

void stft_init(void) {
    if (g_initialized) return;

    // 1. Bit-reversal table for N=2048 (11 bits: 2^11 = 2048)
    for (int i = 0; i < FFT_SIZE; i++) {
        g_bit_reverse[i] = reverse_bits(i, 11);
    }

    // 2. Twiddle factor table (cos, sin)
    for (int i = 0; i < FFT_SIZE / 2; i++) {
        double angle = 2.0 * M_PI * (double)i / (double)FFT_SIZE;
        g_twiddle_cos[i] = (float)cos(angle);
        g_twiddle_sin[i] = (float)sin(angle);
    }

    // For 75% overlap (N=2048, HOP=512), sum(hann) = 2.0.
    // Analysis window = sqrt(hann) / sqrt(2.0), Synthesis window = sqrt(hann) / sqrt(2.0).
    // The product win_analysis * win_synthesis = hann / 2.0, so sum(win_a * win_s) = 2.0 / 2.0 = 1.0000000!
    float norm_factor = 1.0f / sqrtf(2.0f);
    for (int i = 0; i < FFT_SIZE; i++) {
        float hann = 0.5f * (1.0f - cosf(2.0f * (float)M_PI * (float)i / (float)FFT_SIZE));
        g_window[i] = sqrtf(hann) * norm_factor;
    }

    stft_reset();
    g_initialized = 1;
}

void stft_reset(void) {
    memset(g_input_pcm, 0, sizeof(g_input_pcm));
    memset(g_output_pcm, 0, sizeof(g_output_pcm));
    memset(g_magnitudes, 0, sizeof(g_magnitudes));
    memset(g_mask, 0, sizeof(g_mask));
    memset(g_spec_real, 0, sizeof(g_spec_real));
    memset(g_spec_imag, 0, sizeof(g_spec_imag));
}

float* stft_get_input_ptr(int ch) {
    if (ch < 0 || ch > 1) return NULL;
    return g_input_pcm[ch];
}

float* stft_get_output_ptr(int ch) {
    if (ch < 0 || ch > 1) return NULL;
    return g_output_pcm[ch];
}

float* stft_get_magnitudes_ptr(int ch) {
    if (ch < 0 || ch > 1) return NULL;
    return g_magnitudes[ch];
}

float* stft_get_mask_ptr(int ch) {
    if (ch < 0 || ch > 1) return NULL;
    return g_mask[ch];
}

void stft_forward(int num_frames) {
    if (num_frames <= 0 || num_frames > MAX_FRAMES) num_frames = DEFAULT_CHUNK_FRAMES;

    for (int ch = 0; ch < 2; ch++) {
        for (int f = 0; f < num_frames; f++) {
            int offset = f * HOP_SIZE;

            // Apply analysis window
#if USE_SIMD
            for (int i = 0; i < FFT_SIZE; i += 4) {
                v128_t pcm = wasm_v128_load(&g_input_pcm[ch][offset + i]);
                v128_t win = wasm_v128_load(&g_window[i]);
                wasm_v128_store(&g_work_real[i], wasm_f32x4_mul(pcm, win));
                wasm_v128_store(&g_work_imag[i], wasm_f32x4_splat(0.0f));
            }
#else
            for (int i = 0; i < FFT_SIZE; i++) {
                g_work_real[i] = g_input_pcm[ch][offset + i] * g_window[i];
                g_work_imag[i] = 0.0f;
            }
#endif

            // Run forward FFT
            fft_radix2(g_work_real, g_work_imag, FFT_SIZE, 0);

            // Store complex spectrum and compute magnitudes for first 1024 bins
            float* mag_out = &g_magnitudes[ch][f * NUM_BINS];
            for (int k = 0; k < NUM_BINS; k++) {
                float r = g_work_real[k];
                float im = g_work_imag[k];
                g_spec_real[ch][f][k] = r;
                g_spec_imag[ch][f][k] = im;
                mag_out[k] = sqrtf(r * r + im * im + 1e-9f);
            }
        }
    }
}

void stft_apply_mask(int num_frames, int mode, float strength) {
    if (num_frames <= 0 || num_frames > MAX_FRAMES) num_frames = DEFAULT_CHUNK_FRAMES;
    if (strength < 0.0f) strength = 0.0f;
    if (strength > 1.0f) strength = 1.0f;

    for (int ch = 0; ch < 2; ch++) {
        for (int f = 0; f < num_frames; f++) {
            float* m = &g_mask[ch][f * NUM_BINS];
            float* sr = g_spec_real[ch][f];
            float* si = g_spec_imag[ch][f];

            for (int k = 0; k < NUM_BINS; k++) {
                float mask_val = m[k];
                float gain = 1.0f;

                if (mode == 0) {
                    // Karaoke / Vocal Remover: Multiply by (1.0 - mask * strength)
                    gain = 1.0f - (mask_val * strength);
                    if (gain < 0.0f) gain = 0.0f;
                } else if (mode == 1) {
                    // Acapella / Vocal Isolation: Multiply by (mask * strength)
                    gain = mask_val * strength;
                } else {
                    // Bypass
                    gain = 1.0f;
                }

                sr[k] *= gain;
                si[k] *= gain;
            }
        }
    }
}

void stft_backward(int num_frames) {
    if (num_frames <= 0 || num_frames > MAX_FRAMES) num_frames = DEFAULT_CHUNK_FRAMES;

    int total_output_samples = (num_frames * HOP_SIZE) + (FFT_SIZE - HOP_SIZE);
    for (int ch = 0; ch < 2; ch++) {
        memset(g_output_pcm[ch], 0, total_output_samples * sizeof(float));
    }

    for (int ch = 0; ch < 2; ch++) {
        for (int f = 0; f < num_frames; f++) {
            // Reconstruct conjugate symmetric spectrum for real iFFT
            float* sr = g_spec_real[ch][f];
            float* si = g_spec_imag[ch][f];

            // DC and positive frequencies (0 to 1023)
            for (int k = 0; k < NUM_BINS; k++) {
                g_work_real[k] = sr[k];
                g_work_imag[k] = si[k];
            }
            // Nyquist bin (k = 1024)
            g_work_real[NUM_BINS] = 0.0f;
            g_work_imag[NUM_BINS] = 0.0f;

            // Conjugate symmetry for negative frequencies (1025 to 2047)
            for (int k = 1; k < NUM_BINS; k++) {
                g_work_real[FFT_SIZE - k] = sr[k];
                g_work_imag[FFT_SIZE - k] = -si[k];
            }

            // Run inverse FFT
            fft_radix2(g_work_real, g_work_imag, FFT_SIZE, 1);

            // Apply synthesis window and overlap-add into output buffer
            int offset = f * HOP_SIZE;
#if USE_SIMD
            for (int i = 0; i < FFT_SIZE; i += 4) {
                v128_t ifft = wasm_v128_load(&g_work_real[i]);
                v128_t win = wasm_v128_load(&g_window[i]);
                v128_t out = wasm_v128_load(&g_output_pcm[ch][offset + i]);
                v128_t synth = wasm_f32x4_add(out, wasm_f32x4_mul(ifft, win));
                wasm_v128_store(&g_output_pcm[ch][offset + i], synth);
            }
#else
            for (int i = 0; i < FFT_SIZE; i++) {
                g_output_pcm[ch][offset + i] += g_work_real[i] * g_window[i];
            }
#endif
        }
    }
}
