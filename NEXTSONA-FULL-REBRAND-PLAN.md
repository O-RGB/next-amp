# NextSona Full Rebrand Plan

สถานะ: **แผนเท่านั้น — ยังไม่ได้เริ่มเปลี่ยนชื่อใน source, build หรือ Store และยังไม่ได้ commit**

วันที่สำรวจ repository: 14 กันยายน 2026  
branch ที่สำรวจ: `optimization`

## 1. เป้าหมาย

เปลี่ยนแบรนด์ที่โครงการเป็นเจ้าของจาก `NextStudio` และชื่อเก่า `NextAmp` เป็น
`NextSona` ให้ครบทั้ง Extension, Web player, Public site, Remote, Go engine,
Model builder, build artifacts, เอกสาร และข้อมูลบน Chrome Web Store โดยต้อง:

- ไม่เปลี่ยนพฤติกรรม DSP หรือคุณภาพ AI Vocal
- ไม่เพิ่ม latency, CPU, GPU หรือขนาดโมเดลเพราะการเปลี่ยนชื่อ
- ไม่ทำให้ค่าตั้งเดิม รายการอัดเสียง หรือ session ที่ควรจำหาย
- ไม่ทำให้ Store build เผลอรวม Go engine
- ไม่เปลี่ยน Extension ID หรือสร้างรายการ Chrome Web Store ใหม่
- ไม่แก้ชื่อและเครดิตของ dependency, โมเดลต้นทาง หรือเจ้าของลิขสิทธิ์ภายนอก

## 2. Naming contract ที่ต้องใช้เหมือนกันทุกส่วน

| บริบท | ค่าใหม่ |
|---|---|
| ชื่อแบรนด์เต็ม | `NextSona` |
| ตัวพิมพ์ใหญ่สำหรับ UI | `NEXTSONA` |
| ชื่อเต็มบน Store | `NextSona - Pitch Shifter, AI Vocal & Video Sync` |
| ชื่อ package/slug | `nextsona` |
| Extension source | `nextsona-extension/` |
| Store artifact | `dist/nextsona-extension-store.zip` |
| Go development artifact | `dist/nextsona-extension-go-dev.zip` |
| Standalone Web artifact | `dist/nextsona-web-prod/` |
| Public site source | `nextsona-public-site/` |
| Go engine | `nextsona-engine` / `nextsona-engine.exe` |
| Model builder | `nextsona-model-builder/` |
| ผู้พัฒนา | `NextFeeder Labs` — **คงเดิม** |
| อีเมล | `nextfeeder.ts@gmail.com` — **คงเดิม** |
| Donate URL | `https://ganknow.com/nextfeederlabs/tip` — **คงเดิม** |

ข้อสำคัญ:

- ใช้ `NextSona` เป็นชื่อผลิตภัณฑ์ ไม่ใช้ `Sona` เดี่ยว ๆ ใน manifest, Store,
  Privacy Policy หรือ Terms เพราะ `Sona` มีซอฟต์แวร์อื่นใช้อยู่แล้ว
- ใช้ `SONA` เดี่ยว ๆ ได้เฉพาะกรณีเป็นโลโก้ย่อที่พื้นที่ไม่พอ และต้องไม่ทำให้
  ผู้ใช้เข้าใจว่าเป็นชื่อทางกฎหมายของผลิตภัณฑ์
- อย่าเปลี่ยน `NextFeeder Labs` เป็น `NextSona Labs`; ผู้พัฒนากับชื่อผลิตภัณฑ์
  เป็นคนละข้อมูล
- อย่าแทนข้อความด้วย search/replace แบบทั้ง repository โดยไม่แยกประเภท

## 3. Mapping คำเก่า

| คำเก่า | คำใหม่ | วิธีจัดการ |
|---|---|---|
| `NextStudio` | `NextSona` | เปลี่ยนข้อความและชื่อที่โครงการเป็นเจ้าของ |
| `NEXTSTUDIO` | `NEXTSONA` | เปลี่ยน UI/build constants แบบ atomic |
| `nextstudio` | `nextsona` | เปลี่ยน slug/path/key พร้อม migration |
| `NextAmp` | `NextSona` | เปลี่ยนเฉพาะสิ่งที่เป็นแบรนด์เก่าของโครงการ |
| `NEXTAMP` | `NEXTSONA` | เปลี่ยนเฉพาะ owned identifiers |
| `nextamp` / `next-amp` | `nextsona` | เปลี่ยน path/slug ที่เราเป็นเจ้าของ พร้อมแก้ reference |

ห้ามเปลี่ยนคำที่เป็นข้อมูลบุคคลที่สาม เช่น ชื่อโมเดล `MGM_MAIN_v4`, `UVR`,
`MDX-Net`, TensorFlow.js, ONNX Runtime, Signalsmith Stretch, PeerJS และข้อความ
license ของเจ้าของเดิม

## 4. จุดตัดสินใจก่อนเริ่มแก้

- [ ] ยืนยันครั้งสุดท้ายว่าชื่อ public คือ `NextSona` ไม่ใช่ `Sona`
- [ ] ตรวจเครื่องหมายการค้าอย่างเป็นทางการในประเทศเป้าหมาย โดยเน้น Class 9
  และ Class 42; การค้นเว็บที่ผ่านมาไม่ใช่ legal clearance
- [ ] เลือก canonical public URL ใหม่
  - แนะนำ: `https://nextsona.nextfeeder.com`
  - ถ้าคง `https://studio.nextfeeder.com` ต้องยอมรับว่า URL ยังมีชื่อเก่าเชิงแนวคิด
- [ ] เตรียม redirect จาก URL เก่าไป URL ใหม่ก่อนแก้ QR/Store links
- [ ] ถ้า Chrome Web Store รุ่นปัจจุบันยังอยู่ระหว่าง review ให้รอผลก่อน แล้วส่ง
  rebrand เป็น version ถัดไปใน listing เดิม
- [ ] สร้าง baseline commit/tag ก่อนแตะ rebrand เพื่อย้อนกลับได้ง่าย

## 5. Phase A — เปลี่ยนชื่อโครงสร้างโครงการ

ใช้ `git mv` เท่านั้นเพื่อรักษาประวัติไฟล์:

- [ ] `next-amp-extension/` → `nextsona-extension/`
- [ ] `nextstudio-engine-go/` → `nextsona-engine-go/`
- [ ] `nextstudio-model-builder/` → `nextsona-model-builder/`
- [ ] `nextstudio-public-site/` → `nextsona-public-site/`
- [ ] `assets/extension/next-amp.png` → `assets/extension/nextsona.png`
- [ ] `assets/extension/next-amp-extension.zip` →
  `assets/extension/nextsona-extension.zip` หรือเลิกเก็บ ZIP เก่าใน source ถ้าไม่ใช้
- [ ] `nextsona-public-site/assets/images/next-studio.png` → ชื่อใหม่ที่สื่อชัด เช่น
  `nextsona-showcase.png`
- [ ] เปลี่ยนชื่อเอกสารที่ขึ้นต้น `NEXTSTUDIO-` เป็น `NEXTSONA-`
- [ ] เปลี่ยน `nextstudio-model-builder/NEXTSTUDIO-MODEL-BUILDER-PLAN.md` เป็น
  `NEXTSONA-MODEL-BUILDER-PLAN.md`

หลังย้าย folder ต้องแก้ path reference ในไฟล์เหล่านี้พร้อมกัน:

- [ ] `package.json` และ `package-lock.json`
- [ ] `.gitignore`
- [ ] `tailwind.config.cjs`
- [ ] `scripts/build-prod.js`
- [ ] `scripts/build-web.js`
- [ ] `scripts/build-public-site.js`
- [ ] `scripts/verify-extension-artifact.js`
- [ ] `scripts/test-review-readiness.mjs`
- [ ] `scripts/audit-copyright-provenance.mjs`
- [ ] `ai-vocal-engine/build.sh`
- [ ] import/path ทั้งหมดใน `ai-vocal-engine/test/`, `ai-vocal-engine/tools/`
  และ `ai-vocal-engine/demo/`
- [ ] build/deploy/verify scripts ภายใน Model builder
- [ ] เอกสารทุกไฟล์ที่มี path เก่า

หมายเหตุ: ชื่อ folder repository ภายนอกปัจจุบันคือ `next-amp` การเปลี่ยน folder นี้
ต้องทำหลังปิดโปรแกรมที่ใช้งาน workspace และอาจต้องเปลี่ยนชื่อ Git remote repository
ด้วย จึงไม่ควรทำกลางการแก้ source

## 6. Phase B — Extension ที่ผู้ใช้เห็น

### B1. Manifest และ package identity

- [ ] แก้ `nextsona-extension/manifest.json`
  - `name` → `NextSona - Pitch Shifter, AI Vocal & Video Sync`
  - คง description ของฟีเจอร์เดิม เว้นแต่ใส่ชื่อผลิตภัณฑ์ให้เปลี่ยนเป็น `NextSona`
  - คง permissions และ CSP เดิม
  - คง icon path ถ้ายังใช้ภาพเดิม
- [ ] แก้ root `manifest.json` สำหรับ Web/PWA
  - `name`, `short_name`, `description`, icon URL และ start URL ที่เกี่ยวข้อง
- [ ] แก้ root `package.json`
  - `name` → `nextsona`
  - `description` → ชื่อเต็มใหม่
- [ ] regenerate `package-lock.json` จาก `package.json`; ห้ามแก้ lock file แบบสุ่ม
- [ ] bump version ตอนทุก phase ผ่านแล้วเท่านั้น แนะนำ rebrand release เป็น `1.1.0`
- [ ] ยืนยันว่าใช้ Chrome Web Store listing เดิมเพื่อรักษา Extension ID และผู้ใช้เดิม

### B2. Popup, Welcome และหน้าภายใน

เปลี่ยน user-facing copy และ accessibility labels ใน:

- [ ] `nextsona-extension/popup.html`
- [ ] `nextsona-extension/player.html`
- [ ] `nextsona-extension/welcome.html`
- [ ] `nextsona-extension/debug-ai.html`
- [ ] `nextsona-extension/modules/settings-modal.js`
- [ ] `nextsona-extension/video-delay.js` สำหรับ toast ที่ฉีดในหน้าเว็บ
- [ ] `nextsona-extension/background.js`
- [ ] `nextsona-extension/offscreen.js`
- [ ] `nextsona-extension/modules/ai-vocal/go-engine-client.js`
- [ ] `nextsona-extension/modules/ai-vocal/vocal-worker.js`
- [ ] `nextsona-extension/modules/ai-vocal/vocal-worklet.js`
- [ ] `nextsona-extension/modules/ai-vocal/model-optimizer.mjs`

ตรวจข้อความต่อไปนี้เป็นพิเศษ:

- [ ] `<title>`, heading, footer, modal, toast และ notification
- [ ] `alt`, `aria-label`, `aria-live` และข้อความ screen reader
- [ ] Donate copy เช่น `SUPPORT NEXTSONA` และ `ENJOYING NEXTSONA?`
- [ ] error/warning/log prefix ที่ผู้ใช้หรือ developer อาจเห็น
- [ ] onboarding เช่น `Welcome to NextSona`
- [ ] ข้อความ Privacy disclosure ใน popup
- [ ] คำแนะนำ Go engine ให้เรียก executable ใหม่ว่า `nextsona-engine`

### B3. Extension Remote

- [ ] `nextsona-extension/remote/index.html`
- [ ] `nextsona-extension/remote/app.js`
- [ ] `nextsona-extension/remote/sw.js`
- [ ] `nextsona-extension/remote/styles.css` เฉพาะ comment/class ที่เป็น brand-owned
- [ ] ถ้ามี generated `remote-ui-bundle.js` ให้แก้ source แล้ว generate ใหม่ ห้ามแก้ bundle
  อย่างเดียว

ต้องตรวจให้ Remote ที่เปิดจาก QR ใช้ copy, protocol version และ public URL ใหม่
พร้อมกัน ห้ามเปลี่ยนเฉพาะหน้าเว็บจน host กับ phone คนละ protocol

## 7. Phase C — Web player เดิมที่ root

เปลี่ยนชื่อและ SEO ใน:

- [ ] `index.html`
- [ ] `app.html`
- [ ] `remote.html`
- [ ] `dos-remote.html`
- [ ] `install-extension.html`
- [ ] `assets/libs/js/app.js`
- [ ] `sw.js`
- [ ] `assets/THIRD-PARTY-NOTICES.txt`
- [ ] `assets/libs/js/LAMEJS-NOTICE.txt` เฉพาะข้อความของโครงการ ห้ามแตะ license เดิม

ตรวจทุกประเภทข้อมูล:

- [ ] `<title>` และ `meta description`
- [ ] SEO keywords
- [ ] Open Graph และ Twitter metadata
- [ ] `apple-mobile-web-app-title`
- [ ] JSON-LD/schema `name`
- [ ] header, footer, manual title และ error message
- [ ] Media Session metadata เช่น artist/app name
- [ ] download link และชื่อ ZIP/PNG
- [ ] URL เก่า `next-amp-player.vercel.app`

ถ้า URL เก่ายังมีผู้ใช้ ให้ redirect แทนการปิดทันที และห้ามให้ URL เก่ากลับมาเป็น
canonical/OG URL ใน build ใหม่

## 8. Phase D — Public site แบบ static/no-build

Public site ต้องยัง deploy ได้โดยวาง static files โดยตรง ไม่บังคับ build เพิ่ม

เปลี่ยนใน:

- [ ] `nextsona-public-site/index.html`
- [ ] `nextsona-public-site/404.html`
- [ ] `nextsona-public-site/remote/index.html`
- [ ] `nextsona-public-site/privacy/index.html`
- [ ] `nextsona-public-site/terms/index.html`
- [ ] `nextsona-public-site/site.webmanifest`
- [ ] `nextsona-public-site/assets/js/site.js`
- [ ] `nextsona-public-site/assets/js/remote.js`
- [ ] `nextsona-public-site/assets/js/remote-protocol.js`
- [ ] `nextsona-public-site/README.md`
- [ ] `nextsona-public-site/THIRD-PARTY-NOTICES.txt`
- [ ] `nextsona-public-site/sitemap.xml`
- [ ] `nextsona-public-site/robots.txt`
- [ ] `nextsona-public-site/vercel.json`

### D1. ภาษาและ SEO

- [ ] เปลี่ยนข้อความ EN/TH ทั้งคู่ ไม่แก้เพียงภาษาที่มองเห็นตอนโหลดครั้งแรก
- [ ] เปลี่ยน `<title>`, description, OG, Twitter, structured data และ image alt
- [ ] เปลี่ยน canonical URLs, sitemap และ redirect rules หลังเลือก domain แล้ว
- [ ] คงค่าเริ่มต้นภาษา EN ตามเดิม
- [ ] Privacy/Terms ต้องใช้ชื่อเต็ม `NextSona` ทุกครั้ง
- [ ] คงชื่อผู้ควบคุม/ผู้พัฒนาเป็น `NextFeeder Labs`
- [ ] เพิ่มข้อความสั้นใน Terms/Privacy ว่า `NextSona was previously named NextStudio`
  เฉพาะช่วงเปลี่ยนผ่าน หากจำเป็นต่อความต่อเนื่องของ policy
- [ ] ปรับ effective date และ version ของ Privacy/Terms เมื่อ deploy จริง

### D2. รูปภาพที่มีชื่อเก่าฝังอยู่

เปิดตรวจด้วยตา ไม่ตัดสินจากชื่อไฟล์อย่างเดียว:

- [ ] `assets/images/nextsona-showcase.png`
- [ ] `assets/images/extension-preview.png`
- [ ] `assets/images/og-image.png`
- [ ] `assets/images/showcase-reference.png`
- [ ] `assets/images/screenshots/extension-overview.png`
- [ ] `assets/images/screenshots/extension-detail.png`
- [ ] `assets/images/screenshots/video-preview.png`
- [ ] `assets/images/screenshots/remote-preview.png`
- [ ] `assets/images/logo.png`

ถ้ารูปมีคำว่า NextStudio/NextAmp ให้ capture ใหม่จาก UI จริงหลัง rebrand ห้ามใช้ภาพ
จำลองที่ไม่ตรงกับ Extension จริง

## 9. Phase E — Storage, cache และ compatibility

ส่วนนี้ห้ามใช้ replace ตรง ๆ เพราะทำให้ข้อมูลผู้ใช้เดิมหาย

### E1. Settings และภาษา

- [ ] key ใหม่: `nextsona_settings_v9_stable`
- [ ] อ่าน key ใหม่ก่อน ถ้าไม่มีให้ fallback ไป `nextstudio_settings_v9_stable`
- [ ] เมื่ออ่าน key เก่าสำเร็จ ให้เขียนสำเนาไป key ใหม่หนึ่งครั้ง
- [ ] ห้ามลบ key เก่าใน release แรกของ rebrand
- [ ] เปลี่ยน `nextstudio-language` → `nextsona-language` ทั้ง public site และ Remote
  ด้วย migration แบบเดียวกัน
- [ ] ตรวจ `chrome.storage`, `localStorage`, `sessionStorage` และ IndexedDB เพิ่มเติมด้วย
  `rg` เพราะอาจมี key ที่ไม่ได้อยู่ในรายการนี้

### E2. Recordings/IndexedDB

พบชื่อเดิมอย่างน้อย:

- `NextStudioDB`
- `NextStudioUltimateDB`

แนวทางปลอดภัย:

- [ ] release แรกให้เปิด DB เดิม อ่านจำนวน recording และ schema version
- [ ] สร้าง DB ใหม่ `NextSonaDB` / `NextSonaUltimateDB`
- [ ] copy records และ metadata ใน transaction
- [ ] ตรวจจำนวน/primary key หลัง copy ก่อนตั้ง migration-complete flag
- [ ] ถ้า migration ล้มเหลว ให้ใช้ DB เดิมต่อ ห้ามแสดงรายการว่างและห้ามลบข้อมูล
- [ ] ห้าม delete DB เก่าอัตโนมัติ
- [ ] ทดสอบ update install ที่มี recording จริงอย่างน้อย 3 รายการ

ถ้าไม่ต้องการรับความเสี่ยง migration ใน release นี้ ให้คงชื่อ DB เก่าเป็น internal
compatibility identifier ได้ เพราะผู้ใช้ไม่เห็น และบันทึกเป็นข้อยกเว้นใน final audit

### E3. Service Worker cache

- [ ] `nextstudio-${CACHE_VERSION}` → `nextsona-${CACHE_VERSION}` ใน Web และ Remote
- [ ] ใน `activate` ให้ลบเฉพาะ cache ที่ขึ้นต้นด้วย prefix เก่าที่ระบุชัด
- [ ] ห้ามล้าง Cache Storage ทั้ง origin
- [ ] bump cache version เพื่อไม่ให้ HTML/JS คนละแบรนด์ปะปนกัน

## 10. Phase F — Internal runtime identifiers

เปลี่ยนเป็นชุดเดียวและแก้ producer/consumer พร้อมกัน:

- [ ] DOM id `nextstudio-action-notification` → `nextsona-action-notification`
- [ ] AudioWorklet processor `nextstudio-ai-vocal-processor` →
  `nextsona-ai-vocal-processor` ทั้ง `registerProcessor()` และ `AudioWorkletNode`
- [ ] global `NextStudioRemoteProtocol` → `NextSonaRemoteProtocol`
- [ ] message/event เช่น `NEXTSTUDIO_KERNEL_BENCH` → `NEXTSONA_KERNEL_BENCH`
- [ ] build define `__NEXTSTUDIO_GO_ENGINE_ENABLED__` →
  `__NEXTSONA_GO_ENGINE_ENABLED__`
- [ ] build define `__NEXTSTUDIO_GO_ENGINE_TYPE__` → `__NEXTSONA_GO_ENGINE_TYPE__`
- [ ] placeholder `__NEXTSTUDIO_WEB_ASSET_KEY__` → `__NEXTSONA_WEB_ASSET_KEY__`
- [ ] marker comment `NEXTSTUDIO_GO_ENGINE_BEGIN/END` →
  `NEXTSONA_GO_ENGINE_BEGIN/END`
- [ ] magic header `NAMPWEB1` → header ใหม่ขนาดเท่าเดิม เช่น `NSONAWB1` โดยแก้
  encrypt/decrypt/verify พร้อมกัน
- [ ] hash seed `nextstudio_` และ `nextstudio_web_` → `nextsona_` / `nextsona_web_`

สำหรับ Remote protocol ให้ expose alias ชื่อเก่าเป็นเวลาอย่างน้อยหนึ่ง release หากหน้า
Remote เก่าที่ยัง cache อยู่มีโอกาสเชื่อมกับ Extension ใหม่ จากนั้นค่อยถอด alias เมื่อ
redirect และ cache migration ทำงานครบ

## 11. Phase G — Build profiles และ artifact names

แก้ `scripts/build-prod.js`, `scripts/build-web.js`, verification scripts และ npm scripts:

- [ ] source path ใหม่ทั้งหมด
- [ ] `nextstudio-extension-store` → `nextsona-extension-store`
- [ ] `nextstudio-extension-go-dev` → `nextsona-extension-go-dev`
- [ ] `nextstudio-web-prod` → `nextsona-web-prod`
- [ ] `nextstudio-public-site` → `nextsona-public-site`
- [ ] build banner/log → `NEXTSONA`
- [ ] internal Go build note → `NextSona`
- [ ] artifact verifier blacklist เปลี่ยน `nextstudio-engine` เป็น `nextsona-engine`
- [ ] Store profile ยังต้อง exclude Go source, binary, localhost bridge UI และ internal
  security behavior ตามกติกาเดิม
- [ ] Go development profile ยังต้องรวมเฉพาะสิ่งที่ profile เดิมอนุญาต
- [ ] `npm run build` ต้องยัง build Web + Store Extension ตามเดิม
- [ ] Public site ยังคงเป็น static source ที่ deploy ได้โดยตรง; ถ้าเก็บ
  `build:public-site` ไว้ ให้เป็นคำสั่งเสริม ไม่ใช่ requirement

## 12. Phase H — Go engine

### H1. Source และ binary

- [ ] Go module `nextstudio-engine-go` → `nextsona-engine-go`
- [ ] แก้ import ใน `main.go`, tests และ package paths
- [ ] `nextstudio-engine` → `nextsona-engine`
- [ ] `nextstudio-engine.exe` → `nextsona-engine.exe`
- [ ] console title, dashboard, connect/disconnect logs และ handshake engine label
  → `NextSona`
- [ ] build script banner และ output list → `NEXTSONA`
- [ ] popup instruction และ process detection ใช้ executable ใหม่ตรงกัน

### H2. Cache และ environment variables

- [ ] cache directory `NextStudio` → `NextSona`
- [ ] ไม่ต้องลบ cache เก่า; runtime สามารถ extract runtime ใหม่ลง cache ใหม่ได้
- [ ] `NEXTSTUDIO_USE_LOCAL_MODEL` → `NEXTSONA_USE_LOCAL_MODEL`
- [ ] `NEXTSTUDIO_RUN_COREML_BENCH` → `NEXTSONA_RUN_COREML_BENCH`
- [ ] `NEXTSTUDIO_RUN_COMPACT_ONNX` → `NEXTSONA_RUN_COMPACT_ONNX`
- [ ] รองรับ env ชื่อเก่าเป็น fallback หนึ่งช่วงพัฒนาเพื่อไม่ให้คำสั่ง local พังทันที

### H3. Model output names

พบชื่อ tensor ภายใน:

- `NextAmp/compact_output`
- `NextAmp/compact_output_head/`
- `NextAmp/compact_roi/`

ห้ามแก้ string ฝั่ง Go อย่างเดียว เพราะ ONNX session จะหา output ไม่พบ:

- [ ] เปลี่ยน namespace ใน Model builder ก่อน
- [ ] build ONNX ใหม่
- [ ] ตรวจชื่อ output ของโมเดลจริง
- [ ] แก้ Go constants ให้ตรงกับ output ใหม่
- [ ] run native model inference equivalence test
- [ ] ถ้า output graph เปลี่ยนชื่อไม่ได้โดยไม่กระทบโมเดล ให้คง namespace เก่าเป็น
  internal model-schema exception และห้ามแสดงต่อผู้ใช้

## 13. Phase I — Model builder โดยไม่เปลี่ยนเสียง

เปลี่ยนโครงสร้างและ metadata เท่านั้น ห้ามเปลี่ยน weight/calibration/config:

- [ ] package name → `nextsona-model-builder`
- [ ] README และ plan → `NextSona Model Builder`
- [ ] Docker env:
  - `NEXTSTUDIO_MODEL_PYTHON` → `NEXTSONA_MODEL_PYTHON`
  - `NEXTSTUDIO_TFJS_CONVERTER` → `NEXTSONA_TFJS_CONVERTER`
- [ ] scripts `build.sh`, `verify.sh`, `deploy.sh` ใช้ path ใหม่
- [ ] provenance field `builder` → `nextsona-model-builder`
- [ ] JS export `NEXTSTUDIO_OPTIMIZATION_METADATA` →
  `NEXTSONA_OPTIMIZATION_METADATA`
- [ ] metadata key `nextstudioModelOptimization` → `nextsonaModelOptimization`
- [ ] runtime loader ต้องอ่าน key ใหม่ก่อนและรองรับ key เก่าเป็น fallback
- [ ] namespace `NextStudio/optimized_output_head`, `NextStudio/roi_*` → `NextSona/...`
  เฉพาะเมื่อ graph rewrite tests ผ่าน
- [ ] regenerate TFJS model และ ONNX จาก source เดิม
- [ ] ยืนยันว่า weight count, tensor shape, input/output contract และ numerical output
  เท่าเดิมภายใน tolerance เดิม
- [ ] deploy model หลัง verify สำเร็จเท่านั้น

การเปลี่ยน metadata/namespace ทำให้ hash ของ `model.json` เปลี่ยนได้ แต่ไฟล์ weights
และผลเสียงต้องไม่เปลี่ยน ถ้า weights hash เปลี่ยนโดยไม่ได้ตั้งใจ ให้หยุดและย้อน phase นี้

## 14. Phase J — เอกสาร, license และ audit files

### J1. เอกสาร Store/Release ที่ต้องอัปเดต

- [ ] `CHROME-WEB-STORE-DESCRIPTION.md`
- [ ] `CHROME-WEB-STORE-DASHBOARD-INPUTS.md`
- [ ] `CHROME-WEB-STORE-APPROVAL-PLAN.md`
- [ ] `CHROME-WEB-STORE-RELEASE-HARDENING-PLAN.md`
- [ ] `CHROME-WEB-STORE-REVIEW-AUDIT.md`
- [ ] `COPYRIGHT-PROVENANCE-AUDIT.md`
- [ ] `MODEL-PROVENANCE.md`

### J2. แผนเทคนิคเดิม

- [ ] เปลี่ยนชื่อปัจจุบันและ path ใน `AI-VOCAL-*.md` ให้ชี้ folder ใหม่
- [ ] rename เอกสาร `NEXTSTUDIO-*.md` → `NEXTSONA-*.md`
- [ ] อย่าเปลี่ยนผลการทดลอง ตัวเลข latency หรือประวัติทางเทคนิค
- [ ] ถ้าเอกสารกล่าวถึง artifact จาก commit เก่าจริง ให้เขียนว่า “legacy artifact”
  แทนการแก้ประวัติให้ดูเหมือนใช้ชื่อใหม่มาตั้งแต่ต้น

### J3. Third-party notices

- [ ] เปลี่ยนเฉพาะ heading/ประโยคที่เรียกผลิตภัณฑ์ของเราเป็น `NextSona`
- [ ] ห้ามแก้ชื่อผู้แต่ง copyright statement, license text, upstream URL หรือชื่อ
  dependency ของบุคคลที่สาม
- [ ] รัน copyright provenance audit หลังแก้

## 15. Phase K — Store listing และสิ่งที่ต้องทำด้วยมือ

หลัง code/build ผ่านทั้งหมด:

- [ ] Chrome Web Store package name:
  `NextSona - Pitch Shifter, AI Vocal & Video Sync`
- [ ] Summary/description เปลี่ยน `NextStudio` → `NextSona`
- [ ] Single-purpose statement และ permission justifications ใช้ชื่อใหม่
- [ ] Reviewer instructions ใช้ชื่อใหม่และ path artifact ใหม่
- [ ] Homepage URL, support URL และ Privacy Policy URL ใช้ canonical domain ใหม่
- [ ] Store icon ตรวจว่าไม่มีชื่อเก่าฝังอยู่
- [ ] อัปโหลด screenshot ใหม่ 1280×800 หรือ 640×400 ที่ capture จาก build จริง
- [ ] เปลี่ยน promotional graphics ถ้ามีชื่อเก่า
- [ ] ตรวจ localized Store listing ทุกภาษา ไม่ใช่เฉพาะ English default
- [ ] อัปโหลดเฉพาะ `dist/nextsona-extension-store.zip`
- [ ] ห้ามอัปโหลด `nextsona-extension-go-dev.zip`
- [ ] ใช้ listing เดิม ห้ามสร้าง Extension ใหม่ เพราะจะเสีย Extension ID/ผู้ใช้/reviews

## 16. Verification ที่ต้องผ่าน

### L1. Static scan

- [ ] scan source ด้วย pattern:
  `NextStudio|NEXTSTUDIO|nextstudio|NextAmp|NEXTAMP|nextamp|next-amp|NAMP`
- [ ] scan ทั้ง filename และ directory name
- [ ] scan built Web, Store ZIP ที่แตกไฟล์แล้ว และ Go-dev artifact
- [ ] scanข้อความใน HTML, JS, JSON, Go, shell, Markdown, CSS และ manifest
- [ ] ตรวจภาพด้วยตา เพราะ `rg` หา text ที่ฝังใน PNG ไม่ได้

ผล scan อาจเหลือชื่อเก่าได้เฉพาะ allowlist ที่อธิบายเหตุผลไว้ เช่น:

1. migration key เพื่ออ่านข้อมูลผู้ใช้เดิม
2. redirect URL เก่า
3. protocol alias ชั่วคราว
4. model-schema fallback ที่จำเป็นต่อ compatibility
5. เอกสารประวัติที่ระบุชัดว่าเป็น legacy name

ชื่อเก่าที่เหลือนอก allowlist ถือว่างานยังไม่เสร็จ

### L2. Automated tests/build

- [ ] `npm run audit:copyright`
- [ ] `npm run model:verify`
- [ ] test suite ใน `ai-vocal-engine`
- [ ] `go test ./...` ภายใน `nextsona-engine-go`
- [ ] `npm run build`
- [ ] `npm run build:extension:go-dev`
- [ ] `npm run verify:extension:store`
- [ ] `npm run verify:extension:go-dev`
- [ ] `npm run test:review`
- [ ] ตรวจว่า Store ZIP ไม่มี Go binary/source และไม่มีชื่อ artifact เก่า

### L3. Regression tests

- [ ] fresh install แล้วหน้า Welcome แสดง NextSona ครบ
- [ ] update ทับ NextStudio เดิมแล้ว settings ยังอยู่
- [ ] update แล้ว recordings เดิมยังเล่น ดาวน์โหลด และลบได้
- [ ] Audio ON/OFF, Original, Karaoke และ Acapella ทำงาน
- [ ] AI model โหลดได้หลังปิด/เปิด Extension ใหม่
- [ ] Pitch, speed, EQ, reverb และ output device ทำงานเหมือน baseline
- [ ] Video control ทำงานตั้งแต่ครั้งแรกหลังติดตั้ง
- [ ] toast บน YouTube และเว็บไซต์ทั่วไปแสดง `NEXTSONA`
- [ ] popup hide/show ไม่ทำให้ recording หรือ AI state ค้าง
- [ ] Remote QR เปิด canonical `/remote` และควบคุมได้จริง
- [ ] Remote page เก่าที่ cache ไว้ไม่ทำให้ host crash
- [ ] Public Privacy/Terms EN และ TH แสดงชื่อใหม่ครบ
- [ ] Go engine macOS รับเสียงและส่ง output กลับ
- [ ] Go engine Windows รับเสียงและส่ง output กลับ
- [ ] สลับ Web/Go ใน internal build แล้ว protocol ไม่ขาด
- [ ] เปรียบเทียบไฟล์เสียงหรือ model output กับ baseline เพื่อยืนยันว่า rebrand ไม่เปลี่ยนเสียง

## 17. Commit groups ที่แนะนำเมื่อเริ่มทำจริง

ห้ามรวมทุกอย่างเป็น commit เดียว เพราะถ้าพังจะหาเหตุยาก:

1. `chore(rebrand): rename source directories and build paths`
2. `feat(rebrand): update NextSona extension and web branding`
3. `feat(rebrand): migrate storage cache and remote identifiers`
4. `chore(rebrand): rename Go engine and model builder metadata`
5. `docs(rebrand): update public policies store copy and documentation`
6. `build(rebrand): regenerate and verify NextSona release artifacts`

แต่ละ commit ต้องผ่าน test ของ phase ตัวเองก่อน commit และไม่ push จนกว่าจะตรวจ final
artifact เสร็จ

## 18. Definition of Done

งานถือว่าเสร็จเมื่อครบทุกข้อ:

- [ ] ทุกหน้าที่ผู้ใช้เห็นใช้ `NextSona` ไม่มี `NextStudio/NextAmp` หลุด
- [ ] Store manifest, Store listing, Privacy, Terms และ screenshots ใช้ชื่อเดียวกัน
- [ ] Extension ID เดิมและข้อมูลผู้ใช้เดิมยังอยู่
- [ ] Web, Extension Store, Extension Go-dev และ Go binaries build ผ่าน
- [ ] Store artifact isolation ยังผ่าน audit
- [ ] AI/Audio/Video/Recording/Remote ทำงานเท่า baseline
- [ ] model output และคุณภาพเสียงไม่เปลี่ยนจากการ rebrand
- [ ] ชื่อเก่าที่เหลืออยู่มีเฉพาะ compatibility allowlist พร้อมเหตุผล
- [ ] canonical site และ redirect เก่าทำงานก่อนเผยแพร่ Store update
- [ ] final `rg` scan, image inspection และ unpacked ZIP inspection ผ่านซ้ำอีกหนึ่งรอบ

## 19. สิ่งที่ห้ามทำ

- ห้ามแทนคำทั้ง repository แล้ว build ทันที
- ห้ามลบ IndexedDB/localStorage/cache ทั้งหมดเพื่อให้ชื่อเก่าหาย
- ห้ามแก้ TFJS/ONNX tensor names ฝั่งเดียว
- ห้ามแก้ไฟล์ generated/minified/obfuscated โดยไม่แก้ source ต้นทาง
- ห้ามเปลี่ยน model weight, DSP setting หรือ AI profile ใน commit rebrand
- ห้ามแก้ข้อความ license ของบุคคลที่สาม
- ห้ามสร้าง Chrome Web Store listing ใหม่
- ห้าม deploy Privacy URL ใหม่หลังส่ง Store packageโดยที่ URL ยังเข้าไม่ได้
- ห้ามปิด domain เก่าก่อน redirect และ Store update เผยแพร่เรียบร้อย
