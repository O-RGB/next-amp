# NextStudio Copyright and Provenance Audit

> Internal release checklist. This is an engineering provenance audit, not a
> legal opinion. Copyright and contract questions depend on jurisdiction.

## Decision summary

The current Store source no longer contains any file that is byte-identical
to the eight files in the local `ai remove/` reference folder. Runtime and
test code no longer imports or reads that folder. The AI weights have been
identified as the official UVR `MGM_MAIN_v4` model and now ship with explicit
MIT attribution.

It is still incorrect to claim that the project was developed without ever
using `ai remove`: Git history records a copied STFT WASM and an early worker
described as a bit-for-bit reference implementation. Those historical facts
cannot be changed by renaming code.

## Current-tree checks

- [x] Compared SHA-256 of all eight files in `ai remove/` with the current
  source tree; there are no exact matches.
- [x] Removed the two tests that loaded `ai remove/stft.wasm` directly.
- [x] Removed product-specific reference wording from current DSP comments
  without changing DSP calculations.
- [x] Confirmed `ai remove/` is ignored and no file under it is tracked.
- [x] Added a release audit that rejects all eight known reference hashes.
- [x] Added a release audit that rejects direct source reads from
  `ai remove/`.
- [x] Preserved the current custom scalar and SIMD STFT implementations; their
  hashes do not match the reference STFT.
- [x] Confirmed no current PerfectBrain bundle, HTML or helper file is copied
  byte-for-byte into the source tree.
- [x] Documented the model identity, source hashes and verification method.
- [x] Added UVR and tsurumeso attribution to all model copies and Extension
  third-party notices.

## Model-rights assessment

- [x] Active weights were traced to official UVR `MGM_MAIN_v4.pth`.
- [x] UVR documents its project as MIT-licensed and explicitly asks
  third-party apps using UVR models to retain MIT terms and credits.
- [x] The original CascadedASPPNet implementation is MIT-licensed by
  tsurumeso.
- [x] The Store build copies `MODEL-LICENSE.txt` with the model.
- [x] Rebuilt the complete TFJS GraphModel and ONNX model from the official UVR
  download with a checked-in converter and executable parity gates.
- [ ] Ask the UVR maintainers for written confirmation covering commercial
  redistribution of the converted `MGM_MAIN_v4` weights. The public MIT
  statement is strong evidence, but written confirmation is stronger.

## Historical risk

Commit `ac5cbc94d0ddbc7831c97c40de7e5a8877da105c` added an STFT WASM with
SHA-256
`90e0e972dc82bab2b1ddbeb1e04c33ce1e6b1b4522662137b1164d6aed6a37e2`,
which is identical to `ai remove/stft.wasm`. Commit `e34e1678` removed that
binary and replaced it with NextStudio's C-based scalar/SIMD implementation,
but the old object remains reachable in Git history.

- [x] The copied historical WASM is absent from the current Store source and
  Store package.
- [ ] Do not publish or distribute the full Git history in its current form.
- [ ] If the repository must become public, create a backup and perform a
  reviewed history rewrite that removes the copied object, then rotate every
  public clone/reference. This is destructive and must not be done
  automatically.
- [ ] If code-expression similarity is disputed, have an IP lawyer review the
  current DSP implementation and the historical development record. A
  clean-room rewrite based only on public UVR source/specifications is the
  strongest technical remediation.

## Other third-party material

The Extension notice currently covers TensorFlow.js, PeerJS, Signalsmith
Stretch, Tailwind CSS, Phosphor Icons and qrcode-generator. The following
items require owner confirmation before claiming that the whole product is
fully cleared:

- [ ] Confirm in writing that NextFeeder Labs created or owns every logo,
  banner, screenshot and promotional image in `assets/`,
  `next-amp-extension/assets/` and `nextstudio-public-site/assets/images/`.
- [x] Added a Web-build LAMEjs notice with the vendored bundle hash, upstream
  source URL and the LGPL usage conditions; the Chrome Store package does not
  include the MP3 encoder.
- [ ] Confirm the exact upstream lamejs revision of the legacy Web bundle before
  making a legal claim about its precise version; replace it with a verified
  upstream artifact if that provenance cannot be established.
  in the separately shipped web app.
- [ ] Decide whether the NextStudio source is proprietary or open source and
  add a root-level copyright/license notice that reflects that decision.
- [ ] Keep a release evidence archive: source commit, Store ZIP hash,
  third-party notices, upstream URLs, upstream files and their hashes.

## Release rule

The Chrome Store ZIP may be distributed only when:

1. `npm run audit:copyright` passes.
2. The Store artifact verification passes.
3. `MODEL-LICENSE.txt` and `THIRD-PARTY-NOTICES.txt` are present.
4. No file from `ai remove/` is included.
5. Marketing does not claim ownership of UVR, endorsement by UVR, or
   guaranteed separation accuracy.

A report or lawsuit can never be made impossible. These controls reduce the
chance of an accidental infringement and preserve evidence supporting the
project's lawful use of MIT-licensed upstream work.
