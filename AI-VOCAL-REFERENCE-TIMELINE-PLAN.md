# AI Vocal Reference Timeline & Quality Recovery Plan

สถานะ: **Planning only — ยังไม่เริ่มแก้ audio pipeline**

เป้าหมายของแผนนี้คือทำให้ Karaoke ตัดเสียงร้องได้เนียนและนิ่งขึ้น ลดเสียงร้องแบบหุ่นยนต์ ลดอาการดนตรีวูบวาบ และรักษารายละเอียดเครื่องดนตรี โดยยังใช้โมเดลขนาดเดิมและรักษาความลื่นบน Apple Silicon, GTX 1050 Ti และ GPU รุ่นเก่าให้มากที่สุด

## 1. กฎที่ห้ามละเมิด

- [ ] คุณภาพเครื่องดนตรี, transient, ambience และ stereo image ต้องไม่ต่ำกว่า production baseline
- [ ] ห้ามแลกการตัดเสียงร้องด้วยการทำให้เครื่องดนตรีกลางเวทีหายหรือเสียงกลวง
- [ ] ห้ามให้ raw vocal, เสียงเพลงเก่า หรือ output จาก generation เก่าหลุดระหว่าง buffering/reset
- [ ] ห้ามให้ latency สะสมเมื่อ hide popup, scroll, เปลี่ยน tab, เปลี่ยนเพลง หรือมี CPU/GPU load ภายนอก
- [ ] Web candidate ต้องแยกจาก GO path; ห้ามเปลี่ยน GO DSP/protocol โดยอัตโนมัติ
- [ ] ทุก candidate ต้องมี feature flag และ rollback ได้โดยไม่ย้อนงาน optimization ที่พิสูจน์แล้ว
- [ ] ไม่เปิด candidate เป็นค่าเริ่มต้นจนกว่าจะผ่าน automated tests และการฟังจริงบน Apple + Windows
- [ ] ไม่ commit จนกว่าผู้ใช้จะสั่งโดยตรง

## 2. ข้อเท็จจริงที่ตรวจแล้ว

- [x] น้ำหนักโมเดล Web ปัจจุบันไม่เคยถูก quantize หรือลดขนาด
- [x] SHA-256 ของ `model.json` และ weights ตรงกันใน app, demo และ reference ภายใน repository
- [x] Graph folding 12 branches ให้ logits ตรงกับ graph เดิม: max error = `0` สำหรับ silence, sparse และ dense inputs
- [x] Exact output-head prototype มี max error ประมาณ `2.98e-8` และยังปิดอยู่ใน production
- [x] โมเดลทั้ง Smooth และ Detail รับ input เต็ม `[1, 1024, 64, 2]`; Smooth ไม่ได้ลด model context
- [x] Current Detail ใช้ `8192 samples / 16 frames / mask start 32 / mask length 16`
- [x] Current Smooth ใช้ `7680 samples / 15 frames / mask start 34 / mask length 15`
- [x] AI Remove reference รับเสียงใหม่ 7,680 samples แต่สร้าง magnitude ใหม่ 16 frames
- [x] AI Remove เลื่อน rolling tensor 15 frames, เติม 16 frames และ normalize ด้วย max ของ rolling tensor 64 framesจริง
- [x] AI Remove depth 2 อ่าน mask 18 frames เริ่มที่ frame 31 และใช้ spectrum จาก one-chunk lookahead
- [x] AI Remove ทำ iSTFT 18 frames แล้วส่งเฉพาะช่วงกลาง 7,680 samples โดย crop ขอบ 1,536 samples
- [x] AI Remove บังคับ WebGL F16 แต่ยังไม่มีหลักฐานว่า F16 เป็นสาเหตุที่คุณภาพดีกว่า
- [x] โฟลเดอร์ AI Remove ไม่มี model weights จึงยังพิสูจน์ไม่ได้ว่าใช้ weights เดียวกับ NextAmp

## 3. สมมติฐานหลัก

อาการวูบวาบ เสียงร้องเด้งกลับ และเสียงหุ่นยนต์น่าจะเกิดจาก mask/timeline บริเวณรอยต่อมากกว่าความละเอียดของโมเดล:

1. Current app สังเคราะห์ output จาก mask 15/16 frames เป็นก้อนและต่อขอบด้วย app overlap-add
2. AI Remove ใช้ mask 18 frames แล้วทิ้งขอบที่เชื่อถือได้น้อย เหลือเฉพาะช่วงกลาง
3. AI Remove มีหนึ่ง STFT frame ที่ซ้อนกันระหว่าง cadence จึงรักษา context รอบรอยต่อได้ต่อเนื่องกว่า
4. Detail เปลี่ยนตำแหน่ง mask จาก Smooth แต่ยังไม่ได้จำลอง reference timeline จึงอาจไม่แก้ artifact ที่ต้นเหตุ

สมมติฐานนี้ต้องพิสูจน์ด้วย PCM/golden tests ก่อนสรุปว่า model weights เป็นข้อจำกัด

## 4. ค่าประมาณต้นทุนก่อนลงมือ

ที่ sample rate 44.1 kHz:

| Path | Inference/s | AI pipeline latency ก่อน device | หมายเหตุ |
| --- | ---: | ---: | --- |
| Current Smooth | 5.742 | ~522.45 ms | 15-frame cadence แต่ยังใช้โมเดล 64 frames |
| Current Detail | 5.383 | ~557.28 ms | ค่าเริ่มต้นที่กำลังทดลอง |
| Reference Timeline candidate | 5.742 | ~522.45 ms เมื่อคง safety queue เดิม | timeline ใกล้ AI Remove แต่ยังรักษาคิวของเรา |
| AI Remove depth 2 | 5.742 | ~348.30 ms + measured runtime lag | buffer architecture ไม่เหมือนเรา |

Reference Timeline จะเรียกโมเดลมากกว่า Detail ประมาณ 6.7% การทำ iSTFT/readback ต่อวินาทีอาจเพิ่มได้สูงสุดประมาณ 20% เพราะใช้ 18 frames แทน 16 frames แต่ model weights/MACs ต่อ inference ไม่เพิ่ม และ DSP ส่วนนี้มีต้นทุนต่ำกว่า U-Net inference มาก ต้องวัดจริงก่อนสรุปเรื่องพลังงาน

## 5. Batch R0 — สร้าง Reference Oracle และ Golden Timeline

Batch นี้ไม่เปลี่ยน production audio

- [ ] สร้าง black-box harness สำหรับ `ai remove/stft.wasm`
- [ ] ป้อน impulse ในทุกตำแหน่งรอบ chunk boundary เพื่อหา mapping ของ input, spectrum, mask และ output อย่างแน่นอน
- [ ] ทดสอบ sine, logarithmic sweep, deterministic noise, stereo phase และ digital silence
- [ ] ยืนยันจำนวน analysis frames, spectrum frames, crop offset และ sample delay จริง
- [ ] จำลอง JS rolling logic ของ AI Remove: เก็บ 48 frames จาก offset 15 แล้วเติม 16 frames
- [ ] บันทึก normalized model input 64 frames และ selected mask indices ของแต่ละ chunk
- [ ] สร้าง golden fixtures ที่ไม่ต้องใช้ model weights ของ AI Remove
- [ ] แยก latency เป็น capture cadence, model lookahead, synthesis crop, safety queue และ AudioContext/device latency

Gate R0:

- [ ] อธิบาย sample/frame mapping ได้ครบโดยไม่เดาจากค่าคงที่อย่างเดียว
- [ ] impulse reconstruction ไม่มี sample shift ที่อธิบายไม่ได้
- [ ] golden fixtures ทำซ้ำได้และไม่พึ่งเวลา/เครื่องที่รัน

## 6. Batch R1 — Web Reference Timeline Candidate

ทำเป็น candidate แยกและยังไม่เปิดเป็น production default

### R1A. Analysis และ rolling context

- [ ] เพิ่ม config ที่แยก `input samples`, `analysis frames`, `context advance`, `mask frames` และ `output samples` ออกจากกัน
- [ ] รับเสียงใหม่ 7,680 samples ต่อ cadence
- [ ] คำนวณ STFT ใหม่ 16 frames พร้อม boundary frame ที่ซ้อนกันตาม oracle
- [ ] เลื่อน rolling model context 15 frames และเติม 16 framesตาม reference
- [ ] คง model input shape `[1,1024,64,2]`
- [ ] คำนวณ max จาก rolling tensor 64 frames จริงและใช้ div-no-nan semantics
- [ ] ทำ full-window max ใน C/WASM ด้วย SIMD หรือ frame-peak ring โดยไม่เพิ่ม allocation ใน realtime path

### R1B. Mask และ synthesis timeline

- [ ] อ่าน logits 18 frames เริ่มที่ frame 31 สำหรับ depth 2
- [ ] ขยาย WASM spectrum/mask queue ให้รองรับ 18 synthesis frames โดยไม่ใช้ allocation ต่อ chunk
- [ ] ใช้ one-chunk lookahead เดิมและ generation guard เดิม
- [ ] ทำ fused mask + iSTFT 18 frames
- [ ] crop เฉพาะ center 7,680 samples ตาม oracle แทนการเชื่อมขอบแบบเดา
- [ ] ยืนยัน COLA/window normalization และระดับความดังว่าไม่เปลี่ยน
- [ ] ล้าง rolling/spectrum/mask state ทุก mode, song, engine, silence และ resync boundary

### R1C. Isolation และ fallback

- [ ] เพิ่ม internal feature flag เช่น `REFERENCE_TIMELINE_CANDIDATE`
- [ ] เก็บ Current Detail เป็น fallback ที่ rollback ได้ทันที
- [ ] ไม่เพิ่มปุ่ม profile ใน popup; candidate เป็น internal build เท่านั้น
- [ ] ไม่เปลี่ยน GO chunk size, native DSP, WebSocket protocol หรือ adaptive GO buffer
- [ ] ไม่เปิด overlap consensus, temporal smoothing, F16, INT8 หรือ output-head candidate พร้อมกัน เพื่อให้รู้สาเหตุของผล A/B

Gate R1:

- [ ] STFT magnitudes, rolling input, mask selection และ reconstructed PCM ตรงกับ R0 oracle ภายใน tolerance
- [ ] ไม่มี discontinuity/click/level jump ที่ chunk boundary
- [ ] silence และ song transition ไม่มี mask/spectrum จากเพลงเก่าหลงมา
- [ ] Karaoke/Acapella/Bypass สลับซ้ำได้โดย output ไม่ดับ

## 7. Batch R2 — Recover Performance โดยห้ามเปลี่ยนเสียง

เริ่มเฉพาะเมื่อ R1 ชนะด้านคุณภาพ

- [ ] รวม rolling max + normalization เป็น SIMD pass ที่ cache-friendly
- [ ] ใช้ circular frame/spectrum storage เพื่อเลี่ยง memmove
- [ ] คง fused mask+iSTFT และ preallocated transfer/output pools
- [ ] ลด readback ให้เหลือ 18 framesที่ใช้จริง โดยต้องผ่าน strict mask-equivalence gate
- [ ] ทดลอง exact output-head เฉพาะเมื่อ output ตรง baseline ภายใน tolerance บน WebGL และ WebGPU
- [ ] benchmark WebGL/WebGPU แยก Apple, GTX 1050 Ti และ GPU รุ่นเก่า
- [ ] วัด p50/p95/p99 ของ STFT, model launch, readback, iSTFT และเวลารวมต่อ chunk
- [ ] วัด inference deadline margin และ memory หลังเล่นต่อเนื่องอย่างน้อย 10 นาที
- [ ] ปรับ safety queue แบบ adaptive หลังคุณภาพนิ่งแล้วเท่านั้น

Gate R2:

- [ ] PCM/mask ไม่เปลี่ยนจาก R1 เกิน numerical tolerance
- [ ] p99 ต่ำกว่า chunk duration พร้อม margin บน GTX 1050 Ti
- [ ] ไม่มี allocation/queue/tensor โตต่อเนื่อง
- [ ] latency ไม่สะสมหลัง external CPU/GPU spike

## 8. Batch R3 — Controlled Quality Candidates ถ้ายังมีเสียงหุ่นยนต์

ทำทีละ candidate หลัง Reference Timeline เท่านั้น ห้ามรวมหลายเทคนิคใน build เดียว

### Candidate A: Overlap consensus แบบ conservative

- [ ] ใช้ prediction ที่โมเดลคำนวณอยู่แล้วจาก context ซ้อนกัน ห้ามเรียกโมเดลรอบที่สอง
- [ ] เปลี่ยน mask เฉพาะ bin ที่สอง context เห็นตรงกันว่าเป็น vocal leakage
- [ ] ห้ามยก mask ขึ้นจนเสียงร้องกลับมา
- [ ] จำกัด cache หนึ่ง cadenceและ reset ทุก boundary
- [ ] reject หากเครื่องดนตรีกลางเวทีหรือ transient ลดลง

### Candidate B: Asymmetric mask stability

- [ ] ทดลอง fast vocal attenuation + slow release เฉพาะ bin ที่มี confidence สูง
- [ ] จำกัด smoothing เป็น 1–2 frames และหลีกเลี่ยง percussive/transient bins
- [ ] reject หากเกิดเสียงกลวง, smearing หรือดนตรีวูบมากกว่าเดิม

### Candidate C: WebGL F16 parity

- [ ] ทดลองแยกเฉพาะ WebGL เพราะ AI Remove บังคับ F16
- [ ] เปรียบเทียบ logits/mask/PCM กับ FP32 และฟัง blind A/B
- [ ] ใช้เฉพาะเมื่อเร็วหรือเบาขึ้นและคุณภาพไม่ต่ำลง
- [ ] ห้าม force F16 บนอุปกรณ์ที่ backend/driver ไม่เสถียร

## 9. สิ่งที่ยังไม่ควรทำ

- [ ] ไม่กด mask แรงขึ้นทั้งย่าน เพราะจะตัดเครื่องดนตรีพร้อมเสียงร้อง
- [ ] ไม่ใช้ center-channel cancellation เป็น production เพราะทำลายเครื่องดนตรีที่อยู่กลาง stereo image
- [ ] ไม่ใช้ smoothing หนักหรือ median filter กว้าง เพราะอาจเบา musical noise แต่ทำ transient และรายละเอียดหาย
- [ ] ไม่ลด context ต่ำกว่า 64 frames
- [ ] ไม่ใช้ INT8 model ที่ไม่มี provenance/calibration/quality report
- [ ] ไม่ลด safety queue เพื่อให้ตัวเลข latencyสวยก่อนผ่าน interruption test
- [ ] ไม่เปลี่ยน model architecture ก่อนพิสูจน์ reference timeline

## 10. Batch R4 — Model Path ถ้า Timeline ยังแพ้ AI Remove

เริ่มเมื่อ R1–R3 ไม่สามารถปิดช่องว่างและมีหลักฐานว่า DSP/timeline ถูกต้องแล้ว

### R4A. Architecture-preserving fine-tune/distillation

- [ ] เตรียม stems ที่มี vocals, accompaniment, centered instruments, backing vocals, reverb และเพลงหลายแนว
- [ ] ใช้ loss แยก vocal suppression, instrument preservation, transient, stereo และ temporal consistency
- [ ] ใช้ phase-aware/heavier teacher แล้ว distill กลับเข้า architecture ขนาดเดิม
- [ ] เริ่ม tune output head ก่อน แล้วค่อย unfreeze decoder/full modelด้วย learning rate ต่ำ
- [ ] export shape/op set/static graph เดิม เพื่อให้ runtime MACs และ latency ไม่เพิ่ม
- [ ] ใช้ weights ใหม่ต่อเมื่อ blind A/B ชนะและเครื่องดนตรีไม่แพ้ baseline

### R4B. Phase-aware model รุ่นถัดไป

- [ ] วัด oracle-mask ceiling เพื่อพิสูจน์ข้อจำกัดของ magnitude mask + mixture phase
- [ ] ทดลอง complex ratio mask หรือ phase residual เป็น model แยก ไม่ทับ production model
- [ ] ประเมิน output channels, readback, complex DSP, memory และพลังงานทั้งหมด
- [ ] พิจารณา distill phase-aware teacher กลับสู่ model เล็กก่อนเพิ่ม runtime cost

## 11. ชุดทดสอบคุณภาพและความนิ่ง

- [ ] เพลงผู้ใช้ที่คุ้นเคยและได้ยิน regression ชัด
- [ ] lead vocal กลาง, backing vocal ซ้าย/ขวา, duet และ chorus หนา
- [ ] vocal ที่มี reverb/delay มากและเสียงลมหายใจ
- [ ] guitar/piano/synth ที่อยู่กลางเวทีและมี harmonic ใกล้เสียงร้อง
- [ ] drum transient, bass และ ambience ห้ามวูบตาม vocal
- [ ] เริ่มเพลง, pause/resume, seek, เปลี่ยนเพลง และช่วง silence
- [ ] hide popup, scroll, switch tab และปล่อย YouTube อยู่เบื้องหลัง
- [ ] external CPU load และ GPU load
- [ ] เล่นต่อเนื่องอย่างน้อย 10 นาที และ final soak 30 นาที
- [ ] Apple Silicon + Windows GTX 1050 Ti; MX130 ใช้เป็น GO/fallback stability case

ถ้ามี clean stems ให้รายงาน SI-SDR/SDR/SIR/SAR และ loudness difference ควบคู่กับ blind listening แต่ metric ห้ามแทนการฟังจริงเรื่อง pumping, musical noise, transient และ stereo image

## 12. จุดให้ผู้ใช้ทดสอบแบบรวมกลุ่ม

เพื่อลดจำนวนครั้งที่ต้องย้ายไป Windows:

1. **Checkpoint A:** จบ R0 + R1 ทั้งก้อน, automated tests ผ่าน แล้ว build Extension/Web ครั้งเดียวให้ฟังเทียบ Current Detail กับ Reference Timeline
2. **Checkpoint B:** จบ R2 ทั้งก้อน, ยืนยันว่าเสียงเท่า Checkpoint A แล้วทดสอบความลื่น/พลังงาน/latency บน Apple + Windows ครั้งเดียว
3. **Checkpoint C:** เฉพาะกรณี R3 มี candidate ที่ผ่าน automated gate จึงรวม candidate ที่ปลอดภัยที่สุดหนึ่งตัวให้ฟัง
4. **Checkpoint D:** R4 เป็นโครงการ model ใหม่และไม่รวมกับ release ปัจจุบัน

## 13. เกณฑ์ตัดสินสุดท้าย

เปิด Reference Timeline เป็น production default เมื่อครบทุกข้อ:

- [ ] เสียงร้องหุ่นยนต์และการเด้งกลับลดลงชัดเมื่อเทียบ Current Detail
- [ ] ดนตรีวูบวาบลดลงและไม่มี centered instrument regression
- [ ] คุณภาพเข้าใกล้หรือเทียบ AI Remove ในเพลงทดสอบหลัก
- [ ] GTX 1050 Ti ทำงานต่อเนื่องโดยไม่มี underrun/resync เพิ่มอย่างมีนัยสำคัญ
- [ ] Apple Silicon ไม่ใช้พลังงานสูงขึ้นเกินประโยชน์ด้านคุณภาพที่ได้รับ
- [ ] GO path ยังคงผลเดิมและผ่าน mode/tab/song transition tests
- [ ] latency ไม่สะสมและกลับเข้าสู่ ceiling หลัง workload spike

ถ้า Reference Timeline ตรง oracle แล้วแต่ยังแพ้ AI Remove ต่อเนื่อง ให้สรุปว่าความต่างมีแนวโน้มมาจาก weights/precision/model limitation และเดิน R4 แทนการเติม post-processing แบบสุ่ม

