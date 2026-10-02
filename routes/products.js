const express = require('express');
const router = express.Router();
const db = require('../config/db');

// ==========================================
// 🛠️ Helper Functions
// ==========================================

// Clean ค่าตัวเลข ป้องกัน NaN หรือค่าที่ไม่ใช่ตัวเลข
const safeNum = (val) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : parsed;
};

// ตัดเศษทศนิยมออก ป้องกันจำนวนชิ้นเพี้ยน
const safeRoundQty = (val) => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : Math.round(parsed);
};

// ==========================================
// 📌 1. Specific Endpoints (เส้นทางเฉพาะ)
// ==========================================

// 📌 GET: /api/products/init-dashboard (ดึงข้อมูลภาพรวมเริ่มต้น)
router.get('/init-dashboard', async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT 
                p.product_id,
                p.product_name,
                p.price,
                p.price AS unit_price,
                p.cost,
                p.stock,
                p.category_id,
                c.category_name
            FROM product_data p
            LEFT JOIN category c ON p.category_id = c.category_id
            ORDER BY p.product_id ASC
        `);

        const [sales2024] = await db.query(`
            SELECT 
                product_id,
                COALESCE(SUM(sales_qty), 0) AS qty,
                COALESCE(SUM(sales_amount), 0) AS amount
            FROM sales_history_2567
            GROUP BY product_id
        `);

        const [sales2025] = await db.query(`
            SELECT 
                product_id,
                COALESCE(SUM(sales_qty), 0) AS qty,
                COALESCE(SUM(sales_amount), 0) AS amount
            FROM sales_history_daily_2568
            GROUP BY product_id
        `);

        const [sales2026] = await db.query(`
            SELECT 
                sd.product_id,
                COALESCE(SUM(sd.quantity), 0) AS qty,
                COALESCE(SUM(sd.subtotal), 0) AS amount
            FROM sale_detail sd
            JOIN sale s ON s.sale_id = sd.sale_id
            WHERE YEAR(s.sale_date) = 2026
            GROUP BY sd.product_id
        `);

        // ปรับแก้: กรอง Header Text ออกจากตาราง risk_and_growth
        const [riskGrowth] = await db.query(`
            SELECT 
                COALESCE(product_id, \`COL 1\`, \`Product ID\`) AS product_id,
                COALESCE(forecast_qty_2027, \`COL 3\`, forecast_qty, 0) AS forecast_qty_2027,
                COALESCE(growth_pct_2027, \`COL 4\`, growth_pct, 0) AS growth_pct_2027,
                COALESCE(recommended_stock, \`COL 5\`, 0) AS recommended_stock
            FROM \`risk_and_growth_2570__1_\`
            WHERE \`COL 1\` NOT LIKE '%product%' 
              AND \`COL 1\` != 'COL 1'
              AND \`COL 1\` IS NOT NULL
        `);

        const [stockRec] = await db.query(`SELECT * FROM \`stock_recommendation_2570\``);

        res.json({
            success: true,
            products,
            sales2024: sales2024.map(s => ({ ...s, qty: safeNum(s.qty), amount: safeNum(s.amount) })),
            sales2025: sales2025.map(s => ({ ...s, qty: safeNum(s.qty), amount: safeNum(s.amount) })),
            sales2026: sales2026.map(s => ({ ...s, qty: safeNum(s.qty), amount: safeNum(s.amount) })),
            riskGrowth,
            stockRec
        });
    } catch (err) {
        console.error('❌ Error fetching init-dashboard:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 📌 GET: /api/products/dashboard-summary (ยอดขายรวมปี 2567 / 2024)
router.get('/dashboard-summary', async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT 
                p.product_id,
                p.product_name,
                p.price,
                p.price AS unit_price,
                p.cost,
                p.stock,
                p.category_id,
                c.category_name
            FROM product_data p
            LEFT JOIN category c ON p.category_id = c.category_id
            ORDER BY p.product_id ASC
        `);

        const [sales2567] = await db.query(`
            SELECT 
                product_id,
                COALESCE(SUM(sales_qty), 0) AS total_qty,
                COALESCE(SUM(sales_amount), 0) AS total_amount
            FROM sales_history_2567
            GROUP BY product_id
        `);

        const formattedData = products.map(prod => {
            const sale = sales2567.find(s => String(s.product_id).trim() === String(prod.product_id).trim());
            
            const totalQty = safeNum(sale?.total_qty);
            const totalRevenue = safeNum(sale?.total_amount);

            return {
                ...prod,
                sold_qty: totalQty,
                sales_amount: totalRevenue,
                total_qty: totalQty,
                total_revenue: totalRevenue
            };
        });

        res.json(formattedData);
    } catch (err) {
        console.error('❌ Error fetching 2024 summary:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 📌 GET: /api/products/dashboard-summary-2568 (ปี 2568 / 2025)
router.get('/dashboard-summary-2568', async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT 
                p.product_id,
                p.product_name,
                p.price,
                p.price AS unit_price,
                p.cost,
                p.stock,
                p.category_id,
                c.category_name
            FROM product_data p
            LEFT JOIN category c ON p.category_id = c.category_id
            ORDER BY p.product_id ASC
        `);

        const [sales2568] = await db.query(`
            SELECT 
                product_id,
                MONTH(sale_date) AS month,
                YEAR(sale_date) AS year,
                COALESCE(SUM(sales_qty), 0) AS total_qty,
                AVG(unit_price) AS avg_unit_price,
                COALESCE(SUM(sales_amount), 0) AS total_amount
            FROM sales_history_daily_2568
            GROUP BY product_id, YEAR(sale_date), MONTH(sale_date)
        `);

        const formattedData = products.map(prod => {
            const history = sales2568
                .filter(s => String(s.product_id).trim() === String(prod.product_id).trim())
                .map(s => {
                    const qty = safeNum(s.total_qty);
                    const amount = safeNum(s.total_amount);

                    return {
                        year: parseInt(s.year, 10) || 2025,
                        month: parseInt(s.month, 10),
                        units_sold: qty,
                        quantity: qty,
                        sales_amount: amount,
                        revenue: amount,
                        total_sales: amount
                    };
                });

            const totalQty = history.reduce((sum, h) => sum + h.units_sold, 0);
            const totalRevenue = history.reduce((sum, h) => sum + h.sales_amount, 0);

            return {
                ...prod,
                sold_qty: totalQty,
                total_qty: totalQty,
                total_revenue: totalRevenue,
                total_sales: totalRevenue,
                sales_amount: totalRevenue,
                sales_history: history
            };
        });

        res.json(formattedData);
    } catch (err) {
        console.error('❌ Error fetching 2568 sales summary:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 📌 GET: /api/products/sale_detail (ปี 2026)
router.get('/sale_detail', async (req, res) => {
    try {
        const [products] = await db.query(`SELECT * FROM product_data`);

        const [sales2026] = await db.query(`
            SELECT 
                sd.product_id,
                MONTH(s.sale_date) AS month,
                YEAR(s.sale_date) AS year,
                COALESCE(SUM(sd.quantity), 0) AS total_qty,
                AVG(sd.unit_price) AS avg_unit_price,
                COALESCE(SUM(sd.subtotal), 0) AS total_amount
            FROM sale_detail sd
            INNER JOIN sale s ON s.sale_id = sd.sale_id
            WHERE YEAR(s.sale_date) = 2026
            GROUP BY sd.product_id, YEAR(s.sale_date), MONTH(s.sale_date)
        `);

        const formattedData = products.map(prod => {
            const history = sales2026
                .filter(s => String(s.product_id).trim() === String(prod.product_id).trim())
                .map(s => {
                    const qty = safeNum(s.total_qty);
                    const amount = safeNum(s.total_amount);
                    return {
                        year: 2026,
                        month: parseInt(s.month, 10),
                        units_sold: qty,
                        sales_amount: amount
                    };
                });

            return {
                ...prod,
                sold_qty: history.reduce((sum, h) => sum + h.units_sold, 0),
                sales_amount: history.reduce((sum, h) => sum + h.sales_amount, 0),
                sales_history: history
            };
        });

        res.json(formattedData);
    } catch (err) {
        console.error('❌ Error fetching sale_detail:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 📌 GET: /api/products/risk-growth
router.get('/risk-growth', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT * FROM \`risk_and_growth_2570__1_\` 
            WHERE \`COL 1\` NOT LIKE '%product%' 
              AND \`COL 1\` != 'COL 1'
              AND \`COL 1\` IS NOT NULL
        `);

        const formattedData = rows
            .map(r => {
                const rawId = r.product_id || r['COL 1'] || r['Product ID'];
                if (!rawId) return null;
                const pid = String(rawId).trim();

                if (pid.toLowerCase().includes('col') || pid.toLowerCase().includes('product')) return null;

                const fcQty = safeRoundQty(r.forecast_qty_2027 || r['COL 3'] || r.forecast_qty);
                const growth = parseFloat(r.growth_pct_2027 || r['COL 4'] || r.growth_pct) || 0;
                const recStock = safeRoundQty(r.recommended_stock || r['COL 5']);

                return {
                    product_id: pid,
                    forecast_qty: fcQty,
                    forecast_2027: fcQty,
                    growth_pct: growth,
                    recommended_stock: recStock
                };
            })
            .filter(Boolean);

        res.json(formattedData);
    } catch (err) {
        console.error('❌ Error fetching risk-growth:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 📌 GET: /api/products/stock-recommendation-2570
router.get('/stock-recommendation-2570', async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT * FROM \`stock_recommendation_2570\``);

        const formattedData = rows
            .filter(r => r.product_id || r.category_id || r.id)
            .map(r => {
                const id = String(r.product_id || r.category_id || r.id).trim();
                const m = (key1, key2) => safeNum(r[key1] ?? r[key2]);

                return {
                    product_id: id,
                    category_id: id,
                    monthly_forecast: [
                        m('2570-01 (ม.ค.)', 'm1'),
                        m('2570-02 (ก.พ.)', 'm2'),
                        m('2570-03 (มี.ค.)', 'm3'),
                        m('2570-04 (เม.ย.)', 'm4'),
                        m('2570-05 (พ.ค.)', 'm5'),
                        m('2570-06 (มิ.ย.)', 'm6'),
                        m('2570-07 (ก.ค.)', 'm7'),
                        m('2570-08 (ส.ค.)', 'm8'),
                        m('2570-09 (ก.ย.)', 'm9'),
                        m('2570-10 (ต.ค.)', 'm10'),
                        m('2570-11 (พ.ย.)', 'm11'),
                        m('2570-12 (ธ.ค.)', 'm12')
                    ],
                    recommended_stock_total: safeNum(r['รวมทั้งปี_2570_แนะนำสต็อก'] || r['recommended_stock_total']),
                    forecast_total: safeNum(r['รวมทั้งปี_2570_พยากรณ์ขาย'] || r['forecast_total'])
                };
            });

        res.json(formattedData);
    } catch (err) {
        console.error('❌ Error fetching stock recommendation 2570:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 📌 GET: /api/products/monthly-trend-all (ดึงข้อมูลยอดขายรายเดือนของทุกปี)
router.get('/monthly-trend-all', async (req, res) => {
    try {
        const [sales2025] = await db.query(`
            SELECT 
                product_id,
                MONTH(sale_date) AS month,
                COALESCE(SUM(sales_qty), 0) AS total_qty,
                COALESCE(SUM(sales_amount), 0) AS total_amount
            FROM sales_history_daily_2568
            GROUP BY product_id, MONTH(sale_date)
        `);

        const [sales2026] = await db.query(`
            SELECT 
                sd.product_id,
                MONTH(s.sale_date) AS month,
                COALESCE(SUM(sd.quantity), 0) AS total_qty,
                COALESCE(SUM(sd.subtotal), 0) AS total_amount
            FROM sale_detail sd
            JOIN sale s ON s.sale_id = sd.sale_id
            WHERE YEAR(s.sale_date) = 2026
            GROUP BY sd.product_id, MONTH(s.sale_date)
        `);

        const [stockRec2027] = await db.query(`SELECT * FROM \`stock_recommendation_2570\``);

        res.json({
            success: true,
            sales2025,
            sales2026,
            stockRec2027
        });
    } catch (err) {
        console.error('❌ Error fetching monthly trend all:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 📌 GET: /api/products/monthly-trend-2568
router.get('/monthly-trend-2568', async (req, res) => {
    try {
        const sql = `
            SELECT 
                product_id,
                MONTH(sale_date) AS month_num,
                COALESCE(SUM(sales_qty), 0) AS monthly_qty,
                COALESCE(SUM(sales_amount), 0) AS monthly_amount
            FROM sales_history_daily_2568
            GROUP BY product_id, MONTH(sale_date)
            ORDER BY product_id, month_num;
        `;
        const [rows] = await db.query(sql);
        const formatted = rows.map(r => ({
            ...r,
            monthly_qty: safeNum(r.monthly_qty),
            monthly_amount: safeNum(r.monthly_amount)
        }));
        res.json(formatted);
    } catch (err) {
        console.error('❌ Error fetching monthly trend 2568:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// 📌 2. Dynamic & Parameterized Routes
// ==========================================

// 📌 GET: /api/products/summary-by-year/:year
router.get('/summary-by-year/:year', async (req, res) => {
    const targetYear = parseInt(req.params.year, 10);
    try {
        if (targetYear === 2024) {
            const [sales2024] = await db.query(`
                SELECT product_id, COALESCE(SUM(sales_qty), 0) AS fc_qty, COALESCE(SUM(sales_amount), 0) AS fc_amount
                FROM sales_history_2567 GROUP BY product_id
            `);
            return res.json(sales2024.map(s => ({ ...s, fc_qty: safeNum(s.fc_qty), fc_amount: safeNum(s.fc_amount) })));
        } else if (targetYear === 2025) {
            const [sales2025] = await db.query(`
                SELECT product_id, COALESCE(SUM(sales_qty), 0) AS fc_qty, COALESCE(SUM(sales_amount), 0) AS fc_amount
                FROM sales_history_daily_2568 GROUP BY product_id
            `);
            return res.json(sales2025.map(s => ({ ...s, fc_qty: safeNum(s.fc_qty), fc_amount: safeNum(s.fc_amount) })));
        } else if (targetYear === 2026) {
            const [sales2026] = await db.query(`
                SELECT sd.product_id, COALESCE(SUM(sd.quantity), 0) AS fc_qty, COALESCE(SUM(sd.subtotal), 0) AS fc_amount
                FROM sale_detail sd
                JOIN sale s ON s.sale_id = sd.sale_id
                WHERE YEAR(s.sale_date) = 2026 GROUP BY sd.product_id
            `);
            return res.json(sales2026.map(s => ({ ...s, fc_qty: safeNum(s.fc_qty), fc_amount: safeNum(s.fc_amount) })));
        } else if (targetYear === 2027) {
            const [sales2027] = await db.query(`SELECT * FROM stock_recommendation_2570`);
            return res.json(sales2027);
        }
        res.status(400).json({ error: "Invalid year parameter" });
    } catch (err) {
        console.error('❌ Error fetching summary-by-year:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 📌 GET: /api/products/ (ดึงรายการสินค้าทั้งหมด)
router.get('/', async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT 
                p.product_id,
                p.product_name,
                p.price,
                p.price AS unit_price,
                p.cost,
                p.stock,
                p.category_id,
                c.category_name
            FROM product_data p
            LEFT JOIN category c ON p.category_id = c.category_id
            ORDER BY p.product_id ASC
        `);
        res.json(products);
    } catch (err) {
        console.error('❌ Error fetching all products:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 📌 GET: /api/products/:id (ดึงสินค้าตาม ID - ต้องอยู่ล่างสุดเสมอ)
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
        console.error('❌ Error fetching product by id:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 📌 GET: /api/products/monthly-trend-chart
// ดึงข้อมูลยอดขาย 12 เดือนของปี 2024, 2025 และพยากรณ์ 2026 ใน Format เดียวกัน
router.get('/monthly-trend-chart', async (req, res) => {
    try {
        // 1. ดึงข้อมูลรายเดือนปี 2024 (ถ้ามี sale_date ให้ GROUP BY MONTH)
        // หมายเหตุ: หากตาราง sales_history_2567 ไม่มี sale_date ต้องปรับตามโครงสร้างตารางจริง
        const [sales2024] = await db.query(`
            SELECT 
                MONTH(sale_date) AS month,
                COALESCE(SUM(sales_qty), 0) AS total_qty,
                COALESCE(SUM(sales_amount), 0) AS total_amount
            FROM sales_history_2567
            GROUP BY MONTH(sale_date)
            ORDER BY month ASC
        `);

        // 2. ดึงข้อมูลรายเดือนปี 2025
        const [sales2025] = await db.query(`
            SELECT 
                MONTH(sale_date) AS month,
                COALESCE(SUM(sales_qty), 0) AS total_qty,
                COALESCE(SUM(sales_amount), 0) AS total_amount
            FROM sales_history_daily_2568
            GROUP BY MONTH(sale_date)
            ORDER BY month ASC
        `);

        // 3. ดึงข้อมูลพยากรณ์ปี 2026 (ดึงจาก stock_recommendation_2570)
        const [forecast2026Rows] = await db.query(`SELECT * FROM \`stock_recommendation_2570\``);

        // แปลงข้อมูลพยากรณ์ 12 เดือนจาก Column '2570-01 (ม.ค.)' ถึง '2570-12 (ธ.ค.)' หรือ 'm1'-'m12'
        const forecast2026 = Array.from({ length: 12 }, (_, i) => {
            const mKey1 = `2570-${String(i + 1).padStart(2, '0')}`; // เช่น 2570-01
            const mKey2 = `m${i + 1}`;
            
            const monthTotal = forecast2026Rows.reduce((sum, row) => {
                // ค้นหา Column ที่ตรงกับเดือน
                const matchingKey = Object.keys(row).find(k => k.includes(mKey1) || k === mKey2);
                return sum + safeNum(row[matchingKey]);
            }, 0);

            return {
                month: i + 1,
                total_qty: monthTotal
            };
        });

        // 4. รวมข้อมูลทั้ง 12 เดือนให้ครบสมบูรณ์ (1 - 12)
        const monthsData = Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const y2024 = sales2024.find(s => parseInt(s.month, 10) === m);
            const y2025 = sales2025.find(s => parseInt(s.month, 10) === m);
            const y2026 = forecast2026.find(s => s.month === m);

            return {
                month: m,
                sales_2024: safeNum(y2024?.total_qty || y2024?.total_amount),
                sales_2025: safeNum(y2025?.total_qty || y2025?.total_amount),
                forecast_2026: safeNum(y2026?.total_qty)
            };
        });

        res.json({
            success: true,
            data: monthsData
        });
    } catch (err) {
        console.error('❌ Error fetching monthly trend chart:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;