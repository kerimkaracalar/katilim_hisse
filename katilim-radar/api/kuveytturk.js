// /api/kuveytturk?mode=universe|indexes|company&index=XK100&symbol=ASELS
// Kuveyt Türk Yatırım katılım sayfasını karar-destek sistemine referans kaynak olarak bağlar.
// Amaç: Katılım evreni, endeks pano değerleri ve şirket uygunluk/detail sayfası linklerini almak.
// Not: Hisse bazlı OHLC geçmişi bu sayfada yoksa teknik analiz için market/history fallbackleri kullanılır.

const KT_BASE = 'https://kuveytturkyatirim.com.tr';
const KT_KATILIM_URL = `${KT_BASE}/katilim-endeksleri/`;
const FETCH_TIMEOUT_MS = 18000;
const CACHE_MS = 10 * 60 * 1000;
const cache = globalThis.__KR_KT_CACHE__ || new Map();
globalThis.__KR_KT_CACHE__ = cache;

export function sendJson(res, status, payload, cacheHeader='s-maxage=300, stale-while-revalidate=900') {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (cacheHeader) res.setHeader('Cache-Control', cacheHeader);
  res.end(JSON.stringify(payload));
}
export function cleanSymbol(input = '') {
  return String(input).trim().toUpperCase().replace(/\.E$/,'').replace(/\.IS$/,'').replace(/[^A-Z0-9]/g, '').slice(0, 12);
}
function stripTags(html='') {
  return String(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#x27;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
}
function parseTRNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v == null) return null;
  let s = String(v).trim().replace(/%/g,'').replace(/₺/g,'').replace(/TL/gi,'').replace(/\s/g,'');
  if (!s || s === '-') return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g,'').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s.replace(/[^0-9.-]/g,''));
  return Number.isFinite(n) ? n : null;
}
async function fetchText(url, accept='text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8') {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: ac.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KatilimRadar/1.6; +https://vercel.app)',
        'Accept': accept,
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
        'Referer': KT_BASE
      }
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0,140)}`);
    return text;
  } finally { clearTimeout(t); }
}
async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_MS) return { ...hit.data, cache: 'hit' };
  const data = await fn();
  cache.set(key, { ts: Date.now(), data });
  return { ...data, cache: 'miss' };
}
function tryJsonParseFromScript(html='') {
  const found = [];
  const next = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (next) {
    try { found.push(JSON.parse(next[1])); } catch {}
  }
  // Some modern sites keep hydration chunks. Extract JSON-like arrays/objects conservatively.
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(Boolean);
  for (const s of scripts) {
    const m = s.match(/self\.__next_f\.push\((\[[\s\S]*?\])\)/);
    if (m) { try { found.push(JSON.parse(m[1])); } catch {} }
  }
  return found;
}
function walk(obj, visit, path=[]) {
  if (obj == null) return;
  if (Array.isArray(obj)) return obj.forEach((v,i)=>walk(v,visit,path.concat(i)));
  if (typeof obj === 'object') { visit(obj, path); Object.keys(obj).forEach(k => walk(obj[k], visit, path.concat(k))); }
}
function inferIndexFromText(txt='') {
  const t = String(txt).toUpperCase();
  const indexes = [];
  if (/XK030|KATILIM\s*30/.test(t)) indexes.push('XK030');
  if (/XK050|KATILIM\s*50/.test(t)) indexes.push('XK050');
  if (/XK100|KATILIM\s*100/.test(t)) indexes.push('XK100');
  if (/XKTUM|XKTÜM|KATILIM\s*TÜ?M/.test(t)) indexes.push('XKTUM');
  return indexes.length ? indexes : ['XKTUM'];
}
function uniqueItems(items=[]) {
  const m = new Map();
  for (const item of items) {
    const symbol = cleanSymbol(item.symbol);
    if (!symbol || symbol.length < 2) continue;
    const old = m.get(symbol) || { symbol, name: symbol, sector: '', indexes: [] };
    const indexes = [...new Set([...(old.indexes || []), ...(item.indexes || [])])];
    m.set(symbol, { ...old, ...item, symbol, name: item.name || old.name || symbol, sector: item.sector || old.sector || '', indexes: indexes.length ? indexes : ['XKTUM'] });
  }
  return [...m.values()].sort((a,b)=>a.symbol.localeCompare(b.symbol));
}
function extractUniverseFromJson(jsons=[]) {
  const out = [];
  for (const root of jsons) {
    walk(root, (obj) => {
      const keys = Object.keys(obj);
      const keyText = keys.join(' ').toLowerCase();
      const symVal = obj.symbol ?? obj.sembol ?? obj.kod ?? obj.code ?? obj.hisse ?? obj.stockCode ?? obj.assetCode;
      const symbol = cleanSymbol(symVal);
      if (symbol && /^[A-Z0-9]{2,8}$/.test(symbol) && !['XK030','XK050','XK100','XKTUM','USDTRY','EURTRY'].includes(symbol)) {
        const name = obj.name ?? obj.unvan ?? obj.sirketAdi ?? obj.hisseAdi ?? obj.title ?? obj.description ?? symbol;
        const sector = obj.sector ?? obj.sektor ?? obj.sectorName ?? '';
        out.push({ symbol, name: String(name || symbol).trim(), sector: String(sector || '').trim(), indexes: inferIndexFromText(JSON.stringify(obj).slice(0,1500)), sourceDetail: 'json' });
      }
      // Objects that explicitly mention participation index but use different key names.
      if (/katılım|katilim|endeks|index/.test(keyText)) {
        const s2 = cleanSymbol(obj.hisseKodu ?? obj.payKodu ?? obj.ticker ?? obj.shortCode);
        if (s2) out.push({ symbol:s2, name: obj.hisseAdi || obj.title || s2, sector: obj.sektor || '', indexes: inferIndexFromText(JSON.stringify(obj).slice(0,1200)), sourceDetail: 'json-index' });
      }
    });
  }
  return uniqueItems(out);
}
function extractUniverseFromHtml(html='') {
  const out = [];
  // Links such as /finansportali/ozet/kontr/ or /finansportali/ozet/kontr/katilim-endeksine-uygunluk/
  const linkRe = /href=["']([^"']*\/finansportali\/ozet\/([a-z0-9]{2,12})(?:\/[^"']*)?)["']/gi;
  for (const m of html.matchAll(linkRe)) {
    const symbol = cleanSymbol(m[2]);
    if (symbol && !['OZET'].includes(symbol)) out.push({ symbol, name: symbol, indexes: ['XKTUM'], sourceDetail: 'link', detailUrl: `${KT_BASE}${m[1].startsWith('/') ? m[1] : '/' + m[1]}` });
  }
  // Some cards expose uppercase symbols as text. Keep this narrow to avoid false positives.
  const text = stripTags(html);
  const symRe = /\b([A-Z]{2,6}[A-Z0-9]{0,4})\b/g;
  const blacklist = new Set(['BIST','XK','XKTUM','XK100','XK050','XK030','USD','TRY','EUR','ALTIN','HTML','JSON','HTTP','HTTPS','KAP','TL']);
  for (const m of text.matchAll(symRe)) {
    const symbol = cleanSymbol(m[1]);
    if (symbol && !blacklist.has(symbol) && symbol.length >= 3) {
      // Only include text symbols if they appear close to participation/company contexts.
      const idx = text.indexOf(m[1]);
      const around = text.slice(Math.max(0, idx-120), idx+160).toUpperCase();
      if (/KATILIM|ENDEKS|HİSSE|HISSE|ŞİRKET|SIRKET|PAY|FİYAT|FIYAT/.test(around)) out.push({ symbol, name: symbol, indexes: inferIndexFromText(around), sourceDetail: 'text' });
    }
  }
  return uniqueItems(out);
}
function extractIndexes(html='', jsons=[]) {
  const out = [];
  const names = { XKTUM:'BIST Katılım Tüm', XK100:'BIST Katılım 100', XK050:'BIST Katılım 50', XK030:'BIST Katılım 30', USDTRY:'USD/TRY', EURTRY:'EUR/TRY', GRALTIN:'Gram Altın' };
  const rawText = stripTags(html);
  // Search snippets show cards like: % 0,171 16.643,860 XK100
  const tokens = rawText.split(/\s+/);
  for (let i=0;i<tokens.length;i++) {
    const codeRaw = tokens[i].toUpperCase().replace(/[^A-Z0-9/]/g,'');
    const code = codeRaw === 'USD/TRY' ? 'USDTRY' : codeRaw === 'EUR/TRY' ? 'EURTRY' : (codeRaw === 'GR' && tokens[i+1]?.toUpperCase().includes('ALTIN') ? 'GRALTIN' : codeRaw);
    if (!names[code]) continue;
    const prev = tokens.slice(Math.max(0,i-4), i).join(' ');
    const nums = [...prev.matchAll(/%?\s*[-+]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?/g)].map(m=>m[0]);
    const changePct = nums.length >= 2 ? parseTRNumber(nums[nums.length-2]) : null;
    const value = nums.length ? parseTRNumber(nums[nums.length-1]) : null;
    out.push({ code, name:names[code], value, changePct, source:'Kuveyt Türk Yatırım' });
  }
  for (const root of jsons) {
    walk(root, (obj) => {
      const txt = JSON.stringify(obj).slice(0,1000).toUpperCase();
      for (const code of Object.keys(names)) {
        if (!txt.includes(code)) continue;
        const value = parseTRNumber(obj.value ?? obj.price ?? obj.son ?? obj.fiyat ?? obj.close ?? obj.kapanis);
        const changePct = parseTRNumber(obj.changePercent ?? obj.changePct ?? obj.degisim ?? obj.yuzde ?? obj.percent);
        if (value != null || changePct != null) out.push({ code, name:names[code], value, changePct, source:'Kuveyt Türk Yatırım JSON' });
      }
    });
  }
  return uniqueIndexItems(out);
}
function uniqueIndexItems(items=[]) {
  const m = new Map();
  for (const item of items) {
    if (!item.code) continue;
    const old = m.get(item.code) || {};
    m.set(item.code, { ...old, ...item });
  }
  return [...m.values()];
}
export async function fetchKuveytTurkPage() {
  return cached('kt-main-page', async () => {
    const html = await fetchText(KT_KATILIM_URL);
    const jsons = tryJsonParseFromScript(html);
    const universe = uniqueItems([...extractUniverseFromJson(jsons), ...extractUniverseFromHtml(html)]);
    const indexes = extractIndexes(html, jsons);
    return { ok:true, source:'Kuveyt Türk Yatırım katılım endeksleri', url:KT_KATILIM_URL, fetchedAt:new Date().toISOString(), universe, indexes, diagnostics:{ htmlLength:html.length, jsonBlocks:jsons.length, universeCount:universe.length, indexCount:indexes.length } };
  });
}
export async function fetchKuveytTurkCompany(symbol) {
  const s = cleanSymbol(symbol);
  if (!s) throw new Error('Geçersiz sembol');
  return cached(`kt-company-${s}`, async () => {
    const urls = [
      `${KT_BASE}/finansportali/ozet/${s.toLowerCase()}/`,
      `${KT_BASE}/finansportali/ozet/${s.toLowerCase()}/katilim-endeksine-uygunluk/`
    ];
    const details = [];
    const errors = [];
    for (const url of urls) {
      try {
        const html = await fetchText(url);
        const text = stripTags(html);
        const priceMatch = text.match(new RegExp(`${s}[^0-9%-]{0,80}(%?\\s*[-+]?\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d+)?)`, 'i'));
        const price = priceMatch ? parseTRNumber(priceMatch[1]) : null;
        details.push({ url, textSample:text.slice(0,1600), price });
      } catch (e) { errors.push(`${url}: ${e.message}`); }
    }
    if (!details.length) throw new Error(errors.join(' | '));
    return { ok:true, symbol:s, source:'Kuveyt Türk Yatırım finans portalı', details, errors };
  });
}
function filterByIndex(items, index) {
  const idx = String(index || 'XK100').toUpperCase();
  return items.filter(x => !idx || idx === 'ALL' || (x.indexes || []).includes(idx));
}
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok:true });
  const mode = String(req.query.mode || 'universe').toLowerCase();
  try {
    if (mode === 'company') {
      const data = await fetchKuveytTurkCompany(req.query.symbol || req.query.s || 'ASELS');
      return sendJson(res, 200, data);
    }
    const page = await fetchKuveytTurkPage();
    if (mode === 'indexes') return sendJson(res, 200, { ok:true, source:page.source, url:page.url, fetchedAt:page.fetchedAt, cache:page.cache, items:page.indexes, diagnostics:page.diagnostics });
    const index = String(req.query.index || 'XK100').toUpperCase();
    const items = filterByIndex(page.universe, index);
    return sendJson(res, 200, { ok:true, source:page.source, url:page.url, fetchedAt:page.fetchedAt, cache:page.cache, index, count:items.length, items, indexes:page.indexes, diagnostics:page.diagnostics, note:'Kuveyt Türk sayfası katılım evreni ve şirket/detail referansı için kullanılır. Hisse OHLC geçmişi yoksa teknik analiz market/history kaynaklarından tamamlanır.' });
  } catch (err) {
    return sendJson(res, 502, { ok:false, source:'Kuveyt Türk Yatırım', error:err.message }, 's-maxage=60, stale-while-revalidate=120');
  }
}
