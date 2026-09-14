# NextSona Chrome Web Store Dashboard Inputs

Copy the values below into the Chrome Web Store Dashboard for the Store ZIP.
This file is an input sheet; it does not replace the required dashboard
submission or the manual clean-profile tests.

## Privacy policy

`https://studio.nextfeeder.com/privacy`

## Single purpose

NextSona is a browser audio practice tool for the media tab selected by the
user. It provides pitch, effects, optional AI vocal modes, recording, video
synchronization and data-only Remote control for that same audio practice
workflow.

## Permissions justification

- `tabCapture`: capture audio from the tab selected by the user after the user
  turns Audio on, so pitch, effects, AI Vocal and recording can work.
- `offscreen`: keep the user-started Web Audio graph and processing alive after
  the popup closes.
- `activeTab`: temporarily access only the tab where the user clicked the
  Extension action.
- `scripting`: inject video synchronization and in-page status UI only into
  the active tab after the user action.
- `storage`: save preferences, disclosure consent, session state and coarse
  local usage counters used to limit the optional donation prompt. Recordings
  are stored separately in local IndexedDB.

## Data disclosure wording

The Extension may handle audio/media content from the user-selected tab,
locally stored recordings, preferences and local session state. Audio and AI
processing are performed locally in the Extension during normal operation.
The Extension does not sell this information or use it for personalized
advertising.

Remote sends validated control data such as volume, pitch, vocal mode, EQ and
video timing. It does not send an audio stream. Remote connection setup uses
PeerJS Cloud signaling and WebRTC services; those services may receive normal
technical connection metadata such as IP address and timing under their own
policies. The privacy policy identifies these services.

## Reviewer notes

```text
NextSona has one user-facing purpose: real-time audio practice and media
synchronization for a tab selected by the user.

To test:
1. Open a tab containing playing audio.
2. Click the NextSona toolbar action.
3. Read the one-time audio disclosure and click Continue.
4. Use Pitch/EQ/Reverb, or enable AI Vocal and select Karaoke/Acapella.
5. Video controls are injected only into the active tab after the toolbar
   action is clicked.
6. For Remote, keep Audio active, click Remote, then open the generated HTTPS
   URL on a second device. Remote sends control data only; it does not carry
   the audio stream.

All model, TensorFlow.js, WASM, worklet and QR-generator files used by the
Store build are packaged locally. The extension does not fetch or execute
remote code. Optional donations do not unlock features.
```

## Final submission checks

- Upload only `dist/nextsona-extension-store.zip`.
- Do not upload `dist/nextsona-extension-go-dev.zip`.
- Use the exact listing text in `CHROME-WEB-STORE-DESCRIPTION.md`.
- Use screenshots taken from the same Store build, without Go/native or hidden
  development controls.
- Confirm the developer identity, support email, privacy contact and legal
  business details in the Dashboard before submitting.
