# AI Vocal Extreme Optimization Plan — Web AI + GO AI

วันที่: 2026-09-07

ขอบเขต: AI vocal ฝั่ง app/browser และ `nextamp-engine-go`

ฐานอ้างอิงรอบนี้: `0d5ddd9` (`fix(ai-vocal): harden GO stream transitions`) ซึ่งรวม adaptive queue/DSP/dashboard batch แล้ว

> กฎสูงสุด: **คุณภาพเสียงต้องไม่ต่ำกว่าเวอร์ชันปัจจุบัน**
>
> ความเร็วหรือการประหยัดไฟไม่มีสิทธิ์ผ่าน หากทำให้เสียงร้องหลงเพิ่ม เครื่องดนตรีวูบวาบขึ้น stereo image แคบลง transient เสีย เสียงแตกเพิ่ม หรือเกิด raw-vocal leak ระหว่างระบบสะดุด

### GO-first safety gate

GO รุ่นที่ผู้ใช้ยืนยันว่าใช้งานได้ปกติคือ production baseline ของรอบนี้ การปรับ Web และ GO ต้องรักษา baseline นี้ก่อนเสมอ:

- [x] Freeze baseline ที่ `0d5ddd9` หลัง GO กลับมาทำงานปกติ และ commit source ที่เกี่ยวข้องแล้ว
- [x] มี guard สำหรับ mode/song boundary: stream token, pending-request cleanup, stale-response drop และ native DSP reset
- [ ] Candidate ใดทำให้ GO มีอาการเสียงดับ, ไม่ส่ง output, buffer ค้าง, เสียงกระตุก/ขาด, raw vocal leak, เสียงเก่า หรือ latency สะสม ให้ reject/rollback ทั้ง candidate แม้ benchmark จะเร็วขึ้น
- [ ] งานที่ทดลองเฉพาะ Web ต้องอยู่หลัง feature boundary ของ Web และต้องไม่เปลี่ยน GO path โดยอัตโนมัติ
- [ ] ก่อนให้ผู้ใช้ทดสอบแต่ละ batch ต้องผ่าน automated regression + native smoke + pairing ของ extension/GO binary จาก source revision เดียวกัน
- [ ] ห้ามทำ precision/model graph/queue change ที่เสี่ยงกับ GO จนกว่าจะมี Windows + GTX 1050 Ti stability gate; ถ้าไม่มี headroom ให้ใช้ Web/GO fallback ที่ stable แทน

เกณฑ์ “ผ่าน” ของ GO คือเล่นต่อเนื่องได้จริงโดยไม่มี output หายหรือเสียงหลุดเมื่อ hide popup, เปลี่ยน tab, เปลี่ยนเพลง และมี CPU/GPU load ภายนอก ไม่ใช่ดูแค่ค่า inference latency เฉลี่ย

ไฟล์นี้เป็นแผนรอบใหม่และไม่แทนที่ `AI-VOCAL-OPTIMIZATION-PLAN.md` ซึ่งบันทึกงานรอบก่อนหน้าไว้แล้ว

## 1. เป้าหมาย

- [ ] ลดเสียงร้องตกค้างให้มากกว่า baseline โดยคุณภาพ ความดัง stereo image และความนิ่งของเครื่องดนตรีต้องไม่ต่ำลง
- [ ] ลด p50/p95/p99 ของ inference และเวลารวมต่อ chunk
- [ ] ลด end-to-end latency ที่ได้ยินจริง โดยไม่ลด lookahead คุณภาพเริ่มต้น
- [ ] ลด CPU/GPU utilization, memory traffic, allocation, GC และพลังงานต่อเพลงหนึ่งนาที
- [ ] ไม่ให้ latency สะสมเมื่อ hide popup, scroll, เปลี่ยน tab, เปลี่ยนเพลง หรือมีโปรแกรมอื่นแย่ง CPU/GPU
- [ ] เลือก backend/profile จากผลวัดของเครื่องนั้น ไม่เดาจากชื่อ GPU หรือ OS อย่างเดียว
- [ ] มี fallback และ rollback ต่อ candidate ทุกตัว

เป้าหมายเชิงตัวเลขจะล็อกหลังเก็บ baseline จริง เพราะตัวเลข watts และ GPU time จาก Apple/GTX 1050 Ti ยังไม่มีข้อมูลดิบ แต่เป้าหมายรอบแรกคือ:

| ด้าน | เป้าหมาย candidate |
| --- | --- |
| คุณภาพ | ไม่แย่กว่า baseline ใน golden PCM, stem metrics และ blind A/B |
| ความนิ่ง | 30 นาทีไม่มี latency โต, ไม่มี raw-vocal leak, underrun/resync ไม่มากกว่า baseline |
| deadline | p99 เวลาประมวลผลต่ำกว่า 70% ของ chunk duration; p95 ต่ำกว่า 55% ถ้าฮาร์ดแวร์ทำได้ |
| latency | Web ประมาณ 350–450 ms และ GO ประมาณ 375–560 ms บนเครื่องที่มี headroom โดยยังใช้ one-chunk lookahead |
| พลังงาน | ลด joules/min อย่างมีนัยสำคัญและทำซ้ำได้; ไม่ใช้ GPU% อย่างเดียวสรุปเรื่องพลังงาน |

ตัวเลข latency ด้านบนไม่รวม latency จาก pitch/EQ/device driver ที่อยู่นอก AI และไม่ใช่คำรับรองก่อน benchmark

## 2. กฎตรวจคุณภาพที่ห้ามข้าม

### 2.1 กลุ่ม exact / lossless optimization

ใช้กับ buffer pool, queue, transport, provider configuration, graph pruning ที่คงสมการ และ DSP fusion

- [ ] เทียบ model logits/mask กับ baseline ด้วย input เดียวกันทุก sample/frame
- [ ] เทียบ PCM หลัง mask + iSTFT + OLA แบบ sample-aligned
- [ ] งานที่ควร bit-exact ต้อง bit-exact; งานที่ลำดับ floating-point เปลี่ยนต้องมี max error/SNR ที่ต่ำกว่าระดับได้ยินอย่างชัดเจน
- [ ] ผ่าน silence, near-silence, impulse, transient, stereo phase, bass กลาง, reverb, vocal ซ้าย/ขวา และเพลงต่อเนื่อง
- [ ] ห้ามเปลี่ยน FFT size, hop, model input shape, weights, lookahead หรือ sample rate ใน production path ของกลุ่มนี้

### 2.2 กลุ่ม numerical/model candidate

ใช้กับ FP16, mixed precision, INT8, mask ensemble, pruning และ distillation

- [ ] ต้องมี reference stems ที่มีสิทธิ์ใช้ แยกชุด tune กับชุด final test
- [ ] วัด residual-vocal leakage แยกจาก instrumental SI-SDR/SDR, spectral convergence, LUFS delta, transient error และ stereo correlation
- [ ] ฟัง blind A/B หลายแนวเพลง โดยไม่ normalize แต่ละช่วงเพื่อซ่อน artifact
- [ ] ถ้าเร็วขึ้นแต่มีเพลงใดเกิด central vocal bleed/pumping/เสียงฉาบหรือ ambience หาย ให้ reject หรือจำกัดเฉพาะ hardware/profile ที่ผ่าน
- [ ] production default ต้อง fallback กลับ FP32 baseline ได้ทันที

### 2.3 สิ่งที่จะไม่ทำเพื่อแลกความเร็ว

- [x] ไม่ปล่อยเสียงต้นฉบับระหว่าง AI underrun
- [x] ไม่ frame-skip แบบสุ่ม
- [x] ไม่ใช้ VAD เดาย่านเสียงคนแล้วข้าม model เพราะดนตรีก็อยู่ในย่านเดียวกัน
- [x] ไม่ลด FFT/model resolution ใน default profile
- [x] ไม่ลด one-chunk lookahead ใน default profile
- [x] ไม่บังคับ FP16/INT8 ทุกเครื่อง
- [x] ไม่ใช้ smoothing, center cancellation, EQ หรือ compressor กลบ regression

## 3. สิ่งที่ตรวจพบจากโค้ดปัจจุบัน

### 3.1 Web AI

- [x] Raw TF.js graph มี 485 nodes; runtime optimizer เดิมลดเหลือ 445 nodes โดยคง weights
- [x] Model มี 7,914,143 weight elements; ในไฟล์ TF.js เก็บเกือบทั้งหมดแบบ float16 quantized storage ขนาดประมาณ 15.10 MiB แต่ runtime tensor ยังเป็น float32 เว้นแต่ backend ใช้ low-precision texture
- [x] Model รับและสร้าง `[1, 1024, 64, 2]` ทุก inference
- [x] `balanced` ใช้ 7,680 samples / 15 frames / ประมาณ 5.742 inference ต่อวินาทีที่ 44.1 kHz
- [x] `ai_remove` ใช้ 8,192 samples / 16 frames / ประมาณ 5.383 inference ต่อวินาทีที่ 44.1 kHz
- [x] เพราะ U-Net ยังประมวลผล input 64 frames เท่ากันทุกครั้ง โปรไฟล์ 15-hop เรียก model มากกว่า 16-hop ประมาณ 6.67%; จึงยังเรียกว่า “ประหยัดพลังงานกว่า” ไม่ได้จนกว่าจะวัดจริง
- [x] Output 64 frames ถูกสร้างครบ แต่ใช้จริงเพียง 15 หรือ 16 frames; output time frames อีก 75–76.6% ไม่ถูกใช้
- [x] Web path อ่านกลับเฉพาะ mask ที่ใช้จริงประมาณ 120 KiB (15 frames) หรือ 128 KiB (16 frames) ต่อรอบ แต่ยังมี synchronous GPU readback
- [x] AudioWorklet สร้าง `Float32Array` ใหม่สองก้อนทุก input chunk และ manager สร้างอีกสองก้อนทุก output chunk
- [x] Worklet ส่ง object diagnostics ผ่าน MessagePort ประมาณทุก 4,096 samples (~10.8 ครั้ง/วินาทีที่ 44.1 kHz) แม้ไม่ได้เปิด detailed diagnostics
- [x] Stable AI playback ยังวนคูณ gain ทีละ sample แม้ gain จะนิ่งที่ 0/1 แล้ว
- [x] ระบบเลือก WebGPU ก่อนเสมอ แต่ยังไม่มี A/B autotune เทียบ WebGPU กับ packed WebGL ต่อเครื่อง/driver
- [x] `vocal-worker.js` เป็น pipeline เก่าที่ไม่ได้เป็น production path และมีสูตร VAD/timeline คนละแบบ เสี่ยงเกิด implementation divergence

### 3.2 GO AI

- [x] GO ใช้ input/output tensor FP32 ขนาด 512 KiB ต่อก้อน และ copy normalized input เข้า ORT tensor ทุก chunk
- [x] Model output กลับ CPU ครบ 64 frames แม้ DSP ใช้เพียง 16 frames จากนั้นจึง slice + sigmoid ใน C
- [x] Initial audit พบว่า Windows DirectML path ตั้ง `SetMemPattern(true)` และใช้ execution mode ที่ไม่ได้ล็อก; แก้เป็น sequential + memory pattern off แล้วใน Batch 1
- [x] Initial audit พบว่า macOS ใช้ CoreML API เก่า; เปลี่ยนเป็น provider-options API พร้อม static-shape/NeuralNetwork/FastPrediction แล้วใน Batch 1 เพราะโมเดลนี้ compile เป็น MLProgram ไม่ผ่านที่ AvgPool
- [x] Initial audit พบว่า GO silence gate ตรวจ **current input** ก่อนเลื่อน STFT/lookahead state และ Karaoke เคยส่ง current raw payload กลับ; ย้าย gate หลัง StepForward และให้ silence เดิน OLA ต่อแล้วใน Batch 1
- [x] Silence threshold GO (`0.0003`) กว้างกว่า digital-silence floor ของ Web (`~3.25e-5`) จึงมีความเสี่ยงข้าม model ในเสียงเบาที่ยังได้ยิน
- [x] `ReadMessage()` สร้าง payload ใหม่ทุก WebSocket message; input ประมาณ 65,544 bytes ต่อ chunk
- [x] เดิมไม่มี application-level flow control; เพิ่ม client in-flight cap 2 chunks และ latest-wins resync แล้ว แต่ยังต้องวัดจริงว่าค่า cap เหมาะกับอุปกรณ์ทุกเครื่องหรือไม่
- [x] Initial audit พบว่า client เก็บ `pendingChunks` แต่ยังไม่จำกัด in-flight และ GO result ไม่มี generation/deadline ใน binary protocol; เพิ่ม in-flight cap + generation/chunk-floor resync และ 16-bit stream token ใน reserved header bytes แล้ว แต่ full protocol metadata ยังรอ Batch 1C
- [x] Initial baseline ให้ GO worklet รอ 5 output chunks; ลดเป็น 3 chunks และ ceiling 4 chunks แล้วใน Batch 1 เพื่อลด startup/queue latency โดยยังคง conceal เป็น silence เมื่อไม่ทัน; เพิ่ม adaptive target จาก measured p95 ใน batch ปัจจุบัน
- [x] Dashboard render เดิมสูงสุด 15 FPS และอ่าน Go memory stats ทุก frame; ลด interactive render เหลือ 5 FPS และ cache memstats ที่ 1 Hz แล้ว
- [x] Native FFT butterfly ยังเป็น scalar; SIMD ใช้หลัก ๆ ที่ window/OLA
- [x] Decrypted ONNX model ประมาณ 30 MiB ถูกเก็บใน RAM ตลอดเพื่อรองรับ CPU recovery
- [x] มี `model_int8.onnx` ประมาณ 7.8 MiB ใน workspace แต่ยังไม่มี provenance, calibration report, quality report หรือ runtime benchmark จึงยังห้ามใช้เป็น production

### 3.3 Latency floor ของสถาปัตยกรรมปัจจุบัน

ที่ 44.1 kHz:

| Path | Chunk | Lookahead | Start queue | AI pipeline latency โดยประมาณก่อน device |
| --- | ---: | ---: | ---: | ---: |
| Web 15-hop | 174.15 ms | 1 chunk | 2 real chunks | ~522.45 ms |
| Web 16-hop | 185.76 ms | 1 chunk | 2 real chunks | ~557.28 ms |
| GO 16-hop | 185.76 ms | 1 chunk | 3 chunks | ~743.04 ms |

การลด queue แบบคงที่ลงเฉย ๆ อาจทำให้ underrun เพิ่ม แผนจึงใช้ adaptive jitter buffer จาก p95/p99 และ deadline margin แทน

## 4. ลำดับลงมือแบบเป็นกลุ่ม

## Batch 0 — Freeze baseline และทำเครื่องวัดให้เชื่อถือได้

เป้าหมาย: รู้ว่าเวลาหายที่ไหนและมี baseline เสียงที่ย้อนกลับได้ ก่อนแก้หลายจุดพร้อมกัน

- [x] Commit/freeze baseline หลังผู้ใช้ยืนยันว่าเสียงรุ่นปัจจุบันดี (`0d5ddd9`)
- [ ] บันทึก source hash, model hash, browser/driver/OS, sample rate, backend และ profile ในทุก benchmark
- [ ] สร้าง golden model input, logits, masks และ streaming PCM จาก Web FP32 ปัจจุบัน
- [ ] สร้าง input ชุดเดียวกันให้ Web และ GO ใช้ เพื่อแยกความต่างของ model ออกจาก DSP/timeline
- [ ] เพิ่ม end-to-end chunk timestamp: capture → worklet → manager/socket → inference → synthesis → playback queue
- [ ] แยก GPU launch, GPU execution, GPU readback, STFT, mask, iSTFT, IPC, queue wait และ device latency
- [ ] เปิด TF.js kernel profile เฉพาะ debug build และ ORT node/provider profiling เฉพาะ benchmark build
- [ ] วัด p50/p95/p99/max หลัง warmupอย่างน้อย 10 นาที ไม่ใช้ผลรอบเดียว
- [ ] สร้าง workload ซ้ำได้: idle, scroll, hide popup, tab switch, YouTube page load, เปลี่ยนเพลง, CPU load และ GPU load
- [ ] วัด energy อย่างน้อย 3 รอบสลับ A/B หลังอุณหภูมินิ่ง
- [ ] วัด actual speaker latency ด้วย loopback/cross-correlation แยกจากค่าประมาณใน UI

เกณฑ์จบ Batch 0:

- [ ] รัน command เดียวแล้วได้ report JSON/CSV และ golden comparison
- [ ] ระบุ top-10 kernels/operations และเวลาที่เสียกับ queue/copy ได้จริงบน Apple กับ GTX 1050 Ti

## Batch 1 — P0 correctness, deadline และ latency control โดยไม่เปลี่ยนเสียง

นี่คือกลุ่มที่ควรทำก่อน เพราะแก้ทั้ง Windows reliability, เสียงหลุด และ latency สะสมโดยไม่ลด model quality

### 1A. GO provider configuration

- [x] DirectML: ตั้ง `SetExecutionMode(ORT_SEQUENTIAL)` และ `SetMemPattern(false)` ก่อน append provider
- [ ] DirectML: ยืนยันจาก ORT profile ว่ากี่ nodes อยู่บน DML และกี่ nodes fallback CPU
- [ ] DirectML: ถ้า graph partition ไม่ครบ ให้ระบุ node ที่หลุดและแก้ graph ก่อนคิดว่า GPU ช้า
- [x] CoreML: เปลี่ยนเป็น `AppendExecutionProviderCoreMLV2`
- [x] CoreML production options: `ModelFormat=NeuralNetwork`, `MLComputeUnits=ALL`, `RequireStaticInputShapes=1`, `SpecializationStrategy=FastPrediction`
- [x] คง `AllowLowPrecisionAccumulationOnGPU=0` ใน exact baseline
- [x] เพิ่ม `-coreml-profile` ให้เปิด `ProfileComputePlan=1` และ `-ort-profile` สำหรับ Chrome trace เฉพาะ debug โดยไม่เพิ่ม overhead ใน production
- [ ] CPU fallback: benchmark thread 1/2/3/4 แบบ sequential และเลือกต่ำสุดตาม deadline + joules ไม่ fix 2 โดยไม่มีผลวัด

อ้างอิง: [ONNX Runtime DirectML](https://onnxruntime.ai/docs/execution-providers/DirectML-ExecutionProvider.html) และ [ONNX Runtime CoreML](https://onnxruntime.ai/docs/execution-providers/CoreML-ExecutionProvider.html)

### 1B. Correct silence gating

- [x] ให้ GO advance STFT, rolling window, peak history และ lookahead queue ทุก chunk แม้เป็น silence
- [x] ตัดสิน skip จาก **delayed target chunk** แบบเดียวกับ Web ไม่ใช่ current chunk
- [x] ข้าม inference เฉพาะ digital silence ที่พิสูจน์ได้; ไม่ใช้ broad near-silence เป็น vocal VAD
- [x] Synthesize delayed silence ผ่าน OLA ให้ tail ถูก drain และ state ต่อเนื่อง
- [x] Reset ทุก state เมื่อ song/generation เปลี่ยน
- [ ] เพิ่ม fixture: loud→silence, silence→loud, song A→silence→song B และเสียงเบาใกล้ threshold

### 1C. Protocol v2 + bounded backlog

- [ ] เพิ่ม protocol version, generation, chunk index, sample count, capture timestamp และ flags ใน header
- [ ] แยก WebSocket reader กับ inference worker แต่ใช้ bounded queue 1–2 chunks
- [ ] ใช้ single writer goroutine และ response generation เดิมจาก request
- [x] เพิ่ม credit/in-flight cap ฝั่ง client เป็น 2 chunks; ห้ามส่งไม่จำกัดเข้า socket
- [x] เมื่อ native bridge เต็ม ให้ latest-wins + explicit DSP resync; ห้ามประมวลผล backlog เก่าให้ครบ
- [x] ทิ้ง stale response ของ GO ด้วย generation/chunk floor หลัง resync
- [x] จำกัด `pendingChunks` และล้างเมื่อ reset/disconnect
- [ ] ส่ง telemetry ต่อ response: inferMs, dspMs, queueWaitMs, serverQueueDepth, provider และ error flags
- [ ] ทดสอบ disconnect/reconnect, Blob/ArrayBuffer, duplicate/out-of-order, malformed packet และ engine restart

### 1D. Adaptive jitter buffer

- [ ] ไม่นับ warmup/delay packet ที่เป็นศูนย์เป็น ready audio
- [x] ลด GO safety baseline จากคงที่ 5 chunks เป็นเริ่ม 3 chunks และ ceiling 4 chunks; เพิ่ม adaptive target จาก measured p95 โดยคง safety ceiling ตาม provider speed
- [x] เริ่มจาก buffer ต่ำสุดที่ measured p95 รองรับจริงต่อ GO session แทนค่าคงที่: เร็วมากเริ่ม 2 chunks, ใกล้ deadline เริ่ม 3, ช้ากว่า deadline คง 4
- [ ] เพิ่ม buffer ทีละ chunk เมื่อเกิด underrun; ลดช้า ๆ หลังนิ่งหลายสิบวินาทีเพื่อไม่ให้ flapping
- [ ] คำนวณ target จาก inference p99 + queue jitter + AudioContext base/output latency
- [x] แยกค่าของ Web และ GO: adaptive tuning เปิดเฉพาะ `go_native`; Web cadence/queue เดิมไม่ถูกเปลี่ยน
- [ ] คง one-chunk model lookahead; ลดเฉพาะ safety queue
- [ ] ใส่ latency ceiling และ resync แทนการปล่อย queue โต

เป้าหมาย Batch 1:

- [ ] GO healthy path เริ่มได้ที่ 1–2 real chunks ถ้า p99 มี headroom
- [ ] ไม่มี latency สะสมหลัง load spike
- [ ] ไม่มีเสียงเก่า/raw vocal หลุดระหว่าง reset, silence หรือเปลี่ยนเพลง

สถานะ implementation รอบนี้:

- [x] JavaScript syntax check ผ่านสำหรับ Go client, manager และ AudioWorklet
- [x] `go test ./...` ผ่าน รวม regression test ของ delayed-silence timeline
- [x] delayed alignment/model optimizer/worklet tests ฝั่ง Web ผ่านจาก baseline suite
- [x] CoreML provider benchmark บน Apple Silicon ผ่าน: NeuralNetwork + ALL/ANE ราว 46 ms ต่อ chunk; MLProgram ถูก reject เพราะโมเดล compile ไม่ผ่านที่ AvgPool
- [x] CoreML output เทียบ CPU reference ใน benchmark แล้ว และยังคงใช้ FP32 accumulation (`AllowLowPrecisionAccumulationOnGPU=0`); final blind quality gate ยังรอเพลงจริง
- [x] GO receive path เปลี่ยนเป็น preallocated `NextReader` buffer และ Worklet steady-state playback ใช้ exact bulk copy
- [x] GO adaptive jitter target: เก็บ RTT ล่าสุด 24 ตัวอย่าง, รอ warmup 8 ผล, เลือก ready queue 2/3/4 ตาม measured p95 และส่ง target ไป Worklet เฉพาะ native path; stale result ไม่ถูกนำมาปรับค่า
- [x] GO mode/song boundary ใช้ native stream token ผ่าน reserved header bytes และ reset DSP ก่อนเริ่มโหมดใหม่ จึงไม่ให้ response เก่าที่ chunk index ชนกันหลุดเข้าเพลงใหม่
- [x] GO Smooth/Detail profile switch ใช้ native stream reset เดียวกับ Worklet พร้อม regression test; ไม่ให้ STFT/lookahead state เก่าชนกับ profile ใหม่
- [x] GO DSP เปิด platform SIMD ให้ inverse-FFT scaling และ 131,072-float normalization บน ARM NEON/x86 SSE แทน scalar loop โดยคงลำดับคำนวณเดิม; WASM branch เดิมยังคงอยู่ใน source ชุด DSP
- [x] Native build packer ตรวจ mtime ก่อนเข้ารหัสใหม่ จึงไม่สุ่มเขียน `model.enc/key_gen.go` ซ้ำทุก build เมื่อ source asset ไม่ได้เปลี่ยน
- [x] native build สร้าง macOS arm64 และ Windows x64 `.exe` จาก source ชุดเดียวกันสำเร็จ
- [x] macOS native smoke test ผ่าน: `/health` รายงาน `ai_enabled=true`, `version=2.3.0-eco` และ CoreML device โดยไม่ fallback
- [ ] build และรันจริงบน Windows + GTX 1050 Ti
- [ ] ฟัง blind A/B และวัด 30-minute stability บน Apple + Windows

## Batch 2 — ลด allocation/IPC/AudioWorklet load แบบ PCM เดิม

### 2A. AudioWorklet real-time path

- [ ] ทำ ping-pong/transferable buffer pool สำหรับ input L/R; manager คืน buffer หลัง copy เข้า WASM หรือ WebSocket
- [ ] ทำ output buffer pool โดย worklet คืนก้อนที่เล่นจบแล้ว
- [ ] เปลี่ยน array queue + `shift()/includes()` เป็น fixed-capacity ring พร้อม index lookup ขนาดเล็ก
- [x] เพิ่ม stable-AI bulk copy fast path เมื่อ `liveGain=0`, `aiGain=1`, `concealGain=1` แทน per-sample multiply loop
- [x] คง per-sample path เฉพาะ fade/conceal/mode transition
- [x] ลด WORKLET_STATUS เป็นประมาณ 2.7 Hz ตอนนิ่งและประมาณ 10.7 Hz ตอน buffering/recovering
- [ ] ไม่ spread/copy diagnostics object ใน audio thread ถ้า diagnostics ปิด
- [ ] ตรวจว่า process callback ไม่มี allocation ใน steady state หลัง warmup

### 2B. Web manager

- [ ] คืน transferred input buffers ทันทีหลัง ingest
- [ ] ใช้ preallocated output pool แทน `new Float32Array` ทุก chunk
- [ ] ลด Map/key cleanup ที่วนทุก chunkเป็น fixed peak ring ตาม delay ที่ใช้จริง
- [ ] หลีกเลี่ยง status string/Chrome storage work ใน hot path
- [ ] ย้าย detailed telemetry aggregation ออกจาก realtime cadence

### 2C. GO server/UI

- [x] เปลี่ยน `ReadMessage()` เป็น `NextReader` + preallocated exact-size packet buffer พร้อม validation
- [x] reuse silence output buffer ใน error/AI-unavailable path; ตัด `make([]float32, ...)` ออกจาก audio loop โดยไม่เปลี่ยน PCM ของ healthy path
- [x] ลด dashboard เหลือ 5 FPS เพื่อไม่แย่ง audio deadline และ cache `runtime.ReadMemStats` ที่ 1 Hz
- [x] subsample meter/sparkline ของ dashboard ด้วย stride 16; เป็น telemetry-only และไม่แตะ PCM/audio deadline
- [x] มี `--headless` สำหรับไม่ render dashboard ที่ไม่เห็น
- [ ] ปล่อย decrypted model bytes หลัง session stable; ถ้าต้อง recovery ให้ decrypt embedded model ใหม่เฉพาะตอนเกิด error
- [ ] วัด GC pause/allocation bytes ต่อหนึ่งนาทีทั้งก่อนและหลัง

เป้าหมาย Batch 2:

- [ ] steady-state AudioWorklet และ GO hot path allocation ใกล้ศูนย์
- [ ] ลด jitter/p99 แม้ค่า inference เฉลี่ยอาจลดเพียงเล็กน้อย
- [ ] PCM ผ่าน exact/numerical-null gate

## Batch 3 — Exact model graph specialization: จุดรีด compute ที่ใหญ่ที่สุด

ปัจจุบัน model สร้าง output 64 frames แต่ใช้เพียง 15/16 frames การใส่ `Slice` หลัง output อย่างเดียวลด readback แต่ไม่รับรองว่าจะลด convolution compute จึงต้องทำ spatial dependency pruning จริง

### 3A. Fused output head

- [ ] สร้าง Web/ONNX model variant ที่รวม Slice → Transpose/reshape → Sigmoid เป็น output head
- [ ] GO output เหลือ `[2, 16, 1024]` หรือ layout ที่ C ใช้ตรง ๆ แทน `[1,1024,64,2]`
- [ ] Web output เหลือ 15/16 framesที่ใช้จริงและลด JS TF op launches
- [ ] คง model IO เป็น FP32 ใน exact candidate
- [ ] เทียบ logits ก่อน sigmoid, mask หลัง sigmoid และ PCM

ประโยชน์ที่คาด: ลด GO device→CPU output จาก 512 KiB เหลือ 128 KiB ต่อ chunk และตัด CPU sigmoid/reshape; Web ลด post-op launches/readback synchronization บางส่วน

### 3B. ROI-specialized decoder graph

- [ ] เขียน static shape/dependency analyzer ย้อนจาก target output frames
- [ ] สำหรับ Conv/Depthwise/Pool/Resize/Concat/Pad คำนวณ input halo ที่จำเป็นแบบ exact
- [ ] Crop feature maps ใน decoder เฉพาะ ROI + receptive-field halo แทนคำนวณ time dimension เต็ม 64 ทุกชั้น
- [ ] ถ้า encoder/deep layer ต้องใช้เต็ม 64 ให้ crop เฉพาะชั้นที่ dependency อนุญาต ไม่เดา
- [ ] สร้าง variant 15-hop และ 16-hop จาก generator เดียวกัน
- [ ] เก็บ weights เดิมทุกค่าและคง padding semantics ที่ขอบ
- [ ] ตรวจ graph ด้วย random/adversarial inputs หลายร้อยชุดและเพลงจริง
- [ ] รายงาน MACs, peak activation memory, kernel count และ actual GPU time ก่อน/หลัง
- [ ] ใช้ candidate ต่อเมื่อ selected logits ตรง baseline ภายใน strict tolerance ทุก backend

นี่เป็นโอกาสลด model compute โดยไม่ retrain ที่ดีที่สุดในแผน แต่เปอร์เซ็นต์จริงยังห้ามเดาจน dependency cone และ profiler เสร็จ

### 3C. Incremental/stateful exact inference feasibility

- [ ] วิเคราะห์ว่า activation ของ 48–49 overlapping frames ใด reuse ได้โดยไม่เปลี่ยน boundary context
- [ ] คำนวณ receptive field ต่อ layer; cache เฉพาะ interior ที่ผลไม่ขึ้นกับ padding/window boundary ใหม่
- [ ] prototype state tensor ต่อ layerและ compare selected logits กับ full-window model
- [ ] ถ้า exact caching เป็นไปไม่ได้เพราะ receptive field ครอบคลุมทั้ง 64 frames ให้หยุด track นี้ ไม่ฝืนใช้ approximation
- [ ] ถ้าผ่าน ให้ประมวลผล sub-chunk 8 hops พร้อมคง lookahead 16 frames เพื่อลด packetization latencyโดยไม่เพิ่ม compute เท่าตัว

## Batch 4 — Backend/provider autotuning ต่อเครื่อง

### 4A. Web backend tournament

- [ ] เทียบ TF.js WebGPU, packed WebGL และ ONNX Runtime WebGPU ด้วย model/input/output เดียวกัน
- [ ] ORT WebGPU candidate ใช้ static shape, `enableGraphCapture`, preallocated output และ specialized output head
- [ ] ตรวจทุก op อยู่ WebGPU; ถ้ามี CPU fallback มากให้ reject ก่อน benchmark
- [ ] ทดลอง Dedicated Worker/proxy เฉพาะ WebGPU เพื่อแยก inference จาก offscreen main event loop
- [ ] ทดลอง WebNN เฉพาะ Windows ที่เปิดใช้ได้จริง; ห้ามเป็น required path เพราะ browser support ยังจำกัด
- [ ] TF.js WebGPU tune `WEBGPU_DEFERRED_SUBMIT_BATCH_SIZE`, conv/matmul program flags และ worker placement เป็น matrix ขนาดเล็ก
- [ ] TF.js WebGL tune packed conv/depthwise/array flags และ texture lifecycle จากค่าที่ bundle รุ่น 4.22.0 รองรับจริง
- [ ] วัดทั้ง p99, CPU time, GPU time, joules และ memory ไม่เลือกจาก p50 อย่างเดียว
- [ ] cache winner ด้วย model hash + browser version + OS + renderer/adapter + driver; invalidate เมื่อสิ่งใดเปลี่ยน
- [ ] backend switch ทำเฉพาะก่อนเริ่มเพลงหรือที่ stream boundary ไม่ hot-swap กลางเสียง

ONNX Runtime WebGPU รองรับ graph capture สำหรับ static graph ที่ทุก kernel อยู่บน WebGPU และรองรับ GPU I/O binding ตาม [เอกสาร WebGPU EP](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)

### 4B. GO ONNX Runtime

- [ ] ใช้ ORT profiler ดู provider assignment และ top nodes บน Windows/Apple
- [ ] ทดลอง optimized ONNX/ORT format แบบ provider-aware; CoreML ใช้ runtime-style optimization และ DML/CPU เปรียบเทียบ fixed/runtime จริง
- [ ] ทดลอง I/O Binding เฉพาะเมื่อ provider รองรับ device tensor อย่างครบและลด copy ได้จริง
- [ ] preallocate/reuse input/output tensors และ warmup exact final graph หลายรอบ
- [ ] อัปเกรด ONNX Runtime จาก embedded 1.20.1 เฉพาะ branch ทดลอง แล้ววัด compatibility/performance ก่อนแทนของเดิม
- [ ] ทำ custom reduced-operator runtime เฉพาะเพื่อลด EXE/startup/RAM; ไม่อ้างว่าจะลด inference ถ้ายังไม่มีผลวัด
- [ ] ถ้า Nvidia-specific CUDA/TensorRT เพิ่ม dependency ใหญ่เกินประโยชน์บน GTX 1050 Ti ให้ไม่ ship; DirectML ต้องยังเป็น standalone default

อ้างอิง: [I/O Binding](https://onnxruntime.ai/docs/performance/tune-performance/iobinding.html), [ORT model format](https://onnxruntime.ai/docs/performance/model-optimizations/ort-format-models.html)

## Batch 5 — DSP/FFT optimization โดยคง spectrum และ timeline

- [ ] profile ก่อนว่า STFT/iSTFT กินกี่เปอร์เซ็นต์ของ total; ไม่ optimize blind
- [ ] เปลี่ยน complex FFT เต็มเป็น real FFT/iRFFT หรือ split-radix ที่คำนวณเฉพาะ conjugate-unique bins
- [ ] ทำ SIMD butterfly/runtime dispatch: WASM SIMD128, x86 SSE2/AVX2 และ ARM NEON
- [ ] fuse delayed-mask application กับการเตรียม iFFT เพื่อตัด `g_spec_*` copy/pass ที่ซ้ำ
- [ ] reuse target lookahead spectrum slot หลังหมดอายุอย่างปลอดภัย
- [ ] vectorize normalization/magnitude/OLA ต่อจากจุดที่ profilerชี้ว่าคุ้ม
- [ ] แยก build flags ต่อ architecture; อย่าให้ Windows binary จบที่ generic x64 ถ้า CPU รองรับ AVX2
- [ ] เปรียบเทียบ spectrum/PCM กับ baseline และตั้ง reconstruction SNR gate สูงกว่า 120 dB
- [ ] ตรวจ denormal/very-low-level audio; optimization ต้องไม่สร้าง CPU spike หรือ noise floor ใหม่

คาดว่ากลุ่มนี้ลด CPU/DSP และพลังงานได้ แต่ model inference น่าจะยังเป็นต้นทุนหลัก จึงทำหลัง Batch 3/4 profiler

## Batch 6 — Precision/quantization candidates (ห้ามเปิดใช้จนคุณภาพผ่าน)

### 6A. FP16 / mixed precision

- [ ] สร้าง ONNX FP16 candidate โดยคง input/output FP32
- [ ] สร้าง layer-wise mixed precision โดยเก็บ sensitive first/last/output head และ layer ที่ error สูงเป็น FP32
- [ ] Apple: ทดสอบ CoreML MLProgram/ANE/GPU แยกกัน
- [ ] WebGPU: ทดสอบ shader-f16 เฉพาะ adapter ที่รองรับ
- [ ] WebGL: ทดสอบ `WEBGL_FORCE_F16_TEXTURES` เป็น candidate แยก ไม่เปิด global
- [ ] GTX 1050 Ti: benchmark FP16 จริง เพราะ Pascal รุ่นนี้ไม่มี Tensor Core และ FP16 อาจไม่เร็วกว่า FP32
- [ ] เลือกต่อ device จาก quality + p99 + joules; ไม่มี universal FP16 default

อ้างอิง: [ONNX Runtime float16/mixed precision](https://onnxruntime.ai/docs/performance/model-optimizations/float16.html)

### 6B. INT8

- [ ] ระบุว่า `model_int8.onnx` ถูกสร้างอย่างไร ก่อนใช้ผลใด ๆ
- [ ] ถ้าทดลองใหม่ ใช้ static QDQ quantization สำหรับ CNN พร้อม representative music calibration
- [ ] ทำ per-channel calibration และ quantization-debug เพื่อกัน layer ที่ทำเสียงเสีย
- [ ] ทดสอบ CPU AVX2 และ provider ที่รองรับจริง; อย่าคิดว่าไฟล์เล็กแปลว่าเร็ว
- [ ] reject ทันทีถ้า vocal leakage/instrument damage เพิ่ม หรือ old GPU ช้าลงจาก Q/DQ overhead
- [ ] INT8 เป็น optional hardware profile เท่านั้น ไม่แทน FP32 baseline โดยอัตโนมัติ

ONNX Runtime ระบุว่า quantization ไม่ lossless และอาจช้าลงบน hardware เก่าที่ไม่มีคำสั่งรองรับ จึงอยู่ท้ายแผน: [ONNX quantization](https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html)

## Batch 7 — ลดเสียงร้องตกค้างโดยไม่เพิ่มจำนวน inference

เป้าหมายของ Batch นี้ไม่ใช่ทำเสียงให้ดังหรือใสขึ้น แต่ต้องทำให้ **เสียงร้องที่ยังหลงใน instrumental output เบาลง** ขณะที่เครื่องดนตรีเดิมไม่หาย ไม่วูบ ไม่แคบ และไม่แตกเพิ่ม กลุ่มนี้ไม่ใช่ lossless แม้ใช้ prediction ที่มีอยู่แล้ว จึงต้องผ่าน quality gate เต็ม

### 7A. สร้าง vocal-leak benchmark ที่แยกความเสียหายต่อดนตรี

- [ ] เตรียม licensed clean vocal/instrumental stems แยก train/tune/final-blind และห้ามใช้เพลง final-blind ปรับค่า
- [ ] เก็บ hard cases: เสียงร้องกลาง/ซ้าย/ขวา, harmony, choir, rap, falsetto, breath, reverb tail, vocal distortion และเสียงร้องทับ synth/guitar
- [ ] สร้าง streaming mixture ด้วย sample rate, STFT, lookahead, chunk boundary และ song transition แบบ production จริง
- [ ] วัด residual vocal ใน instrumental output โดยเทียบกับ clean vocal stem และรายงาน p50/p90/worst-case ไม่ดูค่าเฉลี่ยอย่างเดียว
- [ ] วัดความเสียหายต่อ clean instrumental แยกต่างหาก เพื่อกันวิธีที่ดูเหมือนตัดร้องเก่งเพราะลดทุกอย่างลง
- [ ] loudness-match เฉพาะระดับ track ก่อน blind A/B; ห้าม normalize ช่วงสั้นแต่ละช่วงเพื่อซ่อน pumping
- [ ] สร้าง scorecard แบบ Pareto: candidate ต้องขยับ vocal leakage ลงโดย instrumental/stereo/transient ไม่ถอย

### 7B. ใช้ rolling-window predictions ที่คำนวณไปแล้ว

แต่ละ absolute audio frame ปรากฏใน input window หลายรอบอยู่แล้ว โมเดลจึงเคยทำนาย frame เดียวกันจากตำแหน่ง/context ต่างกัน วิธีนี้จะไม่เรียก `predict()` เพิ่ม แต่ Web อาจต้อง readback logits เพิ่มเล็กน้อย ส่วน GO มี full output อยู่บน CPU แล้ว

- [ ] map `generation + absoluteFrame` ให้ prediction จากทุก overlapping window ตรง frame กันแบบ sample-exact
- [ ] วัด error ของ output position ทั้ง 64 ตำแหน่งเทียบ stem เพื่อรู้ว่าช่วงกลางหรือขอบตำแหน่งใดเชื่อถือได้จริง
- [ ] หา crop/slice position ที่ดีที่สุดสำหรับ 15-hop และ 16-hop จาก tune set แทนการสมมติว่าตำแหน่งเดิมดีที่สุด
- [ ] ใช้ logits ก่อน sigmoid ในการเปรียบเทียบ/รวมค่า เพื่อไม่ทำ sigmoid ซ้ำและไม่บิดน้ำหนัก
- [ ] candidate A: เลือก prediction จากตำแหน่งที่ calibrated ว่าแม่นสุดต่อ absolute frame
- [ ] candidate B: center/reliability-weighted mean เฉพาะ frame ที่ซ้อนกัน โดยไม่เพิ่ม future lookahead
- [ ] candidate C: weighted median หรือ trimmed consensus เพื่อไม่ให้ prediction หลุดหนึ่ง window ทำเสียงร้องเด้งกลับ
- [ ] candidate D: conservative suppression เฉพาะ bin ที่หลาย context เห็นตรงกันว่าเป็น vocal leakage; ถ้าความเห็นขัดกันให้ใช้ mask baseline เพื่อรักษาเครื่องดนตรี
- [ ] จำกัด cache ด้วย absolute frame และลบทันทีเมื่อ frame ถูก synthesize; ห้ามให้ memory/latency โตตามเวลา
- [ ] reset cache เมื่อ seek, pause, song/generation เปลี่ยน, backend switch หรือ resync
- [ ] Web อ่านเพิ่มเฉพาะ frame ที่ candidate ต้องใช้ ไม่ดึง output 64 frames ทั้งก้อนโดยไม่มี benchmark
- [ ] วัด extra CPU, readback, memory และ p99; budget ของ enhancement ต้องต่ำกว่า headroom ที่ Batch 1–5 ประหยัดได้

### 7C. Calibrate mask เพื่อกด residual vocal โดยไม่หั่นดนตรีทั้งย่าน

- [ ] ทดลอง output-logit bias/temperature แบบ offline sweep เป็น baseline การศึกษาเท่านั้น
- [ ] ทดลอง calibration แยกตาม frequency และ reliability เฉพาะบริเวณที่ tune set ยืนยันว่า model ปล่อย vocal ซ้ำ
- [ ] ใช้ agreement/confidence gate จาก 7B เปิด suppression เพิ่มเฉพาะจุด; ห้ามลด mask ทั่วทั้งเพลง
- [ ] จำกัด delta ของ mask ต่อ bin และทำ transition ใน logit domain เพื่อกัน zipper/pumping
- [ ] ห้ามใช้ center-channel cancellation เป็น default เพราะลบ kick, bass, snare และเครื่องดนตรีกลางพร้อมเสียงร้อง
- [ ] ห้ามใช้ blanket `mask^gamma`, global threshold, min-mask หรือ hard binary mask เป็น production หากไม่มีหลักฐานว่า instrumental ไม่เสีย
- [ ] เก็บ current mask เป็น fallback ต่อ frame เมื่อ confidence ต่ำหรือข้อมูล context ไม่ครบ

### 7D. Gate สำหรับคำว่า “ตัดเสียงร้องดีขึ้น”

- [ ] residual-vocal metric ต้องดีขึ้นทั้ง median และ hard-case percentile ไม่ใช่ชนะเพียงบางเพลง
- [ ] instrumental metrics ต้องไม่ถอยเกิน measurement tolerance ที่ล็อกไว้ใน Batch 0
- [ ] blind A/B ต้องยืนยันว่าเสียงร้องลดลงโดยไม่มีผู้ฟังจับได้ว่าเครื่องดนตรี, ambience, stereo หรือ transient แย่ลง
- [ ] ทดสอบต่อเนื่อง 30 นาทีและทุก interruption case เพื่อกัน cache ข้ามเพลงหรือ mask เก่าหลุด
- [ ] Web และ GO ต้องให้ผล PCM เท่ากันภายใน numerical tolerance เมื่อใช้ candidate/config เดียวกัน
- [ ] ถ้าไม่มี candidate ผ่าน ให้คงคุณภาพ current model และเก็บเฉพาะ speed/latency wins จาก Batch 1–5

## Batch 8 — ปรับ weights/model เพื่อให้ตัดร้องดีขึ้นที่ runtime cost เดิมหรือต่ำกว่า

นี่เป็นงานวิจัยแยก branch และไม่ใช่สิ่งที่รับประกันได้จาก weights ปัจจุบัน แต่มีทางทำให้ inference graph ขนาดเดิมรันด้วยจำนวน operations เท่าเดิม แล้วให้ weights ใหม่เน้น residual-vocal suppression มากขึ้น

### 8A. Architecture-preserving fine-tune — เป้าหมาย runtime เท่าเดิม

- [ ] reconstruct trainable architecture ให้ตรง TF.js/ONNX graph ปัจจุบันและ import weights แบบ layer-exact
- [ ] ยืนยันก่อน train ว่า logits จาก trainable graph ตรง production model
- [ ] initialize จาก weights ปัจจุบัน ไม่ train ใหม่จากศูนย์
- [ ] ใช้ clean licensed stems เป็น ground truth; output จาก `ai remove` หรือ teacher อื่นใช้เป็น soft target ได้แต่ห้ามถือเป็น ground truth
- [ ] สร้าง teacher offline แบบหลาย model/context ได้ เพราะต้นทุน teacher เกิดตอน train ไม่ตามไปใน production
- [ ] ใช้ asymmetric objective แยกสองด้าน: ลงโทษ residual vocal และลงโทษ instrumental removal คนละ term
- [ ] เพิ่ม multi-resolution STFT/time-domain loss, stereo coherence, transient และ loudness preservation
- [ ] hard-case mining ให้ sample ที่ current model ปล่อยร้องหลงถูกเห็นบ่อยขึ้น โดยไม่ทิ้งเพลงที่ current model ทำดีอยู่แล้ว
- [ ] เริ่มจาก tune เฉพาะ output head แล้วค่อย unfreeze decoder/full model พร้อม learning rate ต่ำ เพื่อลด catastrophic regression
- [ ] ใช้ current model consistency loss กับเพลงที่ไม่มี stems เพื่อกันพฤติกรรมทั่วไปถอย
- [ ] export กลับเป็น input/output shape, op set และ static graph ขนาดเดิม
- [ ] ยืนยัน MACs, inference count, tensor sizes และ runtime latency ไม่เพิ่มจาก baseline
- [ ] ใช้ weights ใหม่ต่อเมื่อ final-blind ชนะเรื่อง vocal leakage และไม่แพ้เรื่อง instrumental preservation

การศึกษาด้าน singing-voice separation ชี้ว่าคุณภาพและความหลากหลายของ training data มีผลโดยตรง และ self-training สามารถใช้ข้อมูลไม่มี label ช่วยได้ แต่ผลกับโมเดลนี้ยังต้องพิสูจน์เอง: [training-data study](https://arxiv.org/abs/1906.02618), [noisy self-training](https://arxiv.org/abs/2102.07961)

### 8B. Distill ให้เบากว่าเดิมหลังได้ teacher ที่ดีกว่า

- [ ] ใช้ candidate 8A หรือ offline ensemble ที่ผ่าน quality gate เป็น teacher
- [ ] train student ด้วย teacher logits + clean-stem objectives ไม่เลียนแบบ teacher อย่างเดียว
- [ ] ทดลอง structured channel pruning 10/20/30% และ fine-tune ทุกระดับ
- [ ] ทดลอง low-rank/depthwise factorization เฉพาะ layer ที่ profiler ชี้ว่าแพง
- [ ] export static-shape Web/ONNX variants และวัดจริงบน GTX 1050 Ti + Apple
- [ ] เลือก Pareto point ที่ vocal suppression/instrument preservation ไม่ต่ำกว่า 8A แต่ใช้ p99/joules น้อยกว่า
- [ ] ถ้า student เบาลงแต่คุณภาพต่ำกว่า current production ให้ reject แม้ benchmark เร็วมาก

### 8C. Complex/phase-aware model — ทางเลือกสุดท้ายถ้า magnitude mask ชนเพดาน

- [ ] วัด oracle-mask ceiling ก่อน เพื่อพิสูจน์ว่า artifact หลักมาจาก mixture phase/magnitude-mask limitation จริง
- [ ] ทดลอง complex ratio mask หรือ phase-aware output เป็น model ใหม่แยกจาก production baseline
- [ ] นับต้นทุน output channels, complex DSP, memory traffic และ latencyทั้งหมด ไม่ดูเฉพาะ MACs ของ backbone
- [ ] distill phase-aware teacher กลับสู่ model ขนาดเดิมก่อนพิจารณาเพิ่ม runtime cost
- [ ] เปิดใช้เฉพาะเมื่อคุณภาพ vocal removal ดีขึ้นชัดและเครื่องดนตรีไม่เสียบน Apple/GTX 1050 Ti

งานด้าน complex masks รายงานว่าข้อมูล phase สามารถช่วยการแยกเสียงร้อง/ดนตรีได้ แต่ต้องเปลี่ยนเป้าหมายการทำนายและ retrain จึงไม่ใช่ optimization ฟรี: [complex ratio masking for singing voice separation](https://arxiv.org/abs/2011.02008), [learned complex masks for source separation](https://arxiv.org/abs/2103.12864)

หากไม่มี licensed stems, trainable graph หรือผลฟัง blind ที่เพียงพอ ให้หยุด Batch 8 และห้ามเดาว่า weights ใหม่ดีกว่า

## 5. Priority / ผลตอบแทนที่คาด

| Priority | งาน | ผลหลัก | คุณภาพ | ความเสี่ยง |
| --- | --- | --- | --- | --- |
| P0 | DirectML options ให้ถูก | Windows ใช้ GPU ได้จริง/ไม่ fallback แปลก | exact | ต่ำ |
| P0 | GO bounded backlog + generation | ไม่หน่วงสะสม/ไม่เล่นเสียงเก่า | exact | กลาง |
| P0 | Correct delayed silence gate | ตัด state/timeline bug และ raw leak | ดีขึ้น | กลาง |
| P0 | Adaptive jitter buffer | ลด latency หลายร้อย ms เมื่อมี headroom | signal เดิม | กลาง |
| P1 | Worklet/GO buffer pools + RT fast paths | ลด GC/jitter/CPU | exact | ต่ำ–กลาง |
| P1 | Backend autotune | เลือก GPU path ที่เร็ว/เบาจริงต่อเครื่อง | numerical-equivalent | กลาง |
| P1 | Fused small output head | ลด readback/postprocess โดยเฉพาะ GO | numerical-equivalent | กลาง |
| P1 | ROI-specialized graph | ลด model compute โดย weights เดิม | strict-equivalent | สูง |
| P2 | Real FFT + fused mask/iFFT | ลด DSP CPU | strict-equivalent | กลาง |
| P2 | CoreML V2/static/FastPrediction/cache | Apple latency/energy/startup | numerical-equivalent | กลาง |
| P3 | FP16/mixed precision | อาจลด compute/RAM/power บาง GPU | ต้องพิสูจน์ | กลาง–สูง |
| P3 | Overlap consensus/calibration | ลดเสียงร้องหลงโดยไม่เพิ่ม inference | ต้องพิสูจน์ | สูง |
| P3 | Architecture-preserving fine-tune | ลดเสียงร้องหลงด้วย runtime graph ขนาดเดิม | ต้อง retrain/พิสูจน์ | สูง |
| P4 | INT8 | อาจดีบน CPU/ฮาร์ดแวร์เฉพาะ | lossy | สูง |
| P4 | Distillation/pruning | เบากว่าเดิมจาก teacher ที่คุณภาพดีกว่า | ต้อง retrain | สูงมาก |
| P4 | Complex/phase-aware model | อาจข้ามเพดาน magnitude mask | ต้องเปลี่ยน model | สูงมาก |

## 6. แผนทดสอบ Apple + Windows

### Apple

- [ ] Web: TF.js WebGPU vs WebGL vs ORT WebGPU
- [x] GO: CoreML V2 `NeuralNetwork` benchmarked on Apple Silicon: `ALL` is the production default (~47 ms median in this run); `MLProgram` is incompatible with the current model's AvgPool export
- [ ] วัด CPU package/GPU/ANE energy, memory, thermal throttling และ 30-minute drift
- [ ] ทดสอบ Apple Silicon อย่างน้อยหนึ่งรุ่น และ Intel Mac ถ้ายังอยู่ใน support scope

### Windows

- [ ] GTX 1050 Ti: DirectML FP32 เป็น baseline สำคัญ
- [ ] Web: WebGPU vs packed WebGL และ background interruption
- [ ] GO: DirectML correct options, provider coverage, CPU fallback และ bounded backlog
- [ ] ทดสอบ browser/driver version ที่ผู้ใช้ใช้งานจริง
- [ ] ทดสอบ integrated GPU/หลาย GPU เพื่อยืนยัน adapter index ไม่ผิด
- [ ] ทดสอบพร้อม YouTube page load + เกม/โปรแกรม GPU load ที่ทำซ้ำได้

### ทุกเครื่อง

- [ ] เพลงต่อเนื่องอย่างน้อย 30 นาที
- [ ] pause/seek/change song/sustained silence/missing input
- [ ] hide popup, scroll, switch tab และ extension UI ปิดอยู่
- [ ] สลับ Karaoke/Acapella/Bypass และ Web/GO หลายรอบ
- [ ] ไม่มี memory/tensor/pending map/socket queue โตตามเวลา
- [ ] output latency กลับลง ceiling หลัง spike โดยไม่ต้องปิด–เปิด Karaoke ใหม่

## 7. Acceptance gate ต่อ Batch

ทุก Batch ต้องส่งมอบพร้อมกันเป็นกลุ่มตามคำขอ ไม่หยุดให้ผู้ใช้ test ทีละ checkbox ย่อย

- [ ] automated tests ผ่าน
- [ ] golden model/mask/PCM comparison ผ่าน
- [ ] build Web extension + Windows/macOS GO จาก source ชุดเดียวกัน
- [ ] benchmark report เทียบ baseline แบบ A/B
- [ ] smoke test ก่อนส่งให้ผู้ใช้
- [ ] ผู้ใช้ฟังจริง Apple + Windows หลังจบทั้ง batch
- [ ] ทำ `[x]` เฉพาะงานที่ implement และตรวจแล้วจริง
- [ ] ถ้า batch ไม่ผ่าน quality gate ให้ rollback candidate ทั้งกลุ่มหรือปิดด้วย feature flag
- [ ] GO safety gate ต้องผ่านก่อน quality/latency improvement ใด ๆ จะถูกนำไปใช้จริง

## 8. ลำดับแนะนำจริง

1. **Batch 0** — ล็อกเสียงปัจจุบันและเครื่องมือวัด
2. **Batch 1** — แก้ DirectML, silence timeline, GO backlog และ adaptive latency
3. **Batch 2** — ทำ realtime path allocation-free และลด UI/IPC overhead
4. **Batch 3A/3B** — fused output + exact ROI graph specialization
5. **Batch 4** — backend/provider tournament และ cache winner ต่อเครื่อง
6. **Batch 5** — FFT/DSP หลัง profiler ยืนยันว่าคุ้ม
7. **Batch 7A/7B** — ล็อก vocal-leak benchmark แล้วทดลอง overlapping predictions ที่ไม่เพิ่ม inference
8. **Batch 7C** — mask calibration เฉพาะ candidate ที่ consensus ผ่าน
9. **Batch 8A** — fine-tune architecture เดิมเพื่อเพิ่ม vocal suppression ที่ runtime cost เดิม
10. **Batch 6/8B** — precision และ lighter student แยก branch หลังมี baseline/teacher ที่เชื่อถือได้
11. **Batch 8C** — complex/phase-aware model เฉพาะเมื่อพิสูจน์ว่า magnitude-mask เดิมชนเพดาน

## 9. คำตอบตรง ๆ ว่ารีดได้อีกไหม

**ได้อีก** และส่วนที่น่าจะรู้สึกได้มากที่สุดไม่จำเป็นต้องลดคุณภาพ:

1. GO มี latency buffer เกินจำเป็นและไม่มี bounded backlog
2. DirectML session options ปัจจุบันไม่ตรงข้อกำหนด provider
3. Web/GO ยังสร้าง output 64 frames ทั้งที่ใช้ 15/16 frames
4. Web เลือก backend แบบตายตัวแทนการวัดต่อเครื่อง
5. AudioWorklet/GO ยังมี allocation, copy และ UI telemetry ที่ตัดออกได้
6. Rolling-window model คำนวณข้อมูลซ้ำจำนวนมาก; ROI graph และ activation-cache feasibility ยังไม่ถูกรีด

สิ่งที่ยังรับรองไม่ได้ก่อนทดลองคือ FP16/INT8/pruning จะเร็วและเสียงเท่าเดิมทุกเครื่อง โดยเฉพาะ GTX 1050 Ti ดังนั้น production win รอบแรกควรมาจาก exact graph, scheduling, provider และ memory/IPC ก่อน แล้วค่อยเปิด numerical candidate เฉพาะฮาร์ดแวร์ที่ผ่าน quality gate

ส่วนโอกาสทำให้ **ตัดเสียงร้องดีกว่าเดิม** มีอยู่สองระดับที่ไม่จำเป็นต้องเพิ่ม inference cost หลัก:

1. ใช้ prediction ของ absolute frame เดียวกันจาก rolling windows ที่โมเดลคำนวณไปแล้ว เพื่อกดเฉพาะ residual vocal ที่หลาย context เห็นตรงกัน
2. fine-tune weights ใน architecture เดิมด้วย objective ที่แยก residual-vocal suppression ออกจาก instrumental preservation ทำให้จำนวน operations ตอนใช้งานเท่าเดิม

ทั้งสองระดับยังเป็นสมมติฐานจนกว่าจะผ่าน stem metrics และ blind A/B เท่านั้น ห้ามเปิด production เพราะฟังเพลงตัวอย่างไม่กี่เพลงแล้วรู้สึกว่าดีขึ้น
