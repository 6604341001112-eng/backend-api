// config/db.js
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
  dateStrings: true
});

// ทดสอบการเชื่อมต่อ
(async () => {
  try {
    const conn = await pool.getConnection();
    const dbName = process.env.DB_NAME || 'consumables';
    console.log(`✅ เชื่อมต่อ MySQL สำเร็จ (database: ${dbName})`);
    conn.release();
  } catch (err) {
    console.error('❌ เชื่อมต่อ MySQL ไม่สำเร็จ:', err.message);
    console.error('   ตรวจสอบค่า DB_HOST / DB_USER / DB_PASS / DB_NAME ในไฟล์ .env');
  }
})();

module.exports = pool;