# NextStudio Public Web Deployment Plan

วันที่จัดทำ: 2026-09-12

สถานะ: Phase 1–7 มี local implementation แล้ว — static site พร้อม deploy ตรงจาก `nextstudio-public-site/` ที่ `https://studio.nextfeeder.com`; ยังไม่ deploy production และยังไม่เชื่อม URL กลับเข้า Extension

## ข้อสรุปที่ยืนยันแล้ว

- [x] คำว่า “SSO” ในคำขอหมายถึง SEO ไม่ใช่ระบบ Single Sign-On
- [x] ทำและทดสอบเว็บไซต์แบบ local ก่อน
- [x] ยืนยัน production domain: `https://studio.nextfeeder.com`
- [x] หน้า `/` สามารถเป็น Landing page ใหม่ของ NextStudio ได้
- [x] งานออกแบบต้องเป็น production showcase ที่ดูน่าเชื่อถือ ไม่ใช่เพียงหน้าเอกสารหรือหน้าดาวน์โหลด
- [x] ใช้ฟอนต์อ่านง่ายเป็นหลักและไม่ใช้ display font กับข้อความยาว
- [x] รองรับ English และ Thai โดย English เป็นภาษาเริ่มต้น
- [x] ชื่อผู้พัฒนา: `NextFeeder Labs`
- [x] อีเมลติดต่อและ Privacy: `nextfeeder.ts@gmail.com`
- [x] Codex จะเขียน Privacy Policy ฉบับเต็มทั้ง EN/TH ตอน implementation

## เป้าหมาย

สร้างเว็บไซต์ static แยกจาก Extension และ Web Player เพื่อใช้เป็นเว็บไซต์ภายนอกอย่างเป็นทางการของ NextStudio โดยมีหน้าหลัก 3 ส่วน:

- `/` — หน้าแนะนำผลิตภัณฑ์และฟีเจอร์
- `/remote/` — หน้า Remote Controller สำหรับควบคุม Extension จากอุปกรณ์อีกเครื่อง
- `/privacy/` — Privacy Policy สำหรับผู้ใช้และ Chrome Web Store

เว็บไซต์ต้อง deploy ได้โดยนำโฟลเดอร์เดียวขึ้น Vercel, Cloudflare Pages, GitHub Pages หรือ static host อื่น โดยไม่ต้องมี application backend

## ชื่อโฟลเดอร์ที่จะสร้าง

`nextstudio-public-site/`

โฟลเดอร์นี้ต้องไม่ import ไฟล์โดยตรงจาก `next-amp-extension/` หรือ root Web Player เพื่อให้ deploy แยกได้จริงและไม่เผลอนำ source/model ของ Extension ขึ้นเว็บ

## โครงสร้างที่วางแผนไว้

```text
nextstudio-public-site/
├── index.html
├── remote/
│   └── index.html
├── privacy/
│   └── index.html
├── assets/
│   ├── css/
│   │   ├── site.css
│   │   └── remote.css
│   ├── js/
│   │   ├── site.js
│   │   ├── remote.js
│   │   └── remote-protocol.js
│   ├── vendor/
│   │   └── peerjs.min.js
│   ├── fonts/
│   └── images/
│       ├── logo.png
│       ├── og-image.png
│       └── screenshots/
├── robots.txt
├── sitemap.xml
├── 404.html
├── site.webmanifest
├── THIRD-PARTY-NOTICES.txt
├── vercel.json
└── README.md
```

โครงสร้างอาจลดไฟล์ได้ใน implementation จริง แต่ต้องคงหลักการว่า dependency, font, icon และ JavaScript ถูก self-host และตรวจสอบได้

## URL และ Local-first Strategy

เว็บไซต์ใช้ relative URL สำหรับลิงก์ภายใน และ hardcode production origin เฉพาะ metadata/SEO ที่จำเป็น:

- Landing page: `/`
- Remote: `/remote/`
- Privacy Policy: `/privacy/`

ไฟล์ใน `nextstudio-public-site/` เป็น static production site พร้อม deploy โดยไม่ต้อง build โดย canonical URL, Open Graph URL, sitemap และ robots ถูกตั้งเป็น `https://studio.nextfeeder.com` แล้ว การ build ไปยัง `dist/` เป็นเพียงตัวเลือกสำหรับสร้างสำเนาที่มี inventory

ห้ามฝัง `next-amp-player.vercel.app` หรือ domain ชั่วคราวไว้ใน source จนกว่าผู้ใช้จะยืนยัน production host

## Phase 1 — Landing Page `/index.html`

### เนื้อหาหลัก

- [x] Hero section แสดงชื่อ `NextStudio - Pitch Shifter, AI Vocal & Video Sync`
- [x] คำอธิบายสั้นที่บอกชัดว่าเป็นเครื่องมือควบคุมเสียงและวิดีโอใน browser สำหรับฝึกซ้อม
- [ ] ปุ่มติดตั้งจาก Chrome Web Store โดยใช้ placeholder จนกว่าจะมี Store URL จริง
- [x] ปุ่มดูฟีเจอร์, Privacy Policy และ Support/Donate
- [ ] ภาพหน้าจอ Extension ที่ตรงกับ version 1.0 (รอ screenshot ที่อนุมัติ; ตอนนี้ใช้ product UI mockup)
- [x] Compatibility section สำหรับ Chrome/Chromium, Apple Silicon และ Windows GPU
- [x] FAQ แบบสั้นสำหรับ AI Vocal, Remote, Recording และข้อมูลส่วนตัว
- [x] Footer ที่มี Privacy, Support, Contact และ copyright

### Production Showcase Direction

- [x] ออกแบบหน้าแรกให้ดูเหมือนเว็บไซต์ผลิตภัณฑ์พร้อมเปิดตัวจริง ไม่ใช่ README ที่แปลงเป็น HTML
- [x] ใช้ visual hierarchy ชัด: product name → value proposition → product UI → feature proof → compatibility → privacy → CTA
- [x] ให้ภาพ popup และ AI status เป็นจุดเด่นของ Hero แทนการใช้ข้อความจำนวนมาก
- [x] แสดง hardware acceleration เช่น WebGPU, WebGL, Apple Metal และ Windows GPU อย่างกระชับ
- [x] มี section เปรียบเทียบ ECO/FULL โดยไม่อ้างตัวเลข performance ที่ยังไม่ได้วัดอย่างเป็นทางการ
- [x] แสดง Remote, Recording และ Video Sync ด้วย UI preview ที่เข้าใจได้ทันที
- [x] ใช้ theme ที่สัมพันธ์กับ Extension แต่เพิ่มพื้นที่ว่างและ typography สำหรับเว็บไซต์เต็มรูปแบบ
- [x] ใช้ animation เท่าที่จำเป็นและต้องไม่ทำให้หน้าเว็บดูเหมือน demo/game interface
- [x] CTA หลักต้องชัด แต่ไม่มี popup, countdown หรือข้อความเร่งผู้ใช้แบบรบกวน
- [x] รองรับ desktop, tablet และ mobile ตั้งแต่โครงสร้างแรก

### Typography Direction

- [x] ใช้ `Inter`, system sans-serif หรือฟอนต์อ่านง่ายใกล้เคียงสำหรับภาษาอังกฤษ
- [x] ใช้ `Noto Sans Thai`, `Sarabun` หรือ system Thai font สำหรับภาษาไทย
- [ ] Self-host font files ที่เลือกจริง
- [x] ไม่ใช้ Chakra Petch/display font กับ paragraph, FAQ หรือ Privacy Policy
- [ ] ถ้าต้องการเอกลักษณ์ สามารถใช้ display font เฉพาะโลโก้หรือ label สั้น ๆ
- [ ] Body text desktop ต้องไม่น้อยกว่า 16px และ mobile ต้องยังอ่านได้โดยไม่ zoom
- [ ] จำกัดความกว้างบรรทัดของเนื้อหายาว โดยเฉพาะ Privacy Policy

### ฟีเจอร์ที่จะแสดง

- [x] Real-time pitch shifting
- [x] Speed/time control (แสดงใน product capability copy; ยังไม่มี dedicated visual control)
- [x] AI Karaoke และ Acapella
- [x] ECO และ FULL AI modes
- [x] WebGPU/WebGL acceleration ตาม hardware ที่รองรับ
- [x] Optional Go native engine
- [x] EQ, reverb, dynamics, volume และ pan (แสดงใน product copy; controls หลักอยู่ใน Remote)
- [x] Recording, playback, download และ delete
- [x] Video delay/sync, zoom, rotation และ quality controls
- [x] Remote control จากมือถือหรืออุปกรณ์อีกเครื่อง
- [x] AI model โหลดเมื่อผู้ใช้เปิด AI เท่านั้น

### ข้อความที่ต้องหลีกเลี่ยง

- [ ] ไม่ใช้คำว่า “perfect vocal removal”
- [ ] ไม่รับประกันว่าใช้ได้ทุกเว็บไซต์หรือทุก GPU
- [ ] ไม่บอกว่าไม่มีการส่งข้อมูลภายนอก หาก Remote ยังใช้ PeerJS signaling
- [ ] ไม่โฆษณาว่าเป็นเครื่องมือดาวน์โหลดเพลงหรือ bypass DRM/paywall
- [ ] ไม่อ้างว่าปลอดภัย 100% หรือ anonymous 100%

## Phase 2 — SEO และ Social Metadata

- [x] ตั้ง `<title>` ที่กระชับและมีชื่อผลิตภัณฑ์
- [x] เพิ่ม unique meta description ที่ตรงกับ Store listing
- [x] เพิ่ม canonical URL
- [x] เพิ่ม Open Graph title, description, image, URL และ site name
- [x] เพิ่ม Twitter Card metadata
- [x] เพิ่ม favicon และ Apple touch icon
- [x] เพิ่ม JSON-LD ชนิด `SoftwareApplication` (สร้างโดย local site script หลังโหลด)
- [x] ระบุ application category เป็น Multimedia/Application
- [x] ระบุ operating system และ browser compatibility โดยไม่รับประกันเกินจริง
- [x] เพิ่ม `robots.txt`
- [x] เพิ่ม `sitemap.xml` สำหรับ `/` และ `/privacy/`; Remote ถูก `noindex`/`Disallow` เพราะเป็น session controller
- [ ] ตั้ง language และ locale ให้ถูกต้อง
- [x] ใช้ semantic HTML: `header`, `main`, `section`, `nav`, `footer`
- [x] ให้ heading เรียง `h1` → `h2` → `h3` ถูกต้อง
- [x] ใส่ alt text ให้รูปทุกภาพ
- [x] ป้องกัน duplicate title/description ระหว่างแต่ละหน้า
- [x] เตรียม English เป็นภาษาหลักและมีคำแปล Thai ครบตั้งแต่ version แรก
- [x] ใช้ English เป็น HTML/SEO default และ fallback เมื่อ JavaScript ปิด
- [x] เพิ่มตัวสลับ `EN | TH` ที่เห็นง่ายแต่ไม่แย่งความเด่นจาก CTA
- [x] จำภาษาที่ผู้ใช้เลือกไว้เฉพาะใน local preference โดยไม่ทำ analytics/profile
- [x] เตรียม translation dictionary แยกจาก DOM logic เพื่อป้องกันข้อความสองภาษาไม่ตรงกัน
- [x] ใช้ `lang="en"` เป็นค่าเริ่มต้นและเปลี่ยน `lang="th"` เมื่อเลือกภาษาไทย
- [x] Landing, Remote และ Privacy ต้องสลับภาษาได้ครบทั้งหน้า
- [ ] Version แรกยังคงมีเพียง `/`, `/remote/`, `/privacy/`; ยังไม่เพิ่ม `/th/` เพื่อไม่ขยาย route โดยไม่จำเป็น

ผลลัพธ์: Search engine และ social preview เข้าใจชื่อผลิตภัณฑ์ ฟีเจอร์ และ URL หลักอย่างถูกต้อง

## Phase 3 — Performance และ Accessibility

- [x] ใช้ HTML/CSS/JavaScript แบบ static ไม่มี framework runtime ที่ไม่จำเป็น
- [ ] Bundle/minify assets ตอน deploy แต่เก็บ source อ่านได้ใน repository
- [x] ใช้ local fonts หรือ system font เพื่อลด third-party request
- [ ] กำหนดขนาดรูปเพื่อป้องกัน layout shift
- [ ] ใช้ WebP/AVIF พร้อม fallback ตามความเหมาะสม
- [ ] Lazy-load screenshots ที่อยู่นอก viewport
- [x] ไม่ preload AI model หรือ Extension assets บน Landing page
- [x] ไม่ใส่ analytics ในเวอร์ชันแรก
- [x] รองรับ keyboard navigation และ visible focus
- [x] ใช้ contrast ที่ผ่าน WCAG AA เท่าที่ทำได้
- [x] รองรับ `prefers-reduced-motion`
- [x] ใส่ label/ARIA ให้ปุ่มและสถานะ Remote
- [x] แสดง error/loading/connected/disconnected state โดยไม่พึ่งสีเพียงอย่างเดียว

ผลลัพธ์: หน้าเว็บเปิดเร็วบนมือถือ ไม่ดาวน์โหลด AI assets และใช้งานได้กับ assistive technology

## Phase 4 — Remote Page `/remote/`

### Architecture

- [x] เป็น static standalone web page ไม่มี Chrome Extension API
- [x] Bundle PeerJS ไว้ใน `assets/vendor/`
- [x] ไม่ใช้ unpkg, jsDelivr หรือ remote JavaScript
- [x] อ่าน `host` และ `token` จาก URL fragment
- [x] ล้าง fragment จาก address bar หลังอ่านค่าแล้ว
- [x] ไม่เก็บ token ใน localStorage/sessionStorage
- [x] ไม่ส่ง token ไป analytics, logs หรือ error service
- [x] เชื่อมต่อผ่าน PeerJS signaling ที่ PeerJS client เลือกให้ใน runtime (ต้องยืนยัน endpoint ก่อน production)
- [x] ส่งเฉพาะ data messages ตาม allowlist protocol ฝั่ง public Remote
- [x] ไม่รับหรือ execute HTML/CSS/JavaScript/WASM จาก Extension
- [x] ไม่ใช้ `eval` หรือ `new Function`
- [x] ไม่รับหรือส่ง audio stream

### UI

- [x] แสดง NextStudio branding และชื่อ session แบบไม่เปิดเผย URL เต็ม
- [x] Loading state ระหว่าง PeerJS initialization
- [x] Connecting state ระหว่าง handshake
- [x] Connected state พร้อม latency/ping
- [x] Expired/invalid token state
- [x] Reconnecting state ที่มี timeout และปุ่มลองใหม่
- [x] Controls สำหรับฟีเจอร์ที่อนุญาตจาก Remote เท่านั้น
- [x] ปิด control ทั้งหมดจนกว่า handshake ผ่าน
- [x] ปุ่ม Disconnect/Clear Session
- [x] ลิงก์ Privacy Policy และ Support

### Protocol Security

- [x] ใช้ protocol version ใน handshake
- [x] Validate message type และ payload schema ฝั่งหน้า public Remote
- [x] Allowlist parameter names
- [x] Validate number range และ enum
- [x] จำกัด payload size ขั้นต้นก่อนประมวลผลข้อความ
- [x] ปฏิเสธ unknown fields โดยไม่นำไป render หรือส่งต่อ
- [ ] ปิด connection เมื่อได้รับ malformed message ซ้ำ (รอ hardening ฝั่ง host/Extension)
- [x] แสดงข้อมูลจาก Extension ด้วย `textContent` ไม่ใช้ unsanitized `innerHTML`

ผลลัพธ์: Remote เป็น UI ควบคุมแบบ data-only และไม่สามารถเปลี่ยน logic ของ Extension ได้

## Phase 5 — Privacy Page `/privacy/`

- [x] ระบุชื่อผู้พัฒนาเป็น `NextFeeder Labs`
- [x] ระบุอีเมลติดต่อเป็น `nextfeeder.ts@gmail.com`
- [x] Effective date และ policy version
- [x] อธิบาย tab audio capture
- [x] อธิบาย local AI/audio processing
- [x] อธิบาย optional Go loopback engine
- [x] อธิบาย recording และ IndexedDB/local storage
- [x] อธิบาย Extension settings และ session state
- [x] อธิบาย Remote peer ID, token, signaling และ control messages
- [x] ยืนยันว่า Remote ไม่ส่ง audio ใน public Remote data-only flow
- [x] ระบุ third-party processor/service ที่ใช้งานจริง
- [x] ระบุ retention และ session expiry behavior พร้อมข้อจำกัดของ release
- [x] อธิบายวิธีลบ recording/settings/session data
- [x] ระบุว่าไม่มีการขายข้อมูลและไม่มี personalized advertising
- [x] ระบุ security practices โดยไม่รับประกันเกินจริง
- [x] ระบุการเปลี่ยนแปลง Privacy Policy
- [x] ใส่อีเมลติดต่อด้าน privacy/support
- [x] เพิ่มข้อความ Chrome Web Store Limited Use ที่สอดคล้องกับ behavior ที่ประกาศ
- [x] ทำหน้าให้อ่านง่ายบนมือถือและไม่บังคับ JavaScript
- [x] เขียนฉบับภาษาอังกฤษเป็นฉบับหลักสำหรับ Chrome Web Store
- [x] เขียนฉบับภาษาไทยที่มีความหมายตรงกับฉบับภาษาอังกฤษ
- [x] ใส่ disclaimer ว่า policy อธิบาย behavior ปัจจุบันและจะอัปเดตเมื่อ service/data flow เปลี่ยน

ผลลัพธ์: URL ใช้กรอกใน Chrome Web Store Developer Dashboard ได้และตรงกับ behavior ของ Extension/Remote

## Phase 6 — Security Headers และ Deployment Configuration

- [x] กำหนด Content-Security-Policy สำหรับ Landing และ Privacy แบบเข้มงวด
- [x] กำหนด CSP ของ Remote ให้เชื่อมต่อเฉพาะ `self` และ PeerJS endpoints ที่จำเป็น
- [x] เพิ่ม `X-Content-Type-Options: nosniff`
- [x] เพิ่ม `Referrer-Policy: no-referrer` สำหรับ Remote (ใช้กับ static site ทั้งชุด)
- [x] เพิ่ม `Permissions-Policy` เพื่อปิด camera, microphone, geolocation และ API ที่ไม่ใช้
- [x] เพิ่ม frame policy เพื่อป้องกัน clickjacking
- [x] ใช้ HTTPS redirect (Vercel จัดการเมื่อใช้ production domain; ต้องตรวจซ้ำกับ host อื่น)
- [ ] ตั้ง cache ระยะยาวให้ hashed assets (ตอนนี้ใช้ cache 1 วันเพราะชื่อไฟล์ยังไม่ hash)
- [x] ตั้ง HTML/Privacy/Remote shell เป็น no-cache หรือ cache สั้นเพื่อแก้ไข policy/security ได้เร็ว
- [x] ไม่เปิด directory listing โดยตัว static host configuration
- [x] เพิ่ม custom 404 page ที่ไม่สะท้อน query/fragment
- [x] ตรวจว่า deployment ไม่มี source model, Extension ZIP, `.env`, `.git`, certificate หรือ private key

ผลลัพธ์: Static site เปิดเผยเฉพาะ public assets และจำกัด browser capability เท่าที่จำเป็น

## Phase 7 — Build และ Deployment Flow

- [x] เพิ่มคำสั่ง build สำหรับ public site แยกจาก Extension/Web Player (เป็น optional generated copy)
- [x] ทำให้ `nextstudio-public-site/` เป็น static deployment folder ที่ deploy ได้โดยตรงโดยไม่ต้อง build
- [x] ยังคง output สำรองใน `dist/nextstudio-public-site/` สำหรับกรณีต้องการ inventory/verification
- [x] Build ต้อง copy เฉพาะ allowlisted public files
- [x] ตรวจ broken links และ missing assets
- [x] ตรวจ HTML syntax และ metadata
- [x] ตรวจว่า production URL ถูกแทนค่าครบ
- [x] Scan output หา private key, model, source map, debug asset และ secret
- [x] สร้าง inventory ของไฟล์ deploy (checksum ยังไม่ทำ)
- [ ] Preview deployment ก่อน production (ยังไม่ deploy)
- [x] เปิด local preview และตรวจทุก route ก่อนเตรียม production deployment
- [ ] ยังไม่ deploy production จนกว่าผู้ใช้จะเลือก host และอนุมัติหน้า local
- [x] เขียน metadata ที่ขึ้นกับ production origin ลงใน static source แล้ว
- [ ] ทดสอบ `/`, `/remote/`, `/privacy/`, `robots.txt` และ `sitemap.xml` บน production host
- [ ] ตรวจ HTTPS certificate และ security headers
- [ ] เก็บ rollback deployment ก่อนหน้า

ผลลัพธ์: Deploy ได้จากโฟลเดอร์เดียวโดยไม่ดึงไฟล์ลับหรือ AI model ติดไปด้วย

## Phase 8 — Integration กับ Extension

- [ ] เปลี่ยน Remote base URL ใน Store build ให้ชี้ production `/remote/`
- [ ] เปลี่ยน Privacy link ทุกจุดให้ชี้ production `/privacy/`
- [ ] สร้าง QR ภายใน Extension จาก Remote URL
- [ ] ไม่ใช้ URL shortener เพราะ production URL สั้น
- [ ] เพิ่ม first-use Remote disclosure
- [ ] เพิ่ม Reviewer Notes ที่อธิบายว่า Remote page เป็น external static context ไม่มี Chrome API
- [ ] ระบุว่า Extension รับเฉพาะ validated data commands
- [ ] ทดสอบ Remote หลัง popup ถูกปิดและหลัง session ถูกยกเลิก
- [ ] ทดสอบ invalid/expired token
- [ ] ตรวจ network log เทียบกับ Privacy Policy

ผลลัพธ์: Extension, public site และ Chrome Web Store disclosure ใช้ URL/behavior ชุดเดียวกัน

## Content Draft ที่ต้องเตรียม

### Landing page

- Product headline
- Short value proposition
- Feature descriptions
- Hardware/browser compatibility
- Local-first privacy summary
- FAQ
- Installation CTA
- Support/Donate CTA

### Privacy page

- Developer/publisher name: `NextFeeder Labs`
- Contact email: `nextfeeder.ts@gmail.com`
- Data categories
- Local processing/storage
- Third-party services
- Data retention/deletion
- Security practices
- Chrome Web Store Limited Use statement

### Remote page

- Connection labels
- Loading/error/expired messages
- Privacy notice
- Help text สำหรับการ scan QR และ reconnect

## สิ่งที่ผู้ใช้ต้องให้ก่อนเริ่ม Implementation

- [x] ยืนยันว่า “SSO” หมายถึง SEO
- [x] ยืนยันให้ทำ local ก่อนและผู้ใช้จะ deploy เองภายหลัง
- [x] ยืนยันว่า root URL สามารถใช้เป็น Landing page ใหม่ได้
- [x] ให้ชื่อผู้พัฒนา `NextFeeder Labs`
- [x] ให้อีเมล `nextfeeder.ts@gmail.com`
- [x] ยืนยันให้รองรับ EN/TH และใช้ EN เป็นค่าเริ่มต้น
- [ ] ให้ Chrome Web Store URL ถ้ามีแล้ว หรือยอมให้ใช้ placeholder ก่อน
- [ ] เตรียมหรืออนุมัติ screenshots ที่จะใช้บน Landing page
- [x] เลือก production domain: `https://studio.nextfeeder.com`

## สิ่งที่ Codex จะทำเมื่อได้รับอนุญาตให้เริ่ม

- สร้าง `nextstudio-public-site/` ตามแผน
- สร้าง Landing, Remote และ Privacy pages
- จัด theme ให้สอดคล้องกับ Extension popup
- ยกระดับหน้าแรกให้เป็น production showcase พร้อม responsive product presentation
- เขียน SEO/social metadata และ JSON-LD
- ทำ EN/TH language system โดย EN เป็นค่าเริ่มต้น
- Bundle dependency และ assets ไว้ใน site
- เขียน Privacy Policy ฉบับเต็มในนาม NextFeeder Labs ทั้ง EN/TH
- เพิ่ม Remote data-only protocol และ security states
- เพิ่ม security headers/deployment config
- เพิ่ม build/verification scripts
- Build preview และตรวจว่าไม่มี model/secret หลุดเข้า output
- เชื่อม production URLs เข้ากับ Store build ใน phase ที่ได้รับอนุญาต

## Acceptance Criteria

- `/` อธิบาย NextStudio และฟีเจอร์จริงได้ครบโดยไม่โฆษณาเกินจริง
- `/` ดูเป็น production-ready product showcase และใช้ typography ที่อ่านง่าย
- `/remote/` ทำงานโดยไม่มี remote JavaScript injection, `eval` หรือ `new Function`
- `/privacy/` อ่านได้โดยไม่ต้องเปิด JavaScript และตรงกับ behavior จริง
- ทุกหน้ารองรับ EN/TH และเปิดครั้งแรกเป็น EN
- Public site self-host JavaScript, fonts และ icons ที่ใช้ทั้งหมด
- ไม่มี AI model, Extension source, private key, token หรือ debug file ใน deployment
- SEO, Open Graph, sitemap และ robots metadata ถูกต้อง
- Mobile, keyboard และ screen-reader flow ใช้งานได้
- Security headers ผ่านการตรวจ
- Extension และ Remote ใช้ data-only protocol พร้อม token expiry
- URL ทั้งหมดตรงกับ Chrome Web Store listing และ Privacy Dashboard
- Local build ไม่ hardcode production domain และพร้อมให้ผู้ใช้นำไป deploy เอง
