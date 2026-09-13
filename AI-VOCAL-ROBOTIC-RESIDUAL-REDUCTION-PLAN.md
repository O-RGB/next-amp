# AI Vocal Robotic Residual Reduction Plan

สถานะ: **Implementation in progress — tooling ของ Diagnostic, zero-runtime-cost, head-only training, candidate contract และ offline quality gate เสร็จแล้ว; ยังไม่แก้ production model, DSP หรือ Extension**

เอกสารนี้มีไว้ส่งต่อให้ AI/ผู้พัฒนารอบถัดไปทำงานได้โดยไม่ต้องเดาวิธีเอง
เป้าหมายคือทดลองลดเสียงร้องตกค้างที่ฟังเป็นเสียงเบา ๆ แบบหุ่นยนต์ใน Karaoke
โดยรักษาความเร็วและคุณภาพเครื่องดนตรีของ ECO ปัจจุบันไว้ก่อนทุกอย่าง

---

## 1. เป้าหมายที่แท้จริง

ลดเฉพาะอาการต่อไปนี้:

- เสียงร้องหลักยังเหลือเบา ๆ และมี texture แบบหุ่นยนต์
- หางคำร้อง, ลมหายใจ, vibrato, backing vocal หรือ vocal reverb โผล่เป็นช่วง ๆ
- mask เปลี่ยนเร็วเกินไปจนเสียงร้องตกค้างสั่นหรือเป็นเสียงดิจิทัล

สิ่งที่ถือว่า **ไม่ผ่าน** แม้เสียงร้องเบาลง:

- เครื่องดนตรีกลางเวทีหายตามเสียงร้อง
- piano, guitar, synth, snare หรือ ambience กลายเป็นเสียงกลวง
- เสียงวูบวาบหรือสลับ Original/Karaoke ชัดขึ้น
- stereo image แคบลงหรือเสียงร้องย้ายมาอยู่ตรงกลางเด่นกว่าเดิม
- latency, GPU load, อุณหภูมิ หรือ long-run stability แย่ลงอย่างสังเกตได้

เป้าหมายรอบแรกคือการปรับดีขึ้นเล็กน้อยแต่ปลอดภัย ไม่ใช่บังคับให้ไม่มีเสียงร้อง
เหลือเลยทุกเพลง เพราะโมเดล real-time ขนาดเล็กมีเพดานของมัน

---

## 2. Baseline ที่ห้ามทำหาย

- [x] Baseline commit คือ `c2e317b` (`perf(ai): prebuild ECO model graph`)
- [x] ECO ที่ผู้ใช้วัดจริงอยู่ประมาณ `45–50 ms`
- [x] Input และ decoder context ยังคงเต็ม `[1, 1024, 64, 2]`
- [x] Runtime ECO ใช้ output เฉพาะ frame `34..48` จำนวน 15 frames
- [x] Build-time ECO mask ตรงกับ conservative full-output graph ที่
      `MAE 0 / max error 0`
- [x] Production model hashes ปัจจุบัน:
  - `model.json`: `8917532971a28410af9c01011c1c1cfbb6ce6e6bfbe667bb2c7d09e425fbaa07`
  - `group1-shard1of1.bin`: `13cafca89123ac168bf2d45adbd916b2d67bbbdc7cfeee56ed03947f7421f135`
- [x] Store/Web build และ model verification ผ่าน
- [x] ไม่มี tensor leak ใน optimized/fallback model load-dispose test

ทุก candidate ต้องเทียบกับ baseline นี้ ห้ามเทียบกับความทรงจำหรือ build ที่ไม่ทราบ
commit/hash หากผลทดลองไม่ผ่าน ต้องกลับ baseline นี้ได้ทันที

---

## 3. ขอบเขตและข้อห้าม

### อยู่ในขอบเขต

- เครื่องมือวิเคราะห์และฝึก model ภายใน `nextstudio-model-builder/`
- Candidate weights ที่ยังใช้ CascadedASPPNet v4 architecture เดิม
- การปรับเฉพาะ final output head หรือ decoder ชั้นท้ายโดยไม่เพิ่ม runtime layer
- Offline evaluation ด้วยเพลงที่มี stems ถูกต้องตามสิทธิ์
- Causal post-filter ขนาดเล็กมาก เฉพาะเมื่อพิสูจน์แล้วว่าปัญหาเป็น temporal mask

### อยู่นอกขอบเขตของรอบหลัก

- [ ] ห้ามปรับ GO model, ONNX runtime, Go DSP หรือ WebSocket protocol
- [ ] ห้ามเปิด FULL กลับมาเป็น UI option เพื่อแก้ปัญหานี้
- [ ] ห้ามลด model context จาก 64 frames
- [ ] ห้ามเพิ่ม look-ahead หรือ delay chunk
- [ ] ห้ามเพิ่มโมเดลตัวที่สอง, ensemble หรือ TTA ใน runtime
- [ ] ห้ามเปลี่ยน FP16/F32/backend policy ระหว่างทดสอบคุณภาพ
- [ ] ห้าม deploy candidate ทับ `next-amp-extension/model/` ก่อนผ่านทุก gate
- [ ] ห้ามใช้เพลงจาก YouTube หรือไฟล์ไม่มีสิทธิ์เป็น training dataset

FULL และ GO ไม่ใช่เป้าหมาย optimization ของแผนนี้ หาก candidate ใช้ graph/weights
ร่วมกันแล้วได้ประโยชน์โดยอัตโนมัติถือเป็นผลพลอยได้ แต่ห้ามแตก implementation ใหม่
เพื่อรองรับสองเส้นทางนั้น

---

## 4. อย่ารีบสรุปว่าเป็นปัญหาของ model

คำว่า “เสียงหุ่นยนต์” อาจมาจากคนละสาเหตุ และแต่ละสาเหตุต้องแก้ต่างกัน:

1. **Model leakage** — mask มองเสียงร้องบางส่วนเป็นเครื่องดนตรีจริง ๆ
2. **Temporal modulation** — mask ของ bin เดิมกระโดดไปมาระหว่าง frame
3. **Mixture-phase limitation** — magnitude mask ถูก แต่ phase ของ mixture ยังสร้าง residue
4. **Timeline/alignment error** — mask ถูกนำไปใช้กับ spectrum คนละเวลา
5. **Realtime-state error** — stale output, queue reset หรือ generation เก่าหลุดมา
6. **Source ambiguity** — vocal และเครื่องดนตรีทับ harmonic/frequency เดียวกันจนโมเดล
   ไม่สามารถตัดอย่างหนึ่งโดยไม่กระทบอีกอย่างได้

ห้ามเริ่ม fine-tune หรือเพิ่ม DSP จนกว่าจะทำ Phase A แล้วจำแนกสาเหตุได้ เพราะถ้า
offline render สะอาดแต่ realtime render มีหุ่นยนต์ การฝึก model ใหม่จะไม่แก้ต้นเหตุ

---

## 5. โครงสร้างงานทดลองที่ต้องเพิ่มในอนาคต

ให้เพิ่มโครงสร้างต่อไปนี้เมื่อเริ่ม implement แผน ห้ามใส่ audio dataset ลง Git:

- `nextstudio-model-builder/training/`
  - เครื่องมือเตรียม dataset และ fine-tune
- `nextstudio-model-builder/evaluation/`
  - offline renderer, metric และ report generator
- `nextstudio-model-builder/config/robotic-residual/`
  - config ของ baseline/candidate แต่ละตัว
- `nextstudio-model-builder/work/robotic-residual/`
  - dataset cache, feature cache และ intermediate checkpoints; ต้องอยู่ใน `.gitignore`
- `nextstudio-model-builder/dist/candidates/robotic-residual/`
  - model และ report ที่ผ่าน automated gate แต่ยังไม่ใช่ production

กฎสำคัญ:

- คำสั่ง `npm run model:build` เดิมต้องยังสร้าง baseline reproducible ได้เหมือนเดิม
- Candidate ต้องใช้คำสั่งและ output directory แยกจาก production
- ทุก candidate ต้องบันทึก parent checkpoint hash, config hash, dataset manifest,
  random seed, tool versions และ metric report
- ห้ามให้คำสั่ง candidate เรียก `model:deploy` อัตโนมัติ

---

## 6. ชุดข้อมูลที่ต้องใช้

### 6.1 ชุดฟังของผู้ใช้

เตรียมช่วงเพลงสั้น 10–20 วินาทีที่ผู้ใช้ได้ยินปัญหาชัด โดยไม่ต้อง commit ไฟล์:

- lead vocal กลางชัด
- vocal เบา/กระซิบ/ลมหายใจ
- falsetto และเสียงสูง
- vocal ที่มี reverb หรือ delay มาก
- backing vocal ซ้าย/ขวาและ chorus หนา
- duet ชาย/หญิง
- guitar/piano/synth ที่เล่นโน้ตใกล้ย่านเสียงคน
- เพลงที่มี bass/snare อยู่ตรงกลาง
- เพลง acoustic และเพลง dense electronic

เก็บตำแหน่งเวลาและคำอธิบายว่าได้ยิน artifact ตรงไหน เพื่อให้ทุก candidate ฟังช่วง
เดียวกัน ห้ามใช้ทั้งเพลงแบบสุ่มแล้วบอกว่า “รู้สึกดีขึ้น”

### 6.2 ชุดประเมินที่มี stems

ใช้เพลงที่ผู้ใช้มีสิทธิ์ หรือ dataset สำหรับ source separation ที่ได้รับอนุญาตให้ใช้
ในการทดลอง เช่น MUSDB18/MUSDB18-HQ ภายใต้เงื่อนไขของ dataset นั้น

- แยก train/validation/test **ตามเพลง** ห้ามตัด clip จากเพลงเดียวกันไปอยู่คนละ split
- test split ต้องไม่ถูกใช้เลือกราคา hyperparameter
- เก็บ vocal และ instrumental stems แบบ lossless ที่ 44.1 kHz stereo
- ห้าม commit stems, cache หรือไฟล์ที่เงื่อนไขสิทธิ์ไม่อนุญาต
- เขียน dataset manifest เฉพาะ ID/hash/path ภายในเครื่องและสถานะสิทธิ์

ข้อมูลขั้นต่ำเพื่อเริ่มทดลอง:

- validation 20–30 เพลง
- test 10 เพลงที่ไม่ซ้ำ validation
- ถ้าจะ fine-tune จริง ควรมี train material หลายสิบเพลงขึ้นไป

ถ้ามีข้อมูลน้อยกว่านี้ ให้ทำได้เฉพาะ calibration experiment ห้ามสรุปว่า fine-tuned
model ดีกว่าทั่วไป

---

## 7. Phase A — หาให้ชัดว่าเสียงหุ่นยนต์เกิดที่ไหน

Phase นี้เป็นงานวิเคราะห์เท่านั้น ยังไม่แก้ production

### A1. สร้าง offline renderer ที่ใช้ pipeline เดียวกับ ECO

- [x] เพิ่ม offline renderer รับ mixture WAV 44.1 kHz mono/stereo และแปลง mono เป็น stereo
- [x] ใช้ STFT `n_fft=2048`, hop `512`, context 64 และ cadence 15 frames
- [x] ใช้ output window frame `34..48`
- [x] ใช้ mask equation และ inverse STFT แบบเดียวกับ `stft_core.c`
- [x] render เป็น float WAV โดยไม่ผ่าน AudioWorklet, queue หรือ browser scheduling
- [ ] ยืนยันด้วย deterministic fixture ว่า offline output ตรงกับ runtime DSP ภายใน
      tolerance ที่กำหนด

เหตุผล: ถ้า offline output ไม่มีเสียงหุ่นยนต์แต่ extension มี ปัญหาอยู่ที่ timeline,
queue หรือ realtime state ไม่ใช่ weights

### A2. สร้าง render สี่แบบต่อ clip

1. Current ECO model + current DSP
2. Current model mask แบบไม่ใช้ optional smoothing/floor ใด ๆ
3. Oracle ideal ratio mask จาก vocal/instrumental stems แต่ยังใช้ mixture phase เดิม
4. Ground-truth instrumental stem

ความหมายของผล:

- ถ้าแบบ 3 ยังมีหุ่นยนต์ชัด: mixture phase/STFT เป็นข้อจำกัดหลัก
- ถ้าแบบ 3 สะอาด แต่แบบ 1/2 มีหุ่นยนต์: model mask ยังปรับได้
- ถ้าแบบ 1 แย่กว่าแบบ 2: DSP หลัง model เป็นสาเหตุ
- ถ้า offline ทั้งหมดปกติ แต่ realtime แย่: หยุดแผน model แล้วไปแก้ alignment/state

### A3. ตรวจ mask และ alignment

- [x] วัด histogram ของ instrumental mask และบันทึก p05/p50/p95
- [x] วัด frame-to-frame delta ของ mask
- [x] ตรวจ left/right mask disagreement
- [ ] render alignment sweep เฉพาะ offline ที่ `sliceStart` รอบค่าปัจจุบัน
      (`32, 33, 34, 35`) โดยห้ามนำค่าใดเข้า production ทันที
- [ ] ทำ impulse/chirp fixture เพื่อตรวจว่า mask frame ถูกใช้กับ spectrum frame เดียวกัน
- [ ] ตรวจว่าไม่มี output จาก generation/เพลงก่อนหน้าปะปนใน capture

หาก alignment sweep ดีขึ้นเฉพาะบางเพลงแต่ทำให้เพลงอื่นวูบวาบ ให้สรุปว่าไม่ใช่
global alignment fix และห้ามเปลี่ยนค่า production

### A4. Metrics ที่ต้องรายงาน

- Instrumental SI-SDR/SDR เทียบ ground truth
- Vocal leakage energy ใน output Karaoke
- Instrument preservation error
- Multi-resolution STFT distance
- Mask temporal variation ใน vocal regions
- Transient retention สำหรับ drum/percussion regions
- Stereo correlation และ mid/side energy change
- Peak, RMS และ integrated loudness เพื่อกันการชอบ candidate เพราะมันเบากว่า

Metric ใช้เป็น gate ไม่ใช่ตัวแทนการฟัง ต้องเก็บ WAV comparison ด้วยเสมอ

สถานะ implementation: เพิ่ม evaluator รวมหลายเพลงสำหรับ SI-SDR, residual, spectral
distance, mask variation และ stereo แล้ว ส่วน transient regions และการตัดสินจาก
เพลงจริงยังรอ corpus ที่มีสิทธิ์และยังไม่ถูกทำเครื่องหมายว่าเสร็จ

ข้อจำกัดสำคัญ: จนกว่าจะมี manifest/stems ที่ได้รับอนุญาต การรันจริงของ Phase A/B/C
ยังไม่ถือว่าเสร็จ และห้ามนำ synthetic smoke test ไปอ้างว่าเสียงดีขึ้น

### Exit ของ Phase A

- [ ] ระบุ root cause หลักเป็น model-mask, temporal, phase, alignment หรือ realtime-state
- [ ] มี report และ WAV จาก input เดียวกันครบ
- [ ] ถ้ายังระบุไม่ได้ ห้ามเริ่มแก้ model

---

## 8. Phase B — Zero-runtime-cost logit calibration

นี่คือ candidate แรกที่ควรลองหาก Phase A ชี้ว่า model เหลือ vocal ใน bin ที่ mask
มีความมั่นใจระดับกลาง เพราะใช้ builder ที่มีอยู่และไม่เพิ่ม layer/runtime compute

แนวคิด:

- โมเดลสร้าง logits ก่อน sigmoid ผ่าน final 1x1 convolution `out`
- การปรับ “temperature” ของ logits แบบ scalar สามารถ bake ลง final output weights ได้
- Architecture, จำนวน layer, tensor shape, model input และจำนวน GPU kernel เท่าเดิม
- ไม่เพิ่ม latency ทางทฤษฎีและไม่เพิ่ม model size อย่างมีนัยสำคัญ

ขั้นตอนที่ AI รอบถัดไปต้องทำ:

- [ ] ยืนยันก่อนว่า output channel/mask semantics คือ instrumental mask
- [ ] ใช้ validation stems หา scalar ที่ลด vocal leakage โดยจำกัด instrument damage
- [ ] เริ่มค้นหาเฉพาะบริเวณใกล้ baseline เช่น scale `1.00–1.10`
- [ ] สร้าง candidate จากค่าที่ได้จริง ไม่ hard-code ค่าจากการคาดเดา
- [x] เพิ่ม tool สำหรับ scale final `out.weight` ใน artifact ก่อน export/FP16 conversion
- [x] tool จำกัด scalar ไว้ที่ `0.95..1.10`, ตรวจ final head shape และไม่แก้ input model
- [x] tool เขียน `CALIBRATION.json` และห้าม deploy อัตโนมัติ
- [ ] ห้ามเพิ่ม bias/Add/Pow/threshold runtime op ในรอบแรก
- [ ] export TFJS ผ่าน builder ปัจจุบันและตรวจ PyTorch→TFJS parity ของ candidate
- [x] เพิ่ม tool patch `out_kernel.npy` เข้า TFJS FP16 shard โดยแก้เฉพาะ final head
- [x] เพิ่ม static verifier ยืนยัน topology, input/output shape และ weight-spec contract ไม่เปลี่ยน
- [ ] สร้าง baseline + candidate WAV และ package แยกชื่อชัดเจน

เหตุผลที่ต้องวิเคราะห์ histogram ก่อน:

- หาก vocal residue อยู่ใน mask ต่ำกว่า 0.5 การทำ logits ให้คมขึ้นอาจกด residue ลง
- หาก residue ถูก model ทายเป็น instrumental ด้วยความมั่นใจสูง การ sharpen จะทำให้แย่ลง
- global curve อาจกินเครื่องดนตรีที่โมเดลไม่มั่นใจ จึงต้องมี preservation constraint

เกณฑ์รับเบื้องต้น:

- vocal leakage ดีขึ้นเฉลี่ยอย่างน้อยประมาณ `0.3–0.5 dB`
- instrumental SI-SDR ห้ามถอยเฉลี่ยเกิน `0.1 dB`
- critical clip ใด ๆ ห้ามถอยเกิน `0.3 dB` โดยไม่มีเหตุผลที่ฟังยอมรับได้
- latency p50 เพิ่มไม่เกิน `1 ms`, p95 เพิ่มไม่เกิน `2 ms`
- user listening ต้องไม่พบดนตรีวูบหรือเสียงกลางหาย

ถ้าไม่มี scalar ใดผ่าน ให้ reject ทั้ง Phase B ห้ามขยาย scale จนเสียงร้องหายแต่ดนตรีพัง

---

## 9. Phase C — Fine-tune เฉพาะ final output head

นี่คือทางหลักที่มีโอกาสลดเสียงหุ่นยนต์โดยยังใช้พลังงาน runtime เท่าเดิม

### ทำไมเหมาะกับ ECO

- Freeze backbone ทั้งหมดและฝึกเฉพาะ `out.weight`
- จำนวน parameter, layer, MAC และ GPU kernel ตอน inference เท่าเดิม
- Builder สามารถ export TFJS FP16 และ output head 15 frames แบบเดิม
- Model เรียนการแบ่งเส้นระหว่าง vocal/instrumental ใหม่ได้ละเอียดกว่าการตั้ง scalar
- ความเสี่ยงต่ำกว่าการ fine-tune decoder หรือเปลี่ยน architecture ทั้งตัว

### Training contract

- [x] เพิ่ม private stem manifest/NPZ preparation tool ที่ใช้ preprocessing เดียวกับ production
- [x] Input ต้องใช้ preprocessing เดียวกับ production: 44.1 kHz stereo,
      FFT 2048, hop 512, magnitude normalization และ context 64 frames
- [x] Loss หลักคำนวณเฉพาะ active ECO frames `34..48` แต่ input context ต้องยังครบ
- [x] Reconstruction ใช้ mixture complex STFT/phase แบบเดียวกับ runtime
- [x] Freeze ทุก parameter ยกเว้น final `out.weight`
- [x] เริ่มจาก official/reproducible SavedModel checkpoint ปัจจุบัน
- [x] ใช้ learning rate ต่ำ, deterministic seed และเลือก best validation checkpoint
- [x] แบ่ง validation/test ตามเพลงผ่าน manifest และบันทึกทุก run config

### Loss ที่ต้องมี

ใช้หลาย objective โดยให้น้ำหนัก instrument preservation สูงที่สุด:

1. **Instrument reconstruction loss** — ทำให้ Karaoke ใกล้ instrumental stem
2. **Vocal leakage penalty** — ลงโทษพลังงานที่สัมพันธ์กับ vocal stem ใน Karaoke
3. **Baseline trust-region/distillation loss** — บังคับ candidate ไม่หนี baseline มาก
   ใน bin ที่ไม่มีหลักฐานว่าต้องเปลี่ยน
4. **Temporal-delta loss** — ลดการกระโดดของ mask แต่ต้องเทียบกับ target delta
   เพื่อไม่ทำให้ transient ถูก smooth ทิ้ง
5. **Multi-resolution STFT loss** — ตรวจ texture ในหลายช่วงเวลา/frequency
6. **Stereo preservation loss** — ป้องกัน left/right image ถูกบีบหรือ vocal ย้ายกลาง

ห้ามใช้ vocal suppression loss เพียงตัวเดียว เพราะ optimizer จะเรียนวิธีง่ายที่สุดคือ
ลดทุกอย่างลง ซึ่งทำให้ผู้ใช้รู้สึกว่าเสียงร้องหายแต่ดนตรีเสีย

### การป้องกัน overfit

- ใช้ song-level split
- random gain และ channel-safe augmentation เท่านั้นในรอบแรก
- ห้าม pitch/time augmentation จนกว่าจะพิสูจน์ว่า preprocessing target ยังตรง
- monitor เพลงที่มี centered piano/guitar เป็น damage sentinel
- หยุดทันทีเมื่อ validation instrument score แย่ต่อเนื่อง แม้ train vocal loss ดีขึ้น
- เก็บ checkpoint เล็กน้อย เช่น best vocal, best preservation และ best combined score
  ไม่เลือกจาก train loss

### Exit ของ Phase C

- [ ] Candidate อย่างน้อยหนึ่งตัวผ่าน automated metrics
- [ ] Runtime graph shape, kernel count และ output metadata เท่า baseline
- [ ] TFJS candidate ตรงกับ PyTorch candidate ภายใน FP16 tolerance
- [ ] Apple และ Windows latency ไม่ถอยจาก baseline เกิน gate
- [ ] ผู้ใช้ฟังแล้วเลือก candidate โดยไม่พบเครื่องดนตรีเสีย

ถ้า Phase C ไม่ผ่าน ให้คง official weights เดิม การมี builder ไม่ได้แปลว่าต้องฝืนสร้าง
weights ใหม่เสมอ

---

## 10. Phase D — Fine-tune decoder ชั้นท้ายแบบ trust region

ทำเฉพาะเมื่อ Phase C ให้แนวโน้มดีแต่ final head ไม่มี capacity พอ

- [ ] Unfreeze เฉพาะ decoder block สุดท้าย + `out.weight`
- [ ] ใช้ learning rate ของ decoder ต่ำกว่า head
- [ ] เพิ่ม weight-distance penalty เทียบ official checkpoint
- [ ] Architecture และ tensor shapes ต้องเหมือนเดิมทั้งหมด
- [ ] ห้ามเพิ่ม channel, layer หรือ normalization op
- [ ] ใช้ gates และ listening corpus เดิมทุกข้อ

ข้อดีคือ runtime compute ยังเท่าเดิมเพราะเปลี่ยนเฉพาะค่า weights ข้อเสียคือ model มีอิสระ
เปลี่ยน texture มากขึ้นและเสี่ยงทำลายเครื่องดนตรี จึงเป็น Phase รอง ไม่ใช่จุดเริ่มต้น

ถ้า improvement จาก Phase D ไม่ชัดกว่า C ให้เลือก C เพราะเปลี่ยน weights น้อยกว่า

---

## 11. Phase E — Causal residual post-filter (ทางสำรอง)

ทำเฉพาะเมื่อ Phase A ยืนยันว่า artifact มาจาก mask temporal modulation และ model-only
candidate ยังลดไม่ได้พอ

คุณสมบัติที่ยอมรับได้:

- ใช้ current/previous mask เท่านั้น ห้าม look-ahead
- ทำใน loop WASM เดิมและไม่ allocate ต่อ frame
- ทำเฉพาะ vocal-confident bins ที่ต่อเนื่องหลาย frame
- จำกัด extra attenuation อย่างอ่อน เช่นไม่เกินไม่กี่ dB
- bypass เมื่อ spectral flux บอกว่าเป็น transient
- reset state ทุกครั้งที่ seek, เปลี่ยนเพลง, เปลี่ยน mode หรือ generation
- อยู่หลัง feature flag และ default ปิดจนผ่าน listening

ห้ามทำ:

- ลด mid/center channel แบบ global
- ลด frequency band ของเสียงคนแบบคงที่
- hard threshold/binary mask
- global mask power ที่ไม่มี validation constraint
- median/average ที่ต้องรอ future frame

เหตุผล: เทคนิคเหล่านี้ลดเสียงร้องได้ง่าย แต่กิน centered instruments และสร้าง pumping
ซึ่งเป็น regression ที่ผู้ใช้เคยพบแล้ว

Performance gate ของ post-filter:

- DSP เพิ่มไม่เกินประมาณ `0.2 ms/chunk` บนเครื่องทดสอบหลัก
- audio output latency ห้ามเพิ่ม
- ไม่มี allocation ต่อ frame/chunk
- long-run 30 นาทีไม่มี state growth หรือเสียงเก่าหลุด

---

## 12. Phase F — Phase-aware research (ไม่ใช่ ECO production รอบแรก)

Magnitude mask ที่ใช้ mixture phase มีข้อจำกัดเมื่อ vocal และ instrument ซ้อนกัน งานวิจัย
ด้าน STFT/mixture consistency และ phase recovery แสดงว่าการจัดการ phase สามารถช่วยได้
เมื่อ magnitude estimate ดี แต่เทคนิคเหล่านี้มักเพิ่ม computation และ state

ให้ใช้เป็น **offline upper-bound experiment** เท่านั้นก่อน:

- [ ] ทดลอง STFT consistency projection offline
- [ ] ทดลองหนึ่งรอบของ Wiener/phase refinement offline
- [ ] เปรียบเทียบกับ ideal ratio mask + mixture phase
- [ ] ถ้า improvement แทบไม่มี ให้ปิด Phase F
- [ ] ถ้า improvement ชัด ให้ประเมิน MAC, memory และ look-ahead ก่อนออกแบบ runtime

ห้ามใส่ iterative Wiener, Griffin-Lim, complex model head หรือ iSTFT→STFT เพิ่มใน ECO
โดยตรง เพราะขัดกับเป้าหมาย 45–50 ms จนกว่าจะมีหลักฐานว่าคุ้มจริง

---

## 13. วิธีทำ candidate build โดยไม่ทำ production พัง

หนึ่งกลุ่มทดลองต้องสร้างอย่างน้อย:

- `baseline/` — official current weights + current graph
- `candidate-<id>/` — candidate weights/graph
- `REPORT.json` — config, hashes, metrics, latency และ pass/fail
- `LISTENING.md` — รายชื่อ clip และจุดที่ต้องฟัง
- Extension ZIP ชื่อชัดเจน ไม่ใช้คำว่า `current` หรือชื่อสุ่ม

ห้ามแก้ audit hash ของ production เพื่อให้ candidate build ผ่าน ให้สร้าง candidate verifier
แยกต่างหาก เมื่อผู้ใช้เลือก candidate และอนุมัติ productionization แล้วจึง:

1. commit candidate source/config/report
2. build model สองครั้งและยืนยัน deterministic hashes
3. run PyTorch, SavedModel, TFJS, fallback และ memory-leak verification
4. deploy เข้า Extension model directory
5. update provenance/license/hash audit
6. build Store + Web
7. test Apple และ Windows
8. commit production change แยกก้อน

---

## 14. ลำดับทำงานแบบเป็นกลุ่ม

### กลุ่ม 1 — Diagnostic foundation

- [ ] ทำ Phase A ทั้งหมด
- [ ] สร้าง corpus manifest, offline renderer, oracle renders และ report
- [ ] สรุป root cause ก่อนทำ candidate

ให้ผู้ใช้ทดสอบครั้งเดียวหลังกลุ่มนี้เฉพาะ WAV ที่จำเป็น ไม่ต้องย้าย Windows

### กลุ่ม 2 — Zero-cost model candidates

- [ ] ทำ Phase B calibration sweep
- [ ] ถ้า B มีแนวโน้มดี ทำ Phase C head-only fine-tune ต่อในกลุ่มเดียวกัน
- [ ] ส่ง baseline + candidate ที่ผ่าน automated gate สูงสุดไม่เกิน 2 ตัว

ผู้ใช้ฟังบน Apple ก่อน หากเสียงไม่ดีให้ reject ทั้งกลุ่มโดยไม่ build Windows

### กลุ่ม 3 — Same-compute fine-tune

- [ ] ทำ Phase D เฉพาะเมื่อ C ชน capacity limit
- [ ] รวม A/B package กับ C ที่ดีที่สุด
- [ ] ให้ผู้ใช้ทดสอบ Apple + Windows ครั้งเดียว

### กลุ่ม 4 — Optional DSP/phase

- [ ] ทำ Phase E เฉพาะ temporal root cause
- [ ] ทำ Phase F เฉพาะ offline upper bound ชี้ว่า phase เป็นข้อจำกัดหลัก
- [ ] ห้ามทำสอง Phase พร้อมกัน เพราะจะระบุสาเหตุไม่ได้

### กลุ่ม 5 — Productionization

- [ ] เลือก candidate เดียว
- [ ] รัน full verification, reproducibility, long-run และ Store/Web build
- [ ] update documentation/provenance
- [ ] commit หลังผู้ใช้ยืนยันเสียงผ่าน

---

## 15. Listening protocol

เพื่อกัน placebo และความดังหลอกหู:

- Normalize comparison ให้ loudness ใกล้กันโดยไม่เปลี่ยน dynamic range
- ใช้ clip เดิม เวลาเดิม และ volume เดิม
- สลับ baseline/candidate โดยไม่แสดง latency/ชื่อเทคนิคเมื่อเข้าสู่ final blind test
- ฟัง headphone และ speaker อย่างน้อยอย่างละหนึ่งรอบ
- ให้คะแนนแยกหัวข้อ ไม่ใช้คะแนนรวมอย่างเดียว:
  - vocal residue
  - robotic texture
  - instrument preservation
  - pumping/warble
  - transient clarity
  - stereo image
- ถ้าฟังไม่ออก ให้ถือว่า candidate ไม่ได้ดีขึ้นพอที่จะรับความเสี่ยง

Final candidate ควรถูกเลือกว่าดีกว่า baseline ในหลายเพลง ไม่ใช่ชนะมากในเพลงเดียวแล้ว
แพ้เล็กน้อยทุกเพลงที่เหลือ

---

## 16. Runtime/latency verification

ตัวเลข UI หนึ่งครั้งไม่เพียงพอ ให้รายงาน:

- cold-start warm-up
- p50/p95/p99 inference + readback หลัง warm-up
- จำนวน model calls ต่อวินาที
- dropped/stale chunks และ underrun count
- memory/tensor count ก่อนเปิด, หลัง 5 นาที และหลังปิด
- อุณหภูมิ/clock/fan เท่าที่ระบบอ่านได้
- เล่นต่อเนื่องเพลงเดิม 10 นาที
- เปลี่ยนเพลงและโหลดหน้าใหม่หลายครั้ง
- final soak 30 นาทีพร้อม foreground workload

เครื่องขั้นต่ำ:

- Apple Silicon เครื่องที่ baseline ได้ 45–50 ms
- Windows GTX 1050 Ti บน WebGPU

Candidate ที่เสียงดีขึ้นแต่ทำให้เครื่องร้อนจนเกิด GPU Slow เมื่อเล่นเพลงที่สองถือว่าไม่ผ่าน

---

## 17. Stop rules — จุดที่ต้องยอมแพ้และรักษา baseline

หยุด candidate ทันทีเมื่อ:

- vocal ดีขึ้นด้วยการลดเครื่องดนตรีกลางอย่างเดียว
- transient หรือ ambience เสียชัดใน sentinel clips
- p95 latency เพิ่มเกิน 2 ms โดยไม่มี improvement ที่ฟังชัด
- เกิด warble, clicking, stale audio หรือ buffer instability ใหม่
- improvement มีเฉพาะ train/validation แต่ไม่อยู่ใน unseen test songs
- ต้องเพิ่ม model/runtime pass ที่สองเพื่อให้ได้ improvement เล็กน้อย
- ผู้ใช้ blind test แยกไม่ออกจาก baseline

ผลที่ถูกต้องของแผนอาจเป็น “official model ปัจจุบันดีที่สุดสำหรับ ECO แล้ว” ได้ การทดลอง
ที่ reject อย่างมีหลักฐานถือว่าสำเร็จกว่าการฝืนรับ candidate ที่ทำลายเสถียรภาพ

---

## 18. ลำดับความสำคัญสุดท้าย

1. **Phase A: แยก model artifact ออกจาก realtime/alignment artifact**
2. **Phase B: constrained logit calibration ที่ bake ลง weights ได้**
3. **Phase C: fine-tune เฉพาะ final head — ตัวเลือกหลักที่ runtime cost เท่าเดิม**
4. **Phase D: unfreeze decoder ชั้นท้ายเมื่อมีหลักฐานว่า head capacity ไม่พอ**
5. **Phase E: causal post-filter เฉพาะ temporal artifact**
6. **Phase F: phase-aware offline research เท่านั้น**

อย่าเริ่มด้วย DSP ที่แรงกว่า อย่าเริ่มด้วย complex model และอย่าเริ่มจากการปรับค่าจาก
ความรู้สึกโดยไม่มี stems/report เพราะสามทางนั้นมีโอกาสทำให้เสียงวูบและดนตรีหายสูงที่สุด

---

## 19. งานอ้างอิงสำหรับผู้ลงมือ

- Differentiable STFT/mixture consistency projection:
  <https://arxiv.org/abs/1811.08521>
- Open-Unmix และการใช้ multichannel Wiener filtering ใน source separation:
  <https://joss.theoj.org/papers/10.21105/joss.01667>
- Model-based STFT phase recovery และข้อจำกัดของ mixture phase:
  <https://arxiv.org/abs/1608.01953>
- Multi-domain/combination losses ที่ใช้ตอน training โดยไม่จำเป็นต้องเพิ่ม inference cost:
  <https://arxiv.org/abs/2305.07855>
- CascadedASPPNet/vocal-remover architecture ต้นทาง:
  <https://github.com/tsurumeso/vocal-remover>

งานอ้างอิงเหล่านี้เป็นแนวทางตัดสินการทดลอง ไม่ใช่เหตุผลให้คัดลอก architecture ใหม่หรือ
เพิ่ม algorithm เข้า production โดยไม่ผ่าน latency/listening gates ของแผนนี้

---

## 20. Definition of Done

แผนนี้ถือว่าเสร็จเมื่อเกิดหนึ่งในสองผลลัพธ์:

### ผลลัพธ์ A — พบ candidate ที่ดีกว่า

- [ ] robotic vocal residue ลดลงในการฟังและ metric
- [ ] ไม่มีเครื่องดนตรี/เสียงกลาง/transient regression
- [ ] ECO p50/p95 ยังอยู่ใน gate จาก baseline 45–50 ms
- [ ] ไม่มี latency เพิ่มและไม่มี long-run regression บน Apple/Windows
- [ ] build reproducible, provenance ครบ และ rollback ได้
- [ ] ผู้ใช้ยืนยัน candidate ก่อนเปลี่ยน production

### ผลลัพธ์ B — ไม่พบ candidate ที่คุ้ม

- [ ] ทุก candidate ที่ reject มี report และเหตุผล
- [ ] production ยังคงอยู่ที่ commit/hash baseline
- [ ] ไม่มี experimental flag/dead code หลุดเข้า Store/Web build
- [ ] สรุปชัดว่า artifact ส่วนที่เหลือเป็นเพดานของ model/phase ภายใต้ ECO budget
