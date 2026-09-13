#!/usr/bin/env python3
"""Serialize TFJS metadata deterministically without changing graph meaning."""

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("model_json", type=Path)
    args = parser.parse_args()

    with args.model_json.open() as source:
        model = json.load(source)
    with args.model_json.open("w") as destination:
        json.dump(model, destination, sort_keys=True, separators=(",", ":"))
        destination.write("\n")


if __name__ == "__main__":
    main()
