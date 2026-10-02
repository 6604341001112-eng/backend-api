const express = require('express');
const router = express.Router();
const db = require('../config/db');

/**
 * GET /api/sales หรือ /api/sale
 * ดึงรายการขายทั้งหมด พร้อมรายละเอียดสินค้า หมวดหมู่ ราคา ต้นทุน และราคารวม
 */
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT 
                s.sale_id,
                s.sale_date,
                sd.quantity,
                sd.quantity AS qty,
                sd.unit_price AS price,
                (sd.quantity * sd.unit_price) AS rev,
                p.product_id,
                p.product_name,
                p.cost,
                c.category_id,
                c.category_name
            FROM sale s
            INNER JOIN sale_detail sd ON s.sale_id = sd.sale_id
            LEFT JOIN product_data p ON sd.product_id = p.product_id
            LEFT JOIN category c ON p.category_id = c.category_id
            ORDER BY s.sale_date DESC
        `;
        
        const [rows] = await db.query(query);
        
        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching sales:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลการขาย',
            error: error.message
        });
    }
});

/**
 * GET /api/sales/summary
 * สรุปยอดขายรวมแยกตามสินค้า
 */
router.get('/summary', async (req, res) => {
    try {
        const query = `
            SELECT 
                p.product_id,
                p.product_name,
                c.category_id,
                c.category_name,
                p.price,
                p.cost,
                COALESCE(SUM(sd.quantity), 0) AS total_sold_qty,
                COALESCE(SUM(sd.quantity * sd.unit_price), 0) AS total_revenue,
                COALESCE(SUM(sd.quantity * (sd.unit_price - p.cost)), 0) AS total_profit
            FROM product_data p
            LEFT JOIN category c ON p.category_id = c.category_id
            LEFT JOIN sale_detail sd ON p.product_id = sd.product_id
            GROUP BY p.product_id, p.product_name, c.category_id, c.category_name, p.price, p.cost
            ORDER BY total_revenue DESC
        `;

        const [rows] = await db.query(query);
        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching summary:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสรุปยอดขาย',
            error: error.message
        });
    }
});

/**
 * GET /api/sales/category-monthly
 * สรุปยอดขายตามหมวดหมู่และรายเดือนประจำปี 2026 / 2569
 */
router.get('/category-monthly', async (req, res) => {
    try {
        const query = `
            SELECT 
                c.category_id,
                c.category_name,
                COALESCE(MONTH(s.sale_date), 0) AS month,
                COALESCE(SUM(sd.quantity * sd.unit_price), 0) AS monthly_revenue
            FROM category c
            LEFT JOIN product_data p ON c.category_id = p.category_id
            LEFT JOIN sale_detail sd ON p.product_id = sd.product_id
            LEFT JOIN sale s ON sd.sale_id = s.sale_id AND (YEAR(s.sale_date) = 2026 OR YEAR(s.sale_date) = 2569)
            GROUP BY c.category_id, c.category_name, MONTH(s.sale_date)
            ORDER BY c.category_id ASC, month ASC
        `;

        const [rows] = await db.query(query);
        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching category monthly sales:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลยอดขายรายเดือน',
            error: error.message
        });
    }
});

module.exports = router;