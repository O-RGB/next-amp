# NextStudio — Chrome Web Store Reviewer Audit

วันที่ตรวจ: 13 กันยายน 2026
ขอบเขต: Chrome Web Store build (`dist/nextstudio-extension-store.zip`) และข้อมูลสาธารณะที่เกี่ยวข้อง
สถานะ: **ยังไม่ควรส่ง Review จนกว่า P0 checklist ด้านล่างจะครบ**

> ไม่มีใครรับประกันผลการ Review ได้ 100% เพราะ Google เป็นผู้ตัดสินขั้นสุดท้าย แต่รายการนี้แยก policy blocker, ความเสี่ยง และงาน Dashboard เพื่อไม่ให้ส่งงานทั้งที่ยังรู้อยู่แล้วว่ามีจุดผิด

## สรุปแบบ Reviewer

ก่อน audit รอบนี้ Store build มีความเสี่ยงสูงต่อการไม่ผ่านจาก obfuscation, anti-debug/security WASM, executable WASM ที่เข้ารหัส, permission กว้าง, Remote UI ที่ส่ง executable code, Remote token ที่เดาง่าย และบริการ QR ภายนอกที่ได้รับ URL พร้อม token

ความเสี่ยงเดิมหลายข้อถูกแก้ใน working tree แล้ว และรอบนี้แก้ blocker ด้าน source/artifact เพิ่มเติมพร้อมตรวจซ้ำแล้ว ได้แก่ การขอไมโครโฟนจากหน้า OUT, การเปิด PeerJS signaling ก่อนผู้ใช้กด Remote, inline event handler ที่ผิด CSP, Chrome version compatibility, Remote token/privacy mismatch, privacy/listing copy, runtime Tailwind, dependency lock, dead Remote payload, CSP wildcard และ certificate hygiene อย่างไรก็ตามยังห้ามส่ง Review จนกว่า clean-install test ใน Chrome, long-run test, production deploy และ Dashboard จะผ่านจริง

## วิธีใช้เอกสารนี้

ไฟล์นี้เป็น checklist หลักสำหรับ Store release รอบปัจจุบัน เอกสาร Store plan รุ่นเก่าเป็นประวัติการวางแผนและมี checkbox ที่ไม่ได้อัปเดตหลายจุด ห้ามนำจำนวน checkbox จากไฟล์เก่ามาตัดสินว่า release พร้อมหรือไม่

สำหรับ AI/ผู้พัฒนาที่รับช่วงแก้:

1. ทำหัวข้อ `P0-A` ถึง `P0-H` ตามลำดับ ห้ามข้ามหัวข้อ
2. ห้ามแก้ AI model, STFT, vocal worklet, overlap, F16, context frames หรือ audio-quality parameters งานรอบนี้เป็น Store/privacy/runtime hardening เท่านั้น
3. ห้ามนำ Go adapter, localhost CSP หรือ Go UI กลับเข้า Store profile
4. ห้ามลบหรือย้อนงานอื่นใน working tree เพราะ repository อาจมีงานของผู้ใช้ที่ยังไม่ได้ commit
5. หลังแก้แต่ละหัวข้อ ให้รัน test ที่ระบุ แต่ยังไม่ mark `[x]` ถ้ายังไม่ได้ทดสอบ acceptance criteria จริง
6. ห้าม commit หรือ deploy จนกว่าผู้ใช้จะสั่ง หากผู้ใช้สั่ง commit ให้ commit เป็นกลุ่มที่อธิบายได้ ไม่รวมไฟล์ที่ไม่เกี่ยวข้อง

## P0 implementation handoff — รายละเอียดที่ต้องแก้

### P0-A — สร้าง baseline และป้องกันการแก้ผิดส่วน

เป้าหมาย: ยืนยันว่าเริ่มจาก Store profile ที่ถูกต้อง และทำให้การแก้ policy ไม่กระทบคุณภาพเสียง

ไฟล์ที่เกี่ยวข้อง:

- `package.json`
- `scripts/build-prod.js`
- `scripts/verify-extension-artifact.js`
- `scripts/test-review-readiness.mjs`
- `dist/nextstudio-extension-store/`

ขั้นตอน:

- [x] รัน `git status --short` และจดรายการไฟล์เดิมที่ dirty ไว้ ห้าม restore/reset ไฟล์ของผู้ใช้
- [x] รัน `npm run test:review`
- [x] รัน `node scripts/verify-extension-artifact.js --profile=store`
- [x] บันทึก SHA-256 ของ ZIP ก่อนแก้เพื่อใช้ยืนยันว่า artifact เปลี่ยนเฉพาะหลัง rebuild
- [x] ตรวจ Store manifest ว่ามี permission เท่ากับ `tabCapture`, `offscreen`, `activeTab`, `scripting`, `storage` เท่านั้น
- [x] ตรวจว่า Store artifact ไม่มี Go binary, Go adapter, `go_native`, localhost/127.0.0.1 endpoint, encrypted `.dat`, remote JavaScript URL หรือ security/anti-debug module

ห้ามทำ:

- ห้ามใช้ `git reset --hard`, `git checkout -- .` หรือคำสั่งที่ล้างงานเดิม
- ห้ามใช้ Go development ZIP เป็น baseline
- ห้ามสรุปว่า manual behavior ผ่านเพียงเพราะ script จบด้วยข้อความ `passed`

ผ่านเมื่อ: baseline commands ผ่าน และทราบชัดว่าไฟล์ใด dirty อยู่ก่อนเริ่มงาน

Baseline ก่อน cleanup/P1 hardening: `07883050ad73ac1aaa29ac6b37796e244d07bc96a38c73e34f79d2f30bdce60d`

### P0-B — เอาการขอไมโครโฟนออกจากหน้า OUT

ปัญหา: `next-amp-extension/player.js` ใน `initAudioDevices()` เรียก `navigator.mediaDevices.getUserMedia({ audio: true })` ตอนเปิดหน้า OUT แม้ NextStudio ต้องใช้เสียงจากแท็บ ไม่ใช่ไมโครโฟน และ MediaStream ที่ได้มาไม่ได้หยุด track อย่างชัดเจน

พฤติกรรมที่ต้องการ:

- หน้า OUT ต้องเล่น stream ที่ Extension ส่งมาได้
- ผู้ใช้ยังเลือก output device ได้ผ่าน `enumerateDevices()`/`setSinkId()` เมื่อ browser รองรับ
- ห้ามเปิด microphone permission prompt และห้ามทำให้ browser แสดงว่าไมโครโฟนกำลังถูกใช้
- ถ้าชื่อ output device อ่านไม่ได้ ให้แสดงชื่อกลาง เช่น `OUTPUT DEVICE 1`; ห้ามขอไมค์เพียงเพื่อปลดล็อก label

ขั้นตอน:

- [x] เปิด `next-amp-extension/player.js`
- [x] ใน `initAudioDevices()` ลบเฉพาะคำสั่ง `navigator.mediaDevices.getUserMedia({ audio: true })`
- [x] คง `navigator.mediaDevices.enumerateDevices()` และ logic สร้าง `<option>` ไว้
- [x] ทำ fallback เมื่อ `enumerateDevices()` fail หรือไม่มี label โดยยังเหลือ `SYSTEM DEFAULT`
- [x] อย่าแก้ `getUserMedia()` ใน `next-amp-extension/offscreen.js`; จุดนั้นใช้ `streamId` จาก `tabCapture` และจำเป็นต่อ core audio
- [x] เพิ่ม artifact test ให้ fail ถ้า packaged `player.js` มี `getUserMedia(`

ทดสอบอัตโนมัติ:

- [x] Build Store ใหม่ แล้วตรวจ `dist/nextstudio-extension-store/player.js`
- [x] `rg -n "getUserMedia" next-amp-extension/player.js dist/nextstudio-extension-store/player.js` ต้องไม่พบผลลัพธ์

ทดสอบจริง:

- [ ] เปิด OUT โดยยังไม่เคยให้สิทธิ์ไมโครโฟน เว็บไซต์ต้องไม่ถาม permission
- [ ] ตรวจ `chrome://settings/content/microphone`/permission indicator ว่า Extension ไม่ได้ใช้ไมค์
- [ ] SYSTEM DEFAULT เล่นเสียงได้ และการเลือก output device ทำงานเมื่อ `setSinkId` รองรับ

ผ่านเมื่อ: หน้า OUT ทำงานโดยไม่มี microphone permission หรือ live microphone track

### P0-C — เปิด PeerJS เฉพาะเมื่อผู้ใช้กด Remote

ปัญหา: `next-amp-extension/offscreen.js` เรียก `initHostPeer()` ใน handler ของ `START_CAPTURE` ทำให้เปิด signaling connection ทันทีเมื่อผู้ใช้เปิด Audio แม้ไม่เคยกด Remote

พฤติกรรมที่ต้องการ:

- Audio, Pitch, EQ, AI Vocal และ Recording ต้องไม่ติดต่อ PeerJS
- PeerJS เริ่มเชื่อมต่อหลัง user gesture ที่ปุ่ม Remote เท่านั้น
- การเปิด Remote ครั้งแรกยังแสดง loading และ retry ได้เหมือนเดิม
- หลังเคยเปิด Remote สามารถปิด/reopen popup และใช้ URL เดิมได้ตราบใดที่ audio session เดิมยังอยู่
- เมื่อ audio session เจ้าของ token ถูกหยุด/Exit/ปิด source tab token ต้องใช้ไม่ได้ทันที

ขั้นตอน:

- [x] เปิด `next-amp-extension/offscreen.js`
- [x] ลบเฉพาะ `initHostPeer().catch(() => {});` ออกจาก branch `msg.type === "START_CAPTURE"`
- [x] คง `waitForHostPeerId()` ใน branch `GET_REMOTE_TOKEN`; ฟังก์ชันนี้ต้องเป็นจุดเริ่ม PeerJS เมื่อ popup ขอ Remote token
- [x] ตรวจ source ว่ากด Remote ตอน offscreen เพิ่งเริ่มยังใช้ retry/timeout path เดิมได้ และไม่มี promise เก่าถูกเก็บค้าง
- [x] เพิ่ม helper สำหรับ destroy `hostPeer` เมื่อไม่มี session ใดมี `remoteToken` เหลือ เรียกหลัง `sessions.delete(tabId)` ใน `stopAudio()`
- [x] helper ต้อง close/destroy peer, ตั้ง `hostPeer = null`, `hostPeerId = null`, `hostPeerReadyPromise = null`; ห้าม destroy ขณะที่ session อื่นยังใช้ Remote
- [x] อย่าลบ PeerJS library, Remote UI หรือ `GET_REMOTE_TOKEN` เพราะ Remote ยังเป็นฟีเจอร์ของ Store

ทดสอบอัตโนมัติ:

- [x] เพิ่ม test ตรวจว่า branch `START_CAPTURE` ไม่เรียก `initHostPeer`
- [x] เพิ่ม test/inspection ว่า `GET_REMOTE_TOKEN` ยังเรียก `waitForHostPeerId`

ทดสอบจริง:

- [ ] เปิด DevTools Network ของ offscreen document แล้วเปิด Audio/AI โดยไม่กด Remote ต้องไม่มี request/WebSocket ไป PeerJS
- [ ] กด Remote แล้วจึงต้องเห็น signaling connection และ QR ต้องสร้างสำเร็จ
- [ ] ปิด/reopen popup ระหว่าง audio session เดิม ต้องใช้ Remote URL เดิมได้
- [ ] กด Exit/Audio OFF แล้ว URL เดิมต้อง handshake ไม่ผ่าน

ผ่านเมื่อ: PeerJS ไม่มี network activity ก่อนกด Remote และ cleanup ถูกต้องเมื่อ session จบ

### P0-D — กำหนด lifecycle ของ Remote token ให้ชัดและให้ Privacy ตรงกับโค้ด

ข้อกำหนดรอบนี้: ใช้ **session-scoped token** ไม่ใช่ time-based TTL เพื่อรักษาพฤติกรรม reconnect ที่ผู้ใช้ต้องการ

นิยามที่ต้องใช้ทั้งโค้ดและเอกสาร:

- token ถูกสร้างครั้งแรกเมื่อผู้ใช้กด Remote ใน audio session นั้น
- token อยู่ต่อเมื่อปิด popup, ปิด QR overlay หรือ Remote หลุดชั่วคราว
- token ใช้ซ้ำได้เฉพาะขณะที่ audio session เจ้าของ token ยังอยู่
- token หมดผลทันทีเมื่อ Audio OFF/Exit Extension/source tab ปิด/offscreen session ถูก destroy
- URL/token อาจอยู่ใน `chrome.storage.session` เพื่อ reopen popup แต่ต้องลบ cache ของ tab เมื่อ session จบ
- token ห้ามอยู่ใน `localStorage`, analytics, console production หรือ URL query; ใช้ URL fragment เท่านั้น

ขั้นตอน:

- [x] ตรวจ `offscreen.js` ว่า `mapConnectionToSession()` ยอมรับ token เฉพาะ session ที่ยังอยู่ใน `sessions`
- [x] ใน cleanup ของ `stopAudio(tabId)` ให้ปิด `remoteConns`, delete session และทำให้ token เดิมใช้ต่อไม่ได้
- [x] เพิ่ม helper เพื่อลบ entry ของ tab ออกจาก `REMOTE_LINK_CACHE_KEY` ใน `chrome.storage.session` เมื่อ session จบ
- [x] ห้ามล้าง cache เพียงเพราะ popup ถูกปิด เพราะ popup ปิด/reopen เป็น behavior ที่ต้องรองรับ
- [x] แก้ `nextstudio-public-site/privacy/index.html` ทั้ง EN/TH: เอาคำว่า `short-lived` และข้อความที่บอกว่าปิด Remote connection แล้ว token ถูกทิ้งออก เปลี่ยนเป็นคำอธิบาย session-scoped ตามนิยามด้านบน
- [x] ไม่เขียนว่ามี TTL เพราะโค้ดใช้ session-scoped lifecycle จริง

ทดสอบ:

- [ ] URL เดิม reconnect ได้หลังปิด/reopen popup โดย audio session ยังอยู่
- [ ] URL เดิมใช้ไม่ได้หลัง Audio OFF, Exit หรือปิด source tab
- [ ] token ผิด, protocol version ผิด และ token ของ session ที่จบแล้วต้องถูก reject
- [ ] ตรวจ storage หลัง session จบว่า cache ของ tab ถูกลบ

ผ่านเมื่อ: behavior, source comments, Privacy EN/TH และ reviewer notes อธิบาย lifecycle แบบเดียวกัน

### P0-E — ลบ inline JavaScript และกำหนด Chrome ขั้นต่ำ

ปัญหา 1: `next-amp-extension/player.html` มี `onmouseover`/`onmouseout` ซึ่งถูก Manifest V3 CSP บล็อก

ขั้นตอนแก้ CSP:

- [x] ลบ attribute `onmouseover` และ `onmouseout` จากปุ่ม donation ใน `player.html`
- [x] เพิ่ม class ที่สื่อความหมายให้ปุ่ม เช่น `support-link`
- [x] ย้าย hover background/border ไป CSS `:hover`; ห้ามใช้ inline JavaScript แบบอื่นแทน
- [x] Scan HTML ทุกไฟล์ใน Store directory ด้วย regex แบบ case-insensitive `\son[a-z]+\s*=`
- [x] เพิ่ม scan เดียวกันใน `scripts/verify-extension-artifact.js` ทั้ง output directory และ ZIP entries

ปัญหา 2: `background.js` ใช้ `chrome.runtime.getContexts()` ซึ่งต้องใช้ Chrome 116+ แต่ manifest ไม่บอก version ขั้นต่ำ

ขั้นตอนแก้ compatibility:

- [x] เพิ่ม `"minimum_chrome_version": "116"` ใน `next-amp-extension/manifest.json`
- [x] ตรวจว่า build script คง field นี้ไว้ใน Store manifest
- [x] เพิ่ม assertion ใน `scripts/test-review-readiness.mjs` และ artifact verifier ว่า Store manifest มี minimum version อย่างน้อย 116
- [x] ไม่สร้าง fallback ที่เปิด offscreen document ซ้ำโดยไม่ตรวจ context เพราะอาจทำให้ audio graph/model ซ้อนกัน

ผ่านเมื่อ: Store ZIP ไม่มี inline event handler, Console ไม่มี CSP error และ Chrome รุ่นต่ำกว่า 116 ติดตั้งไม่ได้แทนที่จะติดตั้งแล้วค้าง

### P0-F — แก้ Audio OFF state เมื่อ Remote ปิดเสียงแล้วเปิด popup ใหม่

ปัญหา: ใน `next-amp-extension/popup.js` หลัง `GET_STATE` ถ้า `state.isAudioActive` เป็น true โค้ดเรียก `loadAudioState(state)` แล้วบังคับ `isAudioMasterOn = true` แม้ Remote อาจตั้ง `state.isAudioMasterOn = false` และ AudioContext ถูก suspend อยู่

พฤติกรรมที่ต้องการ:

- ถ้า offscreen session active และ `state.isAudioMasterOn === false` popup ต้องแสดง Audio OFF
- ถ้า state ไม่มี field นี้จาก build เก่า จึงค่อย fallback เป็น true เพื่อ compatibility
- การเปิด popup ต้องไม่ resume/mute/stop session เองโดยไม่มี user action

ขั้นตอน:

- [x] เปลี่ยน assignment แบบ hard-coded เป็น `isAudioMasterOn = state.isAudioMasterOn !== false`
- [x] ให้ `updateMasterTogglesUI()` อ่านค่าที่ restore แล้ว
- [x] ห้ามเรียก `initCapture()` ใน branch ที่มี active session อยู่แล้ว
- [x] ห้ามส่ง `SET_PARAM` เพียงเพื่อ sync UI ตอน popup เปิด

ทดสอบ:

- [ ] เปิด Audio จาก popup แล้วสั่ง Audio OFF จาก Remote
- [ ] ปิด/reopen popup ต้องแสดง OFF และไม่มีเสียง
- [ ] กด ON จาก popup หนึ่งครั้งต้อง resume ได้ตามปกติ
- [ ] ทดสอบ session จาก build เก่าที่ไม่มี `isAudioMasterOn`; popup ต้องไม่พัง

ผ่านเมื่อ: popup state ตรงกับ offscreen state และไม่มี side effect ตอนเปิด popup

### P0-G — ทำข้อความ Privacy, Store listing และ Dashboard ให้ตรงกับพฤติกรรมจริง

ไฟล์:

- `nextstudio-public-site/privacy/index.html`
- `nextstudio-public-site/index.html`
- `nextstudio-public-site/assets/js/site.js`
- `CHROME-WEB-STORE-DESCRIPTION.md`
- `next-amp-extension/welcome.html`
- `CHROME-WEB-STORE-REVIEW-AUDIT.md`

ขั้นตอน:

- [x] เพิ่ม Privacy EN/TH ว่า Extension เก็บ coarse local usage counters เช่นเวลาใช้งานและจำนวน completed sessions เพื่อจำกัดความถี่ donation prompt; ไม่ใช่ analytics และไม่ส่งให้ NextFeeder Labs
- [x] ระบุ retention ของ counters ว่าอยู่ใน local Extension storage จนกว่าจะ clear/uninstall และ donation prompt มี cooldown ตามโค้ด
- [x] แก้คำอธิบาย permission `storage`: ใช้เก็บ preferences, consent และ local usage/prompt state; ไม่เขียนว่า Chrome `storage` เก็บ recording
- [x] อธิบายแยกว่า recording อยู่ใน local IndexedDB และไม่ upload ตามการทำงานปกติ
- [x] แก้ Short description จาก `AI vocal removal` เป็น `AI vocal reduction` หรือ `AI vocal modes`
- [x] แก้ welcome copy ให้ไม่อ้างว่าผู้ใช้กลับมาหน้านี้จาก Extension ได้ ทั้งที่ไม่มีลิงก์ดังกล่าว
- [x] ตรวจ public homepage/translation ว่าไม่มี Go Engine, native app, ECO/FULL selector หรือ performance claim ที่ Store UI ไม่มี
- [x] ตรวจ Privacy EN/TH ว่าข้อความสำคัญเท่ากันด้านความหมาย ไม่ใช่แก้ภาษาเดียว

Dashboard wording ที่ต้องใช้:

- `storage`: “Stores user preferences, disclosure consent, session/prompt state and local usage counters. Recordings are stored separately in local IndexedDB.”
- Remote: เปิดเผย PeerJS-compatible signaling และ connection metadata เช่น IP/timing โดยระบุว่าไม่มี audio stream ถูกส่งไป Remote
- AI: model/audio processing อยู่ในเครื่อง และผล vocal reduction แตกต่างตามเพลง/source quality

ผ่านเมื่อ: UI, Privacy, Store description, reviewer notes และ Dashboard ไม่มีคำอธิบายที่ขัดกับ code path จริง

### P0-H — ทำ automated gates ให้ตรวจสิ่งที่อ้างว่าเสร็จจริง

ปัญหา: test ปัจจุบันผ่าน แต่ยังไม่ได้เทียบ protocol schema ทุก range/enum และไม่ได้ทดสอบ first-use consent flow จริง ห้ามติ๊กสองข้อนี้เป็น `[x]` จนกว่าจะเพิ่ม test

Protocol test ที่ต้องเพิ่ม:

- [x] Export schema แบบ read-only จาก Extension module และ public Remote module เพื่อทำ parity check
- [x] เทียบรายชื่อ key แบบ exact equality
- [x] สำหรับ number ทุก key ให้เทียบ `min` และ `max` แล้วทดสอบ `min`, `max`, ต่ำกว่า min และสูงกว่า max
- [x] สำหรับ enum ให้เทียบสมาชิกและลำดับ/ชุดค่า แล้วทดสอบค่าที่ถูกและค่าที่ไม่รู้จัก
- [x] สำหรับ boolean ให้ reject string, number, null และ object
- [x] EQ ต้องรับ index 0–9 และ reject -1, 10, float, string และ null
- [x] ทดสอบ message เกิน 4096 bytes, malformed object, array, unknown type, wrong protocol version และ invalid token

Consent-flow test ที่ต้องเพิ่ม:

- [x] แยก logic ตัดสินใจ first-use disclosure เป็นฟังก์ชันที่ทดสอบได้ใน `modules/audio-disclosure.js`
- [x] กรณียังไม่ consent: coordinator ไม่ resolve ให้เริ่ม capture ก่อนผู้ใช้กด Continue
- [x] กด Keep Audio Off/close: coordinator ไม่บันทึก consent และไม่อนุญาตให้เริ่ม capture
- [x] กด Continue: บันทึก consent ก่อน coordinator resolve เพื่อให้ popup เริ่ม capture ต่อได้
- [x] การเปิด AI Vocal ครั้งแรกยังผ่าน `checkFirstLaunchModal()` ก่อนเริ่ม capture

Artifact gate ที่ต้องเพิ่ม:

- [x] reject `getUserMedia(` ใน packaged `player.js`
- [x] reject inline HTML event attributes `on*=...`
- [x] require `minimum_chrome_version >= 116`
- [x] ตรวจว่า `START_CAPTURE` ไม่มี eager `initHostPeer`
- [x] คง gate เดิมเรื่อง permission, Go isolation, localhost, remote code, model/WASM และ license

เมื่อ test ครบแล้วจึงเปลี่ยนสอง checkbox ใน P1 จาก `[ ]` เป็น `[x]` ซึ่งทำแล้วในรอบนี้

## ลำดับส่งมอบหลังแก้โค้ด

1. รัน `git diff --check`
2. รัน `npm run test:review`
3. รัน `npm run build:extension:store`
4. รัน `node scripts/verify-extension-artifact.js --profile=store`
5. Scan Store directory และ ZIP ซ้ำ ไม่ตรวจเฉพาะ source
6. ทดสอบ clean Chrome profile ตาม P0 manual checklist ด้านล่าง
7. ทดสอบ Apple และ Windows/WebGPU long run ตาม baseline เดิม ห้ามสรุปคุณภาพเสียงจาก unit test
8. Deploy `nextstudio-public-site` ปัจจุบันไป `https://studio.nextfeeder.com`
9. เปิด production `/`, `/remote`, `/privacy` และเทียบข้อความกับ local source
10. บันทึก SHA-256 ของ ZIP หลัง manual test ผ่าน ห้าม rebuild อีกก่อน upload
11. กรอก Dashboard และ Reviewer Notes ให้ตรงกับ ZIP hash ที่ผ่าน test

Rollback rule: ถ้าการแก้ Store hardening ทำให้เสียง, AI latency, recording, video หรือ Remote behavior เปลี่ยน ให้ย้อนเฉพาะ phase ที่ทำให้พัง ห้ามแก้ model/DSP เพื่อกลบ regression

## Code และ Store artifact ที่แก้แล้ว

- [x] Store profile ใช้ esbuild minification ที่ Google อนุญาต และไม่ใช้ `javascript-obfuscator`, control-flow flattening, dead-code injection หรือ RC4 string array
- [x] Store profile ไม่ inject anti-debug/security guard และไม่ package encrypted security WASM
- [x] Store profile ไม่เข้ารหัส executable STFT WASM หรือ model container; ใช้ไฟล์ local มาตรฐานที่ reviewer ตรวจได้
- [x] ตรวจ SHA-256 แล้วว่า model JSON, model weights, SIMD STFT และ scalar STFT ใน Store artifact ตรงกับ source แบบ byte-for-byte
- [x] ใช้ชื่อไฟล์สำคัญที่อ่านความหมายได้ใน Store artifact เช่น `popup.js`, `offscreen.js`, `vocal-worklet.js`, `stft_simd.wasm`
- [x] ตัด Go/native bridge, loopback endpoint และ legacy Remote UI bundle ออกจาก Store profile
- [x] ลบ external message listener ที่เปิดให้ extension/web app อื่นสั่ง capture และเปลี่ยนค่าโดยไม่จำเป็น
- [x] ลด permission เหลือ `tabCapture`, `offscreen`, `activeTab`, `scripting`, `storage`
- [x] เอา `tabs`, `host_permissions: <all_urls>` และ static content scripts บนทุกหน้า/ทุก frame ออกจาก Store build
- [x] จำกัด web-accessible resource เหลือ `video-delay-worker.js` ที่ content script ต้องใช้จริง
- [x] Content script สำหรับ video/notification ถูก inject หลังผู้ใช้กด extension action โดยอาศัย `activeTab`
- [x] เพิ่ม allowlist, type/range validation, protocol version, message-size limit และ authentication check ให้คำสั่ง Remote ฝั่ง Extension
- [x] เปลี่ยน Remote token เป็นค่าจาก `crypto.getRandomValues` ขนาด 192 บิต
- [x] ยกเลิกบริการ QR ภายนอกและสร้าง QR ภายใน Extension เพื่อไม่ส่ง Remote URL/token ให้บุคคลที่สาม
- [x] ลบ external Google Fonts ออกจาก popup/Store CSS
- [x] เพิ่ม prominent disclosure ก่อน capture เสียงครั้งแรก พร้อมปุ่ม Continue, Keep Audio Off และ Privacy Policy
- [x] ระบุว่าการบันทึกเริ่มเมื่อกด REC, เก็บใน local Extension storage และผู้ใช้ต้องมีสิทธิ์บันทึกเนื้อหา
- [x] ลด donation UX: ไม่มี donation modal ทันทีหลังติดตั้งและไม่มีปุ่ม donation บน Video header; เหลือ About และ usage-based prompt
- [x] แก้ source ของ Store description, welcome page, public site และ privacy copy ไม่ให้โฆษณา Go, ECO/FULL หรือ speed control ที่ไม่มีใน Store UI ปัจจุบัน; production deploy ยังรอทำใน P0 manual
- [x] เพิ่ม `THIRD-PARTY-NOTICES.txt` และ `MODEL-LICENSE.txt` ใน Store ZIP
- [x] เพิ่ม full Apache License 2.0 text ใน Store ZIP สำหรับ TensorFlow.js
- [x] เพิ่ม artifact gate ให้ reject permission เกิน, broad host permission, static content scripts, external QR/font host, encrypted `.dat`, legacy Remote UI, security core และไฟล์ license ที่หาย
- [x] `npm run build:extension:store` สำเร็จ
- [x] Store profile ไม่ package runtime Tailwind compiler/config; utility CSS ถูก compile เป็น static `styles.css` ระหว่าง build
- [x] Artifact/source scan เป็น recursive และตรวจ remote executable URL ทั้ง directory กับ ZIP entry
- [x] PeerJS CSP จำกัดเป็น `https://0.peerjs.com` และ `wss://0.peerjs.com` ทั้ง Extension และ public site
- [x] ลบ embedded `ITTY_BITTY_HASH`, legacy generated Remote UI และ short-link generator ที่ไม่มี runtime ใดอ้างถึงแล้ว
- [x] เพิ่ม `package-lock.json`; clean `npm ci` จาก temporary empty directory ผ่านด้วย lockfile นี้ และ Store build ผ่านด้วย dependency tree ชุดเดียวกัน
- [x] `npm audit --package-lock-only --omit=optional` ไม่พบ vulnerability (`0` ทุก severity)
- [x] `cert.pem`/`key.pem` ถูก ignore และหยุด track ใน Git index โดยไฟล์ local ยังใช้กับ dev server ได้
- [x] เพิ่ม version/fingerprint ของ vendored assets ใน third-party notices และเอา dangling PeerJS source-map reference ออก
- [x] Go-dev profile build และ artifact gate ผ่านหลังลบ legacy source
- [x] Artifact gate ผ่าน: 29 ZIP entries
- [x] Store ZIP ปัจจุบัน: `dist/nextstudio-extension-store.zip`
- [x] SHA-256 ปัจจุบัน: `a2f2747f518675733228a3f85915f7190e8c6b006384f55e83a1940b1b0d6eae`

## P0 — ต้องทำก่อนส่ง Review

### ทดสอบ Extension แบบ clean install

- [ ] เปิด Chrome profile ใหม่ ลบ extension รุ่นเก่า แล้ว Load unpacked จาก `dist/nextstudio-extension-store`
- [ ] ตรวจว่า welcome page เปิดเพียงครั้งเดียวและข้อความตรงกับฟีเจอร์จริง
- [ ] เปิด popup ครั้งแรกและยืนยันว่า disclosure แสดงก่อนเริ่ม tab capture
- [ ] กด `KEEP AUDIO OFF` แล้วตรวจว่าไม่มีเสียงถูก capture และเปิด popup ใหม่ยังคง Audio OFF
- [ ] ทดสอบใหม่ด้วย clean profile แล้วกด `CONTINUE`; ตรวจว่า audio เริ่มและ disclosure ไม่แสดงซ้ำ
- [ ] ทดสอบ Audio ON/OFF, ปิด popup, เปิดใหม่, เปลี่ยนแท็บ และปิดแท็บ โดยไม่มี session ค้าง
- [ ] ทดสอบ Video delay/zoom/rotate/quality บนเว็บอย่างน้อย 3 แห่งหลังเปิด popup; ต้องทำงานตั้งแต่ครั้งแรกโดยไม่ต้อง reload หน้า
- [ ] ทดสอบบนหน้า Chrome ที่ห้าม inject เช่น `chrome://extensions`; ต้อง fail แบบปลอดภัยและไม่ทำให้ service worker พัง

### ทดสอบ AI หลังเปลี่ยนรูปแบบ package

- [ ] ทดสอบ WebGL บน Apple และ Windows: เปิด Karaoke/Acapella, สลับ Original, ปิด popup และกลับมาเปิดใหม่
- [ ] ทดสอบ WebGPU บน Windows ที่รองรับและเล่นต่อเนื่องอย่างน้อย 20–30 นาที รวมการเปลี่ยนเพลง/เปลี่ยนหน้า
- [ ] ตรวจ Console ว่าไม่มี model/WASM 404, CSP error, unhandled rejection หรือ `Loading AI...` ค้าง
- [ ] ฟังเทียบ release ก่อนหน้าอย่างน้อย 3 เพลง แม้ checksum model/WASM จะตรงกัน เพื่อยืนยันว่า plaintext loader ไม่เปลี่ยน timing หรือ initialization behavior

### ทดสอบ Remote และ security

- [ ] Deploy `nextstudio-public-site` รุ่นปัจจุบันที่ `https://studio.nextfeeder.com`
- [ ] ตรวจว่า `https://studio.nextfeeder.com/remote` และ `/privacy` เปิดผ่าน HTTPS ได้จากมือถือจริง
- [ ] กด Remote, สแกน QR, สั่ง volume/pitch/AI/video/EQ และ reconnect หลังสลับแอปมือถือ
- [ ] ยืนยันจาก Network panel ว่าไม่มี request ไป `api.qrserver.com`, Google Fonts หรือ itty.bitty
- [ ] ทดสอบ URL ที่ token ผิด; Remote ต้องเชื่อมต่อไม่ได้
- [ ] ส่ง command key ที่ไม่อยู่ใน allowlist, ค่าเกิน range, protocol version ผิด และ payload เกิน 4096 bytes; Extension ต้อง reject โดยเสียงยังทำงานปกติ
- [ ] ตรวจว่า Remote ส่งเฉพาะ control data และไม่มี audio track/audio payload

### ทดสอบ Recorder และสิทธิ์ผู้ใช้

- [ ] กด REC/STOP, ปิด popup ระหว่างอัด, เปิดใหม่, play ทีละรายการ, export และ delete
- [ ] ยืนยันว่า recording อยู่ใน local Extension storage และไม่มี network upload
- [ ] เก็บข้อความ “Record only content you own or are authorized to record” ไว้ใน disclosure, privacy policy และ Store listing

### Chrome Web Store Dashboard — ผู้พัฒนาต้องกรอกเอง

- [ ] Privacy policy URL: `https://studio.nextfeeder.com/privacy`
- [ ] Single purpose: อธิบายว่า NextStudio เป็นเครื่องมือปรับและประมวลผลเสียงจากแท็บที่ผู้ใช้เลือก พร้อมเครื่องมือ sync/record/remote ที่สนับสนุน workflow เดียวกัน
- [ ] `tabCapture`: ใช้รับเสียงจากแท็บที่ผู้ใช้เลือกหลังเปิด Extension เพื่อให้ pitch, EQ, effects, AI Vocal และ recording ทำงาน
- [ ] `offscreen`: ใช้รักษา Web Audio graph และการประมวลผลเสียงที่ผู้ใช้เปิดไว้เมื่อ popup ปิด
- [ ] `activeTab`: ใช้เข้าถึงเฉพาะแท็บที่ผู้ใช้กด Extension ในขณะนั้น
- [ ] `scripting`: ใช้ inject video sync และ in-page status UI ลงในแท็บที่ผู้ใช้เลือกเท่านั้น
- [ ] `storage`: ใช้เก็บ settings, consent state และ local usage/prompt state; recordings เก็บแยกใน IndexedDB ของ Extension
- [ ] กรอก User Data disclosure ให้ครอบคลุม tab audio/media content, recordings/preferences และ Remote technical connection metadata ตามตัวเลือกจริงใน Dashboard
- [ ] ระบุว่า audio/model processing ทำในเครื่อง, ไม่มีการขายข้อมูล, ไม่มี personalized ads และข้อมูล Chrome API ใช้เพื่อฟีเจอร์ที่ผู้ใช้ร้องขอเท่านั้น
- [ ] เปิดเผยว่า Remote ใช้ PeerJS-compatible signaling และอาจมี IP/timing metadata ตามขั้นตอน WebRTC
- [ ] ตรวจชื่อ developer, support email และ privacy contact ให้ตรงกับ `NextFeeder Labs` / `nextfeeder.ts@gmail.com`
- [ ] อัปโหลด ZIP จาก Store profile เท่านั้น ห้ามใช้ `nextstudio-extension-go-dev.zip`

### Listing และ Reviewer notes

- [ ] นำข้อความจาก `CHROME-WEB-STORE-DESCRIPTION.md` รุ่นปัจจุบันไปใส่ Store listing
- [ ] ลบข้อความ/ภาพเก่าที่มี Go engine, native app, ECO/FULL selector, speed control หรือข้อความรับประกันผล AI
- [ ] Screenshot ต้องเป็น UI ของ build ที่ส่งจริง และไม่แสดงฟีเจอร์ซ่อน/ทดลอง
- [ ] ระบุว่า AI Vocal เป็น compact real-time model ผลลัพธ์ขึ้นกับเพลงและคุณภาพ source
- [ ] ใส่ Reviewer notes พร้อมขั้นตอน: เปิด media tab → กด Extension → ยอมรับ disclosure → เปิด AI Vocal → Karaoke
- [ ] ใส่ Reviewer notes สำหรับ Remote: ต้องเปิด Audio session ก่อน แล้วกด Remote และเปิด generated URL บนอุปกรณ์ที่สอง
- [ ] บอก reviewer ชัดเจนว่า PeerJS ใช้ signaling/control data เท่านั้น ไม่ download remote executable code และไม่ส่ง audio stream
- [ ] บอก reviewer ว่า model, TF.js, WASM, worklet และ QR generator package มากับ ZIP และทำงานแบบ self-contained
- [ ] Donation ต้องอธิบายว่า optional, ไม่ปลดล็อกฟีเจอร์ และไม่มีผลต่อการใช้งาน

## P1 — ไม่ใช่ blocker แต่ควรทำหลัง release candidate ผ่าน P0

- [x] แทน runtime Tailwind compiler ขนาดใหญ่ด้วย precompiled static CSS เพื่อลดไฟล์ vendor ที่ reviewer ต้องตรวจและลดงานตอนเปิด popup
- [x] สร้าง reproducible `package-lock.json`; ทดสอบ clean `npm ci` และใช้ dependency tree นั้น build Store สำเร็จ (ยังไม่ commit ตามคำสั่งผู้ใช้)
- [x] เพิ่ม automated test ให้ protocol schema ฝั่ง public Remote และ Extension ตรงกันทุก key/range/enum (`npm run test:review`)
- [x] เพิ่ม automated consent-coordinator test และ source assertion สำหรับ Continue/Keep Audio Off/capture ordering (`scripts/test-review-readiness.mjs`)
- [x] ลบ dead legacy source เช่น `ITTY_BITTY_HASH`, generated itty.bitty payload, short-link generator และ `remote/remote-ui-bundle.js`; Go-dev build ผ่านหลังลบ
- [x] จำกัด PeerJS CSP จาก wildcard เป็น signaling host ที่ library ใช้จริง (`0.peerjs.com`) ทั้ง Extension และ public site
- [x] เอา `cert.pem` และ `key.pem` ออกจาก current Git index/การแจกจ่ายและเพิ่ม `.gitignore`; local files ไม่ถูกลบ
- [x] บันทึก license, version ที่พิสูจน์ได้ และ SHA-256 fingerprint ของ vendored asset ที่ไม่มี version metadata ใน `THIRD-PARTY-NOTICES.txt`
- [x] เพิ่ม `assets/libs/js/LAMEJS-NOTICE.txt` ให้ Web build และตรวจว่า LAME ไม่ถูก package ใน Store ZIP
- [ ] ถ้า repository เคย public หรือ private key เคยถูกแจก ให้ rotate certificate/key และพิจารณา purge ไฟล์จาก Git history; การหยุด track ใน commit ใหม่ไม่ลบสำเนาในประวัติ

หมายเหตุ dependency: npm ของ working tree เดิมเคยติด internal Arborist error เพราะ `node_modules` มี state ปะปน จึงสร้าง lockfileจาก directory ว่าง แล้วพิสูจน์ด้วย `npm ci`, `npm ls`, Store build และ npm audit จาก dependency tree สะอาดแทน ห้ามลบ `package-lock.json` หรือใช้ `npm install` แบบไม่ตรวจ diff ก่อน release

## Reviewer notes ตัวอย่าง

รายละเอียดที่ copy ไปกรอกใน Chrome Web Store Dashboard อยู่ใน
`CHROME-WEB-STORE-DASHBOARD-INPUTS.md`

```text
NextStudio has one user-facing purpose: real-time audio practice and media synchronization for the tab selected by the user.

To test:
1. Open a tab containing playing audio.
2. Click the NextStudio toolbar action.
3. Read the one-time local audio disclosure and click Continue.
4. Use Pitch/EQ/Reverb, or enable AI Vocal and select Karaoke/Acapella.
5. Video controls are injected only into the active tab after the toolbar action is clicked.

All AI/model/WASM/worklet code is packaged locally in the extension. The extension does not fetch or execute remote code. Remote uses a packaged PeerJS client for signaling and a validated data-only control channel; it does not transmit the audio stream. The Remote QR is generated locally. Optional donations do not unlock features.
```

## เอกสารนโยบายที่ใช้อ้างอิง

- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies)
- [Code Readability Requirements](https://developer.chrome.com/docs/webstore/program-policies/code-readability/)
- [Manifest V3 Requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)
- [Review Process](https://developer.chrome.com/docs/webstore/review-process)
- [User Data FAQ and Minimum Permissions](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Disclosure Requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements)
- [Data Handling Requirements](https://developer.chrome.com/docs/webstore/program-policies/data-handling)
- [Limited Use Requirements](https://developer.chrome.com/docs/webstore/program-policies/limited-use)
- [Listing Requirements](https://developer.chrome.com/docs/webstore/program-policies/listing-requirements/)
- [Quality Guidelines](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines)
- [Accepting Payment / Donations](https://developer.chrome.com/docs/webstore/program-policies/accepting-payment)

## Release rule

ห้ามส่ง Review หากมี P0 ข้อใดข้อหนึ่งที่ยังไม่ผ่าน หรือ Store ZIP hash เปลี่ยนหลังทดสอบแล้วโดยไม่ได้รันทดสอบ P0 ซ้ำ
