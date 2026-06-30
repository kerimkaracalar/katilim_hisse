// /api/snapshot?symbols=ASELS,BIMAS,TUPRS&range=1mo
// Latest snapshot priority: OYAK Yatırım katılım market table -> İş Yatırım/Yahoo history fallback.

import { cleanSymbol, fetchBestBars } from './isyatirim.js';
import { fetchOyakIndex } from './oyak.js';

function send(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=600');
  res.end(JSON.stringify(payload));
}
function round(v, d=2) { return Number.isFinite(v) ? Number(v.toFixed(d)) : null; }
async function mapLimit(items, limit, fn) {
  const ret = []; let i = 0;
  async function worker() { while (i < items.length) { const idx = i++; ret[idx] = await fn(items[idx], idx); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return ret;
}
function quoteFromOyak(row) {
  return {
    ok:true,
    symbol: row.symbol,
    name: row.name,
    source: row.source || 'OYAK Yatırım piyasa verileri',
    provider: 'oyak',
    price: round(row.price),
    previousClose: row.changePct != null && row.price != null ? round(row.price / (1 + row.changePct/100)) : null,
    change: row.changePct != null && row.price != null ? round(row.price - (row.price / (1 + row.changePct/100))) : null,
    changePct: round(row.changePct),
    weeklyPct: round(row.weeklyPct),
    monthlyPct: round(row.monthlyPct),
    yearlyPct: round(row.yearlyPct),
    high: round(row.high),
    low: round(row.low),
    volume: row.volume || 0,
    lastBar: new Date().toISOString().slice(0,10)
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });
  const raw = req.query.symbols || req.query.s || 'ASELS,BIMAS,TUPRS';
  const symbols = [...new Set(String(raw).split(',').map(cleanSymbol).filter(Boolean))].slice(0, Number(req.query.max || 160));
  const range = req.query.range || '1mo';
  const started = Date.now();
  const failed = [];
  const items = [];
  const remaining = new Set(symbols);
  let oyakMeta = null;

  // First get current price table from OYAK's participation index market page.
  try {
    const oyak = await fetchOyakIndex(req.query.index || 'XKTUM');
    oyakMeta = { ok:true, source:oyak.source, cache:oyak.cache, count:oyak.count, url:oyak.url };
    const map = new Map((oyak.items || []).map(x => [x.symbol, x]));
    for (const s of symbols) {
      const row = map.get(s);
      if (row && row.price != null) { items.push(quoteFromOyak(row)); remaining.delete(s); }
    }
  } catch (e) {
    oyakMeta = { ok:false, error:e.message };
  }

  // Fallback for symbols not in OYAK table: İş Yatırım/Yahoo last bar.
  const fallbackRows = await mapLimit([...remaining], 5, async (s) => {
    try {
      const data = await fetchBestBars(s, range, '1d');
      const bars = data.bars || [];
      const last = bars[bars.length - 1];
      const prev = bars[bars.length - 2];
      return { ok: true, symbol: s, source: data.source, provider: data.provider, price: round(last?.close), previousClose: round(prev?.close), change: round(last?.close - prev?.close), changePct: prev?.close ? round((last.close - prev.close)/prev.close*100) : null, volume: last?.volume || 0, lastBar: last?.date };
    } catch (err) { return { ok: false, symbol: s, error: err.message }; }
  });
  for (const r of fallbackRows) r.ok ? items.push(r) : failed.push(r);

  const ordered = symbols.map(s => items.find(x => x.symbol === s)).filter(Boolean);
  return send(res, 200, {
    ok: true,
    source: 'OYAK current snapshot + İş Yatırım/Yahoo fallback',
    count: symbols.length,
    success: ordered.length,
    failed,
    oyak: oyakMeta,
    elapsedMs: Date.now() - started,
    items: ordered
  });
}
