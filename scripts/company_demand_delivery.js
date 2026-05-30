/**
 * COMPANY DEMAND DELIVERY SYSTEM
 * Every 12 hours: match company's sell locations → send relevant buyers via WhatsApp
 * Companies register: company name, areas they sell in, WhatsApp number
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/matchpro.db');
const INSTANCE = '7105409203';
const TOKEN = '0e7ca429980f4331ae5fee4360c955a9db2d6fe3ca6545a4b3';

// Company registry — add companies here
const COMPANIES = [
  {
    name: 'إيهاب الهاشمي',
    phone: null, // Mo'men will provide
    areas: ['مدينتي', 'Madinaty', 'B15', 'B11', 'B12', 'التجمع الخامس'],
    propertyTypes: ['فيلا', 'شقة', 'villa'],
    priceMin: 5000000,
    reportCode: 'IHAB',
  },
  {
    name: 'محمد أبو حجر',
    phone: null, // wrong number — pending
    areas: ['التجمع الخامس', 'New Cairo', 'القاهرة الجديدة', 'mountain view'],
    propertyTypes: ['شقة', 'فيلا', 'apartment'],
    priceMin: 3000000,
    reportCode: 'ABU_HAJR',
  },
];

async function sendWhatsApp(chatId, message) {
  const { execSync } = require('child_process');
  try {
    const cmd = `curl -s -X POST "https://7105.api.greenapi.com/waInstance${INSTANCE}/sendMessage/${TOKEN}" ` +
      `-H 'Content-Type: application/json' ` +
      `-d '${JSON.stringify({ chatId, message }).replace(/'/g, "'\\''")}'`;
    const result = execSync(cmd, { timeout: 10000 }).toString();
    const r = JSON.parse(result);
    return !!r.idMessage;
  } catch(e) {
    return false;
  }
}

function getDemandForCompany(company, db, hours = 12) {
  const locationFilters = company.areas.map(() => 
    `(d.location LIKE ? OR d.area LIKE ? OR d.location_cluster LIKE ?)`
  ).join(' OR ');
  
  const params = [];
  company.areas.forEach(area => {
    params.push(`%${area}%`, `%${area}%`, `%${area}%`);
  });
  
  // Add time filter
  params.push(hours);
  
  const query = `
    SELECT 
      d.sender_name,
      d.sender_phone,
      d.location,
      d.area,
      d.price_max,
      d.bedrooms,
      d.property_type,
      d.purpose,
      d.raw_message,
      d.created_at,
      d.group_name
    FROM demand d
    WHERE (${locationFilters})
    AND d.created_at >= datetime('now', '-' || ? || ' hours')
    AND d.sender_phone IS NOT NULL
    ORDER BY d.created_at DESC
    LIMIT 50
  `;
  
  try {
    return db.prepare(query).all(...params);
  } catch(e) {
    // Fallback: simpler query
    const simpleQuery = `
      SELECT sender_name, sender_phone, location, area, price_max, bedrooms, 
             property_type, purpose, raw_message, created_at, group_name
      FROM demand 
      WHERE created_at >= datetime('now', '-${hours} hours')
      ORDER BY created_at DESC LIMIT 50
    `;
    return db.prepare(simpleQuery).all();
  }
}

function formatDemandReport(company, buyers, period = '12 ساعة') {
  const now = new Date().toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  if (buyers.length === 0) {
    return `📊 *MatchPro™ — تقرير ${company.name}*\n📅 ${now}\n\n⚪ لا يوجد طلبات جديدة في المناطق المحددة خلال آخر ${period}.\n\nالمناطق المراقبة: ${company.areas.join('، ')}`;
  }

  let msg = `📊 *MatchPro™ — طلبات جديدة لـ ${company.name}*\n`;
  msg += `📅 ${now} | آخر ${period}\n`;
  msg += `📍 المناطق: ${company.areas.slice(0,3).join('، ')}\n`;
  msg += `👥 *${buyers.length} مشتري/مستأجر نشط*\n\n`;
  msg += `━━━━━━━━━━━━━━━━━\n\n`;

  buyers.slice(0, 15).forEach((b, i) => {
    const budget = b.price_max ? 
      (b.price_max >= 1000000 ? `${(b.price_max/1000000).toFixed(1)}M EGP` : `${(b.price_max/1000).toFixed(0)}K EGP`) 
      : '—';
    const rooms = b.bedrooms ? `${b.bedrooms} غرف` : '—';
    const purpose = b.purpose === 'rent' ? 'إيجار' : b.purpose === 'buy' ? 'شراء' : b.purpose || '—';
    
    msg += `*${i+1}. ${b.sender_name || 'مشتري'}*\n`;
    msg += `📱 ${b.sender_phone || '—'}\n`;
    msg += `📍 ${b.area || b.location || '—'} | 💰 ${budget} | 🛏 ${rooms}\n`;
    msg += `🎯 ${purpose}\n\n`;
  });

  if (buyers.length > 15) {
    msg += `\n...و ${buyers.length - 15} مشتري آخر\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━\n`;
  msg += `🤖 MatchPro™ Intelligence | Crystal Power Investments`;
  
  return msg;
}

async function runDelivery(hoursBack = 12) {
  console.log(`🚀 Starting company demand delivery (last ${hoursBack}h)...`);
  
  const db = new Database(DB_PATH, { readonly: true });
  
  // Also send summary to Mo'men
  const MOMEN = '201066505665@c.us';
  
  for (const company of COMPANIES) {
    if (!company.phone) {
      console.log(`⚠️  ${company.name}: No phone configured, skipping WhatsApp delivery`);
      
      // Still get the data and report to Mo'men
      const buyers = getDemandForCompany(company, db, hoursBack);
      const report = formatDemandReport(company, buyers, `${hoursBack} ساعة`);
      console.log(`   Found ${buyers.length} buyers for ${company.name}`);
      
      // Send to Mo'men with note
      const moMsg = `📊 *تقرير ${company.name} — للمراجعة*\n⚠️ رقم الشركة مش متسجل بعد\n\n` + report;
      await sendWhatsApp(MOMEN, moMsg);
      continue;
    }
    
    const buyers = getDemandForCompany(company, db, hoursBack);
    console.log(`   ${company.name}: ${buyers.length} buyers found`);
    
    const report = formatDemandReport(company, buyers, `${hoursBack} ساعة`);
    const sent = await sendWhatsApp(`${company.phone}@c.us`, report);
    console.log(`   Delivery to ${company.name}: ${sent ? '✅' : '❌'}`);
  }
  
  db.close();
  console.log('✅ Delivery complete');
}

// Run immediately if called directly
if (require.main === module) {
  const hours = parseInt(process.argv[2]) || 12;
  runDelivery(hours).catch(console.error);
}

module.exports = { runDelivery, getDemandForCompany, formatDemandReport, COMPANIES };
