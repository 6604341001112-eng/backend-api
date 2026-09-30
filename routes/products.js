const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 📌 1. GET: /api/products - ดึงรายการสินค้าพร้อม sales_history รายเดือน
router.get('/', async (req, res) => {
    try {
        // 1. ดึงข้อมูลสินค้าทั้งหมดพร้อมชื่อหมวดหมู่
        const [products] = await db.query(`
            SELECT 
                p.product_id,
                p.product_name,
                p.price,
                p.price AS unit_price,
                p.cost,
                p.stock,
                p.category_id,
                c.category_name,
                COALESCE(SUM(sd.quantity), 0) AS sold_qty
            FROM product_data p
            LEFT JOIN category c ON p.category_id = c.category_id
            LEFT JOIN sale_detail sd ON p.product_id = sd.product_id
            GROUP BY p.product_id, p.product_name, p.price, p.cost, p.stock, p.category_id, c.category_name
            ORDER BY p.product_id ASC
        `);

        // 2. ดึงประวัติยอดขายแยกรายเดือน (สมมติว่าตาราง sales/sale_detail มี transaction_date หรือ created_at)
        // หมายเหตุ: ปรับชื่อตารางและ field วันที่ตาม DB จริงของคุณ (เช่น s.sale_date หรือ s.created_at)
        const [salesHistory] = await db.query(`
          SELECT 
    sd.product_id,
    YEAR(s.sale_date) AS year,      -- เปลี่ยนตรงนี้
    MONTH(s.sale_date) AS month,    -- และตรงนี้
    SUM(sd.quantity) AS units_sold
FROM sale_detail sd
JOIN sale s ON sd.sale_id = s.sale_id
GROUP BY sd.product_id, YEAR(s.sale_date), MONTH(s.sale_date)
        `);

        // 3. ประกอบ sales_history ยัดใส่สินค้าแต่ละชิ้น
        const formattedData = products.map(prod => {
            const history = salesHistory
                .filter(s => s.product_id === prod.product_id)
                .map(s => ({
                    year: Number(s.year),
                    month: Number(s.month),
                    units_sold: Number(s.units_sold)
                }));

            return {
                ...prod,
                sales_history: history
            };
        });

        // ส่งออกเป็น Array ตรงๆ ตามที่ test.html คาดหวัง
        res.json(formattedData);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 📌 2. ดึงข้อมูลรายชิ้น (พร้อมชื่อหมวดหมู่จริง)
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT p.*, p.price AS unit_price, c.category_name
             FROM product_data p
             LEFT JOIN category c ON p.category_id = c.category_id
             WHERE p.product_id = ?`,
            [req.params.id]
        );
        res.json(rows[0] || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📌 3. เพิ่มสินค้า
router.post('/', async (req, res) => {
    try {
        const { product_name, price, unit_price, stock, category_id, cost } = req.body;
        const finalPrice = price || unit_price || 0;
        await db.query(
            'INSERT INTO product_data (product_name, price, stock, category_id, cost) VALUES (?, ?, ?, ?, ?)',
            [product_name, finalPrice, stock || 0, category_id || 1, cost || 0]
        );
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📌 4. แก้ไขสินค้า
router.put('/:id', async (req, res) => {
    try {
        const { product_name, price, unit_price, stock, category_id, cost } = req.body;
        const finalPrice = price || unit_price || 0;
        await db.query(
            'UPDATE product_data SET product_name = ?, price = ?, stock = ?, category_id = COALESCE(?, category_id), cost = COALESCE(?, cost) WHERE product_id = ?',
            [product_name, finalPrice, stock, category_id || null, cost ?? null, req.params.id]
        );
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 📌 5. ลบสินค้า
router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM product_data WHERE product_id = ?', [req.params.id]);
        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;