# AI Vocal WebGPU Long-Run Stability Plan

สถานะ: **ยังไม่ได้เริ่มแก้โค้ด**  
เป้าหมายหลัก: แก้อาการ Web AI บน Windows ที่เพลงแรกทำงานลื่น แต่เมื่อเล่นนานหรือเปลี่ยนเพลงแล้วเกิด `GPU Slow`, YouTube กระตุก, เสียงขาด และระบบไม่ฟื้นจนต้องปิด AI รอหลายนาที  
ขอบเขต: Browser/Web AI ที่ใช้ร่วมกันระหว่าง Extension และหน้า Web เท่านั้น โดยห้ามเปลี่ยน GO engine

เอกสารนี้ตั้งใจเขียนให้ผู้ลงมือที่ไม่รู้บริบทเดิมสามารถทำตามได้ทีละขั้น ห้ามเดา ห้ามรวมขั้นตอนเอง และห้ามปรับโมเดลนอกเหนือจากที่ระบุ

---

## 0. กติกาสำหรับ AI ที่ลงมือทำ

ทำตามกติกานี้ก่อนอ่านส่วนอื่น:

1. อ่านไฟล์นี้ให้จบก่อนแก้โค้ด
2. ทำครั้งละหนึ่งกลุ่มตามลำดับ `S0 -> S1 -> S2 -> S3 -> S4`
3. หลังทำแต่ละกลุ่ม ให้ build และรอผู้ใช้ทดสอบ ห้ามเริ่มกลุ่มถัดไปเอง
4. **ห้าม commit ทันทีหลังทำกลุ่มเสร็จ**
5. เมื่อผู้ใช้บอกว่ากลุ่มก่อนหน้าผ่านและสั่งให้ทำต่อ จึง commit กลุ่มก่อนหน้า แล้วค่อยเริ่มกลุ่มใหม่
6. ห้ามแก้หรือลบทิ้งการเปลี่ยนแปลงที่มีอยู่ในไฟล์อื่นของผู้ใช้ โดยเฉพาะ `AI-VOCAL-QUALITY-LATENCY-PLAN.md` ซึ่งมีการแก้ค้างอยู่ก่อนสร้างแผนนี้
7. ทุก behavior ใหม่ต้องมี feature flag หรือสามารถ rollback เป็นกลุ่มได้
8. ถ้าผลทดสอบไม่ผ่าน ให้แก้เฉพาะกลุ่มปัจจุบัน ห้ามย้อน optimization ที่ผ่านการฟังจริงไปแล้ว
9. ห้ามเปลี่ยน model weights, model graph, mask, STFT, iSTFT, profile, chunk size หรือ queue target เพื่อพยายามกลบปัญหา
10. ห้ามแก้ GO engine, WebSocket protocol หรือ native DSP ในแผนนี้
11. ห้ามปล่อยเสียง input ปกติเป็น fallback เมื่อ AI ขาด output ให้ใช้การ mute/fade แบบเดิมเท่านั้น
12. ถ้าพบว่าข้อสมมติฐานในแผนผิด ให้บันทึกหลักฐานลงเอกสารก่อนเปลี่ยนแนวทาง ห้ามแก้แบบสุ่ม

คำสั่งสำหรับตรวจสถานะก่อนเริ่มทุกกลุ่ม:

```bash
git status --short
git diff -- next-amp-extension/modules/ai-vocal/ai-vocal-manager.js
```

ห้ามใช้ `git reset --hard`, ห้ามลบงานของผู้ใช้ และห้าม restore ไฟล์ที่ไม่อยู่ในขอบเขตกลุ่มปัจจุบัน

---

## 1. อาการที่ต้องแก้

เครื่องทดสอบที่พบปัญหา:

- Windows
- NVIDIA GeForce GTX 1050 Ti
- Extension แสดง backend เป็น `WEBGPU`
- Chrome ถูกกำหนดให้ใช้ GTX 1050 Ti แล้ว
- ไม่ได้เปิดโหมดประหยัดพลังงาน
- latency ตอนระบบยังปกติประมาณ `90-110 ms`

ลำดับอาการ:

1. ปิด AI หรือพักเครื่องไว้ประมาณ 5 นาที
2. เปิด Extension และเปิด Karaoke
3. เพลงแรกทำงานลื่นและตัดเสียงได้ตามปกติ
4. เมื่อเล่นต่อเนื่องนานขึ้น หรือ YouTube เปลี่ยนไปเพลงที่สอง ระบบเริ่มผิดปกติ
5. YouTube กระตุกหรือค้าง เสียง AI ขาด และขึ้น `GPU Slow`
6. Reload หน้า YouTube หรือ reload Extension ไม่ทำให้ลื่นเหมือนเดิม
7. ต้องปิด AI แล้วรอหลายนาทีจึงกลับมาใช้งานได้ชั่วคราว

ผลที่ต้องการ:

- เล่นต่อเนื่องและเปลี่ยนเพลงได้โดยไม่เกิด deadlock ถาวร
- ถ้า Chrome/driver ทำให้ WebGPU สะดุด ระบบต้องกู้ตัวเองได้
- ไม่ต้องปิด Extension และรอ 5 นาที
- ระหว่างกู้ระบบ ห้ามมีเสียงร้องจริงหรือเสียงเพลงเก่าหลุดออกมา
- หลังฟื้นแล้วคุณภาพเสียงต้องเหมือน production baseline ปัจจุบัน

---

## 2. ข้อเท็จจริงที่ตรวจจากโค้ดแล้ว

- [x] Runtime ที่ผู้ใช้เห็นเป็น `WEBGPU` ใช้ TensorFlow.js WebGPU จริง
- [x] `CANDIDATE_WEBGL_F16` มีผลเฉพาะ WebGL เท่านั้น และไม่มีผลเมื่อ backend เป็น WebGPU
- [x] WebGPU ปัจจุบันจึงทำ inference/readback แบบ float32
- [x] Detail production profile ใช้ 16 frames, 8,192 samples และ model context เต็ม 64 frames
- [x] latency ปกติ `90-110 ms` ต่ำกว่า cadence ของ Detail ประมาณ `185.8 ms`
- [x] เพลงแรกที่เล่นลื่นพิสูจน์ว่า GTX 1050 Ti สามารถประมวลผลโมเดลปัจจุบันแบบ realtime ได้ใน steady state
- [x] `runChunkQueue()` ล็อกด้วย `this.isBusy = true`
- [x] `processChunk()` รอ `await maskTensor.data()` โดยไม่มี timeout
- [x] ถ้า readback Promise ไม่ resolve/reject งาน queue สามารถค้างที่ `isBusy = true` ได้ถาวร
- [x] `STREAM_RESET` ล้าง audio/DSP timeline แต่ไม่สร้าง WebGPU backend/device ใหม่
- [x] ไม่มี listener สำหรับ `GPUDevice.lost`
- [x] `destroy()` ปัจจุบันเรียกเพียง `resetState()` และ disconnect Worklet
- [x] `destroy()` ไม่ dispose model, variables หรือ TFJS backend อย่างครบถ้วน
- [x] `unloadEngine()` dispose model/variables แต่ไม่ได้สร้าง lifecycle สำหรับ WebGPU device ที่ค้าง
- [x] warning `GPU Slow` อ้างอิง one-time benchmark และถูกเก็บใน `chrome.storage.local`
- [x] warning เก่าสามารถแสดงซ้ำหลัง reload แม้ latency สดจะกลับมาปกติแล้ว
- [x] Worklet ตั้ง song boundary เมื่อเงียบประมาณ 348 ms หรือ input หายประมาณ 371 ms
- [x] การเปลี่ยนเพลงของ YouTube สามารถทำให้เกิด boundary ดังกล่าวได้ตามปกติ
- [x] ต้องเก็บ silence/missing-input reset ไว้ เพราะมันป้องกันเสียงเพลงเก่าหลุดเข้ามาในเพลงใหม่
- [x] Extension และ Web app ใช้แกน `AIVocalManager` เดียวกันผ่าน Web adapter
- [x] TensorFlow.js backend เป็น global runtime ใน offscreen document ดังนั้นการ remove/recreate backend โดยไม่ประสาน manager หลายตัวอาจทำให้ session อื่นพัง

ข้อสรุปเบื้องต้น:

```text
YouTube เปลี่ยนเพลงหรือใช้ GPU หนัก
  -> Worklet พบ silence/missing input และ reset timeline
  -> WebGPU readback เก่าอาจค้างที่ maskTensor.data()
  -> runChunkQueue ยังถือ isBusy
  -> chunk ใหม่ไม่มีผู้ประมวลผล
  -> Worklet ไม่มี output และคงสถานะ mute/buffering
  -> Reload ธรรมดาอาจไม่คืน WebGPU resource ทั้งหมด
```

นี่เป็นสมมติฐานที่มีหลักฐานจากโค้ด แต่ยังต้องยืนยันด้วย telemetry ในกลุ่ม S0 ก่อนสรุปว่า driver/device loss เป็นสาเหตุทุกครั้ง

---

## 3. สิ่งที่ห้ามเปลี่ยนเด็ดขาด

ค่าต่อไปนี้เป็น audio baseline และไม่ใช่เป้าหมายของแผน:

- `DEFAULT_VOCAL_PROFILE`
- `VOCAL_PROFILES`
- model files ใต้ `next-amp-extension/model/`
- model input shape `[1, 1024, 64, 2]`
- mask slice/index/layout
- attenuation floor
- asymmetric smoothing
- transient gate
- overlap consensus
- graph optimization และ output-head flags
- STFT/iSTFT equations
- delay/lookahead จำนวนหนึ่ง chunk
- Worklet fade ที่ป้องกัน raw vocal leakage
- GO chunk size, GO buffer, DirectML/CoreML และ WebSocket

ห้ามทำสิ่งเหล่านี้เพื่อแก้ปัญหา:

- ห้ามปิด `SILENCE_RESET_CHUNKS` หรือ `MISSING_INPUT_RESET_BLOCKS`
- ห้ามเพิ่ม queue แบบไม่จำกัด
- ห้ามเพิ่ม output latency เพื่อซ่อน GPU deadlock
- ห้ามส่ง raw input ออกลำโพงตอน buffering
- ห้ามใช้ CPU เป็น realtime fallback เพราะ CPU path ไม่ทัน realtime บนเครื่องเป้าหมาย
- ห้ามบังคับ WebGL ตั้งแต่เริ่มโดยไม่มีหลักฐานว่า WebGPU recovery ใช้ไม่ได้
- ห้าม fallback เพราะ latency ช้าเพียง sample เดียว
- ห้ามอัปเกรด TensorFlow.js ใน patch เดียวกับ recovery เพราะจะระบุสาเหตุของผลไม่ได้
- ห้าม dispose tensor ที่ยังมี `data()` pending แบบไม่ป้องกัน exception/double-dispose
- ห้ามใช้ `unloadEngine()` ตรง ๆ ใน recovery ถ้ายังมี behavior ที่เปลี่ยน `currentMode` เป็น `bypass`

---

## 4. คำศัพท์ที่ใช้ในแผน

- **Audio timeline reset**: ล้าง chunk/output/DSP state เมื่อเปลี่ยนเพลงหรือเสียงหาย แต่ยังใช้ GPU backend เดิม
- **Engine recovery**: ยกเลิก generation ปัจจุบัน, dispose model/runtime ที่เสีย, สร้าง backend/model ใหม่ และ warm up ใหม่
- **Hard stall**: WebGPU readback ไม่ resolve/reject ภายใน hard timeout ไม่ใช่เพียง inference ช้ากว่าปกติหนึ่งรอบ
- **Device loss**: `GPUDevice.lost` resolve และแจ้งว่า WebGPU device ใช้ต่อไม่ได้
- **Generation**: เลขที่ใช้ปฏิเสธ output เก่าหลัง mode/song/engine เปลี่ยน
- **Session fallback**: เมื่อ WebGPU กู้ซ้ำแล้วไม่เสถียร ให้ใช้ WebGL F16 จนกว่าจะสร้าง offscreen runtime/session ใหม่ โดยไม่บันทึกเป็น blacklist ถาวร
- **Normal path**: การเล่นปกติที่ไม่มี timeout/device loss การแก้ stability ต้องไม่เปลี่ยน PCM หรือ model calculation ใน path นี้

---

## 5. ไฟล์ที่คาดว่าจะเกี่ยวข้อง

ไฟล์หลัก:

- `next-amp-extension/modules/ai-vocal/ai-vocal-manager.js`
- `next-amp-extension/modules/ai-vocal/vocal-worklet.js`
- `next-amp-extension/offscreen.js`
- `next-amp-extension/popup.js`

ไฟล์ใหม่ที่อนุญาตให้สร้าง:

- `next-amp-extension/modules/ai-vocal/webgpu-recovery-controller.mjs`
- `ai-vocal-engine/test/test_webgpu_recovery_controller.mjs`
- `ai-vocal-engine/test/test_ai_manager_stall_recovery.mjs`

Build scripts bundle dependency ของ `offscreen.js` และ Web adapter อยู่แล้ว ดังนั้นโมดูล `.mjs` ใหม่ที่ถูก import จาก manager ควรถูก esbuild bundle เข้า output อัตโนมัติ ห้ามคัดลอกไฟล์ใหม่ลง dist ด้วยมือ

ไฟล์ที่ไม่ควรแก้ในแผนนี้:

- `nextamp-engine-go/**`
- `ai-vocal-engine` ส่วน model/DSP ยกเว้นไฟล์ test ใหม่
- model weights และ encrypted production model
- build security/obfuscation เว้นแต่ build ล้มเพราะ import ใหม่จริง ๆ

---

## 6. ลำดับการทำงานแบบเป็นกลุ่ม

## S0 — เพิ่มหลักฐานและ automated harness โดยยังไม่เปลี่ยนเสียง

เป้าหมาย: พิสูจน์ว่าเกิด hard stall, device loss, queue lock หรือ resource leak แบบใด โดยไม่เปลี่ยน model/DSP/output

### S0.1 เพิ่ม diagnostics fields

เพิ่ม fields ต่อไปนี้ใน `this.diagnostics` ของ `AIVocalManager`:

```text
webGpuReadbackStarted
webGpuReadbackCompleted
webGpuReadbackRejected
webGpuReadbackTimeouts
webGpuDeviceLosses
webGpuRecoveryRequests
webGpuRecoveriesSucceeded
webGpuRecoveriesFailed
webGpuFallbacksToWebGL
queueRunnerStarts
queueRunnerStops
queueRunnerRestarts
lastRecoveryReason
lastRecoveryStartedAt
lastRecoveryCompletedAt
lastWebGpuDeviceLostInfo
```

เพิ่มสถานะ snapshot ต่อไปนี้ใน `getDiagnostics()`:

```text
backendType
isBusy
isReady
engineLoading
chunkQueueSize
streamGeneration
recoveryState
recoveryAttemptCount
forceWebGlForSession
activeReadbackAgeMs
tf.memory().numTensors แบบ best-effort
```

กฎ:

- Diagnostics ปกติต้องไม่สร้าง array/map ใหม่ทุก audio chunk
- Timestamp ใช้ `performance.now()` สำหรับ duration
- ห้าม log ทุก chunk
- log เฉพาะ timeout, device loss, recovery start/success/failure และ backend fallback

### S0.2 แยกคำเตือน startup ออกจากสถานะสด

ยังไม่เปลี่ยน popup ในกลุ่มนี้ แต่ต้องเพิ่มข้อมูลให้แยกได้ว่า:

- `benchmarkMs` คือ startup benchmark
- `lastInferMs` คือค่าล่าสุด
- rolling p50/p95/p99 คือ runtime จริง
- warning มาจาก `startup-benchmark`, `live-deadline`, `readback-timeout` หรือ `device-lost`

อย่าเพิ่งลบ key เก่า เพราะ popup เก่าอาจยังอ่านอยู่

### S0.3 สร้าง test harness สำหรับ Promise ค้าง

สร้าง pure helper/controller ในไฟล์ใหม่ ไม่ให้ test ต้องเปิด GPU จริง โดยต้องจำลองได้อย่างน้อย:

1. readback resolve ตามปกติ
2. readback reject
3. readback ไม่ resolve จน timeout
4. readback resolve ช้าหลัง timeout
5. timeout และ device loss เกิดใกล้กัน
6. recovery ถูกเรียกซ้ำพร้อมกันหลายครั้ง

Controller ต้อง guarantee ว่า:

- recovery จริงมีได้ครั้งเดียวในเวลาเดียวกัน
- ผู้เรียกทุกตัวได้รับ Promise ของ recovery รอบเดียวกัน
- timer ถูก clear เมื่อ readback จบตามปกติ
- late resolve/reject ไม่กลายเป็น unhandled rejection
- state กลับ `idle` หรือ `failed` อย่างแน่นอน

### S0.4 Tests ที่ต้องผ่าน

```bash
node ai-vocal-engine/test/test_webgpu_recovery_controller.mjs
node ai-vocal-engine/test/test_vocal_worklet.mjs
node ai-vocal-engine/test/test_vocal_stress.mjs
```

### Gate S0

- [x] ไม่มีการเปลี่ยน model/DSP/profile
- [x] normal readback path ยังคืนข้อมูลเดิม
- [x] hanging Promise ถูก test ได้โดย test ไม่ค้างตาม
- [x] concurrent recovery requests ถูกรวมเป็น recovery เดียว
- [x] Worklet regression tests ผ่าน
- [x] ยังไม่มี behavior fallback/reload backend ใน production

เมื่อทำครบ: build แล้วหยุด ห้าม commit จนผู้ใช้บอกว่าผ่านและสั่งทำ S1

Suggested commit หลังผู้ใช้อนุมัติ:

```text
test(ai-vocal): add webgpu stall diagnostics and recovery harness
```

---

## S1 — ทำ queue watchdog และป้องกัน isBusy ค้าง

เป้าหมาย: ต่อให้ `maskTensor.data()` ค้าง queue runner ต้องหลุดจาก lock และเข้าสู่สถานะ recovery ได้ ห้ามเริ่ม backend ใหม่ในกลุ่มนี้ถ้ายังไม่ได้ทำ S2

### S1.1 เพิ่ม hard timeout เฉพาะ WebGPU readback

เพิ่ม constant แบบ explicit:

```js
const WEBGPU_READBACK_TIMEOUT_MIN_MS = 1000;
const WEBGPU_READBACK_TIMEOUT_MAX_MS = 2000;
const WEBGPU_READBACK_TIMEOUT_P95_MULTIPLIER = 8;
const WEBGPU_READBACK_TIMEOUT_CHUNK_MULTIPLIER = 5;
```

คำนวณ timeout ดังนี้:

```text
chunkMs = chunkSamples / sampleRate * 1000
historyMs = rolling p95 ถ้ามี มิฉะนั้น lastInferMs
candidate = max(1000, historyMs * 8, chunkMs * 5)
timeoutMs = clamp(candidate, 1000, 2000)
```

เหตุผล:

- `90-110 ms` ไม่ควรถูกมองว่า stall
- spike ตอนเปลี่ยนหน้าหลายร้อย ms ยังมีโอกาสจบเอง
- readback ที่ไม่จบเกิน 1-2 วินาทีถือว่า realtime stream ใช้ต่อไม่ได้แล้ว

ใช้ timeout เฉพาะเมื่อ:

```text
this.backendType === "webgpu"
```

WebGL และ GO ต้องเดิน path เดิม

### S1.2 ครอบ `maskTensor.data()` อย่างปลอดภัย

ห้ามใช้ `Promise.race()` แล้วทิ้ง Promise เดิมโดยไม่มี handler

ลำดับที่ถูกต้อง:

1. เก็บ Promise จริงจาก `maskTensor.data()`
2. ติดทั้ง resolve และ reject handler ให้ Promise จริงทันที
3. แข่งกับ timeout
4. ถ้าจบปกติ ให้ clear timer และ dispose tensor หนึ่งครั้ง
5. ถ้า timeout อย่าใช้ result นั้นอีก
6. เก็บ late Promise ให้มี handler สำหรับ cleanup
7. ถ้า late Promise จบภายหลัง ให้ dispose tensorแบบ best-effort และห้ามส่ง output
8. ห้ามให้ late reject กลายเป็น unhandled rejection
9. ใช้ generation/engine epoch เพื่อตัด result เก่า

สร้าง error type ที่แยกจาก model errorทั่วไป เช่น:

```js
class WebGpuReadbackTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`WebGPU readback exceeded ${timeoutMs}ms`);
    this.name = "WebGpuReadbackTimeoutError";
    this.recoverable = true;
  }
}
```

### S1.3 ให้ recoverable error ออกจาก `processChunk()`

ปัจจุบัน `processChunk()` catch error ทุกชนิดและไม่ throw ต่อ ให้เปลี่ยนเฉพาะ recoverable GPU error:

```text
ถ้าเป็น WebGpuReadbackTimeoutError หรือ WebGPU device-lost error
  -> cleanup output buffer ที่ยืมมา
  -> increment diagnostics
  -> throw ต่อให้ runChunkQueue จัดการ
error อื่น
  -> ใช้ behavior เดิม
```

ห้าม recovery ซ้อนอยู่ใน tensor/DSP block โดยตรง เพราะจะทำให้ dispose กับ queue lock ปะปนกัน

### S1.4 ป้องกัน queue runner หลุดแล้วไม่มีคนเริ่มใหม่

แก้ `runChunkQueue()` ให้ `finally` ทำตามลำดับ:

```text
1. this.isBusy = false
2. increment queueRunnerStops
3. ถ้ายัง ready, mode ไม่ใช่ bypass, queue ยังมีงาน และไม่มี recovery
4. schedule queueMicrotask(() => this.runChunkQueue()) เพียงหนึ่งครั้ง
```

ต้องมี guard ไม่ให้ schedule ซ้ำ

สาเหตุ: มี race ที่ chunk ใหม่เข้า queue ช่วงท้ายของ runner ตอน `isBusy` ยังเป็น true แล้วไม่มี message ใหม่มาปลุก runner

### S1.5 Warmup หลัง reset ต้องอ้างอิง stream ไม่ใช่เลข chunk 0

ปัจจุบัน code ทิ้ง warmup output เมื่อ `chunkIndex === 0` เท่านั้น แต่หลัง song reset/recovery เลข chunk อาจไม่กลับเป็นศูนย์

เพิ่ม state เช่น:

```text
browserWarmupChunksRemaining
```

เมื่อล้าง WASM/model timeline:

```text
browserWarmupChunksRemaining = processing.delayChunks
```

หลังประมวลผล chunk สำเร็จ:

```text
ถ้า browserWarmupChunksRemaining > 0
  -> ลดค่าลงหนึ่ง
  -> recycle output
  -> ห้ามส่งเข้า Worklet
```

แทนการเช็คเฉพาะ `chunkIndex === 0`

ผลที่ต้องได้คือหลังทุก song/reset ระบบจะ prime lookahead ใหม่โดยไม่ปล่อย delayed slot เก่า/ว่าง

### S1.6 Tests ที่ต้องเพิ่ม

สร้าง `test_ai_manager_stall_recovery.mjs` หรือแยก pure queue runner helper แล้วทดสอบว่า:

- pending readback timeout แล้ว `isBusy` ไม่ค้าง
- result ที่ resolve หลัง timeout ถูก drop
- generation เก่าไม่ส่ง `CHUNK_PROCESSED`
- queue ไม่โตเกิน hard cap
- queue runner restart ได้หลัง recoverable error
- reset ที่ chunk index ไม่ใช่ 0 ยังทิ้ง warmup output หนึ่ง cadence
- normal path ส่ง output จำนวนเดิมและลำดับเดิม

### Gate S1

- [x] จำลอง Promise ค้างแล้ว test จบเอง
- [x] `isBusy` กลับ false เสมอ
- [x] ไม่มี raw input ถูกส่งเป็น output
- [x] ไม่มี late generation output
- [x] normal path ไม่เปลี่ยน PCM/mask
- [x] WebGL/GO path ไม่ผ่าน watchdog
- [x] existing tests ผ่านทั้งหมด

ใน S1 หาก timeout เกิดจริง ให้ขึ้นสถานะ `Recovering AI...` และคง mute ไว้ แต่ยังไม่ต้องพยายาม recreate backend จนทำ S2

เมื่อทำครบ: build แล้วหยุด ห้าม commit จนผู้ใช้บอกว่าผ่านและสั่งทำ S2

Suggested commit หลังผู้ใช้อนุมัติ:

```text
fix(ai-vocal): prevent webgpu readback from locking audio queue
```

---

## S2 — กู้ WebGPU device/backend/model อัตโนมัติ

เป้าหมาย: เมื่อ watchdog หรือ `GPUDevice.lost` แจ้งปัญหา ระบบต้อง mute อย่างปลอดภัย สร้าง runtime ใหม่ และกลับมา Karaoke เอง

### S2.1 เพิ่ม engine epoch และ recovery state

เพิ่ม state ใน manager:

```text
engineEpoch = 0
recoveryState = "idle" | "requested" | "recovering" | "cooldown" | "failed"
recoveryPromise = null
recoveryAttemptCount = 0
lastRecoveryAt = 0
forceWebGlForSession = false
destroyed = false
awaitingRecoveryFirstChunk = false
```

กฎ:

- increment `engineEpoch` ก่อน dispose/recreate backend
- ทุก async continuation ต้องตรวจทั้ง `streamGeneration` และ `engineEpoch`
- recovery หลาย request ต้องคืน Promise เดียวกัน
- ถ้า manager ถูก destroy หรือผู้ใช้เปลี่ยนเป็น bypass ระหว่าง recovery ห้าม reload model กลับมาเอง

### S2.2 ฟัง `GPUDevice.lost`

หลัง `tf.setBackend("webgpu")`, `tf.ready()` และได้ backend แล้ว:

1. หา device จาก TFJS backend แบบ best-effort เช่น `tf.backend()?.device`
2. ถ้ามี `device.lost` ให้ติด handler หนึ่งครั้งต่อ engine epoch
3. เมื่อ lost Promise resolve ให้เก็บ `reason/message` ใน diagnostics
4. ตรวจว่า epoch ยังเป็นรอบเดียวกันและ manager ยังไม่ destroyed
5. เรียก shared recovery controller ด้วย reason `device-lost`

ห้าม assume ว่า property `device` มีทุก TFJS version ถ้าไม่มีให้พึ่ง watchdog ต่อ ห้ามทำให้ loadEngine ล้มเพราะตรวจ device ไม่ได้

### S2.3 แยก resource disposal ออกจาก user-facing unload

สร้าง internal method เช่น:

```text
disposeBrowserEngineResources({
  preserveMode,
  removeBackend,
  reason
})
```

Method นี้ต้อง:

- set `isReady = false`
- cancel engine load ด้วย epoch
- clear pending chunk queue และคืน transferred input buffers
- reset DSP state
- dispose `this.model` แบบ idempotent
- set `this.model = null`
- clear `modelOutputHead`
- dispose variables แบบ best-effort
- ไม่เปลี่ยน `currentMode` ถ้า `preserveMode === true`
- ไม่ส่ง bypass ไป Worklet เมื่อเป็น recovery
- เรียกซ้ำได้โดยไม่ throw

จากนั้น:

- `unloadEngine()` ใช้ helper นี้แล้วค่อยตั้ง bypassตาม behavior เดิม
- `destroy()` ใช้ helper นี้, mark `destroyed = true`, unregister manager และ disconnect Worklet
- ห้ามให้ `destroy()` เหลือ model/backend resource แบบเดิม

### S2.4 ประสาน TFJS global backend

TensorFlow.js backend เป็น global ต่อ offscreen document ห้ามให้ manager แต่ละตัวเรียก `tf.removeBackend("webgpu")` พร้อมกัน

ใน `webgpu-recovery-controller.mjs` ให้มี process-wide coordinator:

```text
registeredManagers: Set
sharedRecoveryPromise: Promise | null
sharedBackendEpoch: number
```

Recovery ลำดับบังคับ:

1. snapshot manager ที่ยัง active, ใช้ browser engine และ backend WebGPU
2. ให้ manager ทั้งหมด mark recovering, increment generation และ mute/flush Worklet
3. dispose model ของ manager เหล่านั้นก่อนแตะ backend
4. ถ้า active backend คือ WebGPU ให้ `tf.removeBackend("webgpu")` แบบ best-effortหนึ่งครั้ง
5. อย่าลบ backend factory/script registration
6. เลือก WebGPU หรือ WebGL ตาม fallback policy
7. โหลด model และ warmup ของ manager ที่ยัง active ทีละตัว
8. manager ที่เปลี่ยน GO/bypass/destroy ระหว่างรอไม่ต้องโหลดกลับ
9. clear sharedRecoveryPromise ใน `finally`

ถ้า product ยืนยันว่ามี browser AI session ได้เพียงหนึ่ง session ก็ยังต้องเก็บ shared lock ไว้ เพราะ timeout กับ device-lost สามารถเรียก recovery พร้อมกันได้

### S2.5 Mute และ resync อย่างปลอดภัย

เมื่อ recovery เริ่ม:

1. increment `streamGeneration`
2. clear manager queue
3. `resetState()`
4. ส่ง `RESYNC` ไป Worklet พร้อม generation ใหม่
5. Worklet ล้าง output เก่าและคง `aiGain = 0`
6. ระหว่าง `isReady === false` ให้คืน input buffers แต่ไม่ inference
7. หลัง model warmup สำเร็จ ให้ตั้ง `awaitingRecoveryFirstChunk = true`
8. เมื่อ input chunk แรกหลัง recovery เข้ามา ให้กำหนด stream floor จาก chunk นั้นและส่ง RESYNC ที่มี `nextChunkIndex` จริง
9. prime lookahead ตาม `browserWarmupChunksRemaining`
10. ปล่อยเสียง AI หลัง Worklet มี queue ถึง ready threshold เดิมเท่านั้น

ห้ามเดา `nextChunkIndex` ตอนเริ่ม recovery เพราะ Worklet ยังเดินเวลาและอาจส่งหลาย chunk ระหว่างโหลด model

### S2.6 Fallback policy ที่ห้าม oscillate

Policy เริ่มต้น:

- hard timeout/device loss ครั้งแรก: recreate WebGPU หนึ่งครั้ง
- ถ้าเกิด hard timeout/device loss ครั้งที่สองภายใน 120 วินาที: ตั้ง `forceWebGlForSession = true`
- หลัง fallback ให้ใช้ WebGL พร้อม `CANDIDATE_WEBGL_F16` ปัจจุบัน
- ห้ามสลับกลับ WebGPU เองใน session เดียวกัน
- ห้ามบันทึก permanent GPU blacklist ลง `chrome.storage.local`
- เมื่อสร้าง offscreen runtime ใหม่จึงเริ่มลอง WebGPU ใหม่ได้
- ถ้า WebGL ใช้ CPU/SwiftShader ให้ fail แบบ mute และแจ้ง error ห้ามเริ่ม CPU realtime loop

Fallback ต้องเกิดจาก hard timeout/device loss เท่านั้น ไม่ใช่ `lastInferMs` สูงหนึ่งครั้ง

### S2.7 Recovery failure

ถ้าทั้ง WebGPU recreate และ WebGL fallback ล้มเหลว:

- set `recoveryState = "failed"`
- `isReady = false`
- clear queue
- Worklet คง mute
- status ชัดเจน เช่น `AI GPU unavailable`
- ห้าม loop โหลด model ไม่สิ้นสุด
- retry ได้เมื่อผู้ใช้ปิด/เปิด AI ใหม่เท่านั้น

### S2.8 Tests บังคับ

ทดสอบอย่างน้อย:

- device lost แล้ว recovery สำเร็จหนึ่งครั้ง
- readback timeout แล้ว recovery สำเร็จ
- timeout + device lost พร้อมกันแต่ backend recreate ครั้งเดียว
- late readback จาก epoch เก่าไม่ส่งเสียง
- recovery ครั้งที่สองภายใน 120 วินาที fallback WebGL
- ไม่มี oscillation กลับ WebGPU
- เปลี่ยนเป็น bypass ระหว่าง recovery แล้ว model ไม่โหลดกลับ
- เปลี่ยนเป็น GO ระหว่าง recovery แล้ว Web recovery ไม่แตะ GO
- destroy ระหว่าง recovery แล้วไม่มี Worklet/model ถูกสร้างใหม่
- manager สองตัวเจอ shared device loss แล้ว backend remove/recreate ครั้งเดียว
- dispose/unload/destroy เรียกซ้ำไม่ throw
- normal path ไม่เข้า recovery

### Gate S2

- [x] simulated timeout ฟื้นกลับมาประมวลผล chunk ใหม่ได้
- [x] simulated device loss ฟื้นได้
- [x] recovery ไม่ปล่อย output เก่า/raw input
- [x] ไม่มี infinite retry
- [x] fallback เกิดตาม policy เท่านั้น
- [x] GO tests ผ่านโดยไม่มี source change ฝั่ง GO
- [x] Extension และ Web production build ผ่าน

เมื่อทำครบ: build แล้วหยุด ห้าม commit จนผู้ใช้ทดสอบและสั่งทำ S3

Suggested commit หลังผู้ใช้อนุมัติ:

```text
fix(ai-vocal): recover lost or stalled webgpu sessions
```

---

## S3 — แก้ GPU Slow ให้สะท้อนสถานะจริง

เป้าหมาย: ไม่ให้ warning เก่าจาก startup benchmark ทำให้ผู้ใช้คิดว่า GPU กำลังช้าตลอด และให้ warning บอกสาเหตุจริง

### S3.1 แยก warning types

เปลี่ยน payload โดยคง backward-compatible fields:

```js
{
  benchmarkMs,
  liveP95Ms,
  chunkDeadlineMs,
  deviceLabel,
  backend,
  reason,
  timestamp,
  active
}
```

ค่า `reason` ที่อนุญาต:

```text
startup-benchmark
live-deadline
readback-timeout
device-lost
recovering
fallback-webgl
recovered
```

### S3.2 อย่าใช้ cached benchmark เป็นสถานะสดถาวร

- key เก่าที่ไม่มี timestamp หรือเก่าเกินเวลาที่กำหนดห้ามเปิด modal สด
- startup benchmark ใช้เป็นคำเตือนเริ่มต้นเท่านั้น
- หลังมี live samples อย่างน้อย 8 ค่า ให้ใช้ rolling p95
- แจ้ง live slow เมื่อ p95 เกินประมาณ 95% ของ chunk deadline ต่อเนื่องหลาย window ไม่ใช่ sample เดียว
- clear warning เมื่อ recovery สำเร็จและ live p95 กลับมามี margin ต่อเนื่อง
- timeout/device loss ต้องแสดง `Recovering` แทนตัวเลข benchmark เก่า

อย่าให้ telemetry calculation เพิ่มงานใน AudioWorklet ใช้ ring buffer ฝั่ง manager ที่มีอยู่แล้ว

### S3.3 Popup behavior

- Popup ต้องอ่าน `active` และ `reason`
- ข้อความต้องแยก `GPU Slow`, `GPU Recovering`, `Fallback WebGL`, `GPU unavailable`
- เมื่อ `reason === recovered` หรือ `active === false` ต้องล้าง warning เก่า
- การเปิด popup ใหม่ห้ามแสดง modal จาก warning ที่หมดอายุ

### S3.4 Tests

- cached warning เก่าหมดอายุ
- startup benchmark spike ไม่ทับสถานะ live ที่ปกติ
- timeout แสดง Recovering
- recovery success ล้าง warning
- live p95 สูงต่อเนื่องจึงแสดง Slow
- sample สูงเพียงครั้งเดียวไม่แสดง warning ถาวร

### Gate S3

- [x] warning สะท้อน backend และเหตุการณ์จริง
- [x] reload popup ไม่ทำให้ warning เก่ากลับมา
- [x] ไม่มี telemetry allocation ใน Worklet hot path
- [x] audio output และ model path ไม่เปลี่ยน

เมื่อทำครบ: build แล้วหยุด ห้าม commit จนผู้ใช้ทดสอบและสั่งทำ S4

Suggested commit หลังผู้ใช้อนุมัติ:

```text
fix(ai-vocal): report live gpu health instead of stale benchmark
```

---

## S4 — Long-run validation และ release gate

S4 เป็นการทดสอบและปรับ threshold เท่านั้น ห้ามเปลี่ยนเสียงหรือ model

### S4.1 Automated regression suite

รันอย่างน้อย:

```bash
node ai-vocal-engine/test/test_webgpu_recovery_controller.mjs
node ai-vocal-engine/test/test_ai_manager_stall_recovery.mjs
node ai-vocal-engine/test/test_vocal_worklet.mjs
node ai-vocal-engine/test/test_vocal_stress.mjs
node ai-vocal-engine/test/test_wasm_simd_equivalence.mjs
node ai-vocal-engine/test/test_model_optimizer.mjs
node ai-vocal-engine/test/stream-model-equivalence.mjs
npm run build
```

ถ้าชื่อ test จริงเปลี่ยน ให้แก้ command ในเอกสารให้ตรงก่อนรัน ห้ามอ้างว่าผ่านโดยไม่ได้รัน

### S4.2 ตรวจ production artifacts

หลัง `npm run build` ต้องมีอย่างน้อย:

- `dist/next-amp-extension-prod/`
- Extension zip จาก build script
- `dist/next-amp-web-prod/`
- Go artifacts ที่ `npm run build` สร้างตาม workflow ปัจจุบัน ถ้ามี

ห้ามแก้ไฟล์ใน dist ด้วยมือ ให้แก้ source แล้ว build ใหม่เท่านั้น

### S4.3 Windows GTX 1050 Ti manual test

ใช้ build เดียวกันทดสอบตามลำดับ:

1. เปิด Chrome ใหม่และยืนยัน UI ว่าเป็น GTX 1050 Ti + WebGPU
2. เปิด Karaoke เพลงเดิมที่ใช้ฟังเทียบประจำ
3. เล่นเพลงแรกจนจบ
4. ให้ YouTube เปลี่ยนไปเพลงที่สอง
5. ทำซ้ำอย่างน้อย 10 เพลงหรือ 30 นาที
6. ระหว่างเล่น ให้ hide popup, scroll หน้า YouTube และสลับ tab
7. เปิดหน้าเว็บที่ใช้ GPU/CPU หนักช่วงสั้น ๆ
8. กลับมาฟังว่า AI ฟื้นเองหรือไม่
9. บันทึก diagnostics ก่อนเปลี่ยนเพลง, ตอนเกิด spike และหลังฟื้น
10. ปิด AI แล้วเปิดใหม่ทันที ต้องกลับมาได้โดยไม่ต้องรอ 5 นาที

### S4.4 Manual device-loss simulation

ถ้า Chrome/DevTools ไม่มีวิธีจำลอง device loss ที่ปลอดภัย ให้ใช้ test mock เท่านั้น ห้ามทำให้ driver crash จริงบนเครื่องผู้ใช้

### S4.5 Web app regression

เพราะ Web app bundle manager ตัวเดียวกัน ต้องทดสอบ:

- เปิด AI แบบ lazy load
- Karaoke ทำงานหลัง model load
- ปิด/เปิด AI ซ้ำ
- เปลี่ยนไฟล์เพลง
- no ServiceWorker/AudioWorklet regression
- normal playback ไม่ load AI ก่อนผู้ใช้กดเปิด

### Release gate

- [ ] เล่น 30 นาทีและเปลี่ยนอย่างน้อย 10 เพลงโดยไม่มี deadlock ถาวร
- [ ] หากบังคับ simulated stall ระบบกลับมารับ output ใหม่ได้เอง
- [ ] recovery ใช้เวลาไม่เกินหนึ่ง model reload/warmup รอบ
- [ ] ไม่ต้องปิด Extension แล้วรอ 5 นาที
- [ ] YouTube อาจสะดุดได้ชั่วคราวเมื่อ GPU ถูกแย่ง แต่ต้องไม่ค้างถาวรเพราะ AI
- [ ] ไม่มีเสียงเพลงเก่า, raw vocal หรือ stale generation หลุดระหว่าง recovery
- [ ] คุณภาพเพลงใน normal path ฟังเหมือน baseline ปัจจุบัน
- [ ] model hashes และ profile constants ไม่เปลี่ยน
- [ ] p50/p95 normal-path latency ไม่ถอยเกิน noise ของการวัด; watchdog overhead ต้องไม่ทำให้เห็น regression ชัดเจน
- [ ] `tf.memory().numTensors` ไม่โตต่อเนื่องหลังเปลี่ยนเพลง/recovery หลายรอบ
- [ ] ปิด AI แล้ว model/tensor/session resources ถูกคืน
- [ ] GO engine ทำงานเหมือนเดิม

Suggested commit หลังผู้ใช้ยืนยัน release gate:

```text
test(ai-vocal): validate long-running webgpu recovery
```

---

## 7. วิธีตัดสินใจเมื่อผลจริงไม่ตรงแผน

### กรณี A: timeout ไม่เคยเกิด แต่เสียงยังหยุด

ตรวจตามลำดับ:

1. `isBusy` ค้างหรือไม่
2. `chunkQueueSize` โตหรือเป็นศูนย์
3. Worklet ยังส่ง `PROCESS_CHUNK` หรือไม่
4. `AudioContext.state` เป็น `running`, `suspended` หรือ `interrupted`
5. stream track ยัง active หรือไม่
6. generation ของ manager และ Worklet ตรงกันหรือไม่
7. output ถูก drop เพราะ stale/floor/index guard หรือไม่

ห้ามเพิ่ม timeout/recovery แบบสุ่ม หาก readback ไม่ใช่จุดค้าง

### กรณี B: WebGPU recovery สำเร็จแต่ค้างซ้ำทันที

- ยืนยันว่ามีการ remove backend instance จริงเพียงครั้งเดียว
- ยืนยันว่า model เดิมถูก dispose ก่อน remove backend
- ยืนยันว่า `forceWebGlForSession` ทำงานเมื่อครบสองครั้ง
- อย่าพยายาม WebGPU ซ้ำไม่จำกัด

### กรณี C: WebGL fallback ลื่นแต่คุณภาพต่าง

- ตรวจว่า fallback ใช้ graph/profile/weights เดิม
- ตรวจ F16 flag และ backend จริง
- ห้ามชดเชยด้วยการเปลี่ยน mask/DSP
- ให้ build WebGL FP32 แยกเพื่อ A/B ก่อนสรุปว่าเป็น precision

### กรณี D: latency เพิ่มหลังใส่ watchdog

- วัด normal path ก่อน
- ตรวจว่ามี timer/log/allocation เกินหนึ่งชุดต่อ inference หรือไม่
- ห้ามย้าย watchdog เข้า AudioWorklet
- ห้ามลด model quality เพื่อชดเชย overhead
- ถ้า Promise timeout wrapper เป็นสาเหตุจริง ให้เปลี่ยนเป็น watchdog timer กลางหนึ่งตัวที่ตรวจ `activeReadbackStartedAt` แทน แต่ต้องคง test behavior เดิม

### กรณี E: YouTube กระตุกแต่ AI ไม่ deadlock แล้ว

นี่อาจเป็น GPU contention จริงระหว่าง video rendering กับ AI:

- เก็บหลักฐาน p95/p99, dropped frames และ backend
- อย่าเพิ่ม queue ไม่จำกัด
- ถ้า WebGPU ฟื้นได้แต่ contention เกิดต่อเนื่อง ให้ทดลอง WebGL F16 เป็น device-session policy แยก
- ต้อง blind-listen และวัดก่อนเลือก WebGL เป็นค่าเริ่มต้นเฉพาะ GPU รุ่นนั้น

---

## 8. Definition of Done

แผนนี้ถือว่าเสร็จเมื่อครบทุกข้อ:

- [ ] มีหลักฐานว่า hard stall/device loss ถูกตรวจพบ
- [ ] queue ไม่สามารถติด `isBusy = true` ถาวรจาก pending readback
- [ ] late result ถูกตัดด้วย generation + engine epoch
- [ ] WebGPU device loss มี listener แบบ best-effort
- [ ] backend/model recovery ถูก serialize
- [ ] manager หลายตัวไม่ remove global TF backend แข่งกัน
- [ ] recovery สำเร็จแล้ว Worklet re-prime จาก input ใหม่
- [ ] recovery ซ้ำ fallback WebGL F16 โดยไม่ oscillate
- [ ] unload/destroy คืน model และ GPU resources แบบ idempotent
- [ ] warning ไม่ใช้ cached startup spike เป็นความจริงถาวร
- [ ] normal audio path ไม่เปลี่ยน model/DSP/PCM โดยตั้งใจ
- [ ] Extension และ Web app build ผ่าน
- [ ] GO path ไม่ถูกเปลี่ยน
- [ ] Windows GTX 1050 Ti ผ่าน 30-minute/10-song test
- [ ] ผู้ใช้ยืนยันว่าเสียงยังดีเหมือน baseline

---

## 9. แหล่งอ้างอิงสำหรับผู้ลงมือ

- WebGPU device loss และการสร้าง resources ใหม่: <https://gpuweb.github.io/gpuweb/>
- `GPUDevice.lost`: <https://gpuweb.github.io/types/interfaces/GPUDevice.html>
- Chrome WebGPU troubleshooting และพฤติกรรม GPU adapter บน Windows: <https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips>
- TensorFlow.js WebGPU backend: <https://github.com/tensorflow/tfjs/blob/master/tfjs-backend-webgpu/README.md>
- ตัวอย่างต้นทุน GPU-to-CPU tensor readback ใน TensorFlow.js: <https://github.com/tensorflow/tfjs/issues/6683>

อย่าคัดลอก code จาก issue โดยตรง ให้อ่านเพื่อเข้าใจว่า GPU readback เป็น synchronization point แล้วเขียน implementation ให้เข้ากับ lifecycle ของ NextAmp เท่านั้น
