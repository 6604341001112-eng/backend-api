# AI Stock — Sales Forecasting System (พร้อมใช้งาน)

ระบบจัดการสต็อกและพยากรณ์ยอดขายสินค้าเครื่องบริโภค (consumables) ด้วย Node.js + Express + MySQL
พยากรณ์คำนวณจาก **ยอดขายจริงในฐานข้อมูล** (ตาราง `sale` / `sale_detail`) ด้วยโมเดลสถิติ (Moving Average + Trend)
แล้วเสริมด้วย **Google Gemini AI** เพื่อสรุปผลและให้คำแนะนำเป็นภาษาไทยแบบอ่านง่าย

## โครงสร้างโปรเจกต์

```
ai-stock-project/
├── server.js                 # จุดเริ่มต้นเซิร์ฟเวอร์ (Express)
├── .env                       # ค่าคอนฟิก (DB, JWT, Gemini API key)
├── config/db.js               # MySQL connection pool
├── services/
│   ├── forecastEngine.js      # โมเดลพยากรณ์สถิติจากยอดขายจริง
│   └── geminiService.js       # เรียก Gemini API สร้างบทวิเคราะห์/คำแนะนำ
├── routes/
│   ├── auth.js                # POST /api/auth/login (bcrypt + JWT)
│   ├── categories.js          # CRUD หมวดหมู่สินค้า
│   ├── products.js            # CRUD สินค้า (join หมวดหมู่จริง)
│   ├── sales.js                # บันทึกการขาย + ตัดสต็อก
│   └── forecast.js            # พยากรณ์ยอดขาย + AI summary
├── public/                    # หน้าเว็บ (login, dashboard, product, categories, sales, forecast)
└── database/consumables.sql   # ไฟล์ฐานข้อมูลตัวอย่าง (import เข้า MySQL)
```

## ขั้นตอนติดตั้ง (Windows / Mac / Linux)

### 1) ติดตั้ง Node.js และ MySQL
ต้องมี Node.js เวอร์ชัน 18 ขึ้นไป (มี `fetch` ในตัว) และ MySQL/MariaDB ที่รันอยู่ (เช่น XAMPP)

### 2) นำเข้าฐานข้อมูล
สร้างฐานข้อมูลชื่อ `consumables` แล้ว import ไฟล์ `database/consumables.sql`:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS consumables"
mysql -u root -p consumables < database/consumables.sql
```
(หรือใช้ phpMyAdmin: สร้างฐานข้อมูล `consumables` แล้ว Import ไฟล์ .sql นี้เข้าไป)

### 3) ติดตั้ง dependencies
```bash
cd ai-stock-project
npm install
```

### 4) ตั้งค่าไฟล์ .env
ไฟล์ `.env` มีค่าเริ่มต้นให้ตามที่ระบุมาแล้ว (`DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `JWT_SECRET`) แก้ไขให้ตรงกับเครื่องของคุณถ้าจำเป็น

**สำหรับ GEMINI_API_KEY (จำเป็นถ้าต้องการให้ AI ช่วยสรุปผล/แนะนำ):**
1. ไปที่ https://aistudio.google.com/app/apikey
2. เข้าสู่ระบบด้วยบัญชี Google แล้วกด "Create API key" (ใช้ฟรีได้ในโควต้าที่กำหนด)
3. คัดลอกคีย์มาใส่ในไฟล์ `.env`:
   ```
   GEMINI_API_KEY=วางคีย์ที่ได้ตรงนี้
   ```
4. ถ้าไม่ใส่คีย์ ระบบจะยังทำงานได้ปกติ แค่ส่วนสรุปผล AI จะใช้ข้อความ template แทน (ไม่ล่ม)

> หมายเหตุ: โมเดล Gemini มีการอัปเดต/ปลดระวางเป็นระยะ ถ้า `GEMINI_MODEL=gemini-2.5-flash` ใน `.env` ใช้ไม่ได้ในอนาคต
> ให้เข้าไปดูรายชื่อรุ่นล่าสุดที่ https://ai.google.dev/gemini-api/docs/models แล้วแก้ค่าตัวแปรนี้

### 5) รันเซิร์ฟเวอร์
```bash
npm start
```
เปิดเบราว์เซอร์ไปที่ **http://localhost:** (จะพาไปหน้า login อัตโนมัติ)

### 6) เข้าสู่ระบบ
- Admin: `admin` / `admin123`

> ผู้ใช้ `owner` ที่ปรากฏใน hint หน้า login ยังไม่มีอยู่จริงในตาราง `user` (ในไฟล์ .sql มีแค่ admin)
> หน้า login.html ปัจจุบันเช็คสิทธิ์แบบ hardcode ฝั่ง frontend (ยังไม่ได้เรียก `/api/auth/login` จริง)
> ผมเตรียม API `/api/auth/login` (เชื่อม MySQL + bcrypt + JWT) ไว้ให้พร้อมใช้แล้ว — ถ้าต้องการให้เชื่อมหน้า login
> เข้ากับ API นี้จริง ๆ (ปลอดภัยกว่า) แจ้งมาได้ ผมจะแก้ให้ในสเต็ปถัดไป

## ระบบพยากรณ์ AI ทำงานอย่างไร

1. **โมเดลสถิติ (คำนวณทุกสินค้า จากข้อมูลจริง)** — `services/forecastEngine.js`
   ดึงยอดขายจริงจาก `sale` + `sale_detail` ย้อนหลัง 60 วัน (ปรับได้ที่ `FORECAST_LOOKBACK_DAYS` ใน `.env`)
   แบ่งครึ่งแรก/ครึ่งหลังเพื่อดูแนวโน้ม (กำลังขายดีขึ้น/ลดลง) แล้วพยากรณ์ยอดขาย 7 วันข้างหน้าต่อสินค้า
   → ใช้กับสินค้าทั้ง 5,000+ รายการได้ทันที รวดเร็ว ไม่ต้องพึ่ง API ภายนอก

2. **Gemini AI (เสริมชั้นการวิเคราะห์เชิงธุรกิจ)** — `services/geminiService.js`
   นำตัวเลขที่ได้จากโมเดลสถิติ (ยอดขายคาดการณ์, สินค้าเสี่ยงสต็อกขาด, เทรนด์สินค้า) ส่งให้ Gemini
   สรุปเป็นภาษาไทยสั้น ๆ แสดงในกล่อง "สรุปผลการวิเคราะห์ AI" หน้า Dashboard และกล่องคำแนะนำหน้า Forecast
   (จำกัดเฉพาะ top รายการเสี่ยงสต็อกขาด เพื่อประหยัดโควต้า ไม่เรียก AI ทีละ 5,000 ครั้ง)

## Endpoint หลัก

| Method | Path | คำอธิบาย |
|---|---|---|
| POST | `/api/auth/login` | เข้าสู่ระบบ (ตรวจกับตาราง `user` จริง) |
| GET/POST/PUT/DELETE | `/api/products` | จัดการสินค้า |
| GET/POST/PUT/DELETE | `/api/categories` | จัดการหมวดหมู่ |
| POST | `/api/sales` | บันทึกการขาย + ตัดสต็อก |
| GET | `/api/sales/history`, `/api/sales/summary` | ประวัติ/สรุปยอดขาย |
| GET | `/api/forecast` | พยากรณ์รายสินค้า (real data + AI advice) |
| GET | `/api/forecast/dashboard-summary` | สรุปภาพรวม Dashboard (real data + AI summary) |

## สิ่งที่แก้ไข/เพิ่มจากไฟล์เดิมที่ส่งมา

- เพิ่ม `server.js`, `config/db.js`, `package.json`, `.env` (ของเดิมยังไม่มีไฟล์เหล่านี้ ระบบรันไม่ได้)
- เขียน `routes/forecast.js` ใหม่ทั้งหมด: จากเดิมที่คำนวณยอดพยากรณ์แบบสุ่ม/ประมาณคร่าว ๆ (`Math.max(18, ...)`)
  เปลี่ยนเป็นคำนวณจากยอดขายจริงในตาราง `sale_detail` + เสริมด้วย Gemini AI
- แก้ `routes/products.js` ให้ JOIN ตาราง `category` จริง (ของเดิมไม่ส่ง `category_name` กลับมาเลย)
- แก้ `public/product.html`: dropdown หมวดหมู่เดิม hardcode ค่าที่ไม่ตรงกับตาราง `category` จริงในฐานข้อมูล
  (ทำให้เพิ่ม/แก้สินค้าแล้ว category_id ผิดเสมอ) เปลี่ยนเป็นดึงหมวดหมู่จริงจาก API มาแสดงแทน
- เปลี่ยน URL แบบ absolute (`http://localhost:5000/...`) เป็น relative path เพื่อให้ deploy ที่ port/โดเมนอื่นได้ง่ายขึ้น
- ใช้ `bcryptjs` แทน `bcrypt` ใน `routes/auth.js` เพื่อไม่ต้อง compile native module ตอนติดตั้ง
