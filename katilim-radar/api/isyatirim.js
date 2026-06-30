// Shared market-data utilities for Katılım Radar.
// Primary source: İş Yatırım HisseTekil daily history. Fallback: Yahoo Finance chart.
// Cache strategy: stable history up to 7 calendar days ago is cached in memory per warm Vercel instance;
// the last week is always fetched live and merged. This shortens repeated scans while keeping recent bars fresh.

const ISY_BASES = [
  'https://www.isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/Data.aspx/HisseTekil',
  'https://www.isyatirim.com.tr/_layouts/15/Isyatirim.WebSite/Common/Data.aspx/HisseTekil'
];
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_DAYS = 7;
const FETCH_TIMEOUT_MS = 14000;
const stableCache = globalThis.__KR_STABLE_HISTORY_CACHE__ || new Map();
const inflight = globalThis.__KR_STABLE_HISTORY_INFLIGHT__ || new Map();
globalThis.__KR_STABLE_HISTORY_CACHE__ = stableCache;
globalThis.__KR_STABLE_HISTORY_INFLIGHT__ = inflight;

export function cleanSymbol(input = '') {
  return String(input).trim().toUpperCase().replace(/\.E$/,'').replace(/\.IS$/,'').replace(/[^A-Z0-9]/g, '').slice(0, 12);
}
function pad(n) { return String(n).padStart(2, '0'); }
export function formatTRDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${pad(dt.getDate())}-${pad(dt.getMonth()+1)}-${dt.getFullYear()}`;
}
function toYmd(d) { return new Date(d).toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function todayNoon() { const d = new Date(); d.setHours(12,0,0,0); return d; }
export function cacheCutoffDate() { return addDays(todayNoon(), -RECENT_DAYS); }
export function startDateForRange(range = '1y') {
  const d = todayNoon();
  const r = String(range || '1y').toLowerCase();
  if (r === '1d') d.setDate(d.getDate() - 10);
  else if (r === '5d') d.setDate(d.getDate() - 20);
  else if (r === '1mo') d.setMonth(d.getMonth() - 1);
  else if (r === '3mo') d.setMonth(d.getMonth() - 3);
  else if (r === '6mo') d.setMonth(d.getMonth() - 6);
  else if (r === '2y') d.setFullYear(d.getFullYear() - 2);
  else if (r === '5y') d.setFullYear(d.getFullYear() - 5);
  else if (r === 'ytd') return new Date(new Date().getFullYear(), 0, 1, 12);
  else d.setFullYear(d.getFullYear() - 1);
  return d;
}
function parseNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v == null) return null;
  let s = String(v).trim();
  if (!s || s === '-' || s.toLowerCase() === 'null') return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function parseDate(v) {
  if (!v) return null;
  if (typeof v === 'string') {
    const m = v.match(/\/Date\((\d+)/);
    if (m) return new Date(Number(m[1]));
    const dmy = v.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
    if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 12);
    const iso = new Date(v);
    if (!Number.isNaN(iso.getTime())) return iso;
  }
  const dt = new Date(v);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
function pick(row, keys) {
  for (const k of keys) if (row[k] != null) return row[k];
  const lower = Object.fromEntries(Object.keys(row).map(k => [k.toLowerCase(), k]));
  for (const k of keys) {
    const real = lower[String(k).toLowerCase()];
    if (real && row[real] != null) return row[real];
  }
  return null;
}
export function normalizeIsYRow(row) {
  const dt = parseDate(pick(row, ['HGDG_TARIH', 'TARIH', 'DATE', 'HG_TARIH']));
  const close = parseNumber(pick(row, ['HGDG_KAPANIS', 'KAPANIS', 'CLOSE', 'HG_KAPANIS']));
  const high = parseNumber(pick(row, ['HGDG_MAX', 'MAX', 'HIGH', 'HG_MAX', 'HGDG_YUKSEK']));
  const low = parseNumber(pick(row, ['HGDG_MIN', 'MIN', 'LOW', 'HG_MIN', 'HGDG_DUSUK']));
  const open = parseNumber(pick(row, ['HGDG_ACILIS', 'ACILIS', 'OPEN', 'HG_ACILIS'])) ?? close;
  const average = parseNumber(pick(row, ['HGDG_AOF', 'AOF', 'AVG', 'ORTALAMA']));
  const volume = parseNumber(pick(row, ['HGDG_HACIM', 'HACIM', 'VOLUME', 'HG_HACIM'])) ?? 0;
  if (!dt || !Number.isFinite(close)) return null;
  return { time: dt.getTime(), date: toYmd(dt), open: open ?? close, high: high ?? Math.max(open ?? close, close), low: low ?? Math.min(open ?? close, close), close, average, volume };
}
async function fetchWithTimeout(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: ac.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KatilimRadar/1.5; +https://vercel.app)',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/Tarihsel-Fiyat-Bilgileri.aspx'
      }
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 120)}`);
    return text;
  } finally { clearTimeout(t); }
}
function buildIsYUrls(symbol, start, end) {
  const qBase = `hisse=${encodeURIComponent(symbol)}&startdate=${encodeURIComponent(formatTRDate(start))}&enddate=`;
  const endPlain = formatTRDate(end);
  const endJson = `${endPlain}.json`;
  const urls = [];
  for (const base of ISY_BASES) {
    urls.push(`${base}?${qBase}${encodeURIComponent(endJson)}`);
    urls.push(`${base}?${qBase}${encodeURIComponent(endPlain)}`);
  }
  return urls;
}
async function fetchIsYatirimSegment(symbol, start, end) {
  const s = cleanSymbol(symbol);
  const errors = [];
  for (const url of buildIsYUrls(s, start, end)) {
    try {
      const text = await fetchWithTimeout(url);
      let json;
      try { json = JSON.parse(text); } catch { throw new Error(`JSON okunamadı: ${text.slice(0, 120)}`); }
      const rows = Array.isArray(json?.value) ? json.value : Array.isArray(json?.Value) ? json.Value : Array.isArray(json) ? json : [];
      const bars = rows.map(normalizeIsYRow).filter(Boolean).sort((a,b) => a.time - b.time);
      if (!bars.length) throw new Error(`boş veri (${formatTRDate(start)}-${formatTRDate(end)})`);
      return { bars, rawCount: rows.length, sourceUrl: url };
    } catch (e) { errors.push(e.message); }
  }
  throw new Error(errors.slice(0, 2).join(' | '));
}
function mergeBars(parts) {
  const m = new Map();
  for (const b of parts.flat()) if (b && Number.isFinite(b.close)) m.set(b.date, b);
  return [...m.values()].sort((a,b) => a.time - b.time);
}
async function cachedStableSegment(symbol, start, cutoff) {
  const s = cleanSymbol(symbol);
  const key = `${s}:${formatTRDate(start)}:${formatTRDate(cutoff)}:stable`; 
  const hit = stableCache.get(key);
  if (hit && Date.now() - hit.savedAt < CACHE_TTL_MS) return { ...hit.data, cache: 'hit' };
  if (inflight.has(key)) return inflight.get(key);
  const p = fetchIsYatirimSegment(s, start, cutoff).then(data => {
    const payload = { ...data, cache: 'miss' };
    stableCache.set(key, { savedAt: Date.now(), data: payload });
    inflight.delete(key);
    return payload;
  }).catch(e => { inflight.delete(key); throw e; });
  inflight.set(key, p);
  return p;
}
export function cacheStats() {
  return { stableEntries: stableCache.size, recentDays: RECENT_DAYS, cutoff: toYmd(cacheCutoffDate()) };
}
export async function fetchIsYatirimBars(symbol, range = '1y') {
  const s = cleanSymbol(symbol);
  if (!s) throw new Error('Geçersiz sembol');
  const start = startDateForRange(range);
  const today = todayNoon();
  const cutoff = cacheCutoffDate();
  const debug = [];
  let bars = [];
  let cacheMode = 'none';
  // For ranges longer than the last week, split stable + live recent.
  if (start.getTime() < cutoff.getTime() - 24*3600*1000) {
    try {
      const stable = await cachedStableSegment(s, start, cutoff);
      debug.push(`stable:${stable.cache}:${stable.bars.length}`);
      cacheMode = stable.cache === 'hit' ? 'stable-hit+recent-live' : 'stable-miss+recent-live';
      let recent = { bars: [] };
      try {
        recent = await fetchIsYatirimSegment(s, addDays(cutoff, -2), today);
        debug.push(`recent:live:${recent.bars.length}`);
      } catch (e) { debug.push(`recent:error:${e.message}`); }
      bars = mergeBars([stable.bars, recent.bars]);
    } catch (splitErr) {
      debug.push(`split:error:${splitErr.message}`);
      const full = await fetchIsYatirimSegment(s, start, today);
      bars = full.bars;
      cacheMode = 'full-live';
    }
  } else {
    const full = await fetchIsYatirimSegment(s, start, today);
    bars = full.bars;
    cacheMode = 'recent-live';
  }
  if (!bars.length) throw new Error(`İş Yatırım veri döndürmedi (${s})`);
  return { source: 'İş Yatırım HisseTekil', symbol: s, currency: 'TRY', range, interval: '1d', bars, rawCount: bars.length, lastBar: bars[bars.length - 1], provider: 'isyatirim', cacheMode, cacheCutoff: toYmd(cutoff), debug };
}
function normalizeYahooSymbol(input = '') { const s = cleanSymbol(input); return s ? `${s}.IS` : ''; }
function yahooBars(result) {
  const q = result?.indicators?.quote?.[0] || {};
  const adj = result?.indicators?.adjclose?.[0]?.adjclose || [];
  const ts = result?.timestamp || [];
  return ts.map((t, i) => ({ time: t * 1000, date: toYmd(t * 1000), open: q.open?.[i] ?? q.close?.[i] ?? adj[i] ?? null, high: q.high?.[i] ?? q.close?.[i] ?? adj[i] ?? null, low: q.low?.[i] ?? q.close?.[i] ?? adj[i] ?? null, close: q.close?.[i] ?? adj[i] ?? null, volume: q.volume?.[i] ?? 0 })).filter(b => Number.isFinite(b.close) && Number.isFinite(b.high) && Number.isFinite(b.low));
}
export async function fetchYahooBars(symbol, range = '1y', interval = '1d') {
  const y = normalizeYahooSymbol(symbol);
  if (!y) throw new Error('Geçersiz sembol');
  const url = `${YAHOO_BASE}${encodeURIComponent(y)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false&events=div%2Csplits`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KatilimRadar/1.5; +https://vercel.app)', 'Accept': 'application/json,*/*' } });
  const raw = await r.text();
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}: ${raw.slice(0, 120)}`);
  const json = JSON.parse(raw);
  const result = json?.chart?.result?.[0];
  const err = json?.chart?.error;
  if (err || !result) throw new Error(err?.description || 'Yahoo boş veri döndürdü');
  const bars = yahooBars(result).sort((a,b) => a.time - b.time);
  if (!bars.length) throw new Error('Yahoo bar verisi boş');
  return { source: 'Yahoo Finance chart proxy', symbol: cleanSymbol(symbol), yahooSymbol: y, currency: result.meta?.currency || 'TRY', marketState: result.meta?.marketState, marketTime: result.meta?.regularMarketTime ? result.meta.regularMarketTime * 1000 : null, regularMarketPrice: result.meta?.regularMarketPrice, range, interval, bars, lastBar: bars[bars.length - 1], provider: 'yahoo', cacheMode: 'live' };
}
export async function fetchBestBars(symbol, range = '1y', interval = '1d') {
  const attempts = [];
  if (['1d', '1wk', '1mo', undefined, null].includes(interval)) {
    try {
      const data = await fetchIsYatirimBars(symbol, range);
      return { ...data, attempts: [`isyatirim:ok:${data.cacheMode}`] };
    } catch (e) { attempts.push(`isyatirim:${e.message}`); }
  }
  try {
    const data = await fetchYahooBars(symbol, range, interval || '1d');
    return { ...data, attempts: [...attempts, 'yahoo:ok'] };
  } catch (e) { attempts.push(`yahoo:${e.message}`); }
  const err = new Error(attempts.join(' | '));
  err.attempts = attempts;
  throw err;
}
