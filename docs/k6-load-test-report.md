# รายงาน K6 Load Test — RIMS Menu Catalog

วันที่ทดสอบ: 8 กันยายน 2026

Branch: `Achiraya`

Feature: การโหลดรายการเมนูพร้อมคำนวณจำนวนเสิร์ฟจากสต็อก (`GET /menu-items`)

## เกณฑ์และรูปแบบการทดสอบ

- K6 `v2.2.0` ยิงไปที่ API ในเครื่องซึ่งเชื่อมต่อฐานข้อมูล Supabase จริง
- เพิ่มโหลดจาก 0 ไปยัง VUs เป้าหมายภายใน 10 วินาที, คงโหลด 20 วินาที, แล้วลดโหลด 5 วินาที
- จำลองผู้ใช้แต่ละคนโหลดรายการเมนูประมาณหนึ่งครั้งต่อวินาที (`THINK_TIME_SECONDS=1`)
- เกณฑ์ผ่าน: error rate ต่ำกว่า 1% และ p95 response time ต่ำกว่า 500 ms
- เป็น read-only load test จึงไม่สร้างหรือแก้ข้อมูลธุรกิจ

## ผลหลังแก้ไข

| Target VUs | Requests | Throughput | Avg | p95 | Max | Error rate | ผล |
|---:|---:|---:|---:|---:|---:|---:|:---|
| 300 | 7,993 | 222.10 req/s | 51.40 ms | 75.49 ms | 252.76 ms | 0.00% | ผ่าน |
| 325 | 8,357 | 231.98 req/s | 89.94 ms | 204.65 ms | 440.96 ms | 1.62% | ไม่ผ่าน |
| 350 | 8,647 | 240.65 req/s | 133.89 ms | 255.71 ms | 676.02 ms | 2.97% | ไม่ผ่าน |

สรุปตามเกณฑ์นี้ ระบบรองรับได้อย่างน้อย **300 VUs** และเริ่มมีประสิทธิภาพลดลงที่ **325 VUs** เนื่องจาก error rate เกิน 1% แม้ p95 ของคำขอที่ตอบสำเร็จยังต่ำกว่า 500 ms

## Feature ที่พบปัญหา

Feature รายการเมนูเป็นจุดที่พบปัญหา เพราะทุก request ต้องรวมข้อมูลเมนู สูตรวัตถุดิบ และ stock lot เพื่อคำนวณ `availableServings` จากฐานข้อมูลจริง เมื่อเกิน 300 VUs throughput เพิ่มขึ้นเพียงเล็กน้อย แต่ error rate เริ่มสูงขึ้น แสดงว่าเส้นทาง API/ฐานข้อมูลเริ่มอิ่มตัว

การแก้ไขที่ทำแล้ว:

1. เปลี่ยน SQL จาก correlated `LATERAL` aggregation ที่คำนวณ stock ซ้ำ เป็นการรวม stock ต่อวัตถุดิบหนึ่งครั้งแล้ว join กลับ
2. เพิ่มเงื่อนไข `quantity_remaining > 0` เพื่อให้ query ใช้ partial index ของ `stock_lots` ได้
3. ทำขนาด PostgreSQL connection pool และ connection timeout ให้กำหนดผ่าน env ได้ โดยคงค่าเริ่มต้นที่ปลอดภัย 10 connections
4. เพิ่ม `pool.on('error')` เพื่อป้องกัน idle database connection error กลายเป็น uncaught event ที่ทำให้ Node process หยุด

หลังแก้ 300 VUs มี p95 75.49 ms และ error 0% เทียบกับรอบสำรวจก่อนแก้ที่ 300 VUs มี p95 ประมาณ 431–670 ms

## วิธีรันซ้ำ

เปิด API ที่ port 3000 ก่อน แล้วรันจาก root ของ repository:

```powershell
k6 run --quiet `
  -e BASE_URL=http://127.0.0.1:3000 `
  -e VUS=300 `
  -e DURATION=20s `
  -e RAMP_UP=10s `
  -e RAMP_DOWN=5s `
  -e THINK_TIME_SECONDS=1 `
  tests/k6/menu-catalog.js
```

## ขั้นตอนสาธิตแบบทีละขั้น

ให้เปิด PowerShell 2 หน้าต่าง และรันตามลำดับ โดยรอให้แต่ละรอบจบก่อนเริ่มรอบถัดไป

### Step 1: เปิด API

ในหน้าต่างที่ 1:

```powershell
cd C:\Users\Asus\Documents\rims
.\node_modules\.bin\tsx.cmd watch apps/api/src/index.ts
```

ถ้า API เปิดอยู่แล้วที่ port 3000 ให้ข้ามขั้นตอนนี้ได้

### Step 2: ตรวจ API

ในหน้าต่างที่ 2:

```powershell
cd C:\Users\Asus\Documents\rims
Invoke-WebRequest http://127.0.0.1:3000/health
```

ต้องได้ HTTP 200 ก่อนเริ่ม K6

### Step 3: ทดสอบ 300 VUs

```powershell
k6 run -e BASE_URL=http://127.0.0.1:3000 -e VUS=300 -e DURATION=20s -e RAMP_UP=10s -e RAMP_DOWN=5s -e THINK_TIME_SECONDS=1 tests/k6/menu-catalog.js
```

คาดหวัง: ผ่านเกณฑ์, error rate 0% โดยประมาณ

### Step 4: ทดสอบ 325 VUs

```powershell
k6 run -e BASE_URL=http://127.0.0.1:3000 -e VUS=325 -e DURATION=20s -e RAMP_UP=10s -e RAMP_DOWN=5s -e THINK_TIME_SECONDS=1 tests/k6/menu-catalog.js
```

คาดหวัง: เริ่มไม่ผ่าน threshold เพราะ error rate สูงกว่า 1%

### Step 5: ทดสอบ 350 VUs

```powershell
k6 run -e BASE_URL=http://127.0.0.1:3000 -e VUS=350 -e DURATION=20s -e RAMP_UP=10s -e RAMP_DOWN=5s -e THINK_TIME_SECONDS=1 tests/k6/menu-catalog.js
```

คาดหวัง: error rate สูงขึ้นจากรอบ 325 VUs และ throughput เพิ่มขึ้นเพียงเล็กน้อย แสดงว่าระบบเริ่มอิ่มตัว

ค่าความจุนี้ใช้ได้กับเครื่อง, network, database plan และข้อมูล ณ วันที่ทดสอบเท่านั้น หากเปลี่ยน environment ต้องวัดใหม่ และไม่ควรรัน load test ใส่ production ระหว่างมีผู้ใช้งานจริง
