# NextStudio Go Engine / Chrome Web Store Build Isolation Plan

วันที่จัดทำ: 2026-09-12

สถานะ: `[~]` กำลังดำเนินการ — build isolation และ artifact gate ทำเสร็จแล้ว เหลือ manual test/listing/security phase

ผลการลงมือรอบนี้: build profiles, adapter isolation, popup boundary, profile CSP และ automated artifact gate ทำเสร็จแล้ว โดยยังไม่ commit ตามคำสั่งปัจจุบัน

## เป้าหมาย

เก็บ Go Engine และโค้ดที่เกี่ยวข้องไว้ใน repository เพื่อพัฒนาต่อในอนาคต แต่ไม่รวมฟีเจอร์ที่ยังไม่เปิดใช้งานไว้ใน Chrome Web Store build ปัจจุบัน

แนวทางนี้ไม่ใช่การซ่อน functionality จาก reviewer แต่เป็นการส่งเฉพาะ functionality ที่เปิดให้ผู้ใช้จริง โดย Store artifact ต้องตรวจสอบได้ตรงไปตรงมาและไม่มี dead/dormant Go integration ปะปนอยู่

ผลลัพธ์ที่ต้องได้:

- Store build ใช้ Web AI เท่านั้น
- Store ZIP ไม่มี Go binary, Go client, loopback URL หรือ UI ของ Go Engine
- Source code และ test ของ Go ยังอยู่ครบใน repository
- มี Go development build แยกสำหรับทดสอบภายใน
- การแยก build ต้องไม่เปลี่ยน model, DSP, ECO/FULL, latency หรือคุณภาพเสียงของ Web AI
- เมื่อ Go พร้อมใช้งาน สามารถเปิดกลับด้วย build profile โดยไม่ต้องเขียนระบบเสียงซ้ำ

## ขอบเขตที่ห้ามเปลี่ยน

- ห้ามแก้ TensorFlow model weights
- ห้ามแก้ ONNX model weights
- ห้ามแก้ STFT/iSTFT, overlap-add, mask, smoothing หรือ vocal profile
- ห้ามเปลี่ยนค่าเริ่มต้น ECO/FULL
- ห้ามแก้ AudioWorklet cadence และ browser queue ที่ผ่านการฟังแล้ว
- ห้ามลบโฟลเดอร์ `nextstudio-engine-go/`
- ห้ามลบ Go tests หรือ native runtime assets
- ห้ามใช้ obfuscation หรือการเข้ารหัสเพื่อซ่อน Go functionality จาก reviewer

## สถานะปัจจุบัน

สิ่งที่พบในโค้ดปัจจุบัน:

- [x] Go binary ไม่ได้อยู่ใน Store ZIP
- [x] Go source และ binary ถูกเก็บแยกใน `nextstudio-engine-go/`
- [x] `scripts/build-prod.js` build Go เฉพาะ Go development profile
- [x] Store extension bundle ใช้ Store no-op adapter แทน `GoEngineClient`
- [x] Store artifact ไม่มี `go_native`
- [x] Store artifact ไม่มี `ws://127.0.0.1:41919/ws`
- [x] Store popup ไม่มี Go modal, label หรือคำสั่งเลือก Go Engine
- [x] Store manifest CSP ไม่อนุญาต loopback endpoint
- [ ] Go WebSocket ยังใช้ `CheckOrigin: return true` (เก็บไว้ทำใน Phase 8 ก่อนเปิด Go จริง)
- [ ] Go WebSocket ยังไม่มี authentication handshake สำหรับ Extension (เก็บไว้ทำใน Phase 8 ก่อนเปิด Go จริง)

ข้อสำคัญ: การซ่อนปุ่มด้วย CSS/HTML อย่างเดียวไม่ถือว่าแยกฟีเจอร์ออก เพราะ logic และ localhost endpoint ยังอยู่ใน Store bundle

## Build Profiles ที่ต้องมี

ใช้ build script หลักชุดเดียวและเลือก behavior ด้วย profile ห้ามสร้างสำเนา AI manager ทั้งไฟล์

### 1. Store profile

คำสั่งเป้าหมาย:

```bash
npm run build:extension:store
```

ผลลัพธ์:

```text
dist/nextstudio-extension-store/
dist/nextstudio-extension-store.zip
```

คุณสมบัติ:

- Web AI เท่านั้น
- ไม่มี Go UI และ Go runtime logic
- ไม่ build Go binary ระหว่างคำสั่งนี้
- ไม่มี localhost/loopback endpoint ใน manifest หรือ JavaScript
- เป็น ZIP เพียงตัวเดียวที่อนุญาตให้อัปโหลด Chrome Web Store

### 2. Go development profile

คำสั่งเป้าหมาย:

```bash
npm run build:extension:go-dev
```

ผลลัพธ์:

```text
dist/nextstudio-extension-go-dev/
dist/nextstudio-extension-go-dev.zip
nextstudio-engine-go/nextstudio-engine
nextstudio-engine-go/nextstudio-engine.exe
```

คุณสมบัติ:

- Web AI และ Go AI
- มี Go UI และ loopback connection
- build native binaries ก่อน build Extension
- ใช้สำหรับ Load unpacked และ internal testing เท่านั้น
- ชื่อ output ต้องมี `go-dev` ชัดเจนเพื่อป้องกันอัปโหลดผิดตัว

### 3. ค่าเริ่มต้นของ `npm run build`

เพื่อป้องกันอัปโหลด artifact ผิดตัว ให้คำสั่งทั่วไปสร้าง Store build เป็นค่าเริ่มต้น:

```json
{
  "build": "npm run build:web && npm run build:extension:store",
  "build:extension": "npm run build:extension:store",
  "build:extension:store": "node scripts/build-prod.js --profile=store",
  "build:extension:go-dev": "node scripts/build-prod.js --profile=go-dev",
  "build:go": "bash nextstudio-engine-go/build.sh"
}
```

ถ้าต้องการ build ทุก artifact ภายในเครื่อง ให้มีคำสั่งที่ตั้งใจเรียกโดยเฉพาะ เช่น:

```json
{
  "build:all-internal": "npm run build:web && npm run build:extension:store && npm run build:extension:go-dev && npm run build:public-site"
}
```

## Phase 1 — เพิ่ม Profile Parser และ Output Isolation

- [x] ให้ `scripts/build-prod.js` อ่าน `--profile=store` หรือ `--profile=go-dev`
- [x] ปฏิเสธ profile ที่ไม่รู้จักและจบด้วย non-zero exit code
- [x] กำหนด `store` เป็นค่าเริ่มต้นเมื่อไม่ระบุ profile
- [x] แยกชื่อ output directory ตาม profile
- [x] แยกชื่อ ZIP ตาม profile
- [x] ลบคำว่า `Store Ready ZIP` ออกจาก log ของ Go development build
- [x] แสดง profile ใหญ่และชัดเจนตั้งแต่บรรทัดแรกของ build log
- [x] เรียก `nextstudio-engine-go/build.sh` เฉพาะ `go-dev`
- [x] ห้าม Store build อ่านหรือ copy binary จาก `nextstudio-engine-go/`
- [x] เพิ่ม marker file ใน Go development output เช่น `INTERNAL-GO-DEV-BUILD.txt`
- [x] ห้าม marker ดังกล่าวปรากฏใน Store output

Acceptance criteria ของ Phase 1:

- Store และ Go development build ไม่เขียนทับกัน
- `npm run build` ไม่ build Go binary
- ไม่มีโอกาสใช้ชื่อ ZIP เดียวกันระหว่างสอง profile

## Phase 2 — แยก Go Provider ออกจาก Web AI Core

เป้าหมายคือ Store dependency graph ต้องไม่เดินไปถึง `go-engine-client.js`

แนวทางที่ใช้จริง:

- ใช้ stable runtime adapter interface เดียวกันสองแบบ
- Store adapter export เฉพาะ no-op client และค่า Web AI
- Go development adapter export client และค่าของ `GoEngineClient`
- ให้ build pipeline สร้าง isolated source snapshot แล้วเลือก adapter ตาม profile
- ห้ามใช้ static import ของ `GoEngineClient` จาก shared AI manager

รายการงาน:

- [x] ย้าย `GoEngineClient` import ออกจาก shared `ai-vocal-manager.js`
- [x] สร้าง Store engine adapter ที่รู้จักเฉพาะ browser engine
- [x] สร้าง Go development engine adapter ที่เพิ่ม `go_native`
- [x] ให้ adapter expose engine capability/constants ตาม profile
- [x] ให้ shared audio code เรียก provider interface โดยไม่ตรวจ hard-coded localhost URL
- [x] ย้าย URL `ws://127.0.0.1:41919/ws` เข้า Go-only module
- [x] ย้าย Go reconnect/backpressure/stream-token logic เข้า Go-only module
- [x] ใช้ isolated source snapshot และ compile-time profile constants เลือก adapter ตาม profile
- [x] เปิด tree-shaking/minification หลัง profile selection เพื่อกำจัด branch ที่ไม่ได้ใช้
- [x] ห้ามใช้ runtime environment variable เพื่อเปิด Go ใน Store build
- [ ] ห้ามมี hidden keyboard shortcut หรือ storage value ที่เปิด Go ใน Store build ได้
- [x] เมื่อ Store build อ่านค่าเก่า `aiEngineType: go_native` ให้ normalize กลับเป็น Web AI โดยไม่ error

เหตุผลที่ต้องใช้ build-time selection: ถ้าใช้เพียง `if (false)` แต่ยัง static import module อยู่ esbuild อาจยังนำ module หรือ string บางส่วนเข้า bundle ได้ จึงต้องตรวจ dependency graph และ artifact จริงทุกครั้ง

Acceptance criteria ของ Phase 2:

- Store bundle ไม่มี `GoEngineClient`
- Store bundle ไม่มี WebSocket constructor สำหรับ Go path
- การเปิด Original/Karaoke/Acapella และ ECO/FULL ทำงานเหมือน baseline
- Go development build ยังเชื่อม engine ได้เหมือนเดิม

## Phase 3 — แยก UI และ Persisted State

- [x] กำหนด Go modal/setting block ด้วย feature boundary ที่ build script นำออกได้
- [x] Store popup ไม่มีปุ่ม, modal, option, label หรือข้อความแนะนำติดตั้ง Go
- [x] Go development popup แสดง Go controls ตามเดิม
- [ ] Shared popup codeไม่ query หรือ bind event กับ Go-only element ใน Store profile
- [ ] ลบ Go notification message ออกจาก Store bundle
- [x] ลบ fallback device label เช่น `Go Native Core` และ `DIRECTML` ที่ใช้เฉพาะ Go ออกจาก Store bundle
- [x] หาก storage เดิมมี `go_native` ให้ migrate เป็น Web AI หนึ่งครั้ง
- [ ] การ migrate ต้องไม่แก้ ECO/FULL หรือ vocal mode ของผู้ใช้
- [ ] เพิ่ม test สำหรับติดตั้งใหม่และ upgrade จาก build ที่เคยเลือก Go

Acceptance criteria ของ Phase 3:

- ผู้ใช้ Store build ไม่เห็น Go ในทุกหน้า
- Store build ไม่ค้าง `Loading AI` เมื่อ storage เก่าระบุ Go
- Go development build ยังสลับ Web/Go ได้

## Phase 4 — สร้าง Manifest/CSP ตาม Profile

### Store manifest

- [x] ไม่เพิ่ม `nativeMessaging` permission
- [x] ลบ `ws://127.0.0.1:*`
- [x] ลบ `http://127.0.0.1:*`
- [x] ลบ `ws://localhost:*`
- [x] ลบ `http://localhost:*`
- [x] ตรวจว่า `host_permissions` ไม่มี entry ที่เพิ่มมาเพื่อ Go
- [x] ตรวจว่า `web_accessible_resources` ไม่มี Go-only file

### Go development manifest

- [x] อนุญาต loopback เท่าที่ใช้งานจริงใน Go development profile
- [x] จำกัด port เป็น `41919` ใน Go development CSP
- [x] ไม่เพิ่ม remote domain สำหรับ Go Engine
- [x] ติด label ใน description ว่า Internal Go Development

Acceptance criteria ของ Phase 4:

- Store manifest ไม่มี network capability สำหรับ Go
- Go development manifest เชื่อม loopback ได้
- Manifest ทั้งสองผ่าน JSON/schema validation

## Phase 5 — แยก Listing และ Privacy ตาม Feature ที่เปิดจริง

Store release ที่ยังไม่มี Go:

- [ ] Store description ไม่โฆษณา Go Engine
- [ ] Store screenshots ไม่มี Go controls
- [ ] Reviewer Notes ไม่บอกให้ reviewer ติดตั้ง Go
- [ ] Privacy Policy อธิบาย Web AI behavior ที่เปิดจริง
- [ ] ถ้าต้องเก็บข้อความ Go ไว้สำหรับอนาคต ให้เก็บในเอกสาร draft ที่ไม่ deploy เป็น policy ปัจจุบัน
- [ ] Chrome Web Store Privacy Practices ต้องตรงกับ Store artifact

เมื่อเปิด Go ในอนาคต:

- [ ] อัปเดต Store description ก่อนส่ง release
- [ ] ระบุว่า Go เป็น optional local companion application
- [ ] ระบุว่า audio ถูกส่งผ่าน loopback เพื่อประมวลผลในเครื่อง
- [ ] ระบุว่า audio ไม่ถูกอัปโหลดไป NextFeeder Labs
- [ ] ระบุแหล่งดาวน์โหลดและผู้เผยแพร่ native application
- [ ] เพิ่ม Reviewer Notes พร้อมขั้นตอนติดตั้งและทดสอบ

## Phase 6 — Automated Artifact Gate

เพิ่ม `scripts/verify-extension-artifact.js` ให้เปิดและตรวจไฟล์ใน Store directory/ZIP จริง

Store build ต้อง fail หากพบคำหรือ artifact เหล่านี้:

```text
127.0.0.1:41919
localhost:41919
go_native
GoEngineClient
Go Native Core
ACTIVATE GO ENGINE
nextstudio-engine.exe
nextstudio-engine
nativeMessaging
```

รายการตรวจเพิ่มเติม:

- [x] ตรวจชื่อไฟล์ใน ZIP ว่าไม่มี `.exe`, `.dylib`, `.dll`, Go source หรือ native host manifest
- [x] ตรวจ JavaScript หลัง bundle ไม่ใช่เฉพาะ source
- [x] ตรวจ `manifest.json` หลัง generate
- [x] ตรวจ HTML หลัง minify
- [x] ตรวจ CSS เผื่อมี hidden Go label
- [x] ตรวจ source map และ debug artifact
- [x] ตรวจว่า Store ZIP ถูกสร้างจาก Store directory เท่านั้น
- [x] ให้ build จบด้วย error ทันทีหาก gate ไม่ผ่าน
- [x] พิมพ์ SHA-256 ของ Store ZIP เมื่อผ่าน

ข้อยกเว้นของ scanner ต้องกำหนดให้น้อยที่สุด ห้ามใช้ broad ignore ที่ทำให้ Go endpoint หลุดผ่านได้

## Phase 7 — Test Matrix

การตรวจอัตโนมัติที่ทำแล้ว:

- [x] Store และ Go-dev JavaScript ผ่าน syntax validation ทุกไฟล์
- [x] Store artifact gate ผ่านหลังสร้าง directory และ ZIP จริง
- [x] Go-dev artifact gate ผ่าน และมี internal marker ใน ZIP
- [x] `go test ./...` ผ่านบนเครื่อง build ปัจจุบัน
- [x] `node scripts/build-prod.js --profile=invalid` ปฏิเสธ profile ด้วย exit code 1

### Store build

- [ ] ติดตั้งใหม่จาก `nextstudio-extension-store/`
- [ ] เปิด/ปิด Extension และทดสอบ Exit/Reopen
- [ ] Original ทำงาน
- [ ] Karaoke ทำงาน
- [ ] Acapella ทำงาน
- [ ] ECO ทำงานและเป็นค่าเริ่มต้น
- [ ] FULL ทำงาน
- [ ] AI ไม่โหลดจนกว่าผู้ใช้เปิด
- [ ] Remote และ recording ทำงานตามขอบเขต release
- [ ] ไม่มี request ไป `127.0.0.1` หรือ `localhost` ใน DevTools Network
- [ ] ไม่มี Go error หรือ reconnect timer ใน console
- [ ] ทดสอบ Apple Silicon
- [ ] ทดสอบ Windows NVIDIA 1050 Ti
- [ ] เปรียบเทียบเสียงกับ Store baseline ก่อนแยก build

### Go development build

- [ ] Web AI ทำงาน
- [ ] Go Engine offline แสดงสถานะอย่างเหมาะสม
- [ ] เปิด native engine แล้วเชื่อมต่อสำเร็จ
- [ ] Karaoke/Acapella ส่งและรับ output
- [ ] สลับ Web/Go หลายรอบโดยไม่ค้าง
- [ ] เปลี่ยนเพลงและ Exit/Reopen โดย session ไม่ค้าง
- [ ] ปิด native engine ระหว่างเล่นแล้ว fallback/stop อย่างปลอดภัย
- [x] Go tests ผ่านบน macOS build host และ Windows target compile ผ่าน
- [ ] รัน Go tests บน Windows runtime จริง

## Phase 8 — Go Security ก่อนเปิดให้ผู้ใช้จริง

Phase นี้ยังไม่ต้องเปิดใน Store release ปัจจุบัน แต่ต้องทำก่อน re-enable Go:

- [ ] เปลี่ยน `CheckOrigin: return true`
- [ ] Allowlist เฉพาะ production Extension origin ที่ต้องการ
- [ ] กำหนด policy สำหรับ unpacked development origin แยกจาก production
- [ ] เพิ่ม authenticated handshake ก่อนยอมรับ audio packet
- [ ] ใช้ session token ที่สุ่มใหม่และมีอายุจำกัด
- [ ] ปฏิเสธ binary packet ก่อน handshake สำเร็จ
- [ ] ปิด `Access-Control-Allow-Origin: *` ที่ health endpoint
- [ ] จำกัด method และ response ของ health endpoint
- [ ] จำกัด connection count, message size และ rate
- [ ] Bind เฉพาะ `127.0.0.1` และห้าม fallback เป็น `0.0.0.0`
- [ ] ไม่รับ path อื่นนอกจาก `/health` และ `/ws`
- [ ] ไม่ให้ WebSocket เรียก shell, เปิดไฟล์ หรือรันคำสั่งระบบ
- [ ] ทำ code signing/notarization สำหรับ Windows/macOS binary
- [ ] แจก binary ผ่าน HTTPS domain ที่ผู้พัฒนาควบคุม
- [ ] แสดง checksum และ version compatibility
- [ ] ตัดสินใจอีกครั้งว่าจะใช้ loopback WebSocket ต่อหรือย้ายเป็น Chrome Native Messaging
- [ ] หากใช้ Native Messaging ให้ประกาศ permission และ `allowed_origins` อย่างโปร่งใส

## Suggested Commit Groups เมื่อเริ่มทำจริง

### Commit A — Build profiles

- package scripts
- profile parser
- output directory/ZIP isolation
- conditional Go binary build

### Commit B — Provider/UI isolation

- engine registry/adapter
- Store UI removal
- storage migration
- Store manifest/CSP generation

### Commit C — Verification

- no-Go artifact scanner
- Store/Go-dev tests
- documentation และ reviewer checklist

ห้าม commit ระหว่างแต่ละกลุ่มจนกว่าจะตรวจ diff และ build ของกลุ่มนั้นผ่าน

## Definition of Done สำหรับ Release ปัจจุบัน

ถือว่าแยก Go ออกจาก Store release สำเร็จเมื่อครบทุกข้อ:

- [x] `npm run build` สร้าง Web + Store Extension โดยไม่ build Go
- [x] `npm run build:extension:store` ผ่าน
- [x] `npm run build:extension:go-dev` ผ่าน
- [x] Store ZIP ไม่มี Go binary/source/client/UI/string/endpoint
- [x] Store manifest ไม่มี loopback CSP และไม่มี `nativeMessaging`
- [x] Store runtime ไม่พยายามเชื่อม localhost
- [ ] Go source, native assets และ tests ยังอยู่ครบ
- [ ] Go development build ยังเชื่อม native engine ได้ (ต้องทดสอบ runtime บนเครื่องจริง)
- [ ] Web AI คุณภาพเสียงและ latency ไม่เปลี่ยนจาก baseline
- [ ] Store listing, Privacy Policy และ Reviewer Notes ตรงกับ functionality ที่เปิดจริง
- [ ] ยังไม่มีการเปิด Go ให้ผู้ใช้ Store จนกว่า Phase 8 จะผ่าน

## เอกสารที่เกี่ยวข้อง

- `CHROME-WEB-STORE-APPROVAL-PLAN.md`
- `CHROME-WEB-STORE-RELEASE-HARDENING-PLAN.md`
- `NEXTSTUDIO-PUBLIC-WEB-DEPLOY-PLAN.md`
- Chrome Native Messaging: https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging
- Chrome Web Store Code Readability: https://developer.chrome.com/docs/webstore/program-policies/code-readability
- Manifest V3 Requirements: https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
- User Data FAQ: https://developer.chrome.com/docs/webstore/user_data
