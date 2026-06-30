// Shared İş Yatırım data helpers for Katılım Radar.
// Primary source: https://www.isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/Data.aspx/HisseTekil

const ISY_BASE = 'https://www.isyatirim.com.tr/_layouts/15/Isyatirim.Website/Common/Data.aspx/HisseTekil';
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';

export function cleanSymbol(input = '') {
  return String(input)
    .trim()
    .toUpperCase()
    .replace(/\.E$/,'')
    .replace(/\.IS$/,'')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

function pad(n) { return String(n).padStart(2, '0'); }
export function formatTRDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${pad(dt.getDate())}-${pad(dt.getMonth()+1)}-${dt.getFullYear()}`;
}

export function startDateForRange(range = '1y') {
  const d = new Date();
  const r = String(range || '1y').toLowerCase();
  if (r === '1d') d.setDate(d.getDate() - 10);
  else if (r === '5d') d.setDate(d.getDate() - 20);
  else if (r === '1mo') d.setMonth(d.getMonth() - 1);
  else if (r === '3mo') d.setMonth(d.getMonth() - 3);
  else if (r === '6mo') d.setMonth(d.getMonth() - 6);
  else if (r === '2y') d.setFullYear(d.getFullYear() - 2);
  else if (r === '5y') d.setFullYear(d.getFullYear() - 5);
  else if (r === 'ytd') return new Date(new Date().getFullYear(), 0, 1);
  else d.setFullYear(d.getFullYear() - 1);
  return d;
}

function parseNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v == null) return null;
  let s = String(v).trim();
  if (!s || s === '-' || s.toLowerCase() === 'null') return null;
  // Turkish format: 1.234.567,89 -> 1234567.89
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
    if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
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
  return {
    time: dt.getTime(),
    date: dt.toISOString().slice(0, 10),
    open: open ?? close,
    high: high ?? Math.max(open ?? close, close),
    low: low ?? Math.min(open ?? close, close),
    close,
    average,
    volume,
    raw: row
  };
}

export async function fetchIsYatirimBars(symbol, range = '1y') {
  const s = cleanSymbol(symbol);
  if (!s) throw new Error('Geçersiz sembol');
  const startdate = formatTRDate(startDateForRange(range));
  const enddate = formatTRDate(new Date());
  const endWithJson = `${enddate}.json`;
  const url = `${ISY_BASE}?hisse=${encodeURIComponent(s)}&startdate=${encodeURIComponent(startdate)}&enddate=${encodeURIComponent(endWithJson)}`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KatilimRadar/1.4; +https://vercel.app)',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/Tarihsel-Fiyat-Bilgileri.aspx'
    }
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`İş Yatırım HTTP ${r.status}: ${text.slice(0, 160)}`);
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`İş Yatırım JSON okunamadı: ${text.slice(0, 160)}`); }
  const rows = Array.isArray(json?.value) ? json.value : Array.isArray(json?.Value) ? json.Value : Array.isArray(json) ? json : [];
  const bars = rows.map(normalizeIsYRow).filter(Boolean).sort((a,b) => a.time - b.time);
  if (!bars.length) throw new Error(`İş Yatırım veri döndürmedi (${s}, ${startdate}-${enddate})`);
  return {
    source: 'İş Yatırım HisseTekil',
    sourceUrl: url,
    symbol: s,
    currency: 'TRY',
    range,
    interval: '1d',
    bars,
    rawCount: rows.length,
    lastBar: bars[bars.length - 1]
  };
}

function normalizeYahooSymbol(input = '') {
  const s = cleanSymbol(input);
  if (!s) return '';
  return `${s}.IS`;
}

function yahooBars(result) {
  const q = result?.indicators?.quote?.[0] || {};
  const adj = result?.indicators?.adjclose?.[0]?.adjclose || [];
  const ts = result?.timestamp || [];
  return ts.map((t, i) => ({
    time: t * 1000,
    date: new Date(t * 1000).toISOString().slice(0, 10),
    open: q.open?.[i] ?? q.close?.[i] ?? adj[i] ?? null,
    high: q.high?.[i] ?? q.close?.[i] ?? adj[i] ?? null,
    low: q.low?.[i] ?? q.close?.[i] ?? adj[i] ?? null,
    close: q.close?.[i] ?? adj[i] ?? null,
    volume: q.volume?.[i] ?? 0
  })).filter(b => Number.isFinite(b.close) && Number.isFinite(b.high) && Number.isFinite(b.low));
}

export async function fetchYahooBars(symbol, range = '1y', interval = '1d') {
  const y = normalizeYahooSymbol(symbol);
  if (!y) throw new Error('Geçersiz sembol');
  const url = `${YAHOO_BASE}${encodeURIComponent(y)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false&events=div%2Csplits`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KatilimRadar/1.4; +https://vercel.app)', 'Accept': 'application/json,*/*' } });
  const raw = await r.text();
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}: ${raw.slice(0, 160)}`);
  const json = JSON.parse(raw);
  const result = json?.chart?.result?.[0];
  const err = json?.chart?.error;
  if (err || !result) throw new Error(err?.description || 'Yahoo boş veri döndürdü');
  const bars = yahooBars(result).sort((a,b) => a.time - b.time);
  if (!bars.length) throw new Error('Yahoo bar verisi boş');
  return {
    source: 'Yahoo Finance chart proxy',
    sourceUrl: url,
    symbol: cleanSymbol(symbol),
    yahooSymbol: y,
    currency: result.meta?.currency || 'TRY',
    marketState: result.meta?.marketState,
    marketTime: result.meta?.regularMarketTime ? result.meta.regularMarketTime * 1000 : null,
    regularMarketPrice: result.meta?.regularMarketPrice,
    range,
    interval,
    bars,
    lastBar: bars[bars.length - 1]
  };
}

export async function fetchBestBars(symbol, range = '1y', interval = '1d') {
  const attempts = [];
  // İş Yatırım is daily. Use it for all daily/weekly scans; intraday remains Yahoo only.
  if (['1d', '1wk', '1mo', undefined, null].includes(interval)) {
    try {
      const data = await fetchIsYatirimBars(symbol, range);
      return { ...data, provider: 'isyatirim', attempts: ['isyatirim:ok'] };
    } catch (e) { attempts.push(`isyatirim:${e.message}`); }
  }
  try {
    const data = await fetchYahooBars(symbol, range, interval || '1d');
    return { ...data, provider: 'yahoo', attempts: [...attempts, 'yahoo:ok'] };
  } catch (e) { attempts.push(`yahoo:${e.message}`); }
  const err = new Error(attempts.join(' | '));
  err.attempts = attempts;
  throw err;
}
