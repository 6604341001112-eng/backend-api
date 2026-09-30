// routes/po.js
const express = require('express');
const router = express.Router();

// POST: /api/po (รับข้อมูลสร้าง PO จากหน้าบ้าน)
router.post('/', async (req, res) => {
  try {
    const { sku, order_quantity, forecast_year } = req.body;

    // TODO: เพิ่มโค้ดบันทึกลง Database ของคุณตรงนี้ (เช่น MySQL, MongoDB หรือ PostgreSQL)
    // const result = await db.query('INSERT INTO purchase_orders ...');

    console.log(`[PO Created] SKU: ${sku}, Quantity: ${order_quantity}, Year: ${forecast_year}`);

    res.status(201).json({
      success: true,
      po_number: `PO-${Date.now()}`,
      message: 'สร้างใบสั่งซื้อสำเร็จ'
    });
  } catch (error) {
    console.error('Error creating PO:', error);
    res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดในการสร้างใบสั่งซื้อ' });
  }
});

// GET: /api/po (ดึงประวัติใบสั่งซื้อทั้งหมด)
router.get('/', async (req, res) => {
  try {
    // TODO: ดึงข้อมูล PO จาก Database
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});

module.exports = router;