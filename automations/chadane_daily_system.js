#!/usr/bin/env node
/**
 * Chadane Daily Task Report System
 * Crystal Power Investments — Property Manager Daily Briefings
 *
 * Usage:
 *   node chadane_daily_system.js morning   → 9AM Cairo (07:00 UTC)
 *   node chadane_daily_system.js evening   → 8PM Cairo (18:00 UTC)
 */

const { execSync } = require('child_process');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const GREEN_API_BASE = 'https://7105.api.greenapi.com/waInstance7105409203';
const TOKEN = '0e7ca429980f4331ae5fee4360c955a9db2d6fe3ca6545a4b3';
const CHADANE_CHAT_ID = '201143200551@c.us';

// ─── TASK LISTS ──────────────────────────────────────────────────────────────
const PROPERTY_TASKS = [
  'بريفادو — متابعة المستأجرين المحتملين (0 متابعة)',
  'دريم لاند — تحديث الأسعار وحالة الوحدة',
  'B7 مدينتي — تحصيل الإيجار المتأخر (28,000 ج)',
];

const REPORTING_TASKS = [
  'إرسال تقرير البروكرز اليومي (MatchPro)',
  'متابعة الـ leads الجديدة في WhatsApp',
];

const MORNING_PRIORITIES = [
  'بريفادو — تابعي المستأجرين المحتملين',
  'دريم لاند — حدّثي الأسعار وحالة الوحدات',
  'تقرير البروكرز اليومي (MatchPro)',
];

// ─── MESSAGE BUILDERS ────────────────────────────────────────────────────────
function buildEveningMessage() {
  const propertyLines = PROPERTY_TASKS.map(t => `□ ${t}`).join('\n');
  const reportLines = REPORTING_TASKS.map(t => `□ ${t}`).join('\n');

  return `🌙 تقرير نهاية اليوم — شادان

📋 مهام اليوم:

🏠 العقارات:
${propertyLines}

📊 التقارير:
${reportLines}

💼 متنوع:
□ _______________

✅ أجوبي بـ "تم X" أو "لم يتم X — السبب" لكل بند
مثال: "تم بريفادو" أو "لم يتم B7 — المستأجر مش بيرد"`;
}

function buildMorningMessage() {
  const priorityLines = MORNING_PRIORITIES.map((t, i) => `${i + 1}. ${t}`).join('\n');

  return `☀️ صباح الخير شادان!

مهامك النهارده:
${priorityLines}

عندك أي استفسار، كلمي في أي وقت 💪`;
}

// ─── SEND VIA GREEN-API ──────────────────────────────────────────────────────
function sendWhatsApp(message) {
  const url = `${GREEN_API_BASE}/sendMessage/${TOKEN}`;
  const payload = JSON.stringify({
    chatId: CHADANE_CHAT_ID,
    message: message,
  });

  // Escape for shell
  const escapedPayload = payload.replace(/'/g, "'\\''");
  const cmd = `curl -s -X POST '${url}' -H 'Content-Type: application/json' -d '${escapedPayload}'`;

  try {
    const result = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    const parsed = JSON.parse(result);
    if (parsed.idMessage) {
      console.log(`✅ Message sent successfully. ID: ${parsed.idMessage}`);
      return { success: true, id: parsed.idMessage };
    } else {
      console.error('❌ Unexpected response:', result);
      return { success: false, response: result };
    }
  } catch (err) {
    console.error('❌ Failed to send message:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const mode = process.argv[2];

if (!mode || !['morning', 'evening'].includes(mode)) {
  console.error('Usage: node chadane_daily_system.js <morning|evening>');
  process.exit(1);
}

console.log(`[${new Date().toISOString()}] Running Chadane Daily System — mode: ${mode}`);

let message;
if (mode === 'morning') {
  message = buildMorningMessage();
  console.log('📤 Sending morning activation message to Chadane...');
} else {
  message = buildEveningMessage();
  console.log('📤 Sending evening task report to Chadane...');
}

console.log('\n--- Message Preview ---');
console.log(message);
console.log('---\n');

const result = sendWhatsApp(message);
process.exit(result.success ? 0 : 1);
