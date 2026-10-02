require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const forecastRoutes = require('./routes/forecast');
const poRoutes = require('./routes/po');

const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files จากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));

// API Routes หลัก
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/po', poRoutes);

// 📌 [เพิ่มจุดนี้] Alias Routes เพื่อรองรับ Endpoint ที่ Frontend เรียกโดยตรง
app.use('/api/sales_history_2567', salesRoutes);
app.use('/api/sales_history_2568', salesRoutes);
app.use('/api/sale_detail', salesRoutes);
app.use('/api/risk_and_growth', forecastRoutes);
app.use('/api/stock_recommendation', forecastRoutes);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'AI Stock API is running', time: new Date().toISOString() });
});

// หน้าแรกเปิด login.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 404 Handler สำหรับ /api ที่ไม่พบ
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `ไม่พบ endpoint: ${req.originalUrl}` });
});

app.listen(PORT, () => {
  console.log(`🚀 AI Stock server running at http://localhost:${PORT}`);
  console.log(`   Gemini AI: ${process.env.GEMINI_API_KEY ? 'เปิดใช้งาน ✅' : 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY (จะใช้สรุปผลแบบ template แทน)'}`);
});