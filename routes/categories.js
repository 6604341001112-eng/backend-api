const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 1. GET: ดึงรายการหมวดหมู่ทั้งหมด -> /api/categories
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT category_id, category_name FROM category ORDER BY category_id DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. POST: เพิ่มหมวดหมู่ใหม่ -> /api/categories
router.post('/', async (req, res) => {
  try {
    const { category_name } = req.body;
    if (!category_name) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อหมวดหมู่' });
    }
    const sql = 'INSERT INTO category (category_name) VALUES (?)';
    await db.query(sql, [category_name]);
    res.json({ success: true, message: 'เพิ่มหมวดหมู่สำเร็จ' });
  } catch (err) {
    console.error('Error adding category:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. PUT: แก้ไขหมวดหมู่ -> /api/categories/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category_name } = req.body;
    const sql = 'UPDATE category SET category_name = ? WHERE category_id = ?';
    await db.query(sql, [category_name, id]);
    res.json({ success: true, message: 'แก้ไขหมวดหมู่สำเร็จ' });
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. DELETE: ลบหมวดหมู่ -> /api/categories/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sql = 'DELETE FROM category WHERE category_id = ?';
    await db.query(sql, [id]);
    res.json({ success: true, message: 'ลบหมวดหมู่สำเร็จ' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;