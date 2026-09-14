#!/usr/bin/env python3
import unittest

from evaluation.evaluate_candidate import aggregate_clip_results


def row(name, vocal, instrument, spectral=0.0):
    return {
        "id": name,
        "delta_candidate_minus_baseline": {
            "residual_rms_db": vocal,
            "instrumental_reference_si_sdr_db": instrument,
            "multi_resolution_spectral_distance": spectral,
            "stereo_correlation": 0.0,
            "mask_frame_to_frame_mean_abs_delta": 0.0,
        },
    }


class CandidateEvaluatorTests(unittest.TestCase):
    def test_requires_both_vocal_improvement_and_instrument_preservation(self):
        accepted = aggregate_clip_results([row("a", -0.4, 0.0), row("b", -0.35, 0.02)], 0.1, 0.3)
        self.assertTrue(accepted["passed"])

        rejected = aggregate_clip_results([row("a", -0.5, -0.2)], 0.1, 0.3)
        self.assertFalse(rejected["passed"])
        self.assertEqual(rejected["damaged_clips"], ["a"])

    def test_no_improvement_is_rejected(self):
        result = aggregate_clip_results([row("same", 0.0, 0.0)], 0.1, 0.3)
        self.assertFalse(result["checks"]["vocal_improvement"])
        self.assertFalse(result["passed"])


if __name__ == "__main__":
    unittest.main()
