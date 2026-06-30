// /api/cache?symbols=ASELS,BIMAS&range=1y
// Warms the stable history cache. Keep batches small from the frontend.
import { cleanSymbol, fetchBestBars, cacheStats } from './isyatirim.js';
function send(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}
async function readBody(req) {
  if (req.method !== 'POST') return {};
  const chunks=[]; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}
async function mapLimit(items, limit, fn) {
  const ret=[]; let i=0;
  async function worker(){ while(i<items.length){ const idx=i++; ret[idx]=await fn(items[idx], idx); } }
  await Promise.all(Array.from({length:Math.min(limit, items.length)}, worker));
  return ret;
}
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 200, { ok:true });
  const body = await readBody(req);
  const raw = body.symbols || req.query.symbols || req.query.s || '';
  const symbols = [...new Set((Array.isArray(raw) ? raw : String(raw).split(',')).map(cleanSymbol).filter(Boolean))].slice(0, Number(req.query.max || body.max || 20));
  const range = body.range || req.query.range || '1y';
  const started = Date.now();
  const rows = await mapLimit(symbols, 4, async s => {
    try {
      const data = await fetchBestBars(s, range, '1d');
      return { ok:true, symbol:s, bars:data.bars?.length || 0, provider:data.provider, cacheMode:data.cacheMode, lastBar:data.lastBar?.date };
    } catch(e) { return { ok:false, symbol:s, error:e.message }; }
  });
  return send(res, 200, { ok:true, range, count:symbols.length, success:rows.filter(x=>x.ok).length, failed:rows.filter(x=>!x.ok), items:rows.filter(x=>x.ok), cache:cacheStats(), elapsedMs:Date.now()-started });
}
