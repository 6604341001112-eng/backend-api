// services/forecastEngine.js
// โมเดลพยากรณ์ยอดขายแบบสถิติ (Moving Average + Trend Adjustment)
// คำนวณจากข้อมูลยอดขายจริงในตาราง sale / sale_detail (ไม่ใช้ตัวเลขสุ่มหรือ mock)
//
// แนวคิด:
// 1. หาช่วงเวลาอ้างอิง (anchor date) จากวันที่ล่าสุดที่มีการขายจริงในระบบ ไม่ใช้ CURDATE()
//    ตรงๆ เพราะข้อมูลตัวอย่างอาจไม่ใช่ข้อมูล real-time
// 2. แบ่งช่วง lookback (ค่าเริ่มต้น 60 วัน) เป็นครึ่งแรก/ครึ่งหลัง เพื่อดู "แนวโน้ม"
// 3. พยากรณ์ยอดขาย 7 วันข้างหน้า = ค่าเฉลี่ยต่อวันช่วงหลัง x 7 x (1 + trend*weight)
//    โดย trend ถูก clip ไว้ไม่ให้พยากรณ์เพี้ยนสุดโต่งเกินไป

const db = require('../config/db');

const LOOKBACK_DAYS = Number(process.env.FORECAST_LOOKBACK_DAYS || 60);
const HALF = Math.floor(LOOKBACK_DAYS / 2);
const TREND_WEIGHT = 0.5;
const TREND_CLIP_MIN = -0.6;
const TREND_CLIP_MAX = 1.2;
const DEFAULT_BASELINE_QTY_7D = 5; // สินค้าที่ไม่มีประวัติขายเลย ให้ค่าตั้งต้นแบบระมัดระวัง

function clip(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

async function getAnchorDate() {
  const [rows] = await db.query('SELECT DATE(MAX(sale_date)) AS anchor FROM sale');
  return rows[0]?.anchor || new Date().toISOString().split('T')[0];
}

/**
 * ดึงยอดขายรวมต่อสินค้า แบ่งเป็นครึ่งแรก/ครึ่งหลังของช่วง lookback
 */
async function getProductSalesWindow(anchorDate) {
  const sql = `
    SELECT
      sd.product_id,
      SUM(CASE
            WHEN s.sale_date > DATE_SUB(?, INTERVAL ? DAY) AND s.sale_date <= DATE_SUB(?, INTERVAL ? DAY)
            THEN sd.quantity ELSE 0 END) AS qty_first_half,
      SUM(CASE
            WHEN s.sale_date > DATE_SUB(?, INTERVAL ? DAY) AND s.sale_date <= ?
            THEN sd.quantity ELSE 0 END) AS qty_second_half
    FROM sale_detail sd
    JOIN sale s ON sd.sale_id = s.sale_id
    WHERE s.sale_date > DATE_SUB(?, INTERVAL ? DAY) AND s.sale_date <= ?
    GROUP BY sd.product_id
  `;
  const params = [
    anchorDate, LOOKBACK_DAYS, anchorDate, HALF,   // first half window
    anchorDate, HALF, anchorDate,                   // second half window
    anchorDate, LOOKBACK_DAYS, anchorDate           // overall WHERE filter
  ];
  const [rows] = await db.query(sql, params);

  const map = new Map();
  rows.forEach(r => {
    map.set(r.product_id, {
      qtyFirstHalf: Number(r.qty_first_half || 0),
      qtySecondHalf: Number(r.qty_second_half || 0)
    });
  });
  return map;
}

/**
 * คำนวณค่าพยากรณ์ 7 วันข้างหน้าของสินค้าหนึ่งตัว จากข้อมูลยอดขายจริง
 */
function predictNext7Days(salesWindow) {
  if (!salesWindow) {
    return { predicted7d: DEFAULT_BASELINE_QTY_7D, trend: 0, avgDailyRecent: 0 };
  }
  const { qtyFirstHalf, qtySecondHalf } = salesWindow;
  const avgFirst = qtyFirstHalf / HALF;
  const avgSecond = qtySecondHalf / HALF;

  if (avgFirst === 0 && avgSecond === 0) {
    return { predicted7d: DEFAULT_BASELINE_QTY_7D, trend: 0, avgDailyRecent: 0 };
  }

  let trend = avgFirst > 0 ? (avgSecond - avgFirst) / avgFirst : (avgSecond > 0 ? 1 : 0);
  trend = clip(trend, TREND_CLIP_MIN, TREND_CLIP_MAX);

  const predicted7d = Math.max(0, Math.round(avgSecond * 7 * (1 + trend * TREND_WEIGHT)));
  return { predicted7d, trend, avgDailyRecent: Number(avgSecond.toFixed(2)) };
}

/**
 * คืนค่าพยากรณ์รายสินค้าทั้งหมด พร้อมข้อมูลสินค้า/หมวดหมู่ (ข้อมูลจริงจาก product_data + category)
 */
async function buildProductForecast() {
  const anchorDate = await getAnchorDate();
  const salesWindowMap = await getProductSalesWindow(anchorDate);

  const [products] = await db.query(`
    SELECT p.product_id, p.product_name, p.price, p.cost, p.stock,
           p.category_id, c.category_name
    FROM product_data p
    LEFT JOIN category c ON p.category_id = c.category_id
    ORDER BY p.product_id ASC
  `);

  const result = products.map(p => {
    const window = salesWindowMap.get(p.product_id);
    const { predicted7d, trend, avgDailyRecent } = predictNext7Days(window);
    const stock = Number(p.stock || 0);
    const isStockLow = stock < predicted7d;

    return {
      product_id: p.product_id,
      product_name: p.product_name,
      category_name: p.category_name || 'ทั่วไป',
      unit_price: Number(p.price || 0),
      cost: Number(p.cost || 0),
      stock,
      avg_daily_sales_recent: avgDailyRecent,
      trend_pct: Math.round(trend * 100),
      predicted_sales: predicted7d,
      qty_to_order: Math.max(0, predicted7d - stock),
      is_stock_low: isStockLow
    };
  });

  return { anchorDate, forecast: result };
}

/**
 * สรุปยอดสำหรับ Dashboard: ยอดขายจริงย้อนหลัง 7 วัน + คาดการณ์ 7 วันข้างหน้า (รวมทั้งร้าน)
 */
async function buildDashboardStats() {
  const { anchorDate, forecast } = await buildProductForecast();

  const forecast7DaysTotal = forecast.reduce((sum, p) => sum + p.predicted_sales * p.unit_price, 0);
  const reorderCount = forecast.filter(p => p.is_stock_low).length;
  const riskCount = forecast.filter(p => p.stock <= 5).length;

  const topGrowthProducts = [...forecast]
    .filter(p => p.trend_pct > 0)
    .sort((a, b) => b.trend_pct - a.trend_pct)
    .slice(0, 5);
  const topDeclineProducts = [...forecast]
    .filter(p => p.trend_pct < 0)
    .sort((a, b) => a.trend_pct - b.trend_pct)
    .slice(0, 5);

  // ยอดขายจริงย้อนหลัง 7 วัน (real data จาก sale)
  const [actualRows] = await db.query(
    `SELECT DATE(sale_date) AS d, SUM(total_amount) AS total
     FROM sale
     WHERE sale_date > DATE_SUB(?, INTERVAL 6 DAY) AND sale_date <= ?
     GROUP BY DATE(sale_date)
     ORDER BY d ASC`,
    [anchorDate, anchorDate]
  );

  const actualMap = new Map(actualRows.map(r => [r.d, Number(r.total)]));
  const past7Labels = [];
  const past7Values = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    past7Labels.push(key);
    past7Values.push(actualMap.get(key) || 0);
  }

  // กระจายยอดพยากรณ์ 7 วันข้างหน้าเป็นรายวัน (ถัวเฉลี่ยตามสัดส่วนเดิม ถ้าไม่มีข้อมูลให้หารเท่ากัน)
  const avgPastDaily = past7Values.reduce((a, b) => a + b, 0) / 7 || forecast7DaysTotal / 7;
  const future7Labels = [];
  const future7Values = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() + i);
    future7Labels.push(d.toISOString().split('T')[0]);
    // กระจายตามสัดส่วนน้ำหนักเท่ากันบนฐานยอดพยากรณ์รวม (คงยอดรวมให้ตรงกับ forecast7DaysTotal)
    future7Values.push(Math.round(forecast7DaysTotal / 7));
  }

  const chartLabels = [...past7Labels, ...future7Labels];
  const actualSalesData = [...past7Values.map(v => Math.round(v)), ...future7Labels.map(() => null)];
  const forecastSalesData = [...past7Labels.map(() => null), ...future7Values];

  const todaySales = past7Values[past7Values.length - 1] || 0;

  return {
    anchorDate,
    todaySales,
    forecast7DaysTotal: Math.round(forecast7DaysTotal),
    reorderCount,
    riskCount,
    chartLabels,
    actualSalesData,
    forecastSalesData,
    topGrowthProducts,
    topDeclineProducts,
    reorderList: forecast.filter(p => p.is_stock_low).sort((a, b) => b.qty_to_order - a.qty_to_order)
  };
}

module.exports = { buildProductForecast, buildDashboardStats, LOOKBACK_DAYS };
