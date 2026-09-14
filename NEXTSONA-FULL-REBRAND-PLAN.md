# NextSona Full Rebrand Plan

สถานะ: **กำลังดำเนินการ — source, compatibility, build และ automated verification เสร็จแล้ว; เหลือ manual Store/release และ regression checks ตามรายการด้านล่าง**

วันที่สำรวจ repository: 14 กันยายน 2026
branch ที่สำรวจ: `optimization`

ผลการดำเนินการล่าสุด:

- เปลี่ยนชื่อ source directory, package, UI, Web, Public site, Remote, Go engine และ
  Model builder เป็น `NextSona` แล้ว โดยคง compatibility fallback ที่จำเป็นไว้
- สร้างและตรวจ release artifacts แล้ว: `dist/nextsona-web-prod/`,
  `dist/nextsona-extension-store.zip`, `dist/nextsona-extension-go-dev.zip` และ
  `dist/nextsona-public-site/`
- ไม่ได้เปลี่ยน model weights, DSP profile หรือ AI algorithm; model builder parity และ
  provenance audit ผ่านแล้ว
- ยังไม่ commit การเปลี่ยนแปลง implementation ชุดนี้ จนกว่าจะตรวจ manual items ที่ผู้ใช้
  ต้องทำเองตาม Phase K และ L3

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

- [x] ยืนยันครั้งสุดท้ายว่าชื่อ public คือ `NextSona` ไม่ใช่ `Sona`
- [ ] ตรวจเครื่องหมายการค้าอย่างเป็นทางการในประเทศเป้าหมาย โดยเน้น Class 9
  และ Class 42; การค้นเว็บที่ผ่านมาไม่ใช่ legal clearance
- [x] ยืนยัน canonical public URL เป็น `https://studio.nextfeeder.com`
- [ ] เตรียม redirect จาก URL เก่าไป URL ใหม่ก่อนแก้ QR/Store links
- [ ] ถ้า Chrome Web Store รุ่นปัจจุบันยังอยู่ระหว่าง review ให้รอผลก่อน แล้วส่ง
  rebrand เป็น version ถัดไปใน listing เดิม
- [x] สร้าง baseline commit ก่อนแตะ rebrand เพื่อย้อนกลับได้ง่าย

## 5. Phase A — เปลี่ยนชื่อโครงสร้างโครงการ

ใช้ `git mv` เท่านั้นเพื่อรักษาประวัติไฟล์:

- [x] `next-amp-extension/` → `nextsona-extension/`
- [x] `nextstudio-engine-go/` → `nextsona-engine-go/`
- [x] `nextstudio-model-builder/` → `nextsona-model-builder/`
- [x] `nextstudio-public-site/` → `nextsona-public-site/`
- [x] `assets/extension/next-amp.png` → `assets/extension/nextsona-showcase.png` (ภาพเก่าถูกแทนที่ด้วยภาพปัจจุบัน)
- [x] `assets/extension/next-amp-extension.zip` →
  `assets/extension/nextsona-extension.zip` หรือเลิกเก็บ ZIP เก่าใน source ถ้าไม่ใช้
- [x] `nextsona-public-site/assets/images/next-studio.png` → ชื่อใหม่ที่สื่อชัด เช่น
  `nextsona-showcase.png`
- [x] เปลี่ยนชื่อเอกสารที่ขึ้นต้น `NEXTSTUDIO-` เป็น `NEXTSONA-`
- [x] เปลี่ยน `nextstudio-model-builder/NEXTSTUDIO-MODEL-BUILDER-PLAN.md` เป็น
  `NEXTSONA-MODEL-BUILDER-PLAN.md`

หลังย้าย folder ต้องแก้ path reference ในไฟล์เหล่านี้พร้อมกัน:

- [x] `package.json` และ `package-lock.json`
- [x] `.gitignore`
- [x] `tailwind.config.cjs`
- [x] `scripts/build-prod.js`
- [x] `scripts/build-web.js`
- [x] `scripts/build-public-site.js`
- [x] `scripts/verify-extension-artifact.js`
- [x] `scripts/test-review-readiness.mjs`
- [x] `scripts/audit-copyright-provenance.mjs`
- [x] `ai-vocal-engine/build.sh`
- [x] import/path ทั้งหมดใน `ai-vocal-engine/test/`, `ai-vocal-engine/tools/`
  และ `ai-vocal-engine/demo/`
- [x] build/deploy/verify scripts ภายใน Model builder
- [x] เอกสารทุกไฟล์ที่มี path เก่า

หมายเหตุ: ชื่อ folder repository ภายนอกปัจจุบันคือ `next-amp` การเปลี่ยน folder นี้
ต้องทำหลังปิดโปรแกรมที่ใช้งาน workspace และอาจต้องเปลี่ยนชื่อ Git remote repository
ด้วย จึงไม่ควรทำกลางการแก้ source

## 6. Phase B — Extension ที่ผู้ใช้เห็น

### B1. Manifest และ package identity

- [x] แก้ `nextsona-extension/manifest.json`
  - `name` → `NextSona - Pitch Shifter, AI Vocal & Video Sync`
  - คง description ของฟีเจอร์เดิม เว้นแต่ใส่ชื่อผลิตภัณฑ์ให้เปลี่ยนเป็น `NextSona`
  - คง permissions และ CSP เดิม
  - คง icon path ถ้ายังใช้ภาพเดิม
- [x] แก้ root `manifest.json` สำหรับ Web/PWA
  - `name`, `short_name`, `description`, icon URL และ start URL ที่เกี่ยวข้อง
- [x] แก้ root `package.json`
  - `name` → `nextsona`
  - `description` → ชื่อเต็มใหม่
- [x] regenerate `package-lock.json` จาก `package.json`; ห้ามแก้ lock file แบบสุ่ม
- [x] bump version เป็น `1.1.0` หลัง phase implementation ผ่านแล้ว
- [ ] ยืนยันว่าใช้ Chrome Web Store listing เดิมเพื่อรักษา Extension ID และผู้ใช้เดิม

### B2. Popup, Welcome และหน้าภายใน

เปลี่ยน user-facing copy และ accessibility labels ใน:

- [x] `nextsona-extension/popup.html`
- [x] `nextsona-extension/player.html`
- [x] `nextsona-extension/welcome.html`
- [x] `nextsona-extension/debug-ai.html`
- [x] `nextsona-extension/modules/settings-modal.js`
- [x] `nextsona-extension/video-delay.js` สำหรับ toast ที่ฉีดในหน้าเว็บ
- [x] `nextsona-extension/background.js`
- [x] `nextsona-extension/offscreen.js`
- [x] `nextsona-extension/modules/ai-vocal/go-engine-client.js`
- [x] `nextsona-extension/modules/ai-vocal/vocal-worker.js`
- [x] `nextsona-extension/modules/ai-vocal/vocal-worklet.js`
- [x] `nextsona-extension/modules/ai-vocal/model-optimizer.mjs`

ตรวจข้อความต่อไปนี้เป็นพิเศษ:

- [x] `<title>`, heading, footer, modal, toast และ notification
- [x] `alt`, `aria-label`, `aria-live` และข้อความ screen reader
- [x] Donate copy เช่น `SUPPORT NEXTSONA` และ `ENJOYING NEXTSONA?`
- [x] error/warning/log prefix ที่ผู้ใช้หรือ developer อาจเห็น
- [x] onboarding เช่น `Welcome to NextSona`
- [x] ข้อความ Privacy disclosure ใน popup
- [x] คำแนะนำ Go engine ให้เรียก executable ใหม่ว่า `nextsona-engine`

### B3. Extension Remote

- [x] `nextsona-extension/remote/index.html`
- [x] `nextsona-extension/remote/app.js`
- [x] `nextsona-extension/remote/sw.js`
- [x] `nextsona-extension/remote/styles.css` เฉพาะ comment/class ที่เป็น brand-owned
- [x] ถ้ามี generated `remote-ui-bundle.js` ให้แก้ source แล้ว generate ใหม่ ห้ามแก้ bundle
  อย่างเดียว

ต้องตรวจให้ Remote ที่เปิดจาก QR ใช้ copy, protocol version และ public URL ใหม่
พร้อมกัน ห้ามเปลี่ยนเฉพาะหน้าเว็บจน host กับ phone คนละ protocol

## 7. Phase C — Web player เดิมที่ root

เปลี่ยนชื่อและ SEO ใน:

- [x] `index.html`
- [x] `app.html`
- [x] `remote.html`
- [x] `dos-remote.html`
- [x] `install-extension.html`
- [x] `assets/libs/js/app.js`
- [x] `sw.js`
- [x] `assets/THIRD-PARTY-NOTICES.txt`
- [x] `assets/libs/js/LAMEJS-NOTICE.txt` เฉพาะข้อความของโครงการ ห้ามแตะ license เดิม

ตรวจทุกประเภทข้อมูล:

- [x] `<title>` และ `meta description`
- [x] SEO keywords
- [x] Open Graph และ Twitter metadata
- [x] `apple-mobile-web-app-title`
- [x] JSON-LD/schema `name`
- [x] header, footer, manual title และ error message
- [x] Media Session metadata เช่น artist/app name
- [x] download link และชื่อ ZIP/PNG
- [x] ตรวจไม่พบ URL เก่า `next-amp-player.vercel.app`

ถ้า URL เก่ายังมีผู้ใช้ ให้ redirect แทนการปิดทันที และห้ามให้ URL เก่ากลับมาเป็น
canonical/OG URL ใน build ใหม่

## 8. Phase D — Public site แบบ static/no-build

Public site ต้องยัง deploy ได้โดยวาง static files โดยตรง ไม่บังคับ build เพิ่ม

เปลี่ยนใน:

- [x] `nextsona-public-site/index.html`
- [x] `nextsona-public-site/404.html`
- [x] `nextsona-public-site/remote/index.html`
- [x] `nextsona-public-site/privacy/index.html`
- [x] `nextsona-public-site/terms/index.html`
- [x] `nextsona-public-site/site.webmanifest`
- [x] `nextsona-public-site/assets/js/site.js`
- [x] `nextsona-public-site/assets/js/remote.js`
- [x] `nextsona-public-site/assets/js/remote-protocol.js`
- [x] `nextsona-public-site/README.md`
- [x] `nextsona-public-site/THIRD-PARTY-NOTICES.txt`
- [x] `nextsona-public-site/sitemap.xml`
- [x] `nextsona-public-site/robots.txt`
- [x] `nextsona-public-site/vercel.json`

### D1. ภาษาและ SEO

- [x] เปลี่ยนข้อความ EN/TH ทั้งคู่ ไม่แก้เพียงภาษาที่มองเห็นตอนโหลดครั้งแรก
- [x] เปลี่ยน `<title>`, description, OG, Twitter, structured data และ image alt
- [x] เปลี่ยน canonical URLs และ sitemap ให้ใช้ `https://studio.nextfeeder.com`
- [x] คงค่าเริ่มต้นภาษา EN ตามเดิม
- [x] Privacy/Terms ต้องใช้ชื่อเต็ม `NextSona` ทุกครั้ง
- [x] คงชื่อผู้ควบคุม/ผู้พัฒนาเป็น `NextFeeder Labs`
- [x] ตรวจว่า Privacy/Terms ไม่มีชื่อเก่าที่ไม่จำเป็นต้องแสดงต่อผู้ใช้
  เฉพาะช่วงเปลี่ยนผ่าน หากจำเป็นต่อความต่อเนื่องของ policy
- [ ] ปรับ effective date และ version ของ Privacy/Terms เมื่อ deploy จริง

### D2. รูปภาพที่มีชื่อเก่าฝังอยู่

เปิดตรวจด้วยตา ไม่ตัดสินจากชื่อไฟล์อย่างเดียว:

- [x] `assets/images/nextsona-showcase.png` (ตรวจด้วยตาแล้ว ไม่มีชื่อเก่า)
- [x] `assets/images/extension-preview.png` (asset เก่าถูกถอดออกจาก source/public build)
- [x] `assets/images/og-image.png` (ตรวจด้วยตาแล้ว ไม่มีชื่อเก่า)
- [x] `assets/images/showcase-reference.png` (asset เก่าถูกถอดออกจาก source/public build)
- [x] `assets/images/screenshots/extension-overview.png` (asset เก่าถูกถอดออกจาก source/public build)
- [x] `assets/images/screenshots/extension-detail.png` (ตรวจด้วยตาแล้วไม่มีชื่อผลิตภัณฑ์เก่า)
- [x] `assets/images/screenshots/video-preview.png` (ตรวจด้วยตาแล้วไม่มีชื่อผลิตภัณฑ์เก่า)
- [x] `assets/images/screenshots/remote-preview.png` (ตรวจด้วยตาแล้วไม่มีชื่อผลิตภัณฑ์เก่า)
- [x] `assets/images/logo.png` (ตรวจด้วยตาแล้วไม่มีชื่อเก่า)

ถ้ารูปมีคำว่า NextStudio/NextAmp ให้ capture ใหม่จาก UI จริงหลัง rebrand ห้ามใช้ภาพ
จำลองที่ไม่ตรงกับ Extension จริง

## 9. Phase E — Storage, cache และ compatibility

ส่วนนี้ห้ามใช้ replace ตรง ๆ เพราะทำให้ข้อมูลผู้ใช้เดิมหาย

### E1. Settings และภาษา

- [x] key ใหม่: `nextsona_settings_v9_stable`
- [x] อ่าน key ใหม่ก่อน ถ้าไม่มีให้ fallback ไป `nextstudio_settings_v9_stable`
- [x] เมื่ออ่าน key เก่าสำเร็จ ให้เขียนสำเนาไป key ใหม่หนึ่งครั้ง
- [x] ห้ามลบ key เก่าใน release แรกของ rebrand
- [x] เปลี่ยน `nextstudio-language` → `nextsona-language` ทั้ง public site และ Remote
  ด้วย migration แบบเดียวกัน
- [x] ตรวจ `chrome.storage`, `localStorage`, `sessionStorage` และ IndexedDB เพิ่มเติมด้วย
  `rg`; พบเฉพาะ key/storage ที่ระบุในแผนและ compatibility fallback ที่ตั้งใจเก็บไว้

### E2. Recordings/IndexedDB

พบชื่อเดิมอย่างน้อย:

- `NextStudioDB`
- `NextStudioUltimateDB`

แนวทางปลอดภัย:

- [x] release แรกให้เปิด DB เดิม อ่านจำนวน recording และ schema version
- [x] ใช้ DB ใหม่ canonical ชื่อ `NextSonaUltimateDB` (ไม่สร้าง schema ซ้ำที่ไม่จำเป็น)
- [x] copy records และ metadata ใน transaction
- [x] ตรวจจำนวน/primary key หลัง copy ก่อนตั้ง migration-complete flag
- [x] ถ้า migration ล้มเหลว ให้ใช้ DB เดิมต่อ ห้ามแสดงรายการว่างและห้ามลบข้อมูล
- [x] ห้าม delete DB เก่าอัตโนมัติ
- [ ] ทดสอบ update install ที่มี recording จริงอย่างน้อย 3 รายการ

ถ้าไม่ต้องการรับความเสี่ยง migration ใน release นี้ ให้คงชื่อ DB เก่าเป็น internal
compatibility identifier ได้ เพราะผู้ใช้ไม่เห็น และบันทึกเป็นข้อยกเว้นใน final audit

### E3. Service Worker cache

- [x] `nextstudio-${CACHE_VERSION}` → `nextsona-${CACHE_VERSION}` ใน Web และ Remote
- [x] ใน `activate` ให้ลบเฉพาะ cache ที่ขึ้นต้นด้วย prefix เก่าที่ระบุชัด
- [x] ห้ามล้าง Cache Storage ทั้ง origin
- [x] bump cache version เพื่อไม่ให้ HTML/JS คนละแบรนด์ปะปนกัน

## 10. Phase F — Internal runtime identifiers

เปลี่ยนเป็นชุดเดียวและแก้ producer/consumer พร้อมกัน:

- [x] DOM id `nextstudio-action-notification` → `nextsona-action-notification`
- [x] AudioWorklet processor `nextstudio-ai-vocal-processor` →
  `nextsona-ai-vocal-processor` ทั้ง `registerProcessor()` และ `AudioWorkletNode`
- [x] global `NextStudioRemoteProtocol` → `NextSonaRemoteProtocol`
- [x] message/event เช่น `NEXTSTUDIO_KERNEL_BENCH` → `NEXTSONA_KERNEL_BENCH`
- [x] build define `__NEXTSTUDIO_GO_ENGINE_ENABLED__` →
  `__NEXTSONA_GO_ENGINE_ENABLED__`
- [x] build define `__NEXTSTUDIO_GO_ENGINE_TYPE__` → `__NEXTSONA_GO_ENGINE_TYPE__`
- [x] placeholder `__NEXTSTUDIO_WEB_ASSET_KEY__` → `__NEXTSONA_WEB_ASSET_KEY__`
- [x] marker comment `NEXTSTUDIO_GO_ENGINE_BEGIN/END` →
  `NEXTSONA_GO_ENGINE_BEGIN/END`
- [x] magic header `NAMPWEB1` → header ใหม่ขนาดเท่าเดิม เช่น `NSONAWB1` โดยแก้
  encrypt/decrypt/verify พร้อมกัน
- [x] hash seed `nextstudio_` และ `nextstudio_web_` → `nextsona_` / `nextsona_web_`

สำหรับ Remote protocol ให้ expose alias ชื่อเก่าเป็นเวลาอย่างน้อยหนึ่ง release หากหน้า
Remote เก่าที่ยัง cache อยู่มีโอกาสเชื่อมกับ Extension ใหม่ จากนั้นค่อยถอด alias เมื่อ
redirect และ cache migration ทำงานครบ

## 11. Phase G — Build profiles และ artifact names

แก้ `scripts/build-prod.js`, `scripts/build-web.js`, verification scripts และ npm scripts:

- [x] source path ใหม่ทั้งหมด
- [x] `nextstudio-extension-store` → `nextsona-extension-store`
- [x] `nextstudio-extension-go-dev` → `nextsona-extension-go-dev`
- [x] `nextstudio-web-prod` → `nextsona-web-prod`
- [x] `nextstudio-public-site` → `nextsona-public-site`
- [x] build banner/log → `NEXTSONA`
- [x] internal Go build note → `NextSona`
- [x] artifact verifier blacklist เปลี่ยน `nextstudio-engine` เป็น `nextsona-engine`
- [x] Store profile ยังต้อง exclude Go source, binary, localhost bridge UI และ internal
  security behavior ตามกติกาเดิม
- [x] Go development profile ยังต้องรวมเฉพาะสิ่งที่ profile เดิมอนุญาต
- [x] `npm run build` ต้องยัง build Web + Store Extension ตามเดิม
- [x] Public site ยังคงเป็น static source ที่ deploy ได้โดยตรง; ถ้าเก็บ
  `build:public-site` ไว้ ให้เป็นคำสั่งเสริม ไม่ใช่ requirement

## 12. Phase H — Go engine

### H1. Source และ binary

- [x] Go module `nextstudio-engine-go` → `nextsona-engine-go`
- [x] แก้ import ใน `main.go`, tests และ package paths
- [x] `nextstudio-engine` → `nextsona-engine`
- [x] `nextstudio-engine.exe` → `nextsona-engine.exe`
- [x] console title, dashboard, connect/disconnect logs และ handshake engine label
  → `NextSona`
- [x] build script banner และ output list → `NEXTSONA`
- [x] popup instruction และ process detection ใช้ executable ใหม่ตรงกัน

### H2. Cache และ environment variables

- [x] cache directory `NextStudio` → `NextSona`
- [x] ไม่ต้องลบ cache เก่า; runtime สามารถ extract runtime ใหม่ลง cache ใหม่ได้
- [x] `NEXTSTUDIO_USE_LOCAL_MODEL` → `NEXTSONA_USE_LOCAL_MODEL`
- [x] `NEXTSTUDIO_RUN_COREML_BENCH` → `NEXTSONA_RUN_COREML_BENCH`
- [x] `NEXTSTUDIO_RUN_COMPACT_ONNX` → `NEXTSONA_RUN_COMPACT_ONNX`
- [x] รองรับ env ชื่อเก่าเป็น fallback หนึ่งช่วงพัฒนาเพื่อไม่ให้คำสั่ง local พังทันที

### H3. Model output names

พบชื่อ tensor ภายใน:

- `NextAmp/compact_output`
- `NextAmp/compact_output_head/`
- `NextAmp/compact_roi/`

ห้ามแก้ string ฝั่ง Go อย่างเดียว เพราะ ONNX session จะหา output ไม่พบ:

- [x] เปลี่ยน namespace ใน Model builder ก่อน
- [x] build ONNX ใหม่
- [x] ตรวจชื่อ output ของโมเดลจริง
- [x] แก้ Go constants ให้ตรงกับ output ใหม่
- [x] run native model inference equivalence test
- [x] ไม่ต้องใช้ internal model-schema exception เพราะ graph builder และ Go constants
  เปลี่ยน namespace เป็น `NextSona/...` ได้ และ native parity ผ่านแล้ว

## 13. Phase I — Model builder โดยไม่เปลี่ยนเสียง

เปลี่ยนโครงสร้างและ metadata เท่านั้น ห้ามเปลี่ยน weight/calibration/config:

- [x] package name → `nextsona-model-builder`
- [x] README และ plan → `NextSona Model Builder`
- [x] Docker env:
  - `NEXTSTUDIO_MODEL_PYTHON` → `NEXTSONA_MODEL_PYTHON`
  - `NEXTSTUDIO_TFJS_CONVERTER` → `NEXTSONA_TFJS_CONVERTER`
- [x] scripts `build.sh`, `verify.sh`, `deploy.sh` ใช้ path ใหม่
- [x] provenance field `builder` → `nextsona-model-builder`
- [x] JS export `NEXTSTUDIO_OPTIMIZATION_METADATA` →
  `NEXTSONA_OPTIMIZATION_METADATA`
- [x] metadata key `nextstudioModelOptimization` → `nextsonaModelOptimization`
- [x] runtime loader ต้องอ่าน key ใหม่ก่อนและรองรับ key เก่าเป็น fallback
- [x] namespace `NextStudio/optimized_output_head`, `NextStudio/roi_*` → `NextSona/...`
  เฉพาะเมื่อ graph rewrite tests ผ่าน
- [x] regenerate TFJS model และ ONNX จาก source เดิม
- [x] ยืนยันว่า weight count, tensor shape, input/output contract และ numerical output
  เท่าเดิมภายใน tolerance เดิม
- [x] deploy verified TFJS metadata to `nextsona-extension/model/`; Go ONNX was unchanged because its verified hash was already identical

การเปลี่ยน metadata/namespace ทำให้ hash ของ `model.json` เปลี่ยนได้ แต่ไฟล์ weights
และผลเสียงต้องไม่เปลี่ยน ถ้า weights hash เปลี่ยนโดยไม่ได้ตั้งใจ ให้หยุดและย้อน phase นี้

## 14. Phase J — เอกสาร, license และ audit files

### J1. เอกสาร Store/Release ที่ต้องอัปเดต

- [x] `CHROME-WEB-STORE-DESCRIPTION.md`
- [x] `CHROME-WEB-STORE-DASHBOARD-INPUTS.md`
- [x] `CHROME-WEB-STORE-APPROVAL-PLAN.md`
- [x] `CHROME-WEB-STORE-RELEASE-HARDENING-PLAN.md`
- [x] `CHROME-WEB-STORE-REVIEW-AUDIT.md`
- [x] `COPYRIGHT-PROVENANCE-AUDIT.md`
- [x] `MODEL-PROVENANCE.md`

### J2. แผนเทคนิคเดิม

- [x] เปลี่ยนชื่อปัจจุบันและ path ใน `AI-VOCAL-*.md` ให้ชี้ folder ใหม่
- [x] rename เอกสาร `NEXTSTUDIO-*.md` → `NEXTSONA-*.md`
- [x] อย่าเปลี่ยนผลการทดลอง ตัวเลข latency หรือประวัติทางเทคนิค
- [x] ถ้าเอกสารกล่าวถึง artifact จาก commit เก่าจริง ให้เขียนว่า “legacy artifact”
  แทนการแก้ประวัติให้ดูเหมือนใช้ชื่อใหม่มาตั้งแต่ต้น

### J3. Third-party notices

- [x] เปลี่ยนเฉพาะ heading/ประโยคที่เรียกผลิตภัณฑ์ของเราเป็น `NextSona`
- [x] ไม่แก้ชื่อผู้แต่ง copyright statement, license text, upstream URL หรือชื่อ
  dependency ของบุคคลที่สาม
- [x] รัน copyright provenance audit หลังแก้

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

- [x] scan source ด้วย pattern:
  `NextStudio|NEXTSTUDIO|nextstudio|NextAmp|NEXTAMP|nextamp|next-amp|NAMP`
- [x] scan ทั้ง filename และ directory name
- [x] scan built Web, Store ZIP ที่แตกไฟล์แล้ว และ Go-dev artifact
- [x] scanข้อความใน HTML, JS, JSON, Go, shell, Markdown, CSS และ manifest
- [x] ตรวจภาพด้วยตา เพราะ `rg` หา text ที่ฝังใน PNG ไม่ได้

ผล scan อาจเหลือชื่อเก่าได้เฉพาะ allowlist ที่อธิบายเหตุผลไว้ เช่น:

1. migration key เพื่ออ่านข้อมูลผู้ใช้เดิม
2. redirect URL เก่า
3. protocol alias ชั่วคราว
4. model-schema fallback ที่จำเป็นต่อ compatibility
5. เอกสารประวัติที่ระบุชัดว่าเป็น legacy name

ชื่อเก่าที่เหลือนอก allowlist ถือว่างานยังไม่เสร็จ

### L2. Automated tests/build

- [x] `npm run audit:copyright`
- [x] `npm run model:verify`
- [x] test suite ใน `ai-vocal-engine` (23/23 ผ่าน)
- [x] `go test ./...` ภายใน `nextsona-engine-go`
- [x] `npm run build`
- [x] `npm run build:extension:go-dev`
- [x] `npm run verify:extension:store`
- [x] `npm run verify:extension:go-dev`
- [x] `npm run test:review`
- [x] ตรวจว่า Store ZIP ไม่มี Go binary/source และไม่มีชื่อ artifact เก่า

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

- [x] ทุกหน้าที่ผู้ใช้เห็นใช้ `NextSona` ไม่มี `NextStudio/NextAmp` หลุด; ชื่อเก่าที่เหลือ
  เป็น migration/cache/protocol compatibility ที่ไม่แสดงต่อผู้ใช้
- [ ] Store manifest, Store listing, Privacy, Terms และ screenshots ใช้ชื่อเดียวกัน
- [ ] Extension ID เดิมและข้อมูลผู้ใช้เดิมยังอยู่
- [x] Web, Extension Store, Extension Go-dev และ Go binaries build ผ่าน
- [x] Store artifact isolation ยังผ่าน audit
- [ ] AI/Audio/Video/Recording/Remote ทำงานเท่า baseline
- [x] model output และคุณภาพเสียงไม่เปลี่ยนจากการ rebrand; numerical/model parity ผ่าน
- [x] ชื่อเก่าที่เหลืออยู่มีเฉพาะ compatibility allowlist พร้อมเหตุผล
- [ ] canonical site และ redirect เก่าทำงานก่อนเผยแพร่ Store update
- [x] final `rg` scan, image inspection และ unpacked ZIP inspection ผ่านซ้ำอีกหนึ่งรอบ

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
