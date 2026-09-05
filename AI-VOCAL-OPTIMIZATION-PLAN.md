# แผนปรับคุณภาพและลดภาระ AI Karaoke ฝั่ง app

วันที่: 2026-09-06 · จุดอ้างอิง: `9f73180` (`fix: stabilize browser AI vocal playback`)

สถานะปัจจุบัน:

- [x] A — ลดงานภายใน model graph โดยคง weights และผลลัพธ์เดิม พร้อม fallback และ production build
- [x] B instrumentation — เพิ่ม diagnostic สำหรับแยก model timing, queue, stale-drop, resync และ underrun
- [x] C automated checks — ตรวจ 15-hop OLA/transient fixture และ frame timing ใน baseline/candidate
- [x] D decision — ประเมิน smoothing/transient guard แล้วเลือกไม่เปิดใช้ เพราะทำให้เสียงร้องกลางหลุด
- [x] E candidate — ทำ cadence 15-hop สำหรับ browser app, ตรวจเทียบกับ baseline และ build แล้ว
- [ ] E acceptance — ยังไม่ยืนยันคุณภาพ/พลังงาน/ความนิ่งจากเพลงจริงบน Windows/Apple

A ทำแล้วใน app และ build ผ่าน ส่วน B/C automated instrumentation ผ่านแล้ว ส่วน D และ E acceptance ยังต้องฟัง/วัดบนเครื่อง Windows/Apple และเพลงจริง

ผลของ A ที่ตรวจแล้ว: graph เดิม 485 nodes เหลือ 461 nodes ในเส้นทางที่ปรับระหว่างโหลดโมเดล, weights ไม่เปลี่ยน, mask และ PCM ตรงกับ graph เดิมในชุดทดสอบ, WebGPU/WebGL ใช้งานได้ และ tensor ไม่รั่วหลัง inference การวัดเวลาบน Apple M2 ใน local browser ลดลงเล็กน้อยและมีความแกว่ง จึงยังไม่ใช่ตัวเลขประหยัดพลังงานที่รับรองสำหรับ Windows

## เป้าหมายและขอบเขต

ให้เสียงร้องหลงน้อยลง เครื่องดนตรีไม่วูบวาบ และเล่นต่อเนื่องบน Windows GTX 1050 Ti / Apple โดยไม่เพิ่ม delay เพื่อแลกคุณภาพ ผู้ใช้อนุญาตให้ลดงานคำนวณและการใช้พลังงานลงอีกได้ ถ้ายังรักษาคุณภาพเสียงไว้ได้ ไม่จำเป็นต้องใช้จนครบงบเดิม

งานนี้อยู่ใน browser AI app ส่วน GO ใช้เป็นบริบทของปัญหาการเล่นต่อเนื่อง การแก้คุณภาพจะทดลองแยกจากการจัดการ queue เพื่อระบุได้ว่าผลต่างเกิดจากอะไร

ไม่มีหลักฐานว่าการแต่งสัญญาณก่อน predict แบบใดจะทำให้ดีกับทุกเพลง จึงเริ่มจากตรวจความถูกต้องของ pipeline และลดงานซ้ำที่ยังคงสมการ/weights เดิม ก่อนทดลองสิ่งที่เปลี่ยนเสียง

## สิ่งที่ตรวจพบจากโค้ด

| ประเด็น | app ปัจจุบัน | `ai remove/serviceWorker.bundle.js` |
| --- | --- | --- |
| FFT / hop | 2048 / 512 | 2048 / 512 |
| เสียงใหม่ต่อรอบ | baseline 8192/16 hops · candidate 7680/15 hops | 7680 samples = 15 hops |
| รูปร่าง input โมเดล | `[1,1024,64,2]` | `[1,1024,64,2]` |
| การต่อ magnitude window | baseline เลื่อน 16 · candidate เลื่อน 15 โดยยังคงหน้าต่าง 64 frames | slice เริ่ม 15 เก็บ 48 เติม 16 |
| ผล mask ที่อ่านกลับ | candidate 15 frames | 18 frames |
| depth เริ่มต้น | 2: delay 1 chunk | 2; ใช้ตำแหน่ง slice และ spectrum queue คนละสูตร |
| normalization | max ของ peak 4 chunks, floor `1e-4` | max ของ rolling tensor แล้ว `divNoNan` |
| WebGL precision | ไม่บังคับ F16; ขึ้นกับ backend/device | ตั้ง `WEBGL_FORCE_F16_TEXTURES=true` |
| window | periodic Hann พร้อม COLA normalization | สูตร periodic Hann พร้อม normalization เช่นกัน |

ที่ 44.1 kHz baseline app เรียกโมเดลประมาณ 5.383 ครั้ง/วินาที ส่วน candidate 15-hop และ ai remove ประมาณ 5.742 ครั้ง/วินาที ในกรณีประมวลผลครบทุก chunk:

- baseline app เรียกโมเดลน้อยกว่าประมาณ **6.25%** เมื่อเทียบกับ cadence 15-hop
- candidate เพิ่มจำนวน inference ประมาณ **6.67%** เมื่อเทียบกับ baseline app
- นี่คือจำนวนรอบ ไม่ใช่ผลวัด watts และไม่ใช่ข้อพิสูจน์ว่า weights หรือค่าใช้จ่ายต่อ inference เท่ากัน
- ถ้าต้นทุนต่อรอบเท่าเดิมทั้งหมด การเพิ่มความถี่ไม่สามารถถือว่าฟรีได้ หากคิดเฉพาะค่า inference ต้องลดต้นทุนต่อรอบอย่างน้อย 6.25% จึงจะชดเชยความถี่ที่เพิ่มขึ้นได้ ส่วน DSP/readback และพลังงานรวมต้องวัดเพิ่ม

`ai remove/` ที่มีใน workspace ไม่มีไฟล์ model/weights และ DSP WASM ที่โหลดแยก จึงยังพิสูจน์ไม่ได้ว่าใช้ weights เดียวกัน หรือการขยับ chunk เป็นสาเหตุที่เสียงต่างกัน ต้องตรวจ timeline ของ reference เพิ่ม ไม่อนุมานจากเลข 15/16/18 เพียงอย่างเดียว

สำหรับ app ที่เลื่อนทีละ 16 frames สม่ำเสมอ max ของ 4 chunk peaks **เท่ากับ** max ของ 64 frames ที่เก็บอยู่แล้ว (เมื่อใช้ floor เดียวกัน) วิธีนี้ไม่ใช่ EMA และไม่ควรเพิ่มงาน scan normalization ทั้งหน้าต่างโดยหวังว่าจะดีขึ้น

จุดตรวจโค้ด:

- [manager: normalization, model execution, alignment, OLA](next-amp-extension/modules/ai-vocal/ai-vocal-manager.js)
- [worklet: stream boundary, queue, underrun](next-amp-extension/modules/ai-vocal/vocal-worklet.js)
- [DSP: STFT, window, magnitude floor, spectrum ring](ai-vocal-engine/src/dsp/stft_core.c)
- [sample-rate selection](next-amp-extension/offscreen.js)
- [model graph](next-amp-extension/model/model.json)

## A — ลดงานภายในโมเดลโดยรักษาการคำนวณเดิม

- [x] ตรวจพบ 12 ชุดของ `SpaceToBatchND → DepthwiseConv2dNative → BatchToSpaceND` ใน model graph เป็นรูปแบบการทำ dilated convolution โดยจัดข้อมูลไป/กลับ ใช้ dilation 4, 8, 16 และ filter 3×3

สถานะการทำ A:

- [x] อ่าน block shape, padding, crop และ filter shape จาก artifacts เดิม
- [x] แปลงเฉพาะ NHWC, stride 1, filter 3×3, channel multiplier 1 และ padding/crop ที่ตรงเงื่อนไข
- [x] รักษาน้ำหนัก, precision, receptive field, output names และขนาด tensor เดิม
- [x] ไม่แก้ไฟล์ weights และไม่ลดจำนวนเฟรมที่ predict
- [x] ถ้าโครงสร้างไม่ผ่านหรือ backend มีปัญหา ใช้ graph ต้นฉบับผ่าน fallback

การแปลงนี้ลด graph nodes ที่จัดเรียงข้อมูล 24 จุด และอาจลดงานบนบริเวณ padding ที่ถูกทิ้ง ขนาดผลประหยัดจริงขึ้นกับ kernel ของ backend ไม่ใช้จำนวน nodes เป็นเปอร์เซ็นต์ประหยัดพลังงาน

TensorFlow อธิบายความสัมพันธ์ของ space-to-batch กับ dilated operations ไว้ใน [เอกสาร `with_space_to_batch`](https://www.tensorflow.org/api_docs/python/tf/nn/with_space_to_batch) การใช้การแปลงกลับกับ graph นี้เป็นข้อเสนอจากการตรวจโค้ด ต้องยืนยันผลบน TF.js ที่ bundle อยู่จริงอีกครั้ง

เกณฑ์ทดสอบของ A:

- [x] เปรียบเทียบ logit และ sigmoid mask กับ graph เดิมในทุก frame ของชุดทดสอบ
- [x] ทดสอบ silence, sparse/dense spectrum, สัญญาณเบา และสัญญาณ stereo ที่เปลี่ยนตามเวลา
- [x] รันทดสอบ model equivalence บน CPU จนจบเป็นชุดแยกต่างหาก (silence/sparse/dense: max logit error = 0)
- [x] รัน WebGPU และ WebGL เพื่อตรวจพฤติกรรม kernel จริง
- [x] ทดสอบ output PCM หลัง mask, delay และ overlap-add ที่ depth 1–4
- [x] ตรวจ tensor count หลังประมวลผลซ้ำและหลัง dispose
- [x] วัดหลัง warmup และสลับลำดับ A/B
- [x] ไม่เปิดใช้การเปลี่ยน precision เพื่อชดเชยผล benchmark

ผลการตัดสิน A:

- [x] ผลทำนายและ PCM ตรงกับ graph เดิมในชุดทดสอบ
- [x] ใช้ optimized graph ใน app พร้อม fallback ไป graph เดิม
- [x] ใช้ optimized graph loader เดียวกันใน `debug-ai` เพื่อให้เส้นทางทดสอบตรงกับ production app
- [x] ไม่ใช้ smoothing/transient guard เพื่อกลบความต่าง เพราะการทดลองก่อนหน้าทำให้เสียงร้องหลุดเพิ่ม
- [ ] ยืนยันว่าประหยัดพลังงานจริงบน Windows/Apple จากการวัดอุปกรณ์

## B — แยกอาการดนตรีวูบวาบออกเป็นสาเหตุที่วัดได้

สถานะ B:

- [x] เวลา STFT/normalization, model+readback, iSTFT/OLA แยกจากเวลารอ queue ใน manager telemetry
- [x] absolute input/target frame, generation, queue depth, stale-drop, resync และ underrun telemetry
- [x] sample rate จริง, backend, inference p50/p95/p99 และ tensor count มีช่องรายงานใน diagnostics
- [x] มีช่องรายงาน texture precision ใน diagnostics
- [ ] เก็บค่า diagnostics จากการใช้งานจริงระหว่าง scenario ยาว
- [ ] envelope ของเครื่องดนตรีและความเปลี่ยนแปลงของ mask รอบรอยต่อ chunk

หากวูบตรง underrun/resync ให้แก้การส่งเสียงและ scheduling หากวูบแม้ประมวลผล offline ต่อเนื่องโดยไม่ตก chunk จึงตรวจ mask/model ไม่สรุปว่าเป็นโมเดลจากการฟัง realtime เพียงอย่างเดียว

- [x] คงพฤติกรรมไม่ปล่อย raw audio ระหว่าง AI underrun จาก baseline ไว้
- [ ] ตรวจว่าความเงียบชั่วคราวและ underrun ไม่เกิดขึ้นเพิ่มระหว่าง scenario จริง

## C — ตรวจ preprocessing และ frame alignment ก่อนเปลี่ยนสูตรเสียง

### C1. Sample rate และ distribution ที่โมเดลเห็น

app เลือก 44.1 kHz เป็นค่าเริ่มต้น แต่อนุญาต `auto`/อัตราอื่น การเปลี่ยน sample rate โดยใช้ FFT 2048 เดิมทำให้ bin แทนความถี่คนละค่า และทำให้รอบ inference ต่อวินาทีเปลี่ยนไป ต้องยืนยัน sample rate ที่โมเดลคาดหวังจากแหล่งฝึก/export หรือ reference ก่อนตัดสินใจ

สถานะ C1:

- [x] ตรวจจุดเลือก sample rate และยืนยันว่า app ตั้งค่าเริ่มต้น 44.1 kHz
- [ ] ทดลอง 44.1/48 kHz ด้วยสัญญาณต้นทางเดียวกันและบันทึกอัตราจริง
- [ ] วัดต้นทุนและ delay ของ resampler หากจำเป็นต้องใช้

### C2. Normalization และค่าต่ำสุดของ magnitude

ตรวจ floor `sqrt(re²+im²+1e-9)` ร่วมกับ normalization floor `1e-4` ในช่วงสัญญาณเบา ค่า magnitude ของศูนย์จากสูตรนี้ประมาณ `3.16e-5` จึงอาจกลายเป็นค่าที่ไม่เล็กเมื่อ normalize ทั้งหน้าต่างที่เบามาก แม้เส้นทาง digital-silence จะข้าม inference ในบางกรณีก็ตาม

- [x] ตรวจสูตร magnitude floor และคำนวณผลของ epsilon ต่อค่าศูนย์
- [x] ทดสอบ epsilon, digital-silence threshold และ reset ร่วมกันกับเสียงเบา
- [x] ยังไม่เปลี่ยน epsilon หรือเพิ่ม AGC/compressor/EQ/whitening/center cancellation

ไม่เพิ่ม AGC, compressor, EQ, spectral whitening หรือ center cancellation ก่อนโมเดลโดยไม่มีผล A/B วิธีเหล่านี้เปลี่ยนลักษณะ input หรือทำให้เครื่องดนตรีกลางหาย และ normalization เดิมอาจหักล้างประโยชน์ของ global gain อยู่แล้ว

### C3. Timeline และการสังเคราะห์เสียง

- [x] สร้าง 15-hop fixture ที่มี transient ตำแหน่งแน่นอนและตรวจ SNR หลัง OLA
- [x] ตรวจ mask กับ complex spectrum ของ frame เดียวกันสำหรับ depth 1–4
- [ ] ตรวจการเริ่มเพลง, seek, reset, silence และ chunk ที่ถูกทิ้ง

- [x] ตรวจ OLA tail ข้าม chunk และช่วงหลัง reset ด้วย changing mask sequence ใน delayed alignment fixture
- [ ] ตรวจสัญญาณเปลี่ยนตามเวลาและรอยต่อเพลงจริง
- [x] แยกข้อจำกัดของ SNR bypass test แล้วว่าไม่ได้วัดความสามารถตัดเสียงร้อง

- [ ] แก้ index/window หาก fixture พบข้อผิดพลาด
- [x] ยังไม่เปลี่ยน window เพียงเพราะคาดว่า `ai remove` ใช้ Hann ต่างชนิด

## D — ทดลองลดรอยต่อ mask โดยไม่เรียกโมเดลเพิ่ม

สถานะ D: รุ่น smoothing/transient guard ที่เคยทดลองถูกถอดออกแล้วหลังพบเสียงร้องกลางหลุดเพิ่ม จึงยังไม่เปิด post-process ตัวใหม่ใน production candidate

- [x] ปิดการทดลอง smoothing/transient guard ที่ทำให้เกิด central vocal bleed
- [x] เพิ่ม diagnostic-only frame-indexed continuity experiment ด้วย synthetic rolling-window fixture โดยไม่แตะ production mask
- [x] รัน diagnostic บน WebGPU/WebGL แล้ว: optimized model ให้ผลตรงกับ baseline แต่ mask ต่างกันมากเมื่อเทียบ frame เดียวกันที่ขอบหน้าต่าง จึงยังไม่เปิด smoothing
- [ ] ทำ frame-indexed continuity experiment กับเพลงจริงหลังมี fixture/เพลงจริงรองรับ

โมเดลให้ผล 64 frames แต่ baseline app อ่านใช้ 16 frames และ candidate อ่านใช้ 15 frames ต่อรอบ สามารถทดลองเก็บผลทำนายบาง frame ที่ยังไม่ได้เล่น แล้วเปรียบเทียบกับการทำนาย **frame เวลาเดียวกัน** ในรอบถัดไป ไม่เฉลี่ย mask ของเสียงคนละเวลาเหมือน smoothing รอบก่อน

- [ ] เริ่มเฉพาะ 2–3 frames รอบรอยต่อและ depth 2
- [ ] อ้างอิงด้วย absolute frame index และ generation
- [ ] ทดสอบน้ำหนักโดยใช้ผลรอบล่าสุดเป็นหลัก
- [ ] ไม่ใช้ค่า max/min หรือ stereo linking ทั้งย่านแบบตายตัว
- [ ] ทิ้งข้อมูลค้างเมื่อ mode/depth/song/engine เปลี่ยนหรือ resync
- [ ] วัดต้นทุน readback/memory จากการเพิ่ม mask frames

- [ ] ฟังและวัดว่ารอยต่อ mask ลดลงโดยไม่เพิ่มเสียงร้องกลางหรือ instrumental pumping
- [x] ถอด smoothing/transient guard รุ่นก่อนออกหลังพบว่าเสียงร้องกลางหลุดเพิ่ม

งาน [Differentiable Consistency Constraints](https://research.google/pubs/differentiable-consistency-constraints-for-improved-deep-speech-enhancement/) สนับสนุนการตรวจความสอดคล้องของ STFT/mixture แต่ผลวิจัยเป็นงาน speech enhancement ไม่ใช่หลักฐานว่าสูตร postprocess นี้จะเพิ่มคุณภาพ karaoke ของเรา การเพิ่ม projection/FFT อีกชุดต้องคิดต้นทุนแยก

## E — เมื่อใดจึงลอง cadence แบบ ai remove

- [x] ใช้ผล A ก่อนเริ่ม candidate และไม่เปิดใช้ D รุ่น smoothing ที่เคยทำให้เสียงร้องกลางหลุด
- [x] เปรียบเทียบ 16-hop baseline กับ 15-hop โดยใช้ weights เดียวกัน
- [x] ตรวจ timing/OLA ใหม่ทั้งเส้นทางด้วย baseline/candidate streaming PCM test
- [x] แยก cadence ตาม engine ใน worklet: browser `7680/15-hop`, GO `8192/16-hop`

- [x] ฟัง candidate บน Apple และ Windows GTX 1050 Ti แล้ว: ผู้ใช้รายงานว่าเร็วมากและคุณภาพเท่าเดิมหรือดีกว่าเดิม
- [ ] วัดการใช้พลังงานจริงเทียบกับ baseline app
- [x] ไม่ถือ `ai remove` เป็นตัวแทนของ app ที่เพิ่ม cadence เพราะ weights ของ reference ยังไม่ทราบ

- [ ] ตัดสินใจจากผลวัดว่าจะคง cadence เดิมหรือเพิ่ม cadence

## วิธีวัดและเกณฑ์ตัดสิน

- [x] ใช้ baseline `9f73180` และ candidate ทีละรายการด้วย input เดียวกัน
- [x] align ผล model/PCM และ delay ใน automated comparison
- [ ] align loudness และฟังเปรียบเทียบเพลงจริงโดยไม่ normalize แยกทุกช่วง

- [ ] เตรียมชุดฟังตามประเภทเสียงที่ระบุและแยกเพลงปรับค่ากับเพลงทดสอบ
- [ ] ทดสอบด้วยไฟล์/สเต็มที่มีสิทธิ์ใช้
- [x] ยังไม่อ้างตัวเลข vocal suppression จาก automated test ที่ไม่มี reference stems

- [ ] ประเมิน vocal leakage, instrumental distortion และ envelope เมื่อมี stems
- [ ] ใช้ metric เช่น SI-SDR เป็นข้อมูลประกอบร่วมกับการฟัง

| เกณฑ์ | เงื่อนไขรับงาน |
| --- | --- |
| คุณภาพ | ไม่มีเสียงร้องกลางแบบ regression รอบก่อน; เครื่องดนตรีและ stereo image ไม่เสียเพื่อแลก suppression |
| พลังงาน | วัด joules ต่อระยะเวลาที่เล่นเท่ากัน พร้อม CPU/GPU workload; เวลา infer และ GPU % เป็นเพียงตัวประกอบ |
| ความลื่น | ไม่เพิ่ม underrun/drop/resync ใน scenario เดียวกัน; การเงียบแทน raw fallback ยังนับเป็นสะดุด |
| delay | ไม่มี lookahead เพิ่มและไม่มี latency สะสมหลังเล่นนาน |
| หน่วยความจำ | tensor/queue/memory ไม่โตต่อเนื่องหลัง warmup |
| ความทำซ้ำได้ | มี baseline, backend, browser/driver, hardware, sample rate, input และผลดิบกำกับ |

- [x] ทดสอบ smoke test บน Windows GTX 1050 Ti และ Apple ที่ใช้งานจริง
- [ ] ทดสอบรอบนิ่ง 10 นาที และรอบ 30 นาทีระหว่าง hide popup/scroll/change tabs/เปลี่ยนเพลง
- [ ] ทดสอบพร้อมโหลด CPU/GPU ที่ทำซ้ำได้ และสลับ A/B อย่างน้อย 3 คู่หลังอุณหภูมินิ่ง
- [ ] แยก cold start ออกจาก steady state

- [ ] วัด joules/ระยะเวลาที่เล่น พร้อม CPU/GPU workload และความคลาดเคลื่อนของเครื่องมือ
- [ ] รายงานข้อจำกัดหากวัดกำลังไฟ GPU รุ่นเก่าโดยตรงไม่ได้

TF.js มีต้นทุน upload/readback, shader compilation และการจัดการ tensor; ใช้ warmup และ async readback ที่ app มีอยู่แล้ว ไม่เสนอซ้ำว่าเป็น optimization ใหม่ ดู [Platform and environment](https://www.tensorflow.org/js/guide/platform_environment) ทั้งนี้เอกสารมีเนื้อหาเก่าเกี่ยวกับการจัดอันดับ backend จึงใช้เฉพาะหลักการ ไม่สรุปว่า WebGL/WebGPU ใดเร็วที่สุดจากเอกสาร

## การส่งมอบและย้อนกลับ

- [x] มี source change, regression tests, benchmark และ ZIP จาก source ชุดเดียวกัน
- [x] ระบุการเปลี่ยนที่เปิดใช้จริง การทดลองที่ยังเป็นแผน และเครื่องที่ยังไม่ได้ทดสอบ

- [x] ยังไม่ commit การทดลองรวมกับงานเสถียรภาพอัตโนมัติ
- [x] คงจุดอ้างอิง `9f73180` และ queue/resync fixes เดิม
- [x] ตรวจทั้ง WASM/JS ที่แพ็กและทดสอบ ZIP ด้วย `unzip -t`

ลำดับแนะนำ: **A ลดงานโมเดลและพิสูจน์ผลเดิม → B/C ตรวจสาเหตุวูบวาบ → D ทดลองคุณภาพทีละสูตร → E cadence เพิ่มเฉพาะเมื่อผลวัดคุ้ม** หาก D/E ไม่ผ่าน ให้ใช้คุณภาพ baseline พร้อมประโยชน์ด้านประสิทธิภาพจาก A ที่ผ่านการทดสอบ
