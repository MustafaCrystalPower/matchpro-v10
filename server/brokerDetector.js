// brokerDetector.js — auto-generated from broker_detector.py v2
// Rule: mطلوب + structured = broker. Personal voice = real client.

const BROKER_NAME_PATTERNS = [
  /real\s?estate/i, /عقارات/, /بروكر/, /broker/i, /وسيط/, /تسويق/,
  /مكتب\s+/, /شركة\s+/, /properties/i, /realty/i,
  /سمسار/, /وكيل\s+عقاري/, /للعقار/, /عقاري$/, /للتسويق/,
];

const BROKER_MSG_HARD = [
  /^[🏡🏠💎🔥✨📍]\s*(للبيع|للإيجار|للايجار|متاح|حصري)/m,
  /^للبيع/m, /^للإيجار/m, /^متاح/m, /^حصري/m,
  /🔹.+\n🔹/, /تواصل\s+معي\s+للمزيد/,
  /فرصة\s+استثمارية/, /متاح\s+للتمليك/,
];

const KNOWN_BROKERS = new Set([
  'raedsharawi','رائد مكتب الروضة','amar deyap','john lnk',
  'real estate marketing','hani ibrahim','garden 100 m',
]);

const CLIENT_PERSONAL = [
  /(أنا|انا)\s+(عايز|عايزه|محتاج|بدور|بفكر)/,
  /عندي\s+ميزانية/, /معايا\s+(مبلغ|كاش)/,
  /(أسرة|اسرة|عائلة)\s+(سودانية|مصرية|محترمة|نظيفة)/,
  /(نازل|قادم|جاي)\s+من\s+(السعودية|الإمارات|دبي|السودان)/,
  /(مقيم|ساكن)\s+(السعودية|الإمارات|الخارج)/,
  /تخليص\s+حالا/,
];

function structureScore(msg) {
  const lines = msg.split('\n').map(l => l.trim()).filter(Boolean);
  let score = 0;
  const n = lines.length;
  if (n >= 4 && lines.filter(l => l.length < 45).length / n > 0.7) score += 2;
  if (lines.some(l => /^(بادج|budget|ميزانية)/i.test(l))) score += 1.5;
  if (lines.some(l => /^\d+\s*م/.test(l))) score += 1;
  if (lines.length && /^(تنفيذ|ضروري|عاجل)$/.test(lines[lines.length-1])) score += 1.5;
  if (/^مطلوب/.test(msg)) score += 1;
  return score;
}

function isBroker(name, msg) {
  const nameLow = (name||'').toLowerCase();
  if ([...KNOWN_BROKERS].some(k => nameLow.includes(k.toLowerCase()))) return true;
  if (BROKER_NAME_PATTERNS.some(p => p.test(name||''))) return true;
  if (BROKER_MSG_HARD.some(p => p.test(msg||''))) return true;
  if (structureScore(msg||'') >= 4) return true;
  if (/^مطلوب/.test(msg||'') && structureScore(msg||'') >= 2.5) return true;
  return false;
}

function isRealClient(name, msg) {
  return CLIENT_PERSONAL.some(p => p.test(msg||''));
}

function classifyMessage(name, phone, msg) {
  if (isBroker(name, msg)) return 'broker';
  if (isRealClient(name, msg)) return 'client';
  return 'unknown';
}

module.exports = { isBroker, isRealClient, classifyMessage, structureScore };
