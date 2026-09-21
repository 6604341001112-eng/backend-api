// config/db.js
// เชื่อมต่อฐานข้อมูล MySQL แบบ Connection Pool (ใช้ mysql2/promise เพื่อรองรับ async/await)
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'consumables',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true // คืนค่า DATE/DATETIME เป็น string ตรง ๆ ป้องกันปัญหา timezone เพี้ยน
});

// ทดสอบการเชื่อมต่อทันทีตอนบูตแอป เพื่อให้เห็น error ชัดเจนถ้าตั้งค่า .env ผิด
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log(`✅ เชื่อมต่อ MySQL สำเร็จ (database: ${process.env.DB_NAME})`);
    conn.release();
  } catch (err) {
    console.error('❌ เชื่อมต่อ MySQL ไม่สำเร็จ:', err.message);
    console.error('   ตรวจสอบค่า DB_HOST / DB_USER / DB_PASS / DB_NAME ในไฟล์ .env');
  }
})();

module.exports = pool;
