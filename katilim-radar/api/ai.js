// POST /api/ai { analysis: {...}, universeSummary: [...] }
// Optional Gemini proxy. If GEMINI_API_KEY is absent, returns deterministic technical summary.

function send(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function fallback(analysis) {
  if (!analysis) return 'Analiz verisi alınamadı.';
  const ind = analysis.indicators || {};
  const lvl = analysis.levels || {};
  const plan = analysis.positionPlan || {};
  const opp = analysis.opportunity || {};
  const plus = (analysis.reasons || []).map(x => `• ${x}`).join('\n');
  const minus = (analysis.cautions || []).map(x => `• ${x}`).join('\n');
  const oppLines = (opp.reasons || []).map(x => `• ${x}`).join('\n');
  return `## ${analysis.symbol} teknik pozisyon özeti\n\n**Genel görünüm:** ${analysis.verdict} — teknik skor **${analysis.score}/100**. Son fiyat ${analysis.price} ${analysis.currency || 'TRY'}; günlük değişim ${analysis.changePct ?? '—'}%.\n\n**Fırsat durumu:** ${opp.label || 'Fırsat bekleniyor'} — fırsat skoru **${opp.score ?? analysis.score}/100**.\n${oppLines || '• Net fırsat sinyali henüz oluşmadı.'}\n\n**Pozisyon planı:** ${plan.stance || 'İZLE'}. Takip bölgesi ${plan.entryZone?.low ?? '—'} - ${plan.entryZone?.high ?? '—'}, geçersizleşme/takip stop ${plan.invalidation ?? lvl.stop ?? '—'}, hedefler ${plan.target1 ?? lvl.target1 ?? '—'} / ${plan.target2 ?? lvl.target2 ?? '—'}. Risk/ödül yaklaşık ${plan.riskReward1 ?? '—'} / ${plan.riskReward2 ?? '—'}.\n\n**Trend:** Fiyat EMA20 (${ind.ema20 ?? '—'}) ve EMA50 (${ind.ema50 ?? '—'}) seviyelerine göre değerlendiriliyor. RSI14 ${ind.rsi14 ?? '—'}, MACD histogram ${ind.macdHist ?? '—'}.\n\n**Destek/direnç:** Yakın destek ${lvl.support ?? '—'}, direnç ${lvl.resistance ?? '—'}, ATR bazlı takip seviyesi ${lvl.stop ?? '—'}.\n\n**Olumlu sinyaller**\n${plus || '• Net olumlu sinyal sınırlı.'}\n\n**Risk / dikkat**\n${minus || '• Belirgin teknik uyarı sınırlı.'}\n\nBu çıktı yalnızca teknik analiz amaçlıdır; yatırım tavsiyesi değildir.`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST kullanın.' });
  const body = await readBody(req);
  const analysis = body.analysis;
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    return send(res, 200, { ok: true, mode: 'fallback', reason: 'GEMINI_API_KEY tanımlı değil.', text: fallback(analysis) });
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const prompt = `Sen Borsa İstanbul katılım hisseleri için çalışan, temkinli bir teknik analiz asistanısın.
Sadece verilen verileri kullan. Yatırım tavsiyesi verme. Net ama kısa Türkçe rapor hazırla.
Başlıklar: 1) Genel teknik görünüm 2) Olumlu sinyaller 3) Riskler 4) Destek/direnç ve takip seviyeleri 5) İzlenecek senaryo.
Veri paketi:\n${JSON.stringify({ analysis, universeSummary: body.universeSummary || [] }).slice(0, 22000)}`;

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json?.error?.message || `Gemini HTTP ${r.status}`);
    const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    return send(res, 200, { ok: true, mode: 'gemini', model, text: text || fallback(analysis) });
  } catch (err) {
    return send(res, 200, { ok: true, mode: 'fallback', reason: err.message, text: fallback(analysis) });
  }
}
