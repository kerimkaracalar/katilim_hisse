// /api/snapshot?symbols=ASELS,BIMAS,TUPRS&range=1mo
// Lightweight latest snapshot using İş Yatırım daily history last bar.

import { cleanSymbol, fetchBestBars } from './isyatirim.js';

function send(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  res.end(JSON.stringify(payload));
}
function round(v, d=2) { return Number.isFinite(v) ? Number(v.toFixed(d)) : null; }
async function mapLimit(items, limit, fn) {
  const ret = []; let i = 0;
  async function worker() { while (i < items.length) { const idx = i++; ret[idx] = await fn(items[idx], idx); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return ret;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });
  const raw = req.query.symbols || req.query.s || 'ASELS,BIMAS,TUPRS';
  const symbols = [...new Set(String(raw).split(',').map(cleanSymbol).filter(Boolean))].slice(0, Number(req.query.max || 120));
  const range = req.query.range || '1mo';
  const started = Date.now();
  const rows = await mapLimit(symbols, 6, async (s) => {
    try {
      const data = await fetchBestBars(s, range, '1d');
      const bars = data.bars || [];
      const last = bars[bars.length - 1];
      const prev = bars[bars.length - 2];
      return { ok: true, symbol: s, source: data.source, provider: data.provider, price: round(last?.close), previousClose: round(prev?.close), change: round(last?.close - prev?.close), changePct: prev?.close ? round((last.close - prev.close)/prev.close*100) : null, volume: last?.volume || 0, lastBar: last?.date };
    } catch (err) {
      return { ok: false, symbol: s, error: err.message };
    }
  });
  return send(res, 200, { ok: true, source: 'İş Yatırım primary + Yahoo fallback snapshot', count: rows.length, success: rows.filter(x=>x.ok).length, failed: rows.filter(x=>!x.ok), elapsedMs: Date.now() - started, items: rows.filter(x=>x.ok) });
}
