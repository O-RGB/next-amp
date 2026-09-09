# AI Vocal Quality & Latency Optimization Plan

สถานะ: **เสียงดีขึ้นมากหลัง Reference Timeline Plan — ลด latency โดยไม่เสียคุณภาพ**

วัดได้ก่อนแผนนี้:
- KARAOKE (CUT) (apple / metal-3) **55ms – 65ms** ← ตอนนี้ (เสียงดี แต่ช้าขึ้น + GPU ร้อน)
- เป้าหมายก่อนหน้า: 45ms – 55ms

**เป้าหมายแผนนี้:** ลด latency กลับมาใกล้ 45–55ms โดยเสียงยังดีเท่าเดิม
และถ้าทำได้ด้วย ให้เสียงเนียนขึ้นและชัดขึ้นกว่าเดิมอีก

## กฎที่ห้ามละเมิด (สืบทอดจากแผนก่อน)

- [ ] คุณภาพเสียง transient, ambience และ stereo image ต้องไม่ต่ำกว่า baseline ปัจจุบัน
- [ ] ทุก candidate ต้องมี feature flag และ rollback ได้ทันที
- [ ] ห้าม force เปลี่ยนเป็นค่าเริ่มต้นก่อนผ่านการฟังจริงบน Apple + Windows
- [ ] ห้ามแตะ GO path, WebSocket protocol, native DSP
- [ ] ห้ามลด safety queue จนต่ำกว่า 1 chunk ก่อนผ่าน interruption test

---

## Phase A — ทำทันที ไม่เสี่ยง (ไม่ต้องฟังก่อนก็ deploy ได้)

เปลี่ยนค่า config / flags ล้วน ๆ ไม่กระทบ DSP หรือ model weights

### A1. เพิ่ม TF.js WebGL Flags ที่ยังขาดอยู่

**ไฟล์:** `next-amp-extension/modules/ai-vocal/ai-vocal-manager.js` บรรทัด ~947 ใน `configureWebGL()`

- [x] เพิ่ม `tf.env().set("WEBGL_PACK_NORMALIZATION", true)`
- [x] เพิ่ม `tf.env().set("WEBGL_PACK_DEPTHWISE_CONV", true)`

**ทำไมดี:**
`WEBGL_PACK_NORMALIZATION` บังคับให้ TF.js รัน batch normalization layers
ใน packed RGBA texture format แทนที่จะ unpack ออกมาทีละ float ก่อน
`WEBGL_PACK_DEPTHWISE_CONV` ทำเช่นเดียวกันกับ depthwise convolution ซึ่งเป็น
operation ที่ U-Net ใช้บ่อย ทั้งสองรวมกันลด texture read/write roundtrips ต่อ inference

**ผลที่คาด:** ลด latency 5–15% บน WebGL path (Metal และ Windows DirectX)
**ความเสี่ยง:** ต่ำมาก — flags เหล่านี้ทำงานเป็น "optimization hint" ถ้า driver ไม่รองรับ TF.js จะ fallback อัตโนมัติ

---

### A2. เพิ่ม TF.js WebGPU Deferred Submit Flag

**ไฟล์:** `next-amp-extension/modules/ai-vocal/ai-vocal-manager.js` บรรทัด ~981 ใน WebGPU setup block

- [x] เพิ่ม `tf.env().set("WEBGPU_DEFERRED_SUBMIT_BATCH_SIZE", 0)`

**ทำไมดี:**
WebGPU ตามปกติจะ batch GPU commands แล้วส่งเป็นกลุ่มทีหลัง
ทำให้ตัวจัดการเสียงต้องรอนาน สำหรับ real-time audio ที่มี deadline แน่นอน
การตั้ง batch size เป็น 0 บอกให้ submit ทันทีทุก command
ลด jitter และทำให้ inference time คาดเดาได้มากขึ้น

**ผลที่คาด:** ลด tail latency (P95/P99) บน WebGPU path
**ความเสี่ยง:** ต่ำ — ใช้กับ WebGPU path เท่านั้น ถ้าไม่มี WebGPU flag นี้ไม่มีผล

---

### A3. ลด UI Status Update Rate เมื่อ Popup ปิด

**ไฟล์:** `next-amp-extension/modules/ai-vocal/ai-vocal-manager.js`

ปัจจุบัน: `GO_STATUS_UPDATE_INTERVAL_MS = 500` ครอบ GO path แต่ต้องตรวจสอบ Web path

- [x] ยืนยันว่า Web path (WebGL/WebGPU) ไม่เรียก `setStatus(...)` ทุก chunk
- [x] จำกัด callback ของ setStatus สูงสุดทุก 500ms บน Web path ด้วย
- [x] เมื่อ Web player ถูก hide: หยุด DOM update ที่ไม่จำเป็น และ refresh เมื่อกลับมา visible

**ทำไมดี:**
การอัปเดต DOM และ UI label ในทุก chunk (ทุก ~174ms บน 16-frame cadence)
สร้าง microtask บน main thread และแย่ง GPU command queue กับ inference
บน Apple ที่ GPU และ CPU ใช้ memory bus เดียวกัน (UMA) การลด DOM write
ตรง ๆ ลด latency spike ได้จริง

**ผลที่คาด:** ลด CPU interference เล็กน้อย ลด heat ระยะยาว
**ความเสี่ยง:** ต่ำ — เป็นแค่ throttle ของ UI update

---

## Phase B — Quality Candidates (ต้องฟังจริงและ gate ก่อน deploy)

### B1. Attenuation Floor Clamping (ε-floor) ใน WASM

**ไฟล์:** `ai-vocal-engine/src/dsp/stft_core.c` ฟังก์ชัน `apply_mask_to_spectrum()` บรรทัด ~484–510

- [x] เพิ่ม feature flag `ENABLE_ATTENUATION_FLOOR` ใน stft_core.h
- [x] ใน karaoke path: clamp `gain = max(gain, ATTENUATION_FLOOR)` โดย `ATTENUATION_FLOOR ≈ 0.035` (≈ −29 dB)
- [x] expose flag จาก JS ผ่าน `stft_set_attenuation_floor(float epsilon)`
- [x] เปิดเป็น listening candidate ผ่าน `ENABLE_ATTENUATION_FLOOR_CANDIDATE` โดย rollback ได้ทันที
- [ ] ฟังจริงบน Apple + Windows ก่อน commit เป็น default

**ทำไมดี:**
ตอนนี้ karaoke gain สามารถลงไปที่ 0.0 ได้ในทุก bin ที่โมเดลมั่นใจว่าเป็นเสียงร้อง
ทำให้เสียงฟังดู "กลวง" หรือ "dry" ผิดธรรมชาติ เพราะ room ambience
และ harmonic overtone ของเครื่องดนตรีที่ overlap กับ vocal frequency ถูกลบออกด้วย
การตั้ง floor ที่ −29 dB รักษา acoustic background ไว้เล็กน้อยโดยที่เสียงร้องหลักยังหายไป

**ผลที่คาด:** เสียงเนียนขึ้น ลด robotic/hollow artifact โดยเฉพาะใน sustained note และ vocal decay
**ความเสี่ยง:** ต่ำ — ถ้า floor สูงเกินไป (เช่น 0.1) จะเหลือเสียงร้องให้ได้ยิน ต้องหาค่าจากการฟังจริง
**ห้าม:** ใช้กับ Acapella path (mode == 1) เพราะจะทำให้เสียงร้องที่ต้องการเก็บไว้ถูกลดทอน

---

### B2. Asymmetric IIR Mask Smoothing ใน WASM

**ไฟล์:** `ai-vocal-engine/src/dsp/stft_core.c`

- [x] เพิ่ม static buffer `g_mask_smooth[2][NUM_BINS]` (stereo, per-bin state)
- [x] เพิ่ม feature flag `ENABLE_ASYMMETRIC_SMOOTHING` ใน stft_core.h
- [x] ใน `apply_mask_to_spectrum()`: ก่อน apply ให้ผ่าน IIR ก่อน
  ```
  ถ้า mask[k] < g_mask_smooth[ch][k]:  // vocal เข้า → ตัดเร็ว
      g_mask_smooth[ch][k] = α_fast * g_mask_smooth + (1 - α_fast) * mask[k]
      α_fast ≈ 0.1
  ถ้า mask[k] > g_mask_smooth[ch][k]:  // vocal ออก → ปล่อยช้า
      g_mask_smooth[ch][k] = α_slow * g_mask_smooth + (1 - α_slow) * mask[k]
      α_slow ≈ 0.5
  ```
- [x] reset `g_mask_smooth` ทุก song/mode/generation boundary
- [x] expose `stft_set_smoothing_alphas(float fast, float slow)` จาก JS
- [ ] ฟังจริงโดยเน้น: drum transient, guitar pluck, piano attack ต้องไม่หาย

**ทำไมดี:**
โมเดลทำนาย mask แบบ frame-by-frame โดยอิสระ ทำให้ mask กระโดดขึ้น-ลงระหว่าง
frame ซึ่งเมื่อแปลงกลับเป็น PCM จะได้ "musical noise" หรือ chirping artifact
IIR ที่ attack เร็วทำให้ตัดเสียงร้องได้ทันที แต่ release ช้าป้องกันการปั๊มและ artifact
ใน harmonic decay ของ piano หรือ guitar ที่ค้างอยู่หลังจาก vocal หยุดร้อง

**ผลที่คาด:** ลด chirping, ลด pumping, เสียงโดยรวม "นิ่ง" กว่าเดิม
**ความเสี่ยง:** ปานกลาง — α_slow สูงเกินไปจะ smear transient และทำให้ดนตรีดูวูบ
ต้องทดสอบบน drum transient และ piano attack ก่อน commit

---

### B3. Spectral Flux Transient Bypass Gate

**ไฟล์:** `ai-vocal-engine/src/dsp/stft_core.c`

- [x] เพิ่ม feature flag `ENABLE_TRANSIENT_GATE` ใน stft_core.h
- [x] คำนวณ spectral flux ต่อ frame ใน WASM (SIMD-friendly):
  ```
  SF(f) = Σ_k max(0, mag[f][k] - mag[f-1][k])
  ```
- [x] เก็บ `g_prev_mag[2][NUM_BINS]` เป็น static buffer สำหรับ previous frame
- [x] ถ้า SF(f) > TRANSIENT_THRESHOLD: ข้าม smoothing สำหรับ frame นั้น (α = 0)
- [x] เพิ่ม runtime threshold setter และเปิดเป็น listening candidate
- [ ] ทำงานร่วมกับ B2 เท่านั้น — ไม่มีความหมายถ้า B2 ปิดอยู่

**ทำไมดี:**
IIR smoothing จาก B2 ที่ดีต่อ harmonic มักทำให้ drum transient ดู "soft" กว่าจริง
เพราะ IIR มี state ค้างจาก frame ก่อนหน้า Spectral Flux Gate ตรวจ "peak of energy"
ที่เกิดขึ้นทันทีในช่วง drum hit แล้ว bypass smoothing ชั่วคราว 1 frame
ทำให้ snare และ cymbal ยังได้ยิน sharp เหมือนเดิม

**ผลที่คาด:** รักษา transient punch ขณะที่ B2 ดูแลส่วน harmonic/sustained
**ความเสี่ยง:** ต่ำ ถ้า threshold ตั้งสูงพอ — ถ้า threshold ต่ำเกินจะ bypass บ่อยเกินจน B2 ไม่มีผล

---

### B4. WebGL F16 Texture Candidate

**ไฟล์:** `next-amp-extension/modules/ai-vocal/ai-vocal-manager.js`

- [x] เพิ่ม internal flag `CANDIDATE_WEBGL_F16` ไว้ข้าง candidate flags
- [x] เมื่อ flag เปิด: `tf.env().set("WEBGL_FORCE_F16_TEXTURES", true)` ใน configureWebGL()
- [x] เปิด B4 เป็น candidate แยกเดี่ยว โดยปิด B1/B2/B3 ระหว่างการฟัง
- [ ] บันทึก baseline inference time บน Apple Metal (FP32) ก่อน เก็บเป็น reference
- [ ] เปิด flag แล้วบันทึกอีกครั้ง เปรียบเทียบ inference time และฟัง blind A/B
- [ ] reject ถ้า SDR หรือ vocal suppression ลดลงได้ยินจากการฟัง

**ทำไมดี:**
F16 ลด memory bandwidth ครึ่งหนึ่ง บน Apple Silicon ซึ่งใช้ Unified Memory Architecture
ทั้ง CPU/GPU/ANE ใช้ memory bus เดียวกัน การลด bandwidth ตรง ๆ ลดความร้อน
และเพิ่ม throughput ได้พร้อมกัน Research พบ ΔSDR ≤ 0.01 dB สำหรับ audio mask
หมายความว่าคุณภาพแทบไม่ต่างจาก FP32 ในทางปฏิบัติ

**ผลที่คาด:** GPU เย็นขึ้น, inference เร็วขึ้น 10–25% บน WebGL Metal path
**ความเสี่ยง:** ปานกลาง — บน Windows GPU บางรุ่นที่ driver F16 ไม่เสถียรอาจเกิด artifact
ต้องทดสอบแยกบน Apple และ GTX 1050 Ti

---

## Phase C — ลด Latency เชิงโครงสร้าง (แรงงานสูง)

### C1. Adaptive Safety Queue

**ไฟล์:** `next-amp-extension/modules/ai-vocal/ai-vocal-manager.js`, `next-amp-extension/modules/ai-vocal/vocal-worklet.js`

ปัจจุบัน: `MAX_BROWSER_PENDING_CHUNKS = 2` (fixed)

- [x] ตรวจสอบว่า `MAX_BROWSER_PENDING_CHUNKS` เดิมเป็น hard limit; เปลี่ยนเป็น hard ceiling 4 และให้ target ปรับได้ต่ำกว่านั้น
- [x] เพิ่ม P95 inference time tracker โดยใช้ `this.lastInferMs` ที่มีอยู่แล้ว
  ```
  เก็บ rolling window ของ inference time 16 ค่าล่าสุด
  target_depth = ceil(P95_inference / chunk_duration) + 1
  ```
- [x] ตั้ง minimum safety depth = 1 chunk เสมอ
- [x] Scale UP ทันทีเมื่อเกิด underrun หรือ deadline miss; ส่ง target ไปยัง Worklet output queue ด้วย
- [x] Scale DOWN ช้า ๆ เท่านั้น: ลดทีละระดับหลังจาก 30 วินาทีที่ stable และ inference ต่ำกว่า target
- [ ] ผ่าน interruption test: hide popup, scroll, เปลี่ยน tab ก่อน enable เป็น default

**สิ่งที่ทำใน C1 candidate:** ปิด B4 F16 เพื่อแยกผล, คง GO queue controller เดิม,
เพิ่ม browser-only adaptive pending queue และส่ง underrun counter จาก Worklet
โดยไม่เปิด diagnostics หนักใน hot path; candidate เริ่มที่ค่าเดิม 2 chunk และมี hard cap 4.

**ทำไมดี:**
Queue แบบ fixed ตั้งค่าสำหรับ worst-case GPU (GTX 1050 Ti ช้าสุด) ซึ่งอาจ over-buffer
บน Apple Silicon ที่ inference เร็วกว่า Adaptive queue ลด buffer depth เมื่อ GPU เร็ว
ทำให้ latency ที่ผู้ใช้รับรู้ลดลงโดยไม่เพิ่มความเสี่ยง underrun

**ผลที่คาด:** ลด end-to-end latency 10–30% บน Apple Silicon, ไม่เปลี่ยนบน slow GPU
**ความเสี่ยง:** ปานกลาง — การ scale down เร็วเกินอาจทำให้ click เมื่อ GPU spike
ต้องผ่าน interruption test และ 10-minute soak test ก่อน

---

### C2. Decoder ROI Analysis (วิจัยก่อน ยังไม่ implement)

**ไฟล์:** model graph analysis ด้วย external tools

- [x] วิเคราะห์ model graph โดยใช้ `tf.GraphModel` และ trace backward จาก output frames กลาง
- [x] ตรวจสอบ decoder dependencies และหา layer ที่ไม่ส่งผลต่อ output frame ที่ใช้จริง — ไม่พบ safe zero-gradient/prunable path
- [ ] ทดสอบ "pruned forward pass" บน test inputs เทียบ max error กับ full forward pass
- [ ] เฉพาะถ้า max error < 1e-6 จึงพิจารณา implement จริง
- [x] ไม่ implement จนกว่า Phase A + B จะ stable แล้ว; ผล C2 ระบุว่าไม่มี candidate ที่ปลอดภัยให้ implement

**ผล C2 analysis:** Detail (32 output frames) และ Smooth (15 output frames)
ยัง trace กลับไปถึง input ครบ `[1, 1024, 64, 2]` ทั้งคู่ มี resize/align-corners
geometry barrier 20 จุด และไม่สามารถ reuse decoder activation ข้าม window ได้
ค่า theoretical MAC reduction 7.77% (Detail) และ 11.05% (Smooth) เป็นเพียง
ตัวเลขจากการ crop แบบอุดมคติ ไม่ใช่การลดที่ปลอดภัยสำหรับ graph นี้ จึงไม่สร้าง
pruned model และคง full-context model เดิมเพื่อรักษาคุณภาพเสียง.

**ทำไมดี:**
Model รับ input 64 frames แต่ output ที่ต้องการจริงมีเพียง 15–16 frames ตรงกลาง
Decoder layers ที่ compute output สำหรับ frames ที่ไม่ได้ใช้ (boundary frames) ทำงานเปล่า
การ prune ออกไม่เปลี่ยน weight แม้แต่ bit เดียว แต่ลด MACs ต่อ inference ได้มาก

**ผลที่คาด:** ลด inference time 20–40% ถ้า receptive field analysis ยืนยันได้
**ความเสี่ยง:** สูง — analysis ต้องแม่นยำ ถ้าตัด layer ที่ยังมีผลออกจะ degrade quality ทันที
ต้องมี PCM equivalence test ก่อน และหลัง และต้องมี rollback flag

---

## สิ่งที่ไม่ควรทำในแผนนี้

- [ ] ❌ ไม่ใช้ INT8 Quantization แบบ naive (Post-Training Quantization) — research ยืนยันว่า SDR ลด 1.5–3.0 dB ซึ่งจะได้ยินชัดในรูปแบบ vocal leakage และ metallic artifact ถ้าต้องการ INT8 ต้องใช้ QAT + Knowledge Distillation (งาน R4 ในแผนเดิม)
- [ ] ❌ ไม่ลด FFT size หรือ context frames — ลด frequency resolution ทำให้ vocal bleed กลับมาและ phase smearing แย่ลง
- [ ] ❌ ไม่ใช้ smoothing กว้าง (median filter > 2 frames) — smear transient อย่างรุนแรง
- [ ] ❌ ไม่เปิด Complex Ratio Mask ก่อนมีโมเดลใหม่ที่ train สำหรับ CRM output โดยเฉพาะ
- [ ] ❌ ไม่ลด chunk size จาก 16 frames เป็น 8 frames — inference ต่อ second เพิ่มสองเท่า ทำให้ GPU ร้อนขึ้นและ P99 เกิน chunk duration บน slow GPU
- [ ] ❌ ไม่รวมหลาย candidate ใน build เดียว — ถ้าเสียงเปลี่ยนจะไม่รู้สาเหตุ

---

## ลำดับ Checkpoint การฟังจริง

1. **Checkpoint A:** Phase A ทั้งหมด → วัด inference time ก่อนและหลัง (ต้องการ: ลดลงหรือเท่าเดิม, เสียงห้ามเปลี่ยน)
2. **Checkpoint B:** B1 (Attenuation Floor) อย่างเดียว → ฟัง sustained vocal, room decay, centered instrument
3. **Checkpoint C:** B2 + B3 (IIR + Transient Gate) → ฟัง drum transient, piano attack, harmonic decay
4. **Checkpoint D:** B4 (F16) → blind A/B บน Apple และ Windows แยกกัน
5. **Checkpoint E:** C1 (Adaptive Queue) → สอบ interruption test บน Apple + Windows (hide popup, tab switch, 10-min soak)

---

## เกณฑ์ตัดสินสุดท้าย

เปิดเป็น production default เมื่อครบทุกข้อ:

- [ ] Inference time P95 ≤ 55ms บน Apple Silicon Metal
- [ ] Inference time P95 ≤ 65ms บน GTX 1050 Ti
- [ ] ไม่มี underrun, click, หรือ vocal leak หลัง tab switch / hide popup
- [ ] Drum transient, piano attack และ ambience ไม่เปลี่ยนจาก baseline
- [ ] GPU temperature ไม่เพิ่มขึ้นหลังเล่น 10 นาที (เทียบกับก่อนแผนนี้)
- [ ] เล่นต่อเนื่อง 30 นาทีโดยไม่มี resync เพิ่มขึ้น
