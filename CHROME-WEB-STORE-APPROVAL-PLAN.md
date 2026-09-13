# NextStudio Chrome Web Store Approval Plan

วันที่จัดทำ: 2026-09-12

สถานะ: แผนหลักสำหรับ Chrome Web Store — ยังไม่เริ่มแก้โค้ด

> ไม่มีวิธีรับประกันผลการรีวิวแทน Google ได้ แผนนี้เลือกแนวทางที่ conservative ที่สุดและมีโอกาสผ่านสูงสุด โดยตัด known policy blockers ที่ตรวจพบออกทั้งหมด

## การตัดสินใจหลัก

Store build จะใช้สถาปัตยกรรมดังนี้:

- ใช้ Manifest V3
- เก็บ JavaScript, WebAssembly, model และ library ที่ Extension ใช้ไว้ใน package เท่านั้น
- ใช้ minification ได้ แต่ไม่ใช้ obfuscation หรือ anti-debugging
- ใช้หน้า Remote แบบ static บน HTTPS domain ที่ผู้พัฒนาควบคุม
- ไม่ใช้ `itty.bitty.site`, URL shortener หรือ QR API ใน Store build
- หน้า Remote ไม่มี Chrome Extension API และสื่อสารผ่าน data-only protocol
- Extension ไม่รับ HTML, CSS, JavaScript หรือ WASM จาก Remote มารัน
- ไม่เปลี่ยน model/DSP/ECO/FULL หรือคุณภาพเสียง

## URL สำหรับ Remote

ยังไม่กำหนด production domain ในขั้นนี้ จะสร้างและทดสอบแบบ local ก่อน จากนั้นผู้ใช้จะเลือก static host และ deploy เอง

รูปแบบ production URL เมื่อมี domain จริง:

`https://<production-domain>/remote/`

Remote session URL จะมีรูปแบบ:

`https://<production-domain>/remote/#host=<peer-id>&token=<short-lived-token>`

เหตุผลที่ใช้ URL fragment (`#...`): browser จะไม่ส่ง fragment ไปกับ HTTP request ปกติ จึงช่วยลดการปรากฏของ token ใน server access log อย่างไรก็ตาม Remote page ยังอ่าน fragment ได้ จึงต้องมี token expiry และ session invalidation อยู่ดี

## สิ่งที่จะเลิกใช้ใน Store Build

- [ ] `itty.bitty.site`
- [ ] `spoo.me`
- [ ] `da.gd`
- [ ] `api.qrserver.com`
- [ ] `<script src="https://unpkg.com/...">`
- [ ] external JavaScript/CSS/font CDN ใน Extension UI
- [ ] `new Function(...)`
- [ ] `eval(...)`
- [ ] Remote payload ชนิด `MOUNT_UI` ที่มี executable HTML/JS
- [ ] `javascript-obfuscator`
- [ ] control-flow flattening
- [ ] RC4 string array
- [ ] dead-code injection
- [ ] anti-debug `debugger` watchdog
- [ ] Unauthorized Copy DOM replacement
- [ ] encrypted executable WASM/security core ที่มีไว้ซ่อน behavior

## Phase 1 — สร้าง Store Build ที่ Reviewer อ่านได้

- [ ] เพิ่มคำสั่ง `npm run build:extension:store`
- [ ] ใช้ esbuild สำหรับ bundle และ minify เท่านั้น
- [ ] ไม่เรียก `javascript-obfuscator` ใน Store pipeline
- [ ] ไม่ inject `security-guard.js`
- [ ] ไม่ compile/package `security-core.c` สำหรับ Store
- [ ] Package JavaScript และ WebAssembly ที่ใช้งานจริงไว้ใน ZIP โดยตรง
- [ ] Package TensorFlow.js, WebGPU backend, SignalsmithStretch, PeerJS, fonts และ icons ไว้ใน ZIP
- [ ] Package model เป็น local model asset มาตรฐานที่ AI loader อ่านได้
- [ ] ไม่ download JavaScript/WASM/model ระหว่าง Extension runtime
- [ ] ไม่สร้าง file-name mapping ที่ตั้งใจซ่อน functionality; content hash เพื่อ cache/integrity ยังใช้ได้หากอ่าน mapping จาก manifest/build output ได้
- [ ] สร้าง `THIRD-PARTY-NOTICES.txt` พร้อม license ของ dependency ที่แจกไปกับ Extension
- [ ] สร้าง Store ZIP คนละชื่อกับ protected/private build เพื่อป้องกันอัปโหลดผิดตัว

ผลลัพธ์: reviewer สามารถเปิด ZIP แล้วระบุ logic และ dependency ทุกส่วนได้

## Phase 2 — สร้าง Static Remote Application

- [ ] สร้าง source ของหน้า Remote เป็นโครงการ static HTML/CSS/JavaScript ภายใน repository
- [ ] Bundle PeerJS และ UI dependency เข้า Remote deployment; ไม่โหลดจาก unpkg/jsDelivr
- [ ] Bundle fonts/icons เอง หรือใช้ system fonts เพื่อลด third-party request
- [ ] Deploy หน้า Remote บน production HTTPS domain ที่ผู้พัฒนาควบคุม
- [ ] แสดงชื่อ NextStudio, privacy link และสถานะ connection ให้ชัดเจน
- [ ] อ่าน `host` และ `token` จาก URL fragment เท่านั้น
- [ ] ลบ fragment ออกจาก address bar ด้วย `history.replaceState` หลังอ่านสำเร็จ
- [ ] ไม่เก็บ token ใน localStorage, analytics หรือ error reporting
- [ ] ไม่ส่ง audio stream ไป Remote; Remote ส่งเฉพาะคำสั่งควบคุมและรับ state
- [ ] Version Remote protocol เพื่อให้ Extension ปฏิเสธ client ที่ไม่รองรับ
- [ ] เพิ่มหน้า error เมื่อ token หมดอายุหรือ Extension ปิด session แล้ว

ผลลัพธ์: Remote เป็นเว็บอิสระที่ตรวจสอบได้ ไม่มีสิทธิ์ Chrome API และไม่สามารถส่ง executable code เข้า Extension

## Phase 3 — เปลี่ยน Remote Protocol เป็น Data-only

- [ ] ลบ `MOUNT_UI`, `html`, `css` และ `js` ออกจาก PeerJS message protocol
- [ ] อนุญาต message type เฉพาะ `HANDSHAKE`, `GET_STATE`, `STATE`, `SET_PARAM`, `PING`, `PONG`, `CLOSE`
- [ ] สร้าง schema/validator กลางสำหรับ Extension และ Remote
- [ ] Allowlist ชื่อ parameter ที่ Remote เปลี่ยนได้
- [ ] Validate type, minimum, maximum และ enum ของทุก parameter
- [ ] ปฏิเสธ object key ที่ไม่รู้จักและ payload ที่ใหญ่ผิดปกติ
- [ ] สร้าง token ด้วย `crypto.getRandomValues`
- [ ] ใช้ token แบบ one-session และมีอายุจำกัด
- [ ] Invalidate token เมื่อปิด Remote, ปิด audio session, เปลี่ยน tab หรือกด Exit Extension
- [ ] ตัด connection หลัง handshake ผิดซ้ำเกินค่าที่กำหนด
- [ ] ไม่พิมพ์ token/Remote URL เต็มลง production console
- [ ] ให้ privileged action ทุกอย่างถูกตรวจและตัดสินใจโดย Extension เท่านั้น

ผลลัพธ์: ต่อให้หน้า Remote ถูกแก้ไข ผู้โจมตีก็ส่งได้เฉพาะคำสั่งชุดเล็กที่ Extension validate แล้ว

## Phase 4 — สร้าง QR ในเครื่อง

- [ ] เพิ่ม QR encoder แบบ local และ pin version/license
- [ ] Generate QR จาก Remote session URL ภายใน Extension
- [ ] ไม่ส่ง URL, peer ID หรือ token ไป QR service ภายนอก
- [ ] จำกัดขนาด URL เพราะ production base URL สั้นและคงที่
- [ ] ทดสอบ QR บน iOS และ Android

ผลลัพธ์: การเปิด Remote ไม่เปิดเผย session credential ให้ URL shortener หรือ QR provider

## Phase 5 — ลด Permissions

Store manifest เป้าหมายเริ่มต้น:

- `tabCapture`
- `offscreen`
- `storage`
- `activeTab`
- `scripting` เฉพาะกรณีเปลี่ยน content script เป็นการ inject หลัง user gesture

งานที่ต้องทำ:

- [ ] เปลี่ยน video-delay/video-zoom content script จาก `<all_urls>` แบบถาวร เป็นการ inject หลังผู้ใช้เปิด Extension บน tab นั้น
- [ ] ใช้ `activeTab` เป็นสิทธิ์ชั่วคราวจาก user gesture
- [ ] ใช้ `scripting` เฉพาะสำหรับ inject ไฟล์ที่อยู่ใน package
- [ ] ลบ `tabs` permission หาก API ที่ใช้ไม่ต้องการ sensitive tab properties
- [ ] ลบ `host_permissions: ["<all_urls>"]`
- [ ] ลบ static `content_scripts.matches: ["<all_urls>"]`
- [ ] ไม่ทำงานบน `chrome://`, Chrome Web Store, browser settings และ restricted pages
- [ ] ลด `web_accessible_resources` ให้เหลือน้อยที่สุด
- [ ] ใช้ `use_dynamic_url` กับ resource ที่จำเป็นต้องเปิดให้ content page หากรองรับ
- [ ] ย้าย AI model/WASM/worklet ที่ใช้จาก offscreen page ออกจาก web-accessible list
- [ ] ตรวจ install warning หลังสร้าง Store build

ผลลัพธ์: Extension ได้สิทธิ์กับ tab จากการกระทำของผู้ใช้และไม่มีสิทธิ์อ่านทุกเว็บไซต์ตลอดเวลา

## Phase 6 — Privacy Policy และ Disclosure

- [ ] สร้าง `PRIVACY-POLICY.md`
- [ ] เขียน Privacy Policy ในนาม `NextFeeder Labs` และใช้อีเมล `nextfeeder.ts@gmail.com`
- [ ] ทดสอบ Privacy Policy แบบ local ก่อน
- [ ] Deploy policy ที่ `https://<production-domain>/privacy/` หลังผู้ใช้เลือก host
- [ ] ระบุว่า audio processing ทำใน browser/local Go engine และไม่อัปโหลดเสียงไป server
- [ ] ระบุว่า recording เก็บใน IndexedDB ของ browser
- [ ] ระบุวิธี download และลบ recording
- [ ] ระบุ settings/session state ที่เก็บใน `chrome.storage`
- [ ] ระบุ PeerJS/signaling service และข้อมูลที่จำเป็นต่อ connection
- [ ] ระบุว่า Remote ส่งเฉพาะ control commands/state และไม่ส่ง audio
- [ ] ระบุ retention ของ token และวิธี invalidate
- [ ] ระบุว่าไม่ขายข้อมูล ไม่ใช้ personalized advertising และไม่ให้มนุษย์เข้าถึง audio/recording
- [ ] แสดง disclosure ก่อนเริ่ม recording ครั้งแรก
- [ ] แสดง disclosure ก่อนเปิด Remote ครั้งแรก
- [ ] กรอก Chrome Web Store Privacy Practices ให้ตรงกับ policy และ code
- [ ] เพิ่ม privacy link ใน Welcome, Settings, Store listing และ Remote page

ผลลัพธ์: network/data behavior ทุกจุดมีคำอธิบายตรงกันทั้งใน UI, policy และ Developer Dashboard

## Phase 7 — Repository และ Dependency Security

- [ ] หยุด track `key.pem` และ `cert.pem`
- [ ] เพิ่ม key/certificate ลง `.gitignore`
- [ ] เพิ่ม script สร้าง self-signed certificate สำหรับ development เท่านั้น
- [ ] เลิกใช้ key เดิมหาก repository เคยถูกแชร์
- [ ] เลือก package manager หนึ่งตัวและสร้าง lockfile
- [ ] Pin dependency version ที่สำคัญ
- [ ] รัน dependency audit หลังมี lockfile
- [ ] ตรวจ license ของทุก dependency และ asset
- [ ] กำหนดตำแหน่ง source model ให้ชัดว่าอยู่ private repository, private artifact storage หรือ Git LFS
- [ ] เพิ่ม secret scan ใน release script
- [ ] ห้าม Store ZIP มี `.pem`, `.key`, debug page, test file หรือ source map

ผลลัพธ์: Build ทำซ้ำได้และไม่มี development secret หลุดใน source/release

## Phase 8 — Runtime Hardening

- [ ] ลบ `chrome.runtime.onMessageExternal` หากไม่ได้ใช้หลังเปลี่ยน Remote เป็น PeerJS data channel
- [ ] ถ้ายังจำเป็น ให้กำหนด `externally_connectable` แบบ allowlist และตรวจ `sender`
- [ ] Validate tab ID, sample rate, latency hint และ control parameter ก่อนใช้งาน
- [ ] เปลี่ยน dynamic `innerHTML` ที่รับข้อมูลภายนอกเป็น DOM API/`textContent`
- [ ] ใช้ CSP แบบ `script-src 'self'` และเพิ่ม `'wasm-unsafe-eval'` เฉพาะเมื่อ AI WASM ต้องใช้จริง
- [ ] จำกัด `connect-src` ให้เหลือ PeerJS production endpoint และ loopback Go engine
- [ ] ให้ Go engine bind เฉพาะ `127.0.0.1`/`localhost`
- [ ] เพิ่ม origin/token validation ให้ Go WebSocket
- [ ] Cleanup MediaStream, AudioContext, Worker, WebSocket และ Peer connection เมื่อ session จบ
- [ ] ตรวจว่า Remote session ไม่รอดข้าม Exit Extension โดยไม่ได้ตั้งใจ

ผลลัพธ์: เว็บไซต์หรือ Extension อื่นไม่สามารถเริ่ม capture หรือควบคุม audio session โดยไม่ได้รับอนุญาต

## Phase 9 — Store Listing และ Reviewer Notes

- [ ] ปรับ Store description ให้มี single purpose ชัดเจน: browser audio/video practice studio
- [ ] อธิบาย `tabCapture`, `offscreen`, `storage`, `activeTab` และ `scripting` ทีละ permission
- [ ] บอกว่า AI model โหลดเมื่อผู้ใช้เปิด AI เท่านั้น
- [ ] บอกว่า Remote เป็น optional feature และเปิดโดย user action
- [ ] บอกว่า recording ใช้กับ content ที่ผู้ใช้เป็นเจ้าของหรือได้รับอนุญาต
- [ ] ระบุว่า Extension ไม่ bypass DRM/paywall และไม่ใช่ media downloader
- [ ] ไม่ใช้คำรับประกันเกินจริง เช่น perfect removal หรือ works everywhere
- [ ] เตรียม Reviewer Notes อธิบายขั้นตอนทดสอบ Audio, AI, Recording และ Remote
- [ ] ใส่ production Remote URL และ Privacy Policy URL ใน Reviewer Notes
- [ ] เตรียม screenshots ที่ตรงกับ UI version 1.0
- [ ] ตรวจ donation ว่า optional/dismissible และไม่แลกกับ install, rating หรือ review

ผลลัพธ์: reviewer สามารถเข้าใจและทดสอบทุกฟีเจอร์โดยไม่ต้องเดาการทำงาน

## Phase 10 — Final Verification

- [ ] รัน test suite ทั้งหมด
- [ ] Build Store ZIP จาก clean checkout ด้วย lockfile
- [ ] ตรวจ manifest schema และ resource references
- [ ] Scan ZIP หา `eval`, `new Function`, remote script, obfuscator runtime, anti-debug และ encrypted executable loader
- [ ] Scan ZIP หา private key, secret, debug page, source map และ test asset
- [ ] ยืนยันว่าไม่มี runtime JavaScript/WASM/model download
- [ ] Load unpacked Store build บน Chrome stable
- [ ] ทดสอบ install ครั้งแรก, Exit/Reopen และ session recovery
- [ ] ทดสอบ Original, Karaoke, Acapella, ECO และ FULL
- [ ] ทดสอบ Web AI และ Go AI
- [ ] ทดสอบ Apple Silicon และ Windows NVIDIA 1050 Ti
- [ ] ทดสอบ recording รวม hide/reopen popup, playback, download และ delete
- [ ] ทดสอบ Remote QR, reconnect, expired token, invalid token และ malformed command
- [ ] ตรวจ network log ว่าตรงกับ Privacy Policy
- [ ] เปรียบเทียบเสียงและ latency กับ baseline ที่ผู้ใช้ยืนยันแล้ว
- [ ] สร้าง SHA-256 checksum ของ ZIP ที่ผ่านการทดสอบ
- [ ] เก็บ Store ZIP ที่ผ่าน test แยกจากทุก build flavor

## Acceptance Criteria

พร้อมส่ง review เมื่อ:

- Extension package ไม่มี obfuscation หรือ anti-analysis behavior
- ไม่มี remote code execution และไม่มี executable payload จาก Remote
- ไม่มี itty.bitty, URL shortener, external QR API หรือ external script CDN ใน Store flow
- Extension ขอ permission เท่าที่จำเป็นหลัง user action
- Privacy Policy, Dashboard disclosure และ network behavior ตรงกัน
- Build มี lockfileและสร้างซ้ำจาก clean checkout ได้
- Store ZIP ผ่าน static scan และไม่มี secret/debug artifact
- Web AI/Go AI/Recording/Remote ทำงานครบ
- คุณภาพเสียงและ latency ไม่ถดถอยจาก baseline

## สิ่งที่ผู้ใช้ต้องทำเอง

งานส่วนนี้ต้องใช้บัญชี การตัดสินใจ หรือการทดสอบจริงจากเจ้าของโครงการ:

- [x] ยืนยันให้ทำเว็บไซต์และ Remote แบบ local ก่อน
- [x] ให้ชื่อผู้พัฒนา `NextFeeder Labs`
- [x] ให้อีเมลติดต่อ `nextfeeder.ts@gmail.com`
- [x] ยืนยันเว็บไซต์ EN/TH โดย EN เป็นค่าเริ่มต้น
- [ ] เลือก production HTTPS domain หลัง local version ผ่านแล้ว
- [ ] Deploy static Remote และ Privacy Policy ที่ผมเตรียมให้ หรืออนุญาต deployment ผ่านระบบที่คุณใช้
- [ ] สร้าง/ยืนยัน Chrome Web Store Developer account และ publisher information
- [ ] กรอก Privacy Practices ใน Developer Dashboard โดยใช้ข้อมูลจาก checklist ที่ผมจะเตรียมให้
- [ ] ทดสอบ Store build บน Apple และ Windows 1050 Ti แล้วแจ้งว่าเสียง/latency ผ่าน
- [ ] จัดเตรียมหรืออนุมัติ icon, screenshots และ promotional images
- [ ] อัปโหลด ZIP ที่มี checksum ตรงกับ release artifact
- [ ] อ่าน Reviewer Notes และกด Submit for Review
- [ ] ส่ง rejection message กลับมาให้แก้หาก Google ขอข้อมูลเพิ่ม

## สิ่งที่ Codex ทำให้ได้

- แก้ source/build/manifest ทั้งหมดตาม Phase 1–10
- สร้าง static Remote application
- สร้าง local QR generator และ secure data-only protocol
- เขียน Privacy Policy draft และ Dashboard disclosure checklist
- ลด permissions และเพิ่ม runtime validation
- เพิ่ม lockfile, audit scripts และ release scanner
- Build Store ZIP และตรวจ artifact
- เขียน Store listing และ Reviewer Notes
- แยกสิ่งที่ต้องให้ผู้ใช้ทดสอบบน hardware จริงอย่างชัดเจน

## ลำดับการทำงาน

1. ทำ Phase 1–8 และสร้างเว็บไซต์/Remote/Privacy แบบ local
2. ผู้ใช้ตรวจหน้า local และเลือก production domain
3. เชื่อม production URL แล้วทำ Phase 9–10
4. สร้าง Store candidate
5. ผู้ใช้ทดสอบ Apple/Windows รอบเดียว
6. แก้เฉพาะ regression ที่พบ แล้วสร้าง final ZIP/checksum
7. ผู้ใช้ deploy เว็บไซต์และอัปโหลด Extension เพื่อส่ง review

## เอกสารอ้างอิงทางการ

- Code Readability Requirements: https://developer.chrome.com/docs/webstore/program-policies/code-readability
- Additional Requirements for Manifest V3: https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
- Remote Hosted Code Guidance: https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
- User Data Policy: https://developer.chrome.com/docs/webstore/user_data
- Declare Permissions: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
