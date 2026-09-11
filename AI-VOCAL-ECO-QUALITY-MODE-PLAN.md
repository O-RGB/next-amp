# AI Vocal Eco / Medium / Full Runtime Mode Plan

## เป้าหมาย

เพิ่มตัวเลือกเพียงหนึ่งตัวให้ผู้ใช้วนสลับระหว่าง:

- `ECO` — ใช้ preset เดียวกับ MEDIUM ที่ผู้ใช้ทดสอบแล้ว ราว 50–55 ms
- `MEDIUM` — ชื่อ compatibility เดิมของ preset balanced เดียวกับ ECO
- `FULL` (`quality` ใน storage เดิม) — คุณภาพเสียงและพฤติกรรม Detail ปัจจุบันเต็มรูปแบบ

ทั้งสามโหมดต้องใช้ model, WASM, manager และ audio pipeline ชุดเดียวกัน ห้ามคัดลอก implementation แยกเป็นหลายชุด

## ข้อเท็จจริงที่ตรวจแล้ว

- [x] `main` และ `optimization` ใช้ `model.json` ไฟล์เดียวกัน
- [x] `main` และ `optimization` ใช้ weights `group1-shard1of1.bin` ไฟล์เดียวกัน
- [x] model input ยังคงเป็น context เต็ม `[1, 1024, 64, 2]`
- [x] `main` ตั้งต้นด้วย `balanced`: 15 frames / 7,680 samples
- [x] ปัจจุบันตั้งต้นด้วย `ai_remove`: 16 frames / 8,192 samples
- [x] WASM ปัจจุบันมี runtime setter สำหรับ attenuation floor, smoothing และ transient gate แล้ว
- [x] WebGL F16 ผ่าน blind listening test ก่อนหน้า โดยผู้ใช้ฟังไม่พบความต่างจาก F32 และ latency ลดลงเล็กน้อย
- [x] `CANDIDATE_WEBGL_F16` มีผลเฉพาะ WebGL ไม่มีผลกับ WebGPU
- [x] commit `13aacda` เป็นจุดเริ่ม optimization ที่เปลี่ยน Web เป็น 15-hop/7,680 และย้าย rolling normalization เข้า WASM
- [x] commit `2453fd5`, `b71df7a`, `42e0c6e` ลดงาน realtime ด้วย diagnostics gating และ fixed/bounded queues
- [x] `model.json` ของ `13aacda`, `15f4a44`, `77bed6f`, `main` และ early optimization มี Git blob เดียวกัน (`350849b...`)
- [x] F16 และ 15-hop เคยผ่านแยกกัน แต่ก่อนเพิ่มสามระดับยังไม่เคยเปิดพร้อมกันเป็น preset เดียว
- [x] ECO และ MEDIUM ใช้ 15-hop / 7,680 samples และ context 64 frames เดียวกัน
- [x] ทดสอบ WebGL kernel flags แบบแยก candidate แล้ว; baseline เสถียรที่สุด จึงไม่เปิด flag ทดลองที่ทำให้ p50/p95 แย่ลง

ดังนั้นงานนี้ไม่ต้อง retrain model, ไม่ต้อง export model ใหม่ และไม่ต้องสร้าง WASM คนละไฟล์สำหรับแต่ละโหมด

## ข้อควรระวังเรื่องตัวเลข latency

ห้ามตัดสินความเบาจากเลข inference ต่อรอบเพียงอย่างเดียว:

- 7,680 samples เรียก model ประมาณ 5.74 ครั้ง/วินาทีที่ 44.1 kHz (ECO/MEDIUM)
- 8,192 samples เรียก model ประมาณ 5.38 ครั้ง/วินาทีที่ 44.1 kHz (FULL)

ECO ไม่เพิ่ม packet หรือ cadence ใหม่จาก MEDIUM และยังเรียก full 64-frame model ใหม่ทุกครั้ง
จึงไม่เพิ่มความเสี่ยงด้าน alignment, เสียงวูบวาบ หรือ latency จากการทดลอง 17-hop

เป้าหมายจริงของ ECO คือภาระรวมต่อวินาทีและความนิ่งเมื่อเล่นนาน ไม่ใช่ทำให้ตัวเลข ms บน UI ต่ำลงอย่างเดียว

## รูปแบบ config กลาง

เพิ่ม runtime preset เพียงจุดเดียวใน `ai-vocal-manager.js`:

```js
const AI_POWER_MODES = Object.freeze({
  eco: Object.freeze({
    profile: "balanced",
    processingProfile: "balanced",
    backendPolicy: "auto_webgpu_first",
    webglF16: false,
    webglPackNormalization: false,
    webglPackDepthwiseConv: false,
    webgpuDeferredSubmitBatchSize: 15,
    attenuationFloor: false,
    asymmetricSmoothing: false,
    transientGate: false,
    overlapConsensus: false,
    adaptiveQueue: false
  }),
  medium: Object.freeze({
    profile: "balanced",
    processingProfile: "balanced",
    backendPolicy: "auto_webgpu_first",
    webglF16: false,
    webglPackNormalization: false,
    webglPackDepthwiseConv: false,
    webgpuDeferredSubmitBatchSize: 15,
    attenuationFloor: false,
    asymmetricSmoothing: false,
    transientGate: false,
    overlapConsensus: false,
    adaptiveQueue: false
  }),
  quality: Object.freeze({
    profile: "ai_remove",
    processingProfile: "ai_remove",
    backendPolicy: "auto_webgpu_first",
    webglF16: true,
    webglPackNormalization: true,
    webglPackDepthwiseConv: true,
    webgpuDeferredSubmitBatchSize: 0,
    attenuationFloor: false,
    asymmetricSmoothing: true,
    transientGate: true,
    overlapConsensus: false,
    adaptiveQueue: true
  })
});
```

ค่าจริงต้องถูกอ่านผ่านฟังก์ชันกลาง เช่น `getPowerModeConfig()` ห้ามกระจายเงื่อนไข `if (eco)` ไปทั่ว manager

เหตุผลที่ ECO และ MEDIUM ใช้ runtime setting จากช่วงต้น:

- ใช้ cadence ที่ผู้ใช้ฟังผ่านแล้วและไม่เพิ่มภาระจาก candidate ใหม่
- ยังคงใช้ model/context 64 frames เดิม ไม่ได้ลดความละเอียดของ model หรือสร้าง model ใหม่
- ปิด smoothing/transient แบบ `main`; FULL เท่านั้นที่คงสองตัวนี้จากรอบทดสอบคุณภาพล่าสุด
- ปิด adaptive queue ใน ECO และใช้ pending target คงที่ 2 แบบ `main`
- คืน WebGPU deferred-submit เป็นค่า default 15 แบบ backend เดิม; FULL คงค่า 0 ที่ทดสอบล่าสุด
- ECO และ MEDIUM ใช้ WebGPU-first/F32 ชุดเดียวกัน

ข้อจำกัด: ECO กับ MEDIUM ไม่ได้ลดภาระต่างกัน เพราะเป็น preset เดียวกัน
หากต้องการลดภาระกว่านี้ต้องทำ candidate ใหม่และผ่าน listening/long-run gate แยกต่างหาก

## ขอบเขตแต่ละโหมด

### ECO

- ใช้ model และ context 64 frames เดิม
- ใช้ balanced 15-frame / 7,680 samples ผ่าน runtime config กลาง
- ใช้ WebGPU-first/F32 เหมือน MEDIUM
- ชื่อ eco เก่าที่ค้างอยู่ใน session จะ resolve เป็น balanced โดยไม่สร้าง profile ใหม่
- ปิด smoothing และ transient gate ให้ตรงกับ `main`
- ใช้ browser pending target คงที่ 2; ไม่เปิด adaptive queue ของ FULL
- คงระบบ queue, stale-generation guard และ recovery ปัจจุบันทั้งหมด
- เรียก model ประมาณ 5.74 ครั้ง/วินาทีที่ 44.1kHz เช่นเดียวกับ MEDIUM
- UI ต้องแสดง backend จริง เช่น `API: WEBGPU • F32` ไม่ใช่แสดงค่าที่ร้องขอแต่เปิดไม่สำเร็จ

### MEDIUM

- เป็นชื่อเดิมของ config เดียวกับ ECO เพื่อ compatibility
- ใช้ balanced 15-frame / 7,680 samples
- ใช้ WebGPU-first/F32, deferred-submit 15 และ fixed pending target 2
- ปิด smoothing, transient และ adaptive queue เหมือนค่าที่ผู้ใช้วัดได้ 50–55 ms

### FULL (`quality`)

- เป็น baseline ปัจจุบันแบบไม่เปลี่ยนเสียง
- ใช้ Detail 16-frame / 8,192 samples
- เลือก WebGPU ก่อน แล้ว fallback WebGL ตาม setting ล่าสุดของ `main`
- คง smoothing, transient gate, graph optimization และ stability recovery ปัจจุบัน
- output ของ QUALITY ต้องไม่เปลี่ยนเพราะการเพิ่ม ECO

### GO

- งานนี้ห้ามเปลี่ยน model, DirectML, CoreML, packet size หรือ DSP ของ GO
- เมื่อเลือก GO ให้เก็บค่า ECO/MEDIUM/FULL ไว้ แต่ยังไม่ reload Web backend
- เมื่อกลับมา WEB ค่อยใช้ preset ที่ผู้ใช้เลือก
- ปุ่ม ECO/MEDIUM/FULL อาจยังแสดงได้ แต่ต้องมี tooltip ว่าใช้กับ WEB AI เท่านั้น หรือ disable ขณะ GO ทำงาน

## ลำดับ fallback ของ ECO

1. WebGPU F32
2. WebGL 2 F32 ถ้า WebGPU ใช้ไม่ได้
3. WebGL 1 F32 ถ้า WebGL 2 ใช้ไม่ได้
4. CPU เป็นทางเลือกสุดท้ายตาม behavior เดิม

ห้าม fallback เพราะ latency สูงเพียง sample เดียว และห้ามสลับ backend ไปมาระหว่างเพลงจนเกิด oscillation

ถ้า backend ใดให้ผลผิดปกติบนอุปกรณ์ใด ให้ fallback สำหรับ session นั้นเท่านั้น ไม่ต้อง blacklist ถาวรในเฟสแรก

## การสลับโหมดระหว่างกำลังเล่น

สร้างเมธอดเดียว เช่น `setPowerMode(mode)` และทำตามลำดับนี้:

1. normalize ค่าเป็น `eco`, `medium` หรือ `quality`
2. ถ้าค่าไม่เปลี่ยน ให้ return โดยไม่ reset audio
3. บันทึกโหมดใหม่
4. increment `streamGeneration`
5. mute AI output และสั่ง Worklet flush queue
6. ล้าง pending chunks, rolling state และผลจาก generation เก่า
7. ถ้า backend policy ใหม่ต้องเปลี่ยน backend:
   - ใช้ shared recovery/backend lock ปัจจุบัน
   - dispose model/tensor ของ backend เก่าอย่างถูกต้อง
   - ห้ามเรียก public `unloadEngine()` ถ้ามันเปลี่ยน mode เป็น bypass
   - configure backend ใหม่
   - load model ชุดเดิมและ warmup หนึ่งครั้ง
8. apply DSP preset ผ่าน runtime setters
9. ส่ง profile/chunk size/generation ปัจจุบันไป Worklet
10. prime จาก input ใหม่เท่านั้น
11. fade AI output กลับหลัง output ใหม่พร้อม

ระหว่างสลับโหมดห้ามปล่อย raw vocal, output จากเพลงก่อนหน้า หรือผลจาก backend เก่าออกลำโพง

ถ้าสลับโหมดล้มเหลว ให้กลับไป preset/backend ล่าสุดที่ทำงานได้ และแสดงสถานะสั้น ๆ โดยไม่ค้าง `Buffering...` ถาวร

## UI และการบันทึกค่า

- เพิ่มปุ่มเดียวใน AI Vocal panel และกดวน `FULL → MED → ECO → FULL`
- default เป็น `FULL` (`quality`) เพื่อไม่เปลี่ยนพฤติกรรมผู้ใช้เดิมโดยไม่ตั้งใจ
- tooltip: `Lower GPU power for older devices`
- เก็บค่าเป็น `aiPowerMode: "eco" | "medium" | "quality"` ใน setting กลาง
- ห้ามนำปุ่ม Smooth/Detail เก่ากลับมา
- ห้ามใช้ `vocalProfile` เป็น public UI setting อีก แต่เก็บ compatibility path สำหรับ session/remote เก่าได้
- hardware status ควรแสดง backend และ precision จริงหลัง engine ready

ไฟล์ที่คาดว่าต้องแก้:

- `next-amp-extension/popup.html`
- `next-amp-extension/popup.js`
- `next-amp-extension/offscreen.js`
- `next-amp-extension/modules/ai-vocal/ai-vocal-manager.js`
- test ที่เกี่ยวข้องใน `ai-vocal-engine/test/`

## กลุ่มงาน A — Preset และ backend policy

- [x] เพิ่ม `AI_POWER_MODES`
- [x] เพิ่ม `DEFAULT_AI_POWER_MODE = "quality"`
- [x] เพิ่ม `getPowerModeConfig()`
- [x] เปลี่ยน DSP setters ให้อ่านค่าจาก preset กลาง
- [x] เปลี่ยน backend selection ให้อ่าน `backendPolicy`
- [x] ECO และ MEDIUM ใช้ `balanced` 15-hop / 7,680 samples ผ่าน runtime config เดียวกัน
- [x] ECO คง config MEDIUM แบบ exact โดยไม่เพิ่ม cadence/profile ใหม่ และไม่แตะ FULL
- [x] เพิ่มสถานะ precision จริง `F16` หรือ `F32`
- [x] ยืนยันว่า QUALITY ยังเข้าทาง WebGPU-first เหมือนเดิม
- [x] ยืนยันว่า ECO และ MEDIUM ใช้ WebGPU-first/F32 ชุดเดียวกัน
- [x] เพิ่ม fallback เมื่อ WebGPU/WebGL initialization หรือ warmup ใช้ไม่ได้
- [x] ห้ามแตะ GO path

## กลุ่มงาน B — Safe runtime switching

- [x] เพิ่ม `setPowerMode(mode)`
- [x] ใช้ generation guard ปัจจุบันเพื่อทิ้ง output เก่า
- [x] serialize การเปลี่ยน backend ด้วย shared lock
- [x] รักษา `currentMode` เป็น Karaoke/Acapella ระหว่าง reload
- [x] flush และ re-prime Worklet ด้วย input ใหม่
- [x] ป้องกันการกด toggle รัวแล้วเกิด model load ซ้อน
- [x] ถ้าผู้ใช้สลับไป GO ระหว่าง reload จะไม่ reset GO และไม่แทรก Web reload
- [x] ถ้า engine ยังไม่โหลด ให้เปลี่ยน config อย่างเดียวและใช้ตอนเปิด AI ครั้งถัดไป
- [x] recovery/fallback เดิมยังทำงานในทั้งสาม preset
- [x] provider switch ล้มเหลวแล้วคืน preset เดิมและพยายาม restore engine หนึ่งครั้ง

## กลุ่มงาน C — UI และ persistence

- [x] เพิ่มปุ่มเดียวสำหรับ FULL/MED/ECO
- [x] ส่ง `aiPowerMode` ผ่าน session setting และ offscreen parameter
- [x] restore ค่าเมื่อเปิด popup ใหม่หรือเปลี่ยน tab
- [x] ป้องกัน setting เก่าที่ไม่มี `aiPowerMode` โดย fallback เป็น QUALITY
- [x] แสดง `WEBGPU • F32` หรือ `WEBGL • F16` จาก backend จริง
- [x] ไม่เพิ่มความสูงจน popup scroll
- [x] ไม่แสดง Smooth/Detail อีก
- [x] remote UI เดิมไม่พัง แม้ยังไม่เพิ่ม ECO control ใน remote

## กลุ่มงาน D — Automated tests

- [x] preset resolver คืนค่าถูกต้องและ object ไม่ถูก mutate
- [x] preset แยก processing cadence/backend policy ของ ECO/MEDIUM/FULL โดยยังใช้ model และ context เดิม
- [x] QUALITY ใช้ config ตรงกับ production baseline ก่อนเพิ่ม ECO
- [x] ECO และ QUALITY อ้าง model URL/weights ชุดเดียวกัน
- [x] ECO/MEDIUM ใช้ cadence และ backend policy ชุดเดียวกันอย่างชัดเจน
- [x] ECO fallback ได้เมื่อ WebGPU หรือ WebGL initialization ล้มเหลว
- [x] การสลับโหมด increment generation และล้าง pending output
- [x] การกดโหมดเดิมซ้ำไม่ reset audio
- [x] toggle รัวไม่สร้าง backend/model พร้อมกันหลายชุด
- [x] switch ระหว่าง Karaoke/Acapella แล้วยังคง mode หลัง backend reload
- [x] switch ไป GO แล้วไม่มี Web backend reload แทรก
- [x] model/tensor count ไม่เพิ่มทุกครั้งที่สลับโหมดใน covered manager lifecycle tests
- [x] test เดิมของ Worklet, model optimizer และ WebGPU recovery ผ่านทั้งหมด

คำสั่งตรวจขั้นต่ำ:

```bash
node ai-vocal-engine/test/test_model_optimizer.mjs
node ai-vocal-engine/test/test_vocal_worklet.mjs
node ai-vocal-engine/test/test_ai_manager_stall_recovery.mjs
node ai-vocal-engine/test/test_webgpu_recovery_controller.mjs
npm run build
```

## กลุ่มงาน E — Listening และ long-run gate

ทดสอบเพลงเดิมชุดเดียวกันทั้ง ECO, MEDIUM และ FULL:

- ช่วงเสียงร้องกลางชัด
- เสียงร้องซ้าย/ขวาและ reverb tail
- drum/snare transient
- เพลงที่เคยเกิดเสียงหุ่นยนต์
- เพลงที่เคยทำให้ดนตรีวูบวาบ
- เปลี่ยนเพลง YouTube อย่างน้อย 10 ครั้ง
- ย่อ popup, scroll หน้าเว็บ และเปิดโปรแกรมที่ใช้ GPU พร้อมกัน

เครื่องทดสอบขั้นต่ำ:

- Apple M2
- Windows GTX 1050 Ti
- Windows MX130 ถ้ายังเข้าถึงเครื่องได้

ทดสอบต่อเนื่องอย่างน้อย 30 นาทีต่อโหมด และเก็บ:

- inference p50/p95/max
- inference calls ต่อวินาที
- backend/precision จริง
- underrun/drop/recovery count
- `tf.memory().numTensors`
- อุณหภูมิหรือ clock/power ถ้าอุปกรณ์รายงานได้
- อาการ YouTube ค้างหลังเปลี่ยนเพลง

## เกณฑ์ผ่าน

### FULL

- [ ] เสียงต้องเหมือน production ปัจจุบัน ไม่มี vocal bleed หรือดนตรีวูบเพิ่ม
- [ ] latency และ calls/sec ไม่ถอยจาก baseline อย่างมีนัยสำคัญ
- [x] WebGPU recovery และ fallback ยังทำงานครบใน automated tests

### ECO

- [ ] blind listening ไม่พบความเสียหายชัดเจนเมื่อเทียบ QUALITY
- [ ] ไม่มีเสียงหุ่นยนต์หรือสลับ raw/Karaoke
- [ ] เล่น Windows GPU รุ่นเก่า 30 นาทีโดยไม่เข้าสู่ GPU Slow ซ้ำแบบเดิม
- [ ] เปลี่ยนเพลงแล้วไม่สะสม tensor, queue หรือ latency
- [ ] ภาระ/ความร้อนระยะยาวต่ำกว่า QUALITY จริง ไม่ใช่แค่เลข ms ต่อรอบต่ำกว่า
- [ ] p95 ยังต่ำกว่า chunk deadline และไม่มี output buffer ขาด

### MEDIUM

- [ ] latency และเสียงเท่ากับ MEDIUM เดิม (เป้าหมายที่พบ 50–55 ms)
- [ ] WebGPU long-run ไม่ร้อนหรือ stall หลังเปลี่ยนเพลง

## Candidate สำรอง ถ้า WebGL F16 ยังไม่เบาพอ

ห้ามเปิด candidate เหล่านี้พร้อมกัน ให้ทดสอบแยกทีละตัว:

1. ทดลอง cadence ที่เรียก inference น้อยลง โดยต้องตรวจ alignment และคุณภาพใหม่ทั้งหมด
2. ใช้ device-session policy เลือก WebGL F16 เฉพาะ GPU รุ่นเก่าที่ WebGPU ร้อนหรือ stall

ผลการทดลอง kernel flags ที่ทำแล้ว: EXP_CONV, ปิด CONV_IM2COL และปิด depthwise packing
ช้ากว่า baseline อย่างชัดเจน ส่วน transpose packing แม้ p50 บางรอบต่ำกว่าเล็กน้อยแต่ p95 แย่กว่า
และยังไม่นิ่งพอสำหรับ production จึงยอมแพ้กับ candidate กลุ่มนี้

`balanced` 15-frame เป็น implementation กลางของทั้ง ECO และ MEDIUM
candidate 17-hop ถูกถอดออกแล้ว เพราะไม่ได้ให้ประโยชน์ที่ยืนยันได้และเพิ่มความเสี่ยงด้าน cadence

ห้ามทำในแผนนี้:

- ลด context model จาก 64 frames
- quantize weights ใหม่
- เปิด compact output head ที่เคยทำให้คุณภาพถอย
- เปิด overlap consensus ที่เคยไม่ให้ผลคุ้ม latency
- ปิด smoothing/transient โดยไม่มี blind listening gate
- ship model หรือ WASM สองชุด
- copy manager/processChunk แยก Eco กับ Quality

## Build impact

- ไม่ต้อง retrain หรือ export model
- ไม่ต้อง build model graph ใหม่
- ไม่ต้อง compile WASM ใหม่สำหรับการสลับ preset
- ต้องรัน `npm run build` หลังแก้ JS/UI เพื่อสร้าง production extension ใหม่
- backend อาจต้อง reload model ชุดเดิมหนึ่งครั้งเมื่อผู้ใช้สลับ ECO/MEDIUM/FULL ขณะ AI ทำงาน

## ลำดับการทำงานที่แนะนำ

1. ทำกลุ่ม A + B พร้อม automated tests
2. ทำกลุ่ม C
3. ทำกลุ่ม D ให้ผ่านทั้งหมด
4. build extension หนึ่งครั้ง
5. ฟังและทดสอบ long-run ตามกลุ่ม E ทีเดียวทั้ง Apple และ Windows ทั้งสามระดับ
6. ถ้า ECO ยังไม่เย็นพอ ค่อยทดลอง candidate สำรองโดยไม่แตะ QUALITY baseline

แผนนี้ถือว่าเสร็จเมื่อผู้ใช้เลือก ECO/MEDIUM/FULL จากปุ่มเดียวได้, ทั้งสามโหมดใช้ assets ชุดเดียว,
FULL ไม่ถอย และ ECO/MEDIUM ใช้ balanced cadence เดียวกันโดยไม่ทำให้เสียงร้องหรือดนตรีแย่ลง
