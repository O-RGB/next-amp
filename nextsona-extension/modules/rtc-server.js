export class RTCServer {
  constructor() {
    this.connections = new Map();
  }

  hackSdp(sdp) {
    const opusMapId = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/);
    if (!opusMapId) return sdp;
    const payload = opusMapId[1];
    const fmtpLineRegex = new RegExp(`a=fmtp:${payload} (.*)`);
    const newParams =
      "stereo=1;sprop-stereo=1;maxaveragebitrate=510000;cbr=1;useinbandfec=1";

    if (sdp.match(fmtpLineRegex)) {
      return sdp.replace(fmtpLineRegex, `a=fmtp:${payload} ${newParams}`);
    } else {
      return sdp.replace(
        opusMapId[0],
        `${opusMapId[0]}\r\na=fmtp:${payload} ${newParams}`
      );
    }
  }

  async startSession(sourceTabId, playerTabId, stream, audioCtx) {
    this.stopSession(sourceTabId);

    const pc = new RTCPeerConnection();

    stream.getTracks().forEach((track) => {
      if (track.kind === "audio") track.contentHint = "music";
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        chrome.runtime.sendMessage({
          type: "RTC_CANDIDATE",
          target: "PLAYER",
          playerTabId: playerTabId,
          candidate: event.candidate,
        });
      }
    };

    const dataChannel = pc.createDataChannel("control");
    dataChannel.onmessage = (e) =>
      this.handleControlMessage(sourceTabId, e.data);

    const offer = await pc.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
      voiceActivityDetection: false,
    });

    offer.sdp = this.hackSdp(offer.sdp);
    await pc.setLocalDescription(offer);

    chrome.runtime.sendMessage({
      type: "RTC_OFFER",
      target: "PLAYER",
      playerTabId: playerTabId,
      offer: offer,
    });

    this.connections.set(sourceTabId, { pc, targetPlayerTabId: playerTabId });
  }

  stopSession(sourceTabId) {
    const conn = this.connections.get(sourceTabId);
    if (conn) {
      conn.pc.close();
      this.connections.delete(sourceTabId);
    }
  }

  async handleAnswer(sourceTabId, answer) {
    const conn = this.connections.get(sourceTabId);
    if (conn) {
      await conn.pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async handleCandidate(sourceTabId, candidate) {
    const conn = this.connections.get(sourceTabId);
    if (conn) {
      await conn.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  handleControlMessage(sourceTabId, data) {
    console.log(`Control from ${sourceTabId}:`, data);
  }
}
