// /api/oyak?index=XKTUM
// OYAK Yatırım piyasa verileri sayfasını, Kuveyt Türk/BIST evrenindeki hisseler için güncel fiyat snapshot fallback'i olarak kullanır.
// Search result/source pages expose: Sembol, Hisse Adı, Son, Yüksek, Düşük, İşlem Hacmi, Günlük%, Haftalık%, Aylık%, Yıllık%.

import { cleanSymbol, sendJson } from './kuveytturk.js';

const URLS = {
  XKTUM: 'https://www.oyakyatirim.com.tr/piyasa-verileri/XKTUM',
  XK100: 'https://www.oyakyatirim.com.tr/piyasa-verileri/XK100',
  XK050: 'https://www.oyakyatirim.com.tr/piyasa-verileri/XK050',
  XK030: 'https://www.oyakyatirim.com.tr/piyasa-verileri/XK030'
};
const CACHE_MS = 3 * 60 * 1000;
const cache = globalThis.__KR_OYAK_CACHE__ || new Map();
globalThis.__KR_OYAK_CACHE__ = cache;

function parseNum(v) {
  if (v == null) return null;
  let s = String(v).trim().replace(/%/g,'').replace(/\s/g,'');
  if (!s || s === '-') return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g,'').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s.replace(/[^0-9.-]/g,''));
  return Number.isFinite(n) ? n : null;
}
function strip(html='') { return String(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim(); }
async function fetchPage(url) {
  const ac = new AbortController(); const t = setTimeout(()=>ac.abort(), 18000);
  try {
    const r = await fetch(url, { signal: ac.signal, headers:{ 'User-Agent':'Mozilla/5.0 (compatible; KatilimRadar/1.6; +https://vercel.app)', 'Accept':'text/html,*/*', 'Accept-Language':'tr-TR,tr;q=0.9,en;q=0.8' } });
    const text = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0,120)}`);
    return text;
  } finally { clearTimeout(t); }
}
function parseRows(html) {
  const text = strip(html);
  const out = [];
  // Symbol + name + 8 numeric cells. This is intentionally tolerant because the site may render tables server-side.
  const re = /\b([A-Z]{2,6}[A-Z0-9]{0,4})\b\s+([A-ZÇĞİÖŞÜ0-9 .,&'’\-]+?)\s+([-+]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s+([-+]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s+([-+]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s+([-+]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s+([-+]?\d{1,3}(?:[.,]\d+)?)\s+([-+]?\d{1,3}(?:[.,]\d+)?)\s+([-+]?\d{1,3}(?:[.,]\d+)?)\s+([-+]?\d{1,3}(?:[.,]\d+)?)/g;
  const blacklist = new Set(['BIST','Sembol'.toUpperCase(),'HISSE','HİSSE','SON','YUKSEK','YÜKSEK','DUSUK','DÜŞÜK']);
  for (const m of text.matchAll(re)) {
    const symbol = cleanSymbol(m[1]);
    if (!symbol || blacklist.has(symbol)) continue;
    out.push({
      symbol,
      name: m[2].trim(),
      price: parseNum(m[3]),
      high: parseNum(m[4]),
      low: parseNum(m[5]),
      volume: parseNum(m[6]),
      changePct: parseNum(m[7]),
      weeklyPct: parseNum(m[8]),
      monthlyPct: parseNum(m[9]),
      yearlyPct: parseNum(m[10]),
      provider: 'oyak',
      source: 'OYAK Yatırım piyasa verileri'
    });
  }
  // fallback: parse JSON-like snippets if table regex fails
  if (!out.length) {
    const symRe = /["'](?:symbol|sembol|kod|hisseKodu)["']\s*:\s*["']([A-Z0-9]{2,10})["'][\s\S]{0,500}?["'](?:son|last|price|fiyat|kapanis|close)["']\s*:\s*["']?([-+]?\d+(?:[.,]\d+)?)/gi;
    for (const m of html.matchAll(symRe)) out.push({ symbol: cleanSymbol(m[1]), price: parseNum(m[2]), provider:'oyak', source:'OYAK Yatırım piyasa verileri' });
  }
  const map = new Map();
  for (const r of out) if (r.symbol && r.price != null) map.set(r.symbol, r);
  return [...map.values()];
}
export async function fetchOyakIndex(index='XKTUM') {
  const idx = String(index || 'XKTUM').toUpperCase();
  const url = URLS[idx] || URLS.XKTUM;
  const key = `oyak:${idx}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_MS) return { ...hit.data, cache:'hit' };
  const html = await fetchPage(url);
  const items = parseRows(html);
  if (!items.length) throw new Error('OYAK sayfasından fiyat tablosu parse edilemedi');
  const data = { ok:true, source:'OYAK Yatırım piyasa verileri', url, index:idx, fetchedAt:new Date().toISOString(), count:items.length, items };
  cache.set(key, { ts:Date.now(), data });
  return { ...data, cache:'miss' };
}
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok:true });
  try {
    const data = await fetchOyakIndex(req.query.index || 'XKTUM');
    return sendJson(res, 200, data, 's-maxage=120, stale-while-revalidate=300');
  } catch (err) {
    return sendJson(res, 502, { ok:false, source:'OYAK Yatırım', error:err.message }, 's-maxage=30, stale-while-revalidate=60');
  }
}
