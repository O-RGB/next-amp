# NextSona Model Builder Plan

เป้าหมายของโฟลเดอร์นี้คือสร้างโมเดลของ NextSona ใหม่จาก
`MGM_MAIN_v4.pth` ที่ดาวน์โหลดจากแหล่งทางการของ Ultimate Vocal Remover
โดยไม่อ่าน ไม่ import และไม่ใช้ไฟล์ใดจาก `ai remove/` หรือโมเดล production
ปัจจุบันเป็นวัตถุดิบในการสร้าง

> สถานะปัจจุบัน: สร้างโฟลเดอร์และแผนแล้ว แต่ยังไม่ได้เขียน converter,
> สร้างโมเดลใหม่ หรือแทนที่โมเดล production

## ผลลัพธ์ที่ต้องการ

ใช้ไฟล์ต้นทางเพียงหนึ่งชุด แล้วสร้างโมเดลสองรูปแบบ:

1. TensorFlow.js GraphModel + FP16 สำหรับ Web และ Chrome Extension
2. ONNX FP32 สำหรับ NextSona Go Engine

โมเดลจะมีอยู่สองระดับเท่านั้น:

1. **Builder artifact** — ผลลัพธ์ที่ตรวจสอบแล้วใน
   `nextsona-model-builder/dist/`
2. **Runtime artifact** — สำเนาที่คำสั่ง deploy นำไปวางในตำแหน่งที่
   NextSona ใช้งานจริง

ห้ามแก้ไฟล์ runtime ด้วยมือ เพราะจะทำให้ builder artifact กับไฟล์ที่ผู้ใช้
ได้รับไม่ตรงกัน

## แหล่งต้นทางและสิทธิ์

- Model: `MGM_MAIN_v4.pth`
- Official UVR model registry:
  <https://github.com/Anjok07/ultimatevocalremovergui/blob/master/gui_data/model_manual_download.json>
- Official public model release:
  <https://github.com/TRvlvr/model_repo/releases/tag/all_public_uvr_models>
- Original VR architecture:
  <https://github.com/tsurumeso/vocal-remover>
- UVR license/credit statement:
  <https://github.com/Anjok07/ultimatevocalremovergui/blob/master/README.md?plain=1>
- Expected source SHA-256:
  `0e6f0c0592333a3b215f61ac1e01f6c24c059f903f0789cf634e92daffae1dce`
- Expected UVR model hash (MD5 of final 10,000 KiB, matching UVR's code):
  `5a6e24c1b530f2dab045a522ef89b751`

ทุก artifact ต้องมี MIT notice ของ UVR และ tsurumeso ห้ามเปลี่ยนชื่อผู้สร้าง
ต้นฉบับเป็น NextFeeder Labs ส่วนที่ NextFeeder Labs เป็นเจ้าของคือ converter,
build pipeline และการปรับรูปแบบสำหรับ runtime เท่านั้น

## ภาษากับเทคโนโลยี

### ภาษาหลัก

- Python 3.10 สำหรับอ่าน PyTorch checkpoint, สร้าง graph และ export model
- JavaScript/Node.js สำหรับตรวจ TFJS artifact และทดสอบ inference ใน runtime
  แบบเดียวกับ Extension
- Shell script สำหรับสร้าง environment ที่ทำซ้ำได้และควบคุมลำดับ build
- Go ใช้เฉพาะ packer เดิมเพื่อเข้ารหัส ONNX หลังผ่านการตรวจสอบแล้ว

### เครื่องมือที่เสนอให้ pin version

- Python 3.10.x
- PyTorch รุ่น CPU ที่ pin แน่นอน
- NumPy 1.26.x
- TensorFlow 2.15.1
- TensorFlow.js Converter 4.22.0
- ONNX รุ่นที่ pin แน่นอน
- ONNX Runtime รุ่นที่เข้ากันกับ Go Engine
- Docker image แบบระบุ digest เพื่อให้ build ซ้ำได้

เหตุผลที่ใช้ TensorFlow 2.15.1 และ TFJS Converter 4.22.0 คือ metadata ของ
โมเดล production ปัจจุบันระบุสองรุ่นนี้ การเริ่มจาก toolchain เดียวกันช่วยลด
ความต่างของ graph และประสิทธิภาพ แต่ต้องยืนยันด้วย benchmark ไม่ใช่อาศัย
เลขเวอร์ชันเพียงอย่างเดียว

หลีกเลี่ยงเส้นทาง ONNX -> TensorFlow -> TFJS เป็นเส้นทางหลัก เพราะ converter
ONNX-to-TensorFlow บางโครงการไม่ได้ดูแลต่อแล้ว และอาจสร้าง operator ที่ช้าบน
WebGL/WebGPU เส้นทางหลักสำหรับเว็บควรเป็น PyTorch weights -> TensorFlow/Keras
implementation -> SavedModel -> TFJS GraphModel

## โครงสร้างโฟลเดอร์เป้าหมาย

```text
nextsona-model-builder/
├── NEXTSONA-MODEL-BUILDER-PLAN.md
├── README.md
├── Dockerfile
├── requirements.lock
├── package.json
├── config/
│   └── mgm-main-v4.json
├── licenses/
│   ├── UVR-MIT.txt
│   └── TSURUMESO-MIT.txt
├── source/
│   ├── SOURCE.json
│   └── MGM_MAIN_v4.pth          # downloaded, ignored by Git
├── src/
│   ├── download_source.py
│   ├── uvr_v4_torch.py
│   ├── uvr_v4_tensorflow.py
│   ├── weight_mapping.py
│   ├── export_saved_model.py
│   ├── export_onnx.py
│   └── generate_provenance.py
├── scripts/
│   ├── build.sh
│   ├── verify.sh
│   ├── deploy.sh
│   └── clean.sh
├── test/
│   ├── deterministic_inputs.py
│   ├── verify_pytorch_tensorflow.py
│   ├── verify_onnx.py
│   ├── verify_tfjs.mjs
│   └── verify_runtime_audio.mjs
├── work/                           # temporary, ignored by Git
└── dist/
    └── mgm-main-v4/
        ├── tfjs/
        │   ├── model.json
        │   └── group1-shard1of1.bin
        ├── onnx/
        │   └── model.onnx
        ├── MODEL-LICENSE.txt
        ├── PROVENANCE.json
        ├── SHA256SUMS
        └── VERIFICATION.json
```

## ตำแหน่งที่ NextSona ใช้งานจริง

### Web และ Extension

คำสั่ง deploy ต้อง copy แบบ atomic จาก:

```text
nextsona-model-builder/dist/mgm-main-v4/tfjs/
```

ไปยัง:

```text
nextsona-extension/model/
```

ไฟล์ที่ deploy:

- `model.json`
- `group1-shard1of1.bin`
- `LICENSE` ซึ่งสร้างจาก `MODEL-LICENSE.txt`

หน้าเว็บและ Extension ใช้ source runtime ชุดเดียวกันอยู่แล้ว เพราะ
`scripts/build-web.js` และ `scripts/build-prod.js` อ่านโมเดลจาก
`nextsona-extension/model/`

### Go Engine

คำสั่ง deploy ต้อง copy:

```text
nextsona-model-builder/dist/mgm-main-v4/onnx/model.onnx
```

ไปยัง:

```text
nextsona-engine-go/model.onnx
```

หลังจากนั้นจึงเรียก packer เดิมให้สร้าง:

```text
nextsona-engine-go/assets/model.enc
```

การเข้ารหัสเป็นเพียงการป้องกันการคัดลอกไฟล์ ไม่ได้เปลี่ยนสิทธิ์ของ UVR
ดังนั้น Go distribution ยังต้องมี `MODEL-LICENSE.txt` อยู่ข้าง executable
หรือมีวิธีให้ผู้ใช้เปิดอ่าน notice ได้

### สำเนาเดิมใน AI engine

ปัจจุบันมีโมเดลซ้ำอยู่ที่:

- `ai-vocal-engine/demo/model/`
- `ai-vocal-engine/src/model/reference/`

ก่อนจบงานต้องปรับ demo/test ให้ใช้
`nextsona-extension/model/` หรือรับ model URL จาก environment แล้วนำ binary
ซ้ำสองตำแหน่งนี้ออก หลัง migration แล้วจะเหลือ source of truth เพียง builder
artifact และ runtime artifact ตามที่กำหนดไว้ข้างต้น

## คำสั่งที่ต้องเพิ่มใน root package.json

```json
{
  "scripts": {
    "model:fetch": "bash nextsona-model-builder/scripts/build.sh --fetch-only",
    "model:build": "bash nextsona-model-builder/scripts/build.sh",
    "model:verify": "bash nextsona-model-builder/scripts/verify.sh",
    "model:deploy": "bash nextsona-model-builder/scripts/deploy.sh",
    "model:build:deploy": "npm run model:build && npm run model:verify && npm run model:deploy"
  }
}
```

พฤติกรรมคำสั่ง:

- `npm run model:fetch` ดาวน์โหลดจาก UVR และตรวจ hash แต่ไม่สร้างโมเดล
- `npm run model:build` สร้าง TFJS และ ONNX ลง builder `dist/` เท่านั้น
- `npm run model:verify` ตรวจ tensor, output, graph, license และ performance
- `npm run model:deploy` ยอม copy เฉพาะ artifact ที่มี
  `VERIFICATION.json` สถานะผ่านและ hash ตรง
- `npm run model:build:deploy` เป็นคำสั่งเดียวสำหรับสร้าง ตรวจ และ copy ไปยัง
  NextSona ทั้ง Web/Extension และ Go

ห้ามให้ `model:build` เขียนทับ production ทันที หาก converter พังจะได้ไม่ทำ
ให้ Extension และ Go ใช้งานไม่ได้ การ deploy ต้องเกิดหลัง verify เท่านั้น

## ขั้นตอนการสร้าง

### Phase 1 — Bootstrap และ reproducibility

- [x] เพิ่ม `Dockerfile` ที่ pin Python และ base-image digest
- [ ] เพิ่ม `requirements.lock` พร้อม hash ของทุก dependency
- [x] เพิ่ม `.gitignore` สำหรับ `source/*.pth`, `work/` และ `dist/`
- [x] ทำให้ build ทำงานแบบ CPU-only เพื่อให้ผลไม่ขึ้นกับ GPU ของเครื่อง build
- [x] ตั้งค่า random seed และ deterministic operations
- [x] บันทึก OS, architecture, Python และ dependency versions ลง provenance

### Phase 2 — ดาวน์โหลดต้นทางอย่างถูกต้อง

- [x] เขียน `download_source.py` ให้ดาวน์โหลดเฉพาะ URL ทางการ
- [x] ตรวจ SHA-256 เต็มไฟล์ก่อนเปิด checkpoint
- [x] ตรวจ UVR final-10,000-KiB MD5 เพิ่มอีกชั้น
- [x] ปฏิเสธ redirect ไป domain ที่ไม่ได้อนุญาต
- [x] บันทึก URL, hash, ขนาดไฟล์และเวลาที่ดาวน์โหลดใน `SOURCE.json`
- [x] ห้าม fallback ไปอ่าน `ai remove/` หรือโมเดล production ปัจจุบัน
- [x] เก็บ license และ URL ของ upstream ที่ใช้ใน build evidence

### Phase 3 — สร้าง PyTorch reference จาก upstream

- [x] นำสถาปัตยกรรม v4 จาก tsurumeso ที่เป็น MIT มาใช้โดยเก็บ notice เดิม
- [x] โหลด `MGM_MAIN_v4.pth` ด้วย `map_location="cpu"`
- [x] ตรวจว่า inference key ถูกใช้ครบ โดย allowlist เฉพาะ auxiliary training heads
- [x] ปฏิเสธ missing keys, unexpected keys และ shape mismatch
- [x] ตั้ง model เป็น `eval()`
- [x] กำหนด input ภายนอกเป็น NHWC `[1, 1024, 64, 2]`
- [x] ภายใน wrapper แปลง NHWC เป็น NCHW ให้ PyTorch และแปลง output กลับ NHWC
- [x] สร้าง deterministic fixture จากสัญญาณสังเคราะห์และเก็บ expected output

### Phase 4 — สร้าง TensorFlow/Keras graph

- [x] เขียน CascadedASPPNet v4 ด้วย TensorFlow/Keras จากสถาปัตยกรรม upstream
- [x] ใช้ input/output `[1, 1024, 64, 2]`
- [x] map Conv2d จาก OIHW เป็น TensorFlow HWIO
- [x] fold BatchNorm เข้า kernel/bias ด้วยสูตรมาตรฐาน
- [x] map depthwise convolution อย่างชัดเจนทุก layer
- [x] รักษา padding, dilation, slicing, concatenation และ bilinear resize
- [x] ระบุ `align_corners`/coordinate behavior ให้ตรงกับ PyTorch
- [x] ตรวจว่า floating inference tensor ทุกตัวถูกใช้เพียงครั้งเดียว
- [x] ห้ามใช้ graph, tensor names หรือไฟล์ model ปัจจุบันเป็น template
- [x] export เป็น TensorFlow SavedModel ที่มี signature ชื่อ `serving_default`
- [x] ตั้ง input tensor ชื่อ `input` และ output ให้ NextSona หาได้แน่นอน

### Phase 5 — สร้าง TFJS FP16

ใช้ TensorFlow.js Converter จาก SavedModel:

```bash
tensorflowjs_converter \
  --input_format=tf_saved_model \
  --output_format=tfjs_graph_model \
  --signature_name=serving_default \
  --saved_model_tags=serve \
  --quantize_float16 \
  --weight_shard_size_bytes=33554432 \
  work/saved_model \
  dist/mgm-main-v4/tfjs
```

- [x] Pin TensorFlow.js Converter เป็น 3.18.0 ซึ่งเป็นรุ่นที่ builder ทดสอบจริง
- [x] ใช้ `--quantize_float16` ไม่ใช้ uint8/uint16
- [x] ให้ผลลัพธ์เป็น shard เดียวเพื่อคงรูปแบบการโหลดที่ NextSona ใช้อยู่
- [x] ตรวจว่า `model.json` ระบุ `graph-model`
- [x] ตรวจ input/output shape และ dtype
- [x] ตรวจว่า float weights ทุกตัวมี metadata `float16`
- [ ] โหลดด้วย `tf.loadGraphModel()` สำเร็จบน CPU, WebGL และ WebGPU
- [ ] warm up อย่างน้อยสองรอบก่อนวัด latency

### Phase 6 — สร้าง ONNX สำหรับ Go

- [x] Export จาก PyTorch wrapper ต้นทางเดียวกัน
- [x] ใช้ static input/output shape `[1, 1024, 64, 2]`
- [x] ตั้ง input ชื่อ `input` และ output ชื่อที่ Go รองรับ
- [x] ใช้ opset ที่ ONNX Runtime ใน Go รองรับและ pin ไว้ใน config
- [x] รัน ONNX checker
- [x] รัน inference ด้วย ONNX Runtime CPU
- [x] เปรียบเทียบ output กับ PyTorch reference
- [x] ทดสอบ `rewriteONNXOutputWindow` ของ Go กับโมเดลใหม่
- [x] copy ไป `nextsona-engine-go/model.onnx` หลัง verify เท่านั้น
- [x] เรียก Go packer เพื่อสร้าง `assets/model.enc`
- [ ] ทดสอบ Apple/CoreML, Windows/DirectML และ CPU fallback

## เกณฑ์ตรวจความเท่าเทียม

### Tensor และ graph

- [x] state-dict inference-key coverage เท่ากับ 100% (ยกเว้น auxiliary training heads ที่ระบุชื่อไว้)
- [x] ไม่มี missing หรือ unexpected inference tensor
- [x] TensorFlow FP32 เทียบ PyTorch FP32:
  mean absolute error ไม่เกิน `1e-5` และ max error ไม่เกิน `1e-3`
- [x] ONNX FP16-rounded/FLOAT เทียบ PyTorch FP32: MAE ไม่เกิน `1e-3`,
  max error ไม่เกิน `0.35` และ cosine similarity อย่างน้อย `0.99998`
- [x] TFJS FP16 เทียบ TensorFlow FP32:
  cosine similarity อย่างน้อย `0.99998`
- [x] TFJS FP16 mean absolute error ไม่เกิน `1e-3`
- [x] Output ทุกค่า finite และ mask อยู่ในช่วงที่ pipeline รองรับ

เกณฑ์ตัวเลขสามารถเข้มขึ้นหลังได้ baseline จริง แต่ห้ามผ่อนเกณฑ์เพียงเพื่อให้
build ผ่านโดยไม่มีคำอธิบายและ listening test

### คุณภาพเสียง

- [ ] ใช้เพลงทดสอบที่มีสิทธิ์ถูกต้องหรือสัญญาณสังเคราะห์เท่านั้น
- [ ] รัน DSP เดิมด้วย output mask จากโมเดลใหม่
- [ ] เปรียบเทียบ vocal attenuation, instrumental retention และ pumping
- [ ] ไม่มีเสียงหุ่นยนต์หรือวูบวาบเพิ่มขึ้นจาก production
- [ ] ไม่มีการเปลี่ยน processing depth, 64-frame context หรือ STFT ในงานนี้
- [ ] ทำ blind listening test บนชุดเพลงเดิม
- [ ] โมเดลใหม่ต้อง “ไม่แย่กว่า” production ก่อน deploy

### ประสิทธิภาพ

- [x] ขนาดดาวน์โหลดไม่เพิ่มเกินงบที่กำหนด
- [x] จำนวน graph nodes ไม่เพิ่มผิดปกติ
- [ ] latency หลัง warmup ไม่แย่กว่า production อย่างมีนัยสำคัญ
- [ ] memory/GPU usage ไม่เพิ่ม
- [ ] ทดสอบ Apple Metal/WebGPU, Windows WebGPU และ WebGL fallback
- [ ] ทดสอบระยะยาวและเปลี่ยนเพลงอย่างน้อย 30 นาที

## การ deploy อย่างปลอดภัย

`deploy.sh` ต้องทำตามลำดับนี้:

1. ตรวจว่า builder dist มีไฟล์ครบ
2. อ่าน `VERIFICATION.json` และปฏิเสธ artifact ที่ยังไม่ผ่าน
3. ตรวจ SHA-256 กับ `SHA256SUMS`
4. ตรวจว่า license/provenance อยู่ครบ
5. copy ไป temporary directory ใน target
6. โหลดโมเดลจาก temporary directory และทดสอบหนึ่ง inference
7. เปลี่ยน directory แบบ atomic
8. copy ONNX ไป Go และเรียก packer
9. รัน `npm run audit:copyright`
10. รัน Store build และ Go model tests
11. บันทึก deployed hashes ลง `MODEL-PROVENANCE.md`

หากขั้นใดล้มเหลว ต้องหยุดและเก็บโมเดล production เดิมไว้ ห้าม deploy
บางไฟล์ เช่นเปลี่ยน `model.json` แต่ยังใช้ weights เก่า

## License ที่ต้องติดไปกับผลลัพธ์

- [x] ชื่อโมเดล `MGM_MAIN_v4`
- [x] เครดิต Ultimate Vocal Remover, Anjok07 และ aufr33
- [x] เครดิต tsurumeso สำหรับ original VR architecture
- [x] ข้อความ MIT License และ copyright notices
- [x] URL ของ upstream source/model registry
- [x] ข้อความ “Converted to TensorFlow.js/ONNX by NextFeeder Labs”
- [x] ข้อความว่าไม่ได้รับการรับรองหรือเป็นพันธมิตรกับ upstream
- [x] source hash, output hashes และ tool versions
- [x] notice ต้องอยู่ใน Chrome Store ZIP และ Go distribution

## สิ่งที่ห้ามทำ

- [x] ห้ามอ่านไฟล์จาก `ai remove/`
- [x] ห้ามใช้ model.json หรือ weights ปัจจุบันเป็น template ใน converter
- [x] ห้ามแก้ byte หรือสลับลำดับ tensor เพียงเพื่อให้ hash แตกต่าง
- [x] ห้ามอ้างว่า NextFeeder Labs เป็นผู้สร้างหรือฝึก `MGM_MAIN_v4`
- [x] ห้ามลบ MIT notice เมื่อ obfuscate/encrypt/package
- [x] ห้าม deploy หาก parity, listening หรือ long-run test ไม่ผ่าน
- [x] ห้ามเปลี่ยน DSP และ model conversion พร้อมกัน เพราะจะหาสาเหตุไม่ได้

## Definition of Done

- [x] สร้างโฟลเดอร์ builder และเอกสารแผน
- [ ] Build ทำงานจาก official UVR file ใน environment ใหม่ได้
- [x] Build ไม่เข้าถึง `ai remove/` และ production model เดิม
- [x] สร้าง TFJS FP16 และ ONNX จากต้นทางเดียวกันได้
- [x] ทุก tensor และทุก output ผ่าน parity test
- [ ] คุณภาพเสียงและ latency ไม่แย่กว่า production
- [x] `npm run model:build:deploy` สร้าง ตรวจ และ copy ได้ครบ
- [x] Web, Extension และ Go ใช้ artifact ที่มี provenance เดียวกัน
- [x] ไม่มี binary model ซ้ำที่แก้ด้วยมือใน repository
- [x] Store ZIP และ Go distribution มี license/credit ครบ
- [x] บันทึก build log, hashes และ verification report แล้ว
