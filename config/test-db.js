const mysql = require('mysql2/promise');
require('dotenv').config();

// สร้าง Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'consumables',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ฟังก์ชันทดสอบดึงข้อมูล
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ เชื่อมต่อฐานข้อมูล MySQL/MariaDB สำเร็จ!');
        
        // ทดสอบ Query ข้อมูล
        const [rows] = await connection.query('SELECT 1 + 1 AS result');
        console.log('📊 ผลการทดสอบ Query:', rows);
        
        connection.release(); // คืน connection กลับเข้า pool
    } catch (error) {
        console.error('❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้:', error.message);
    }
}

testConnection();

module.exports = pool;