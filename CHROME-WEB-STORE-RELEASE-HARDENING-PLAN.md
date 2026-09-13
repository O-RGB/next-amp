# NextStudio Chrome Web Store Release & Security Hardening Plan

วันที่จัดทำ: 2026-09-12

สถานะ: ยังไม่เริ่ม implementation — เอกสารนี้เป็นแผนงานเท่านั้น

## เป้าหมาย

- ทำให้ Extension ผ่านข้อกำหนด Chrome Web Store และ Manifest V3 ได้ง่ายขึ้น
- รักษาการทำงานและคุณภาพเสียงของ Web AI, Go AI, ECO และ FULL ไว้เหมือนเดิม
- ลด permission, external data exposure และ attack surface เท่าที่ทำได้
- ทำให้ production build ตรวจสอบซ้ำได้และ dependency มีเวอร์ชันแน่นอน
- ป้องกันการ copy ระดับสมเหตุสมผล โดยไม่ใช้วิธีที่ขัดกับนโยบาย Store

## สิ่งที่แผนนี้จะไม่เปลี่ยน

- ไม่แก้ model, DSP, overlap, F16, context frames หรือการสังเคราะห์เสียง
- ไม่เปลี่ยนค่า ECO/FULL หรือคุณภาพ Karaoke/Acapella
- ไม่เพิ่ม network processing ให้เสียงหรือส่งเสียงผู้ใช้ขึ้น server
- ไม่เปลี่ยน Go engine protocol เว้นแต่เป็น validation ด้านความปลอดภัยที่ไม่กระทบเสียง

## ผล Audit ตั้งต้น

- [x] `npm run build` ผ่านทั้ง Web และ Extension
- [x] Production Extension ZIP ไม่มี plaintext model, `.bin`, `.wasm`, debug file หรือ source map
- [x] Manifest ใน production อ้าง resource ครบ ไม่มีไฟล์หาย
- [x] ไม่พบการใช้ `cookies`, `history` หรือ `webRequest`
- [x] พบ release blockers: code obfuscation, anti-debugging, remote script และ dynamic code execution
- [x] พบ release risks: ไม่มี lockfile, privacy policy ยังไม่อยู่ใน repo, permission กว้าง และมี private development key ถูก track ใน Git

## Remote Controller: ใช้ itty.bitty.site ต่อได้หรือไม่

คำตอบคือ **ใช้ได้แบบมีเงื่อนไข** และไม่จำเป็นต้องมี application backend จริงเสมอไป

Chrome อนุญาตให้ Extension เปิดเว็บไซต์ภายนอกและสื่อสารกับ remote service ได้ หาก:

- Logic ของ Extension ที่มีสิทธิ์ใช้ Chrome API อยู่ใน package และ reviewer อ่านได้
- เว็บไซต์ภายนอกไม่มีสิทธิ์เข้าถึง Chrome Extension API โดยตรง
- ข้อมูลที่รับจากภายนอกเป็น data/state/commands ไม่ใช่ JavaScript หรือ WASM ที่นำมารันใน Extension
- การส่งข้อมูลภายนอกถูกเปิดเผยใน Privacy Policy และเป็นส่วนที่จำเป็นของฟีเจอร์

### ปัญหาของวิธีปัจจุบัน

- Extension สร้าง HTML ที่มี `<script src="https://unpkg.com/...peerjs...">`
- Remote page รับ `d.js` แล้วใช้ `new Function(...)` รันโค้ด
- Store scanner สามารถเห็น pattern ของ remote script และ dynamic execution ใน bundle ของ Extension
- Reviewer อาจระบุ full functionality ไม่ได้ เพราะ behavior ถูกประกอบขึ้นระหว่าง runtime
- URL ที่มี host ID/token ถูกส่งให้ URL shortener และ QR API ภายนอก

### ทางเลือก A — Static Remote Host (แนะนำสำหรับ Store)

ใช้หน้า remote แบบ static บน GitHub Pages, Cloudflare Pages, Vercel หรือ domain ของโครงการ ไม่ต้องมี backend application

- หน้า remote และ dependency ถูก version/pin ชัดเจน
- Extension เปิด URL เช่น `https://remote.example/#host=...&token=...`
- token อยู่ใน URL fragment เพื่อลดการส่งไปใน HTTP request/log ของ host
- หน้า remote ส่งเฉพาะคำสั่งที่กำหนดไว้ เช่น `SET_PARAM`, `GET_STATE`, `PING`
- Extension ไม่รับ HTML/CSS/JavaScript มารัน
- PeerJS signaling ยังใช้ได้ แต่ต้องระบุใน Privacy Policy

ข้อดี: ผ่านการอธิบายกับ reviewer ง่ายที่สุด, URL สั้น, QR เล็ก และ update remote UI ง่าย

ข้อเสีย: ต้องมี static hosting แม้จะใช้ฟรีได้

### ทางเลือก B — itty.bitty.site แบบ Store-safe (เก็บไว้ทดลอง)

- สร้าง remote controller จาก template ที่อยู่ใน source/package และ reviewer อ่านได้
- ห้ามมี `new Function`, `eval` หรือ `MOUNT_UI` ที่ส่ง executable JavaScript
- ห้ามให้ remote peer ส่ง HTML/JS มา mount แบบอิสระ
- Controller ส่ง/รับเฉพาะ schema ของข้อมูลที่กำหนดไว้ล่วงหน้า
- ถ้าจำเป็นต้องใช้ library ภายนอกในหน้า itty ให้แยกชัดว่าโค้ดรันใน external web context เท่านั้น และไม่มีทางเข้าถึง Chrome API
- ทำ Store scanner test เพื่อยืนยันว่า bundle ของ Extension ไม่มี remote-code signature

ข้อดี: ไม่ต้องมี static host ของเรา

ข้อเสีย: URL ยาว, พึ่งพา itty.bitty, privacy/review อธิบายยากกว่า และมีความเสี่ยงถูก automated review จับมากกว่าทางเลือก A

### ข้อสรุป Remote

- Production Store target จะใช้ **ทางเลือก A เป็นค่าเริ่มต้น**
- ทางเลือก B จะเก็บเป็น experimental fallback จนกว่าจะผ่าน static scan และ review checklist
- ไม่ว่าจะเลือกทางใด Extension จะรับเฉพาะ data commands และจะไม่ execute code จาก remote

## Phase 1 — แยก Store Build ออกจาก Protected Build

- [ ] เพิ่มคำสั่ง `build:extension:store` สำหรับไฟล์ที่จะส่ง Chrome Web Store
- [ ] ใช้ esbuild minification ได้ แต่ปิด `javascript-obfuscator` ทั้งหมดใน Store build
- [ ] ปิด control-flow flattening, RC4 string array, dead-code injection และ object-key transform
- [ ] เอา anti-debug watchdog และ `debugger` ออกจาก Store build
- [ ] เอา Unauthorized Copy DOM replacement และ security guard ที่ซ่อน behavior ออกจาก Store build
- [ ] ให้ executable JavaScript/WASM ที่อยู่ใน Store package ตรวจสอบย้อนกลับได้
- [ ] อนุญาตให้เก็บ model weights เป็น protected data ได้เฉพาะเมื่อ decoder อ่านได้และไม่มี remote logic
- [ ] เก็บ protected/obfuscated build แยกไว้สำหรับการแจกนอก Chrome Web Store หากยังต้องการ
- [ ] ห้ามใช้ protected build ผิดตัวตอน upload Store

ผลลัพธ์ที่ต้องได้: Store ZIP มี behavior เหมือน build ปัจจุบัน แต่เป็น readable/minified code และไม่มี anti-analysis logic

## Phase 2 — ปรับ Remote Architecture

- [ ] ตัด `<script src="https://unpkg.com/...">` ออกจาก code path ที่สร้างโดย Extension
- [ ] ตัด `new Function`, `eval` และ dynamic executable payload ทุกจุด
- [ ] เลิกส่ง `MOUNT_UI` ที่มี `html/css/js` แบบรันได้
- [ ] กำหนด message schema แบบ allowlist: `HANDSHAKE`, `GET_STATE`, `SET_PARAM`, `PING`, `PONG`
- [ ] ตรวจ type, range และชื่อ parameter ทุกข้อความก่อนนำไปใช้
- [ ] ใช้ cryptographically random session token
- [ ] เพิ่ม token TTL และ invalidate เมื่อปิด remote, ปิด session หรือเปลี่ยน source tab
- [ ] จำกัดจำนวน handshake ที่ผิดและตัด connection ที่ส่งข้อความผิด schema
- [ ] ไม่ log token/URL เต็มใน production console
- [ ] Bundle PeerJS ใน Extension จาก dependency ที่ pin version ไว้
- [ ] ทำ static remote app สำหรับทางเลือก A
- [ ] ทำ itty-safe prototype สำหรับทางเลือก B โดยไม่มี executable payload จาก peer
- [ ] เปลี่ยน QR generation เป็น local bundled QR library เพื่อตัด `api.qrserver.com`
- [ ] เอา `spoo.me` และ `da.gd` ออกจาก Store build หรือใช้เฉพาะหลังผู้ใช้ยืนยันและเปิดเผยข้อมูลชัดเจน

ผลลัพธ์ที่ต้องได้: Remote ใช้งานจากมือถือได้เหมือนเดิม แต่ network ส่งเฉพาะ session data/commands และไม่มี remote code execution

## Phase 3 — ลด Permissions และ Resource Exposure

- [ ] ลบ `scripting` หลังยืนยันว่าไม่มี code path ใช้ `chrome.scripting`
- [ ] ทดสอบถอด `activeTab`; เก็บไว้เฉพาะเมื่อจำเป็นต่อ tab capture/user gesture จริง
- [ ] ตรวจการใช้ `tabs` ทีละจุด และถอด permission หาก API ที่ใช้ไม่ต้องการสิทธิ์นี้
- [ ] แยก permission ที่จำเป็นต่อ core audio ออกจาก permission ของ video tools
- [ ] พิจารณา `optional_host_permissions` สำหรับเว็บที่ผู้ใช้เลือกใช้งาน
- [ ] ถ้าจำเป็นต้องใช้ `<all_urls>` ให้มีเหตุผลที่ตรงกับ Store listing และ disclosure
- [ ] ลด `all_frames` หาก video/audio control ไม่ต้องทำงานในทุก iframe
- [ ] ลด `web_accessible_resources` ให้เหลือเฉพาะไฟล์ที่ content script ต้องโหลดจริง
- [ ] เอา model, protected `.dat`, security core และ debug assets ออกจาก web-accessible list หากโหลดจาก Extension context ได้อยู่แล้ว
- [ ] ตรวจว่า source manifest และ generated manifest ให้ permission ตรงกัน

ผลลัพธ์ที่ต้องได้: Install warning น้อยที่สุดและเว็บไซต์ภายนอกเข้าถึง resource ได้เฉพาะส่วนจำเป็น

## Phase 4 — Privacy และ User Data Compliance

- [ ] สร้าง `PRIVACY-POLICY.md` ภาษาอังกฤษเป็นหลักและมีฉบับภาษาไทยถ้าต้องการ
- [ ] ระบุว่า audio processing ทำในเครื่องหรือส่งไปที่ใดอย่างชัดเจน
- [ ] ระบุว่า recordings เก็บใน IndexedDB/local browser storage
- [ ] อธิบายวิธีเล่น, download และลบ recordings
- [ ] ระบุ settings/session metadata ที่เก็บใน `chrome.storage`
- [ ] ระบุ third parties ที่จำเป็น เช่น PeerJS signaling และ static remote host
- [ ] ระบุสิ่งที่ไม่ทำ: ไม่ขายข้อมูล, ไม่ทำ personalized ads, ไม่ให้มนุษย์อ่านข้อความ/ฟังเสียงผู้ใช้
- [ ] ระบุ retention และเวลาที่ remote token หมดอายุ
- [ ] เพิ่ม prominent disclosure ก่อนเริ่ม recording และก่อนเปิด remote ครั้งแรก
- [ ] ใส่ Privacy Policy URL ใน Chrome Web Store Developer Dashboard
- [ ] กรอก Data Usage/Privacy Practices ให้ตรงกับ code และ policy ทุกข้อ
- [ ] ตรวจข้อความ “private” ใน Store listing ให้ไม่กว้างเกิน behavior จริง

ผลลัพธ์ที่ต้องได้: ผู้ใช้และ reviewer เข้าใจว่าข้อมูลอะไรอยู่ local และข้อมูลอะไรต้องผ่าน third party

## Phase 5 — Repository และ Supply-chain Security

- [ ] หยุด track `key.pem` และ `cert.pem` ใน Git
- [ ] เพิ่ม certificate/key ลง `.gitignore`
- [ ] เพิ่ม script สำหรับสร้าง self-signed development certificate ใหม่ในเครื่อง
- [ ] เปลี่ยน/เลิกใช้ key เดิมหาก repository เคยถูกแชร์หรือ public
- [ ] ตัดสินใจให้ชัดว่า plaintext source model จะอยู่ใน private repository, Git LFS หรือ external private artifact storage
- [ ] เพิ่มและ commit lockfile ให้ตรงกับ package manager ที่เลือก
- [ ] Pin เวอร์ชัน build dependencies ที่สำคัญ
- [ ] รัน dependency audit หลังมี lockfile
- [ ] ตรวจ license ของ TensorFlow.js, SignalsmithStretch, PeerJS, fonts และ icon assets
- [ ] เพิ่ม third-party license/notice file ใน package หาก license กำหนด
- [ ] ตรวจว่า build ไม่อ่าน executable จาก CDN หรือดาวน์โหลด dependency ระหว่าง build โดยไม่ pin checksum

ผลลัพธ์ที่ต้องได้: Build ซ้ำได้, dependency ตรวจสอบได้ และไม่มี development private key หลุดใน repository

## Phase 6 — Runtime Security

- [ ] ตรวจ `chrome.runtime.onMessageExternal` และลบถ้าไม่จำเป็น
- [ ] หากจำเป็นต้องใช้ ให้กำหนด `externally_connectable` แบบ allowlist และ validate `sender.id`/origin
- [ ] Validate `sampleRate`, `latencyHint`, tab ID และ parameter ทุกตัวก่อนส่งเข้า audio engine
- [ ] เปลี่ยน `innerHTML` ที่รับข้อมูลแปรผันเป็น DOM API/`textContent` หรือ sanitizer ที่กำหนด allowlist
- [ ] ตรวจ CSP ให้เหลือ domain ที่ใช้จริง
- [ ] ใช้ HTTPS/WSS ทุกจุด ยกเว้น loopback Go engine ที่จำเป็น
- [ ] จำกัด Go WebSocket ให้ bind เฉพาะ `127.0.0.1`/`localhost`
- [ ] เพิ่ม origin/token validation ให้ Go WebSocket handshake
- [ ] ตรวจ cleanup ของ MediaStream, AudioContext, Worker, WebSocket และ Peer connection เมื่อ session จบ

ผลลัพธ์ที่ต้องได้: หน้าเว็บหรือ Extension อื่นไม่สามารถสั่ง capture/control session โดยไม่ได้รับอนุญาต

## Phase 7 — Store Listing และ Intellectual Property

- [ ] ปรับ description ให้บอก single purpose ชัดว่าเป็น browser audio/video practice studio
- [ ] อธิบายเหตุผลของ tab capture, site access, storage และ remote connection
- [ ] ระบุว่า AI model โหลดเมื่อผู้ใช้เปิด AI เท่านั้น
- [ ] ระบุข้อจำกัดของ WebGPU/WebGL และเครื่องเก่าอย่างตรงไปตรงมา
- [ ] เพิ่มข้อความว่า recording ใช้กับสื่อที่ผู้ใช้เป็นเจ้าของหรือได้รับอนุญาต
- [ ] ยืนยันว่า Extension ไม่ bypass DRM, paywall หรือระบบดาวน์โหลดของเว็บไซต์
- [ ] หลีกเลี่ยงคำโฆษณาที่รับประกันผล เช่น “perfect vocal removal” หรือ “works on every site”
- [ ] ตรวจชื่อ, icon, screenshots, short description และ full description ให้ตรงกับ version 1.0
- [ ] ให้ donation เป็น optional, dismissible และไม่แลกกับ review/install/rating

ผลลัพธ์ที่ต้องได้: Listing บอกความสามารถตรงกับของจริงและไม่สร้างความเข้าใจผิด

## Phase 8 — Verification ก่อนส่ง Store

- [ ] รัน unit/integration tests ที่มีอยู่
- [ ] รัน `npm run build:extension:store`
- [ ] ตรวจ ZIP ว่า manifest/resource ครบและไม่มี path traversal/ไฟล์เกินจำเป็น
- [ ] Scan Store ZIP หา `eval`, `new Function`, external script tag, obfuscator runtime, anti-debug และ source map
- [ ] Scan หา secret, private key, localhost development certificate และ debug page
- [ ] ตรวจว่า model plaintext ไม่อยู่ใน ZIP
- [ ] Load unpacked จาก Store build บน Chrome stable
- [ ] ทดสอบ install ครั้งแรก, exit/reopen, Original/Karaoke/Acapella, ECO/FULL
- [ ] ทดสอบ Apple Silicon และ Windows NVIDIA 1050 Ti
- [ ] ทดสอบ Web AI และ Go AI ว่าคุณภาพ/latency ไม่เปลี่ยนจาก baseline
- [ ] ทดสอบ recording, hide/reopen popup, play one-at-a-time, download และ delete modal
- [ ] ทดสอบ remote reconnect, token expiry, invalid token และ malformed command
- [ ] ทดสอบหน้าเว็บหลาย domain และ iframe โดยใช้ permission ชุดใหม่
- [ ] ตรวจ Privacy Dashboard, listing และ Privacy Policy เทียบกับ network behavior จริง
- [ ] สร้าง release checksum และเก็บ artifact ที่ผ่าน test เท่านั้น

## Acceptance Criteria

จะถือว่าพร้อมส่ง Chrome Web Store เมื่อครบทุกข้อ:

- Store ZIP ไม่มี obfuscation, anti-debug หรือ remote executable code
- Extension ไม่ใช้ `eval`/`new Function` กับข้อมูลภายนอก
- Remote ทำงานผ่าน data-only protocol และ token หมดอายุได้
- Permission ทุกตัวมี code path และเหตุผลรองรับ
- Privacy Policy และ Dashboard disclosure ตรงกับ network/data behavior
- Build มี lockfile, audit ได้ และสร้างผลลัพธ์ซ้ำได้
- ไม่มี private key/debug/source map/plaintext model หลุดเข้า Store ZIP
- คุณภาพเสียง, latency และเสถียรภาพของ Web AI/Go AI ไม่ถดถอยจาก baseline ที่ผู้ใช้ยืนยันแล้ว

## เอกสารอ้างอิงทางการ

- Chrome Web Store Code Readability Requirements: https://developer.chrome.com/docs/webstore/program-policies/code-readability
- Additional Requirements for Manifest V3: https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
- Deal with Remote Hosted Code Violations: https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
- Chrome Web Store User Data Policy: https://developer.chrome.com/docs/webstore/user_data
- Declare Permissions: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
- Web Accessible Resources / Manifest migration guidance: https://developer.chrome.com/docs/extensions/develop/migrate/manifest

## ลำดับการลงมือที่แนะนำ

1. Phase 1 และ Phase 2 ก่อน เพราะเป็น Store blockers
2. Phase 3 และ Phase 4 เพื่อให้ permission/privacy ผ่าน review
3. Phase 5 และ Phase 6 เพื่อปิด security และ supply-chain risks
4. Phase 7 แล้วจบด้วย Phase 8 เพื่อตรวจ artifact ตัวจริงก่อน upload
