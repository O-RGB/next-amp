#!/usr/bin/env python3
import json
import pathlib
import tempfile
import unittest

import numpy as np

from training.head_only_finetune import load_npz
from training.prepare_stem_examples import load_manifest


class HeadOnlyTrainingToolTests(unittest.TestCase):
    def test_manifest_requires_song_level_stem_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "manifest.json"
            path.write_text(json.dumps([{"id": "missing-stems", "mixture": "x.wav"}]))
            with self.assertRaises(ValueError):
                load_manifest(path)

    def test_training_cache_shape_contract(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "examples.npz"
            arrays = {
                "contexts": np.zeros((1, 1024, 64, 2), dtype=np.float32),
                "target_masks": np.zeros((1, 15, 1024, 2), dtype=np.float32),
                "mixture_real": np.zeros((1, 15, 1024, 2), dtype=np.float32),
                "mixture_imag": np.zeros((1, 15, 1024, 2), dtype=np.float32),
                "instrumental_real": np.zeros((1, 15, 1024, 2), dtype=np.float32),
                "instrumental_imag": np.zeros((1, 15, 1024, 2), dtype=np.float32),
                "vocal_real": np.zeros((1, 15, 1024, 2), dtype=np.float32),
                "vocal_imag": np.zeros((1, 15, 1024, 2), dtype=np.float32),
            }
            np.savez(path, **arrays)
            loaded = load_npz(path)
            self.assertEqual(loaded["contexts"].shape, (1, 1024, 64, 2))


if __name__ == "__main__":
    unittest.main()
