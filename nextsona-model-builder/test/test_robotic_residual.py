#!/usr/bin/env python3
import unittest

import numpy as np

from evaluation.robotic_residual import (
    ACTIVE_FRAMES,
    CHUNK_SAMPLES,
    CONTEXT_FRAMES,
    FFT_SIZE,
    HISTORY_SAMPLES,
    MODEL_BINS,
    istft_chunk,
    normalize_model_output,
    render_eco,
    stft_chunk,
)


class RoboticResidualToolTests(unittest.TestCase):
    def test_runtime_stft_contract_and_roundtrip(self):
        rng = np.random.default_rng(20260913)
        samples = rng.normal(0.0, 0.1, size=(HISTORY_SAMPLES + CHUNK_SAMPLES, 2)).astype(np.float32)
        spectrum = stft_chunk(samples)
        self.assertEqual(spectrum.shape, (ACTIVE_FRAMES, MODEL_BINS, 2))
        restored = istft_chunk(spectrum)
        self.assertEqual(restored.shape, (CHUNK_SAMPLES + HISTORY_SAMPLES, 2))
        self.assertTrue(np.isfinite(restored).all())

    def test_full_saved_model_layout_extracts_active_window(self):
        logits = np.zeros((1, MODEL_BINS, CONTEXT_FRAMES, 2), dtype=np.float32)
        logits[:, :, 34:49, :] = 2.0
        mask = normalize_model_output(logits)
        self.assertEqual(mask.shape, (ACTIVE_FRAMES, MODEL_BINS, 2))
        self.assertTrue(np.allclose(mask, 1.0 / (1.0 + np.exp(-2.0))))

    def test_renderer_has_one_chunk_lookahead_and_no_nan(self):
        source = np.zeros((CHUNK_SAMPLES + 123, 2), dtype=np.float32)

        def pass_through(_context, _spectrum):
            return np.ones((ACTIVE_FRAMES, MODEL_BINS, 2), dtype=np.float32)

        result = render_eco(source, pass_through)
        self.assertEqual(result.audio.shape, (2 * CHUNK_SAMPLES, 2))
        self.assertEqual(result.masks.shape, (2, ACTIVE_FRAMES, MODEL_BINS, 2))
        self.assertTrue(np.isfinite(result.audio).all())
        self.assertTrue(np.isfinite(result.masks).all())
        self.assertEqual(result.model_calls, 3)


if __name__ == "__main__":
    unittest.main()
