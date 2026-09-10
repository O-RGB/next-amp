# AI Vocal Quality & Latency Optimization Plan v2

สถานะ: **Phase A (flags + UI throttle) ไม่มีผล — ปรับแผนใหม่จากการวิเคราะห์โค้ดจริง**

## ข้อเท็จจริงที่ตรวจสอบแล้ว

| รายการ | ค่าที่วัดได้ |
|--------|-------------|
| ก่อนแผน Reference Timeline | 45–55 ms (Metal-3) |
| ตอนนี้ (หลังปรับเสียง) | 55–65 ms (Metal-3) |
| เสียง | ดีขึ้นมากจากเดิม |
| GPU/ความร้อน | สูงขึ้นจากเดิม |
| Phase A flags | ไม่มีผลใด ๆ ทั้งเสียง latency ความร้อน |

## ทำไม Phase A ไม่มีผล (วิเคราะห์ตรง ๆ)

1. **TF.js flags (`WEBGL_PACK_NORMALIZATION`, `WEBGL_PACK_DEPTHWISE_CONV`)** —
   เป็นแค่ hints สำหรับ TF.js เปลี่ยนวิธี pack ข้อมูลใน texture
   ถ้า model ไม่มี depthwise conv layer หรือ normalization op ที่ TF.js
   จัดเป็น "packable" ก็ไม่มีผล และ model ปัจจุบัน (U-Net) ใช้ standard
   conv2d เป็นหลัก ซึ่ง WEBGL_PACK ที่เปิดอยู่แล้วครอบคลุมแล้ว

2. **`WEBGPU_DEFERRED_SUBMIT_BATCH_SIZE=0`** — ส่งผลเฉพาะ WebGPU backend
   แต่บน Apple Metal-3 ใช้ WebGL path (ผ่าน ANGLE) ไม่ใช่ WebGPU
   flag นี้จึงไม่ทำงานเลย

3. **UI status throttle** — `GO_STATUS_UPDATE_INTERVAL_MS = 500` ครอบ GO path
   ส่วน Web path มี status update แค่ตอน Worklet ส่ง status กลับมา
   ซึ่งก็ไม่ได้ถี่พอที่จะเป็น bottleneck

**ความจริง: bottleneck คือ model inference เอง — U-Net execute + GPU readback
ใช้เวลา 55–65 ms ต่อ chunk และไม่มี flag ใดลดตัวเลขนี้ได้**

---

## แผนที่ปรับใหม่ — เรียง priority จากทำได้จริง > ทำได้ยาก

### ส่วน A — ทำให้เสียงดีขึ้นอีก (ไม่เพิ่ม latency)

เทคนิคเหล่านี้ทำงานใน WASM DSP path หลังจาก inference เสร็จแล้ว
ไม่เพิ่ม GPU compute time เลย เพิ่ม CPU work ในระดับ microsecond เท่านั้น

#### A1. เปิด Attenuation Floor (B1 — implement แล้ว ยังปิดอยู่)

โค้ดมีอยู่แล้วใน `stft_core.c` (line ~576, 602–604, 613–614)
และ flag `ENABLE_ATTENUATION_FLOOR_CANDIDATE = false` ใน JS (ปิดชั่วคราวเพื่อเทียบ baseline หลัง A/B)
+ `stft_set_attenuation_floor()` ใน WASM (line 59 ใน .h)

- [x] เปิด `ENABLE_ATTENUATION_FLOOR_CANDIDATE = true` ทดสอบเป็น A1 listening candidateแล้ว; รอบ baseline ปัจจุบันปิดกลับเป็น `false` และยังไม่ปรับค่า floor จาก 0.035
- [x] ฟังจริงบนเพลง 3–5 เพลง: vocal decay, room ambience, centered instrument — เทียบ `false/true` แล้วไม่พบความต่างที่ฟังได้
- [x] ไม่ลด `ATTENUATION_FLOOR` จาก 0.035 → 0.02 เพราะไม่พบความต่างที่แก้ได้ด้วย floor
- [x] ไม่เปิดเป็น default; คง `ENABLE_ATTENUATION_FLOOR_CANDIDATE = false` เพราะ A/B ไม่ให้ผลต่างชัดเจน

**ทำแล้วดียังไง:**
Gain ปัจจุบันลงได้ถึง 0.0 (เงียบสนิท) ทำให้ bin ที่โมเดลบอกว่าเป็น vocal
ถูกลบออกทั้งหมด แม้แต่ room ambience ที่ซ้อนอยู่ ผลคือเสียง "แห้ง" หรือ "กลวง"
เหมือนห้องไร้เสียงสะท้อน floor 0.035 (−29 dB) รักษา ambient residue ไว้เล็กน้อย
ฟังเป็นธรรมชาติกว่า

**ไม่เหมาะถ้า:** floor สูงเกินจะเหลือเสียงร้องเบา ๆ ให้ได้ยิน

---

#### A2. เปิด Asymmetric IIR Mask Smoothing (B2 — listening candidate)

โค้ดมีอยู่แล้วใน `stft_core.c` (line ~558–584)
flag `ENABLE_ASYMMETRIC_SMOOTHING_CANDIDATE = true` ใน JS (เปิดเป็น A2 listening candidate รอบนี้)

- [x] เปิด `ENABLE_ASYMMETRIC_SMOOTHING_CANDIDATE = true` เป็น A2 listening candidate
- [x] ใช้ค่าเริ่มต้น α_fast=0.1, α_slow=0.5 (JS line 39–40) — ยังไม่ปรับจูน
- [x] เปิด A3 ร่วมกับ A2 ตามลำดับการทดสอบ เพื่อรักษา transient
- [ ] ถ้า smoothing ทำให้เสียงนุ่มเกินจนสังเกตได้ ปรับ α_slow → 0.3
- [x] ฟังจริง: sustained vocal, guitar pluck, hi-hat, reverb tail — ค่าเริ่มต้นผ่านการทดสอบ

**ทำแล้วดียังไง:**
ลด musical noise (chirping) ที่เกิดจาก mask กระโดดขึ้น-ลงระหว่าง frame
ทำให้เสียง overall "นิ่ง" กว่าเดิม

**ไม่เหมาะถ้า:** α_slow สูงเกินจะ smear transient — ทำให้ drum hit ดูหน่วง

---

#### A3. เปิด Spectral Flux Transient Gate (B3 — listening candidate)

โค้ดมีอยู่แล้วใน `stft_core.c` (line ~371–391)
flag `ENABLE_TRANSIENT_GATE_CANDIDATE = true` ใน JS (เปิดเป็น A3 listening candidate รอบนี้)

- [x] เปิด `ENABLE_TRANSIENT_GATE_CANDIDATE = true` เป็น A3 listening candidate
- [x] ใช้ค่าเริ่มต้น TRANSIENT_THRESHOLD = 0.35 (JS line 41)
- [x] ทำงานร่วมกับ A2 ที่เปิดอยู่ (ถ้า smoothing ปิด gate ไม่มีความหมาย)
- [x] ฟังจริง: เพลง drum-heavy, snare roll, cymbal crash — ค่าเริ่มต้นผ่านการทดสอบ

**ทำแล้วดียังไง:**
เป็น guard สำหรับ A2 — เมื่อตรวจพบ transient ที่แท้จริง (spectral flux สูง)
จะ bypass smoothing 1 frame ทำให้ drum/snare ผ่านมาแบบ sharp

**ไม่เหมาะถ้า:** threshold ต่ำเกินจะ bypass บ่อยจน A2 ไม่มีผล

---

### ส่วน B — ลด latency จริง ๆ (ยาก เพราะ bottleneck คือ model)

#### B1. ทดสอบ WebGL F16 (B4 — flag มีอยู่แล้ว ยังปิดอยู่)

`CANDIDATE_WEBGL_F16 = false` ใน JS (line 44)

- [ ] เปิด `CANDIDATE_WEBGL_F16 = true`
- [ ] วัด inference time ก่อนและหลัง (ทำ 3 รอบ เอาค่ากลาง)
- [ ] วัดอุณหภูมิ GPU / fan speed หลังเปิดเล่น 5 นาที
- [ ] blind A/B กับ FP32 บนเพลง 3 เพลง
- [ ] ถ้า inference ลด ≥5ms และเสียงฟังไม่ต่าง → commit
- [ ] ถ้าเสียงต่าง (vocal leak, metallic) → reject

**ทำแล้วดียังไง:**
FP16 ลด memory bandwidth ครึ่งหนึ่ง GPU ย้ายข้อมูลระหว่าง memory กับ compute unit
น้อยลง ใช้พลังงานน้อยลง ทำให้เย็นลง และอาจเร็วขึ้น 10–25%
บน Apple Silicon (UMA) ผลชัดมากเพราะ memory bus แชร์กัน

**ไม่เหมาะถ้า:** driver บางตัว (โดยเฉพาะ Windows Intel/AMD รุ่นเก่า)
มี F16 implementation ที่ผิดปกติ ต้องทดสอบแยกทุก platform
ห้าม force เป็น default ก่อนผ่าน A/B ทั้ง Apple + Windows

---

#### B2. Overlap Consensus เปิดอยู่แล้ว — ตรวจว่าเป็นตัวที่ทำให้ช้าขึ้นไหม

`WEB_OVERLAP_CONSENSUS_CANDIDATE = true` (line 23)
ตรวจโค้ดแล้ว: overlap consensus ต้อง readback `maskFrames * 2` แทน `maskFrames`
จาก GPU (ดู line ~1617–1623, 1669–1681) นั่นคือ readback data ขนาดสองเท่า

- [ ] ปิด `WEB_OVERLAP_CONSENSUS_CANDIDATE = false` ชั่วคราว
- [ ] วัด inference time ก่อนและหลัง
- [ ] ถ้า latency ลด ≥5ms: ต้องตัดสินใจว่าคุณภาพที่ overlap consensus เพิ่ม
      คุ้มกับ latency ที่เสียไปหรือไม่
- [ ] ถ้า latency ไม่เปลี่ยน: overlap consensus ไม่ใช่ตัวปัญหา ปล่อยเปิดต่อ

**ทำแล้วดียังไง:**
ถ้าปิดแล้ว latency ลด แปลว่า readback ขนาดใหญ่ขึ้นเป็นสาเหตุหลัก
เพราะ GPU → CPU transfer (`.data()`) เป็น sync point ที่หนักที่สุดของ pipeline

**ไม่เหมาะถ้า:** เสียง overlap consensus ดีกว่า baseline ชัดเจน
ก็ไม่ควรปิด ให้หาทางลด readback size แทน (เช่น readback เฉพาะ active frames)

---

#### B3. ตรวจสอบ Adaptive Queue ว่าทำงานจริงไหม

`ENABLE_ADAPTIVE_BROWSER_QUEUE_CANDIDATE = true` (line 48)
แต่ MAX_BROWSER_PENDING_CHUNKS เพิ่มจาก 2 → 4 (line 95)

- [ ] ตรวจว่า adaptive queue ลด pending limit จริงไหม หลังเล่นได้ 30 วินาที
- [ ] ดู diagnostics: `browserQueueTarget` ปรับค่าลดลงจาก 2 หรือค้างที่ 2?
- [ ] ถ้าค้างที่ 2 (เพราะ P95 inference > chunk duration / 2):
      adaptive queue ไม่สามารถลดได้ เพราะ inference ช้าเกินจริง ๆ
- [ ] ถ้า adaptive queue ไม่เคยลดลง: `MAX_BROWSER_PENDING_CHUNKS = 4`
      เปิดโอกาสให้ queue กว้างขึ้นโดยไม่จำเป็น ให้ลดกลับเป็น 2

**ทำแล้วดียังไง:**
ถ้า queue กว้างเกินจริง จะเพิ่ม latency เพราะ worklet buffer เพลงไว้มากกว่าที่จำเป็น
ลดให้แคบลงจะลด perceived latency

**ไม่เหมาะถ้า:** ลดแล้ว click/underrun — ต้องมี margin สำหรับ GPU spike

---

#### B4. Exact Model Output Head (implement มีอยู่แล้ว ปิดอยู่)

`EXACT_MODEL_OUTPUT_HEAD = false` (line 30)

Decoder ROI specialization — ตัด output ให้เหลือเฉพาะ frames ที่ใช้จริง
ไม่เปลี่ยน weights แต่ลด computation ใน decoder's final projection

- [ ] เปิด `EXACT_MODEL_OUTPUT_HEAD = true`
- [ ] วัด inference time ก่อนและหลัง
- [ ] ถ้า inference ลด: ฟัง blind A/B เทียบกับ full head
- [ ] ถ้า max error > 1e-5 จาก baseline: reject

**ทำแล้วดียังไง:**
ลด decoder computation ที่ output frames ที่ไม่ได้ใช้ (frames 0–31 ถ้า sliceStart=32)
ทำให้ GPU ทำงานน้อยลงต่อ chunk inference time ลด latency ลด ความร้อนลด

**ไม่เหมาะถ้า:** backend บางตัว (CoreML, DirectML) จัดการ dynamic slice ไม่ดี
ทำให้เกิด vocal artifact ที่ฟังได้ นี่คือเหตุผลที่ปิดอยู่ตอนนี้
comment ระบุชัดว่า "leave it off until CoreML and DirectML audio listening
gates confirm" ต้องทดสอบบน Metal ก่อนเป็นอันดับแรก

---

### ส่วน C — วิจัย / อนาคต (ไม่ implement ในแผนนี้)

#### C1. WebGPU Backend แทน WebGL

ตอนนี้ Apple ใช้ WebGL ผ่าน ANGLE (translation layer) ถ้า Chrome
รองรับ WebGPU บน macOS อย่างเต็มรูปแบบ จะเร็วขึ้นมากเพราะเข้าถึง
Metal compute pipeline ตรง ๆ ไม่ต้องผ่าน ANGLE shader translation

- [ ] ตรวจว่า Chrome version ปัจจุบันบนเครื่องรองรับ WebGPU หรือยัง
- [ ] ถ้ารองรับ: ทดสอบ inference time บน WebGPU vs WebGL
- [ ] Research ยืนยัน WebGPU เร็วกว่า WebGL 2–3x ในงาน ML inference

#### C2. Complex Ratio Mask / Phase-Aware Model

ต้องเปลี่ยน model architecture + retrain — เป็นงาน R4B ในแผนเดิม
ไม่สามารถทำได้กับ weights ปัจจุบัน

#### C3. Model Distillation / Smaller Architecture

ใช้ model ใหญ่เป็น teacher train model เล็กกว่าที่ให้ผลใกล้เคียง
ลด inference time โดยตรง แต่ต้อง data + training pipeline

---

## สิ่งที่ทำแล้วไม่มีผล (ปิดกลับเป็นเดิมได้)

- [x] ~~`WEBGL_PACK_NORMALIZATION`~~ — ไม่มี op ที่ match ใน model
- [x] ~~`WEBGL_PACK_DEPTHWISE_CONV`~~ — model ไม่มี depthwise conv
- [x] ~~`WEBGPU_DEFERRED_SUBMIT_BATCH_SIZE=0`~~ — ไม่ใช้ WebGPU backend
- [x] ~~UI status throttle~~ — ไม่ใช่ bottleneck

แนะนำให้ revert Phase A flags ที่เพิ่มมาออก เพื่อไม่ให้มี dead code ค้างอยู่

---

## ลำดับการทดสอบ

```
ขั้นที่ 1 (ไม่เพิ่ม latency — เสียงอาจดีขึ้น):
  → เปิด A1 (Attenuation Floor) → ฟัง → ตัดสินใจ
  → เปิด A2 + A3 (Smoothing + Transient Gate) → ฟัง → ตัดสินใจ

ขั้นที่ 2 (หา bottleneck จริง):
  → B2: ปิด Overlap Consensus → วัด latency → เทียบเสียง
  → B3: ตรวจ Adaptive Queue Target → ลด MAX_PENDING_CHUNKS ถ้าจำเป็น

ขั้นที่ 3 (ลด GPU compute):
  → B1: เปิด F16 → วัด latency → blind A/B
  → B4: เปิด Output Head → วัด latency → blind A/B
```

---

## เกณฑ์ตัดสินสุดท้าย

- [ ] Latency ≤ 55ms P95 บน Apple Silicon Metal-3
- [ ] เสียงไม่แย่กว่า baseline ปัจจุบัน (ฟังจริง)
- [ ] GPU temperature ไม่สูงกว่า baseline หลัง 10 นาที
- [ ] ไม่มี click/underrun/vocal leak หลัง tab switch / hide popup
- [ ] เล่นต่อเนื่อง 30 นาทีโดยไม่มี resync
