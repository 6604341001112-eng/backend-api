const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET: /api/sales - ดึงรายการยอดขายทั้งหมดพร้อมวันที่ สินค้า และจำนวน เพื่อทำ Dashboard
router.get('/', async (req, res) => {
    try {
        const sql = `
            SELECT 
                s.sale_date,
                sd.product_id,
                sd.quantity
            FROM sale s
            JOIN sale_detail sd ON s.sale_id = sd.sale_id
            ORDER BY s.sale_date ASC
        `;
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching sales data for dashboard:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET: /api/sales/grand-total - ดึงยอดขายรวมจริงทั้งหมดจากตาราง sale
router.get('/grand-total', async (req, res) => {
    try {
        // ดึง SUM(total_amount) จากตาราง sale โดยตรง
        const [rows] = await db.query('SELECT COALESCE(SUM(total_amount), 0) AS grand_total FROM sale');
        res.json({ 
            success: true, 
            totalSales: Number(rows[0].grand_total) 
        });
    } catch (err) {
        console.error('Error fetching grand total sales:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST: /api/sales - บันทึกการขายและตัดสต็อก
router.post('/', async (req, res) => {
    try {
        const { total_amount, created_by, items } = req.body;
        const saleItems = Array.isArray(items) && items.length > 0 ? items : [req.body];
        const item = saleItems[0];

        // แปลง productId และ qty เป็นตัวเลข (Number) แน่นอน 100%
        const productId = Number(item.product_id);
        const qty = Number(item.quantity || 1);
        const price = Number(item.price || item.unit_price || 0);

        if (!productId || isNaN(productId)) {
            return res.status(400).json({ success: false, error: 'รหัสสินค้าไม่ถูกต้อง' });
        }

        // 1. บันทึกลงตาราง sale
        const [saleRes] = await db.query(
            'INSERT INTO sale (sale_date, total_amount, created_by) VALUES (NOW(), ?, ?)',
            [total_amount || (price * qty), created_by || 1]
        );
        const saleId = saleRes.insertId;

        // 2. บันทึกลงตาราง sale_detail (ถ้ามี)
        try {
            await db.query(
                'INSERT INTO sale_detail (sale_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
                [saleId, productId, qty, price]
            );
        } catch (e) {
            console.warn('sale_detail skipped:', e.message);
        }

        // 3. ตัดสต็อกโดยบังคับใช้ CAST และ WHERE ชัดเจน
        const [updateRes] = await db.query(
            'UPDATE product_data SET stock = stock - ? WHERE CAST(product_id AS SIGNED) = ?',
            [qty, productId]
        );

        console.log(`[CHECK SALE] product_id: ${productId} | Cut: ${qty} | Rows updated: ${updateRes.affectedRows}`);

        if (updateRes.affectedRows === 0) {
            return res.status(400).json({ 
                success: false, 
                error: `ตัดสต็อกไม่สำเร็จ! ไม่พบ product_id: ${productId} ในตาราง product_data` 
            });
        }

        res.json({ success: true, message: 'บันทึกการขายและตัดสต็อกเรียบร้อย', sale_id: saleId });

    } catch (err) {
        console.error('Error in POST /api/sales:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET: /api/sales/history - ดึงประวัติการขาย
router.get('/history', async (req, res) => {
    try {
        const sql = `
            SELECT 
                s.sale_id,
                DATE_FORMAT(s.sale_date, '%H:%i') AS sale_time,
                s.total_amount,
                p.product_name,
                sd.quantity
            FROM sale s
            LEFT JOIN sale_detail sd ON s.sale_id = sd.sale_id
            LEFT JOIN product_data p ON sd.product_id = p.product_id
            ORDER BY s.sale_id DESC
            LIMIT 10
        `;
        const [rows] = await db.query(sql);
        res.json({ success: true, data: rows });
    } catch (err) {
        const [rows] = await db.query('SELECT * FROM sale ORDER BY sale_id DESC LIMIT 10');
        res.json({ success: true, data: rows });
    }
});

// GET: /api/sales/summary - สรุปยอดขายแยกตามสินค้า
router.get('/summary', async (req, res) => {
    try {
        const sql = `
            SELECT 
                p.product_id,
                p.product_name,
                p.price,
                COALESCE(SUM(sd.quantity), 0) AS sold_qty,
                COALESCE(SUM(sd.quantity * sd.unit_price), 0) AS total_revenue
            FROM product_data p
            LEFT JOIN sale_detail sd ON p.product_id = sd.product_id
            GROUP BY p.product_id, p.product_name, p.price
            ORDER BY total_revenue DESC
        `;
        const [rows] = await db.query(sql);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching sales summary:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;