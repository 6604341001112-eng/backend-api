require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const forecastRoutes = require('./routes/forecast');
const poRoutes = require('./routes/po'); //
const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ให้บริการหน้าเว็บ (login.html, dashboard.html, product.html, ...) จากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/po', poRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'AI Stock API is running', time: new Date().toISOString() });
});

// เปิดหน้า login เป็นค่าเริ่มต้นเมื่อเข้าหน้าแรก
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 404 handler สำหรับ API ที่ไม่พบ
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `ไม่พบ endpoint: ${req.originalUrl}` });
});

app.listen(PORT, () => {
  console.log(`🚀 AI Stock server running at http://localhost:${PORT}`);
  console.log(`   Gemini AI: ${process.env.GEMINI_API_KEY ? 'เปิดใช้งาน ✅' : 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY (จะใช้สรุปผลแบบ template แทน)'}`);
});
