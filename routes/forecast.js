const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { buildProductForecast, buildDashboardStats } = require('../services/forecastEngine');
const { generateDashboardSummary, generateRestockAdvice } = require('../services/geminiService');

// 1. GET: /api/forecast -> รายการพยากรณ์รายสินค้าทั้งหมด (จากยอดขายจริงใน MySQL)
router.get('/', async (req, res) => {
  try {
    const { anchorDate, forecast } = await buildProductForecast();

    // ให้คำแนะนำ AI (Gemini) เฉพาะ top รายการเสี่ยงสต็อกขาด เพื่อประหยัด quota/เวลา
    const topRisk = [...forecast].filter(p => p.is_stock_low)
      .sort((a, b) => b.qty_to_order - a.qty_to_order);
    const aiAdvice = await generateRestockAdvice(topRisk);

    res.json({
      success: true,
      anchor_date: anchorDate,
      ai_powered: !!process.env.GEMINI_API_KEY,
      ai_advice: aiAdvice, // null ถ้ายังไม่ตั้งค่า GEMINI_API_KEY หรือเรียกไม่สำเร็จ
      data: forecast
    });
  } catch (err) {
    console.error('Error fetching forecast:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET: /api/forecast/dashboard-summary -> สรุปภาพรวมสำหรับหน้า Dashboard
router.get('/dashboard-summary', async (req, res) => {
  try {
    const stats = await buildDashboardStats();

    const aiSummaryHtml =
      (await generateDashboardSummary(stats)) ||
      `
      <p class="mb-2">📌 <b>ภาพรวมยอดขาย:</b> คาดการณ์ยอดขายรวม 7 วันข้างหน้าเท่ากับ <b>฿${stats.forecast7DaysTotal.toLocaleString()}</b> (คำนวณจากยอดขายจริงย้อนหลัง ${process.env.FORECAST_LOOKBACK_DAYS || 60} วัน)</p>
      <p class="mb-2">⚠️ <b>สินค้าต้องสั่งเพิ่ม:</b> พบสินค้าจำนวน <b>${stats.reorderCount}</b> รายการ ที่สต็อกปัจจุบันต่ำกว่าความต้องการซื้อที่คาดการณ์</p>
      <p>💡 <b>คำแนะนำสต็อก:</b> มีสินค้าเสี่ยงหมดสต็อก (คงเหลือ ≤ 5 ชิ้น) <b>${stats.riskCount}</b> รายการ ควรอัปเดตคำสั่งซื้อกับซัพพลายเออร์ทันที${!process.env.GEMINI_API_KEY ? ' (ใส่ GEMINI_API_KEY ใน .env เพื่อให้ AI ช่วยวิเคราะห์เชิงลึกกว่านี้)' : ''}</p>
      `.trim();

    res.json({
      success: true,
      ai_powered: !!process.env.GEMINI_API_KEY,
      anchorDate: stats.anchorDate,
      todaySales: stats.todaySales,
      forecast7DaysTotal: stats.forecast7DaysTotal,
      reorderCount: stats.reorderCount,
      riskCount: stats.riskCount,
      chartLabels: stats.chartLabels,
      actualSalesData: stats.actualSalesData,
      forecastSalesData: stats.forecastSalesData,
      aiSummaryHtml
    });
  } catch (err) {
    console.error('Error fetching dashboard summary:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET: /api/forecast/summary -> ข้อมูลดิบจากตาราง ai_forecast_db_ready (เก็บไว้เพื่อ backward-compat / ใช้เทียบผลโมเดลเก่า)
router.get('/summary', async (req, res) => {
  try {
    const sql = `
      SELECT
        \`COL 1\` AS date,
        \`COL 2\` AS product,
        \`COL 3\` AS predicted,
        \`COL 4\` AS actual,
        \`COL 5\` AS model,
        \`COL 6\` AS accuracy
      FROM ai_forecast_db_ready
      WHERE \`COL 1\` != 'forecast_date' AND \`COL 1\` IS NOT NULL
    `;
    const [rows] = await db.query(sql);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching summary:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
