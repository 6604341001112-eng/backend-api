// services/geminiService.js
// ตัวกลางเรียกใช้ Google Gemini API (REST) สำหรับสร้างบทวิเคราะห์/คำแนะนำภาษาธรรมชาติ
// ถ้าไม่ได้ตั้งค่า GEMINI_API_KEY หรือเรียก API ไม่สำเร็จ ฟังก์ชันจะคืนค่า null
// เพื่อให้ระบบ fallback ไปใช้สรุปผลแบบ template (ไม่ทำให้ระบบล่ม)

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function getEndpoint() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
}

/**
 * ส่ง prompt ไปยัง Gemini แล้วคืนค่าข้อความล้วน (plain text)
 * @param {string} prompt
 * @param {number} timeoutMs
 * @returns {Promise<string|null>}
 */
async function askGemini(prompt, timeoutMs = 12000) {
  const endpoint = getEndpoint();
  if (!endpoint) return null; // ยังไม่ตั้งค่า API key

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 600
        }
      })
    });

    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`⚠️ Gemini API ตอบกลับผิดพลาด (${res.status}):`, errText.slice(0, 300));
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n').trim();
    return text || null;
  } catch (err) {
    clearTimeout(timer);
    console.warn('⚠️ เรียก Gemini API ไม่สำเร็จ:', err.message);
    return null;
  }
}

/**
 * สร้างสรุปผลวิเคราะห์ AI สำหรับหน้า Dashboard (คืนค่าเป็น HTML ย่อหน้าเล็ก ๆ)
 */
async function generateDashboardSummary(stats) {
  const {
    forecast7DaysTotal,
    todaySales,
    reorderCount,
    riskCount,
    topGrowthProducts = [],
    topDeclineProducts = []
  } = stats;

  const prompt = `
คุณเป็นนักวิเคราะห์ข้อมูลสต็อกและยอดขายให้ร้านค้าเครื่องบริโภค (consumables) ในไทย
นี่คือข้อมูลจริงจากระบบวันนี้:
- ยอดขายจริงล่าสุด: ${todaySales.toLocaleString()} บาท
- คาดการณ์ยอดขายรวม 7 วันข้างหน้า (จากโมเดลสถิติ Moving Average + Trend): ${forecast7DaysTotal.toLocaleString()} บาท
- จำนวนสินค้าที่สต็อกต่ำกว่าความต้องการที่คาดการณ์ (ควรสั่งเพิ่ม): ${reorderCount} รายการ
- จำนวนสินค้าเสี่ยงหมดสต็อก (stock <= 5 ชิ้น): ${riskCount} รายการ
- สินค้าที่ยอดขายกำลังเติบโตแรง: ${topGrowthProducts.slice(0, 5).map(p => p.product_name).join(', ') || 'ไม่มีข้อมูล'}
- สินค้าที่ยอดขายกำลังลดลง: ${topDeclineProducts.slice(0, 5).map(p => p.product_name).join(', ') || 'ไม่มีข้อมูล'}

โปรดเขียนสรุปผลวิเคราะห์ธุรกิจสั้น ๆ เป็นภาษาไทย 3 บรรทัด ในรูปแบบ HTML โดยแต่ละบรรทัดอยู่ใน <p> tag เดียว
บรรทัดที่ 1 ขึ้นต้นด้วย "📌" สรุปภาพรวมยอดขาย
บรรทัดที่ 2 ขึ้นต้นด้วย "⚠️" เกี่ยวกับสินค้าที่ต้องสั่งเพิ่ม
บรรทัดที่ 3 ขึ้นต้นด้วย "💡" คำแนะนำเชิงกลยุทธ์สำหรับเจ้าของร้าน
ห้ามใส่ markdown, ห้ามมีคำอธิบายอื่นนอกจาก <p> 3 บรรทัดนี้
`.trim();

  const text = await askGemini(prompt);
  if (!text) return null;

  // กันเคส Gemini ห่อ code fence มาด้วย
  return text.replace(/```html/gi, '').replace(/```/g, '').trim();
}

/**
 * สร้างคำแนะนำสั้น ๆ สำหรับรายการสินค้าเสี่ยงสต็อกขาด (top N)
 */
async function generateRestockAdvice(items) {
  if (!items || items.length === 0) return null;

  const list = items
    .slice(0, 15)
    .map(
      (p, i) =>
        `${i + 1}. ${p.product_name} | สต็อกปัจจุบัน: ${p.stock} | คาดการณ์ขาย 7 วัน: ${p.predicted_sales} | หมวดหมู่: ${p.category_name}`
    )
    .join('\n');

  const prompt = `
คุณเป็นผู้ช่วยจัดการสต็อกสินค้าเครื่องบริโภคให้ร้านค้า นี่คือรายการสินค้าที่มีความเสี่ยงสต็อกไม่พอขายใน 7 วันข้างหน้า (คำนวณจากยอดขายจริง):
${list}

โปรดเขียนคำแนะนำสั้น ๆ ภาษาไทย ไม่เกิน 4 ประโยค บอกว่าควรให้ความสำคัญกับกลุ่มสินค้าใดก่อน และเหตุผลเชิงธุรกิจ
ห้ามใช้ markdown, ตอบเป็นข้อความล้วนเท่านั้น
`.trim();

  return await askGemini(prompt);
}

module.exports = { askGemini, generateDashboardSummary, generateRestockAdvice };
