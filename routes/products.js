const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET: /api/products - ดึงรายการสินค้าพร้อมยอดขายสะสมและชื่อหมวดหมู่จริง (JOIN category)
router.get('/', async (req, res) => {
    try {
        const sql = `
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
        `;
        const [rows] = await db.query(sql);
        res.json({ success: true, data: rows });
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

// 📌 3. เพิ่มสินค้า (รับ category_id จริงจากฐานข้อมูล ไม่ใช่ชื่อหมวดหมู่ตายตัว)
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
