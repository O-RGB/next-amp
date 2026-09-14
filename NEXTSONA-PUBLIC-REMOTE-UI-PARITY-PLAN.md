# NextSona Public Remote UI Parity Plan

## เป้าหมาย

ปรับหน้า `nextsona-public-site/remote/` ให้มีโครงสร้าง UX, ลำดับ section, ตำแหน่ง control, ค่า control และพฤติกรรมเหมือนหน้า Remote ที่ Extension ส่งให้โทรศัพท์ใช้งานจริงทุกจุด แต่เปลี่ยนเฉพาะงานภาพให้เป็นธีมของ `nextsona-public-site`

คำว่า “เหมือน” ในแผนนี้หมายถึง:

- section ต้องเรียงเหมือนกัน
- control ต้องอยู่ใน section และแถวเดียวกันกับ Remote ของ Extension
- ปุ่มลัด, slider, preset, toggle, status และสถานะ disabled ต้องมีครบ
- ค่า `min`, `max`, `step`, default และข้อความแสดงค่าต้องตรงกัน
- การกดและการ sync ค่ากลับจาก Extension ต้องให้ผลเหมือนกัน
- เปลี่ยนได้เฉพาะสี, ฟอนต์, border, radius, shadow, icon และรายละเอียด visual state

## Source of truth ที่ต้องใช้

### Remote ตัวจริงของ Extension

- Layout, control และ runtime behavior หลัก: `nextsona-extension/remote/remote-ui-bundle.js`
- วิธีที่ Extension เปิด Remote และส่ง UI: `nextsona-extension/popup.js` บริเวณ bootloader และ `MOUNT_UI`
- ฝั่ง host, state และ protocol ที่รับคำสั่ง: `nextsona-extension/offscreen.js`
- ค่าเดียวกับหน้า Extension หลักที่ใช้ตรวจสอบซ้ำ: `nextsona-extension/popup.html` และ `nextsona-extension/popup.js`

### ไฟล์ที่เป็นเพียงของเก่าหรือ reference รอง

- `nextsona-extension/remote/index.html`
- `nextsona-extension/remote/styles.css`
- `nextsona-extension/remote/app.js`
- `nextsona-extension/remote/dos-remote.html`

ห้ามใช้ไฟล์กลุ่มนี้เป็น source of truth หากไม่ตรงกับ `remote-ui-bundle.js` เพราะหน้า Remote ที่ผู้ใช้เห็นจริงมาจาก `REMOTE_UI` ใน bundle

### ไฟล์เป้าหมายฝั่งเว็บไซต์

- Markup: `nextsona-public-site/remote/index.html`
- Style: `nextsona-public-site/assets/css/remote.css`
- Runtime: `nextsona-public-site/assets/js/remote.js`
- Validation/protocol: `nextsona-public-site/assets/js/remote-protocol.js`
- ธีมอ้างอิง: `nextsona-public-site/assets/css/site.css`

## ผลการตรวจสอบปัจจุบัน

หน้าเว็บ Remote ปัจจุบันยังไม่เหมือน Remote ตัวจริง โดยมีความต่างหลักดังนี้:

- เรียง AI Vocal → Audio → Video → Connection แต่ Remote ตัวจริงเรียง Audio Master → Donate → Equalizer → AI Vocal → Video & Sync
- ไม่มี Audio Master ON/OFF และ Mute ในตำแหน่งเดียวกับ Remote ตัวจริง
- ไม่มี DYN/Normalize อยู่ข้าง Volume
- ไม่มี Equalizer 10 แบนด์และ preset
- ไม่มีชุดปุ่มลัด Video Delay แบบ `-0.05`, `-0.01`, `0`, `+0.01`, `+0.05`
- ไม่มี Zoom preset `1:1`, `21:9`, `FILL`
- ไม่มี Rotate action และ angle preset `0°`, `90°`, `270°`, `180°`
- มี AI profile readout และ Connection card ขนาดใหญ่ที่ไม่มีใน layout ของ Remote ตัวจริง
- มี intro/session card/footer ที่ทำให้ตำแหน่ง Remote ไม่ตรงกับตัวจริง
- enum บางค่าฝั่งเว็บไม่ตรงกับ Extension เช่น `medium`/`mid` และ `vocal`/`voice`

## Layout เป้าหมายแบบ 1:1

### 1. Audio Master

- [x] วางเป็น block แรกเหมือน Remote ตัวจริง
- [x] ด้านซ้ายของ header มีปุ่ม Audio `ON/OFF` ตามด้วยชื่อ `MASTER AUDIO`
- [x] ด้านขวาของ header มี ping และสถานะ `ONLINE/OFFLINE/SYNCED`
- [x] Card แรกมี Volume และ Balance เรียงบนลงล่าง
- [x] ในแถวชื่อ Volume มี `DYN`, สถานะ DYN, `MUTE` และค่า Volume
- [x] Card ที่สองมี Pitch และ Reverb เรียงบนลงล่าง
- [x] ใช้ range และช่วงค่าตรงกับ Extension:
  - Volume: `0..1`, step `0.02`
  - Balance: `-1..1`, step `0.1`
  - Pitch: `-12..12`, step `1`
  - Reverb: `0..2`, step `0.1`
- [x] แสดงค่าตามรูปแบบเดียวกัน เช่น `100%`, `CENTER`, `0 ST (Normal)`, `0.0s`
- [x] เมื่อ Audio OFF ให้ body ของ Audio, EQ และ AI Vocal disabled แบบเดียวกับ Remote ตัวจริง

### 2. Donate

- [x] อยู่หลัง Audio และก่อน Equalizer เหมือน Remote ตัวจริง
- [x] เป็นแถบ/ปุ่มเต็มความกว้าง ไม่สร้าง panel header เพิ่ม
- [x] ใช้ลิงก์ `https://ganknow.com/nextfeederlabs/tip`
- [x] ปรับ visual ให้สุภาพและเข้าธีม public site โดยไม่เด่นรบกวน control หลัก

### 3. Equalizer

- [x] อยู่หลัง Donate และก่อน AI Vocal
- [x] Header ด้านซ้ายมี EQ `ON/OFF` และชื่อ `EQUALIZER`
- [x] Header ด้านขวามี preset select
- [x] Preset ต้องตรงกับ Extension: `FLAT`, `BASS`, `ROCK`, `POP`, `VOICE`, `USER`
- [x] มี 10 แบนด์เรียงแนวนอนในลำดับเดียวกัน: `32`, `64`, `125`, `250`, `500`, `1k`, `2k`, `4k`, `8k`, `16k`
- [x] แต่ละแบนด์เป็น vertical control ช่วง `-12..12 dB`, step `0.5 dB`
- [x] แต่ละแบนด์แสดงค่า dB ด้านบนและ frequency ด้านล่าง
- [x] ลากด้วย touch/pointer ได้ต่อเนื่องเหมือน Remote ตัวจริง
- [x] เมื่อแก้แบนด์เอง preset ต้องเปลี่ยนเป็น `USER/custom`
- [x] เมื่อเลือก preset ต้องอัปเดตทั้ง 10 แบนด์และส่งค่าให้ host ครบ

### 4. AI Vocal

- [x] อยู่หลัง Equalizer และก่อน Video
- [x] Header ด้านซ้ายมี AI Vocal `ON/OFF` และชื่อ `AI VOCAL`
- [x] Header ด้านขวาแสดง mode ปัจจุบัน `ORIGINAL`, `KARAOKE` หรือ `ACAPELLA`
- [x] ภายในมี label `MODE` และปุ่มสามช่องเท่ากันตามลำดับ `ORIG`, `KARAOKE`, `ACAPELLA`
- [x] active state แยกสีให้รับรู้ได้ชัด แต่ยังใช้ชุดสี public site
- [x] ไม่ใส่ AI profile/ECO readout เพราะไม่มีใน layout Remote ตัวจริง
- [x] เมื่อ AI Vocal OFF ให้เฉพาะ body ของ AI Vocal disabled แต่ปุ่มเปิดยังใช้งานได้

### 5. Video & Sync

- [x] อยู่เป็น block สุดท้าย
- [x] Header ด้านซ้ายมี Video `ON/OFF` และชื่อ `VIDEO & SYNC`
- [x] Header ด้านขวามี quality select และปุ่ม reset video
- [x] ค่า quality ต้องตรงกับ Extension: `max`, `high`, `mid`, `low`
- [x] Delay เป็น card เต็มความกว้างก่อนส่วนอื่น
- [x] Delay มีค่า timecode ขนาดเด่น, slider `0..5`, step `0.05`
- [x] Delay มีปุ่มลัดตามลำดับ `-0.05s`, `-0.01s`, `0s`, `+0.01s`, `+0.05s`
- [x] ใต้ Delay เป็น grid สองคอลัมน์: Zoom ทางซ้ายและ Rotation ทางขวา
- [x] Zoom มีค่าเปอร์เซ็นต์, preset `1:1`, `21:9`, `FILL` และ slider `1..3`, step `0.05`
- [x] Rotation มีค่าองศา, ปุ่ม `ROTATE +90°` และ angle preset สี่ตำแหน่ง `0°`, `90°`, `270°`, `180°`
- [x] หน้าจอเล็กกว่า 360px เปลี่ยน Zoom/Rotation เป็นหนึ่งคอลัมน์เหมือน Remote ตัวจริง
- [x] ไม่เพิ่ม Position X/Y เพราะไม่มีอยู่ใน `remote-ui-bundle.js` ที่ใช้งานจริง ณ ตอนนี้

### 6. Connection และสถานะ

- [x] ย้าย connection state และ RTT/ping ไปไว้ด้านขวาของ Audio header ตาม Remote ตัวจริง
- [x] ใช้ reconnect banner ด้านบน control stack เมื่อ link หลุด
- [x] banner มีข้อความ countdown และปุ่ม Retry
- [x] ตอนเริ่มเชื่อมต่อให้แสดง loading/connecting state โดยไม่ทำให้ layout กระโดด
- [x] ตัด Connection card ขนาดใหญ่ออกจาก control stack
- [x] เก็บข้อความ privacy/ลิงก์ Privacy/Support ไว้ในส่วนท้ายขนาดเล็กนอก control layout หากจำเป็น แต่ห้ามแทรกกลางตำแหน่ง control

## Style ที่ต้องเปลี่ยนจาก Extension

- [x] ใช้สีหลักจาก public site: dark green/ink, lime green, cyan และ muted green-gray
- [x] ใช้ฟอนต์อ่านง่ายชุดเดียวกับ public site รวม fallback ภาษาไทย
- [x] เปลี่ยน Win98 border เป็น card border, radius และ shadow แบบ public site
- [x] เปลี่ยนปุ่มโลหะ/ปุ่มนูนเป็น button และ segmented control แบบ public site
- [x] เปลี่ยน blue title bar เป็น panel header แบบ public site แต่รักษาขนาดและตำแหน่ง element ภายใน
- [x] ออกแบบ horizontal slider และ vertical EQ ใหม่ให้เข้าธีม แต่รักษาพื้นที่ลากและค่าทางเทคนิคเดิม
- [x] ใช้ icon แบบไม่เพิ่ม runtime dependency จาก CDN
- [x] active, hover, focus, disabled, loading และ error มี state ที่มองเห็นชัด
- [ ] touch target สำคัญไม่น้อยกว่า 40px และไม่ทำให้ตำแหน่ง control เปลี่ยนลำดับ
- [ ] จำกัดความกว้าง Remote ใกล้เคียงตัวจริงประมาณ 440px บน desktop และเต็มความกว้างอย่างเหมาะสมบน mobile

## Runtime และ protocol

### รักษาของดีที่มีอยู่ฝั่ง public Remote

- [x] คงการอ่าน `host` และ `token` จาก URL fragment
- [x] คงการลบ token ออกจาก address bar หลังอ่านเข้าหน่วยความจำ
- [x] คง `HANDSHAKE`, `protocolVersion`, `needUI: false` และ `GET_STATE`
- [x] คง local PeerJS bundle ห้ามย้อนกลับไปใช้ PeerJS CDN
- [x] คง message size limit, allowlist และการ validate ค่า
- [x] คง reconnect, heartbeat, ping/RTT และ user disconnect
- [x] คงหลักการส่งเฉพาะ control data ไม่มี audio/video stream

### เพิ่ม behavior ให้ครบตาม Remote ตัวจริง

- [x] เพิ่ม `isAudioMasterOn` ใน public protocol schema
- [x] เพิ่ม UI/state binding สำหรับ `normalize`, `isEqOn`, `isAudioMasterOn`, `eqPreset` และ `eq[0..9]`
- [x] แก้ enum ให้ตรง Extension จริง:
  - `videoQuality`: ใช้ `max`, `high`, `mid`, `low`
  - `eqPreset`: ใช้ `flat`, `bass`, `rock`, `pop`, `voice`, `custom`
- [x] หากต้องรองรับ state เก่า ให้ normalize alias ที่ขอบระบบเท่านั้น เช่น `medium -> mid`
- [x] ปุ่ม preset/shortcut ทุกปุ่มเรียก `sendParam()` กลาง ห้ามส่ง PeerJS เองจาก inline handler
- [x] ปุ่ม reset video ส่ง Zoom `1`, Rotation `0`, Delay `0` เหมือน Remote ตัวจริง
- [x] ปุ่ม rotate หลักหมุนวน `0 -> 90 -> 180 -> 270 -> 0`
- [x] EQ preset ส่ง 10 ค่าโดยรักษาลำดับ index และส่ง `eqPreset` ปิดท้าย
- [x] incoming `SYNC_STATE` และ `UPDATE_PARAM` อัปเดตทุก control แม้หน้าอยู่ background
- [x] ค่าที่ผู้ใช้ลาก update แบบ optimistic และยอมรับค่าล่าสุดจาก host เป็นค่าจริง
- [x] จำกัดความถี่การส่ง slider/EQ ด้วย `requestAnimationFrame` หรือ fallback coalescing และ flush ค่าสุดท้ายเมื่อ pointer up/change
- [x] ไม่ใช้ inline `onclick` และไม่ใช้ `new Function()` ใน public site

## โครงสร้าง implementation ที่แนะนำ

### Phase A — ทำ inventory และ contract ก่อนแตะหน้าตา

- [x] สร้าง inventory control ID → state key → min/max/step → formatter → ตำแหน่ง section จาก `remote-ui-bundle.js`
- [x] ตรวจค่าทุก enum กับ `popup.html`, `popup.js` และ `offscreen.js`
- [x] ระบุ control ที่อยู่ในไฟล์เก่าแต่ไม่มีใน runtime bundle และห้ามนำเข้ามาเอง
- [ ] บันทึก screenshot/reference ของ Remote Extension ที่สถานะ connected สำหรับเทียบตำแหน่ง

### Phase B — สร้าง DOM ให้ตรง layout Extension

- [x] เขียน `remote/index.html` ใหม่ตามลำดับและ nesting ในหัวข้อ Layout เป้าหมาย
- [x] ลบ intro, session card, AI profile และ Connection card ที่ทำให้ layout ไม่ตรง
- [x] ทำ static semantic DOM สำหรับ control หลัก และ generate เฉพาะ EQ 10 แบนด์จาก config เดียว
- [x] ใส่ label EN/TH ให้ control ใหม่ทั้งหมดโดยไม่เปลี่ยน state key

### Phase C — ทำ visual skin ของเว็บไซต์

- [x] refactor `remote.css` เป็น stylesheet เดียวที่อ่านง่าย
- [x] ลบ override เก่าที่ซ้อนท้ายไฟล์เมื่อ style ใหม่ครอบคลุมแล้ว
- [x] map component ทุกชนิดเข้ากับ token ของ `site.css`
- [x] ตรวจ spacing และ column breakpoint ให้ตำแหน่งตรง Remote Extension

### Phase D — ต่อ behavior และ protocol ให้ครบ

- [x] เพิ่ม schema และ alias normalization
- [x] ผูก Audio Master, Mute, DYN, EQ, Vocal และ Video controls
- [x] ผูก shortcut/preset/reset และ formatter ทั้งหมด
- [x] ทำ state dependency ระหว่าง Audio, EQ, AI Vocal และ Video
- [x] ทำ reconnect banner, ping และ status ในตำแหน่งเดียวกับ Remote Extension
- [x] ลบ runtime code ของ public UI เดิมที่ไม่มี element ใช้งานแล้ว

### Phase E — ทดสอบ parity

- [ ] ตรวจ DOM/control inventory ว่ามี control เท่ากับ runtime bundle ทุกตัว
- [ ] ตรวจทุกค่า min/max/step/default และ enum ด้วย automated test หรือ assertion
- [ ] ทดสอบ mock `SYNC_STATE` แล้วทุก control แสดงค่าถูกต้อง
- [ ] ทดสอบ `UPDATE_PARAM` ทีละ key รวม EQ index `0..9`
- [ ] ทดสอบ outgoing `SET_PARAM` ของทุก control และทุก shortcut
- [ ] ทดสอบ reconnect โดยไม่ reset state และไม่สร้าง Peer ซ้ำค้าง
- [ ] ทดสอบ background/foreground และการกลับมาหน้า Remote
- [ ] ทดสอบมือถืออย่างน้อย 320px, 360px, 390px, 430px และ desktop
- [ ] ทดสอบ touch drag ของ slider และ EQ โดยไม่ทำให้หน้าเลื่อนผิดจังหวะ
- [ ] ทดสอบ keyboard, focus-visible, screen-reader label และ color contrast
- [ ] ทดสอบ end-to-end กับ Extension จากลิงก์ Remote จริง ไม่ใช่แค่เปิด HTML โดยตรง

### Static checks ที่ทำแล้วในรอบ implementation

- [x] ตรวจ JavaScript syntax ด้วย `node --check` สำหรับ `remote.js` และ `remote-protocol.js`
- [x] ตรวจ whitespace/error ด้วย `git diff --check`
- [x] ตรวจ HTML ด้วย `tidy`; ไม่พบ error โครงสร้าง มีเพียง warning ของ span ว่างที่ใช้เป็น status dot
- [x] ตรวจไม่พบ inline event handler, `new Function()` หรือ CDN runtime ใน Public Remote
- [ ] ยังไม่ได้ทดสอบ end-to-end ใน browser จริงกับลิงก์ที่ Extension สร้าง

## สิ่งที่ห้ามทำ

- ห้ามแก้ `nextsona-extension/remote/remote-ui-bundle.js` เพื่อให้เว็บดูเหมือนกัน
- ห้ามเปลี่ยน layout ของ Remote Extension ต้นฉบับ
- ห้ามเอา connection code จาก `remote/app.js` หรือ `dos-remote.html` มาทับ public runtime
- ห้ามกลับไปใช้ query-string สำหรับ token
- ห้ามโหลด Tailwind, Google Fonts, PeerJS หรือ icon library จาก CDN ตอน runtime
- ห้ามเพิ่ม control จากไฟล์เก่าที่ไม่มีใน `remote-ui-bundle.js`
- ห้ามตัด control ออกจากเว็บเพียงเพราะทำ style ยาก
- ห้ามทำแค่ mock UI; ทุก control ต้องส่งและ sync กับ Extension จริง
- ห้ามแก้ระบบเสียง, AI model, WebGL/WebGPU หรือ DSP ในงานนี้
- ห้าม commit จนกว่าผู้ใช้จะสั่ง

## เกณฑ์ว่างานเสร็จ

- [ ] เมื่อวางภาพ Remote Extension กับ Public Remote เทียบกัน จะเห็น section, ลำดับ, nesting และตำแหน่ง control ตรงกัน
- [ ] ความต่างที่ตั้งใจเหลือเพียง visual skin, ฟอนต์ และ branding ของ public website
- [ ] ทุก control ของ `remote-ui-bundle.js` มีอยู่และใช้งานได้ใน public Remote
- [ ] ไม่มี panel/control พิเศษของหน้า public เดิมมาคั่น layout
- [ ] state จาก Extension และค่าที่ Remote ส่งกลับตรงกันครบ
- [ ] reconnect และ background/foreground ใช้งานได้โดยไม่ค้าง Loading
- [ ] ไม่มี secret/token ใน URL หลัง boot, console หรือ DOM
- [ ] ไม่มี external runtime dependency เพิ่ม
- [ ] ผ่านการทดสอบกับลิงก์ Remote ที่ Extension สร้างจริงบนโทรศัพท์

## ลำดับการส่งงาน

1. ทำ Phase A–B เป็นกลุ่มแรก แล้วตรวจ layout parity
2. ทำ Phase C–D เป็นกลุ่มที่สอง แล้วตรวจ visual และ behavior พร้อมกัน
3. ทำ Phase E ทั้งชุดก่อนส่งให้ผู้ใช้ทดสอบจริง
4. ยังไม่ commit จนกว่าผู้ใช้จะตรวจและสั่งให้ commit
