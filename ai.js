// POST /api/scan { symbols:["ASELS","BIMAS"], range:"1y", interval:"1d" }
// GET  /api/scan?symbols=ASELS,BIMAS&range=1y&interval=1d

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const ALLOWED_INTERVALS = new Set(['5m','15m','30m','60m','1h','1d','1wk']);
const ALLOWED_RANGES = new Set(['1d','5d','1mo','3mo','6mo','1y','2y','5y','ytd']);

function send(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  if (req.method !== 'POST') return {};
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function normalizeSymbol(s='') {
  const clean = String(s).trim().toUpperCase().replace(/[^A-Z0-9.]/g, '').replace(/\.E$/,'');
  if (!clean) return '';
  return clean.endsWith('.IS') ? clean : `${clean}.IS`;
}

function stripIS(s='') { return String(s).replace(/\.IS$/,''); }
function num(v) { return Number.isFinite(v) ? v : null; }
function last(arr) { return arr[arr.length - 1]; }
function mean(vals) { const x = vals.filter(Number.isFinite); return x.length ? x.reduce((a,b)=>a+b,0)/x.length : null; }
function pct(a,b) { return b ? (a-b)/b*100 : null; }
function round(v, d=2) { return Number.isFinite(v) ? Number(v.toFixed(d)) : null; }

function sma(values, period) {
  return values.map((_, i) => i + 1 < period ? null : mean(values.slice(i + 1 - period, i + 1)));
}

function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) { out.push(prev); continue; }
    if (prev == null) {
      const seed = i + 1 >= period ? mean(values.slice(i + 1 - period, i + 1)) : v;
      prev = seed;
    } else {
      prev = v * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

function rsi(values, period = 14) {
  if (values.length <= period) return values.map(() => null);
  const out = Array(values.length).fill(null);
  let gain = 0, loss = 0;
  for (let i=1; i<=period; i++) {
    const diff = values[i] - values[i-1];
    if (diff >= 0) gain += diff; else loss -= diff;
  }
  gain /= period; loss /= period;
  out[period] = loss === 0 ? 100 : 100 - (100 / (1 + gain / loss));
  for (let i=period+1; i<values.length; i++) {
    const diff = values[i] - values[i-1];
    gain = (gain * (period - 1) + Math.max(diff,0)) / period;
    loss = (loss * (period - 1) + Math.max(-diff,0)) / period;
    out[i] = loss === 0 ? 100 : 100 - (100 / (1 + gain / loss));
  }
  return out;
}

function atr(bars, period = 14) {
  const trs = bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const pc = bars[i-1].close;
    return Math.max(b.high-b.low, Math.abs(b.high-pc), Math.abs(b.low-pc));
  });
  return ema(trs, period);
}

function macd(values) {
  const e12 = ema(values, 12);
  const e26 = ema(values, 26);
  const line = values.map((_, i) => e12[i] != null && e26[i] != null ? e12[i] - e26[i] : null);
  const sig = ema(line.map(v => v ?? 0), 9);
  const hist = line.map((v, i) => v != null && sig[i] != null ? v - sig[i] : null);
  return { line, signal: sig, hist };
}

function bollinger(values, period = 20, mult = 2) {
  return values.map((_, i) => {
    if (i + 1 < period) return null;
    const w = values.slice(i + 1 - period, i + 1).filter(Number.isFinite);
    const m = mean(w);
    const sd = Math.sqrt(mean(w.map(x => Math.pow(x - m, 2))));
    return { mid: m, upper: m + mult * sd, lower: m - mult * sd, width: m ? (4*sd/m*100) : null };
  });
}

function stochastic(bars, period = 14) {
  return bars.map((b, i) => {
    if (i + 1 < period) return null;
    const w = bars.slice(i + 1 - period, i + 1);
    const hi = Math.max(...w.map(x => x.high));
    const lo = Math.min(...w.map(x => x.low));
    return hi === lo ? 50 : ((b.close - lo) / (hi - lo)) * 100;
  });
}

function toBars(result) {
  const q = result?.indicators?.quote?.[0] || {};
  const ts = result?.timestamp || [];
  return ts.map((t, i) => ({
    time: t * 1000,
    date: new Date(t * 1000).toISOString().slice(0,10),
    open: q.open?.[i] ?? null,
    high: q.high?.[i] ?? null,
    low: q.low?.[i] ?? null,
    close: q.close?.[i] ?? null,
    volume: q.volume?.[i] ?? 0
  })).filter(b => Number.isFinite(b.close) && Number.isFinite(b.high) && Number.isFinite(b.low));
}

async function fetchBars(symbol, range, interval) {
  const y = normalizeSymbol(symbol);
  const url = `${YAHOO_BASE}${encodeURIComponent(y)}?range=${range}&interval=${interval}&includePrePost=false`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 KatilimRadar/1.0', 'Accept': 'application/json,*/*' } });
  if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
  const json = await r.json();
  const result = json?.chart?.result?.[0];
  const err = json?.chart?.error;
  if (err || !result) throw new Error(err?.description || 'Boş veri');
  return { meta: result.meta || {}, bars: toBars(result) };
}

function analyze(symbol, bars, meta={}) {
  if (!bars || bars.length < 50) throw new Error('Teknik analiz için yeterli veri yok.');
  const closes = bars.map(b=>b.close);
  const highs = bars.map(b=>b.high);
  const lows = bars.map(b=>b.low);
  const volumes = bars.map(b=>b.volume || 0);
  const c = last(closes);
  const prev = closes[closes.length-2];
  const s20 = last(sma(closes,20));
  const s50 = last(sma(closes,50));
  const s200 = last(sma(closes,200));
  const e20 = last(ema(closes,20));
  const e50 = last(ema(closes,50));
  const r14 = last(rsi(closes,14));
  const a14 = last(atr(bars,14));
  const m = macd(closes);
  const mh = last(m.hist);
  const ml = last(m.line);
  const ms = last(m.signal);
  const bb = last(bollinger(closes,20,2));
  const st = last(stochastic(bars,14));
  const vol20 = mean(volumes.slice(-20));
  const volRatio = vol20 ? last(volumes) / vol20 : null;
  const hi20 = Math.max(...highs.slice(-20));
  const lo20 = Math.min(...lows.slice(-20));
  const hi52 = Math.max(...highs.slice(-252));
  const lo52 = Math.min(...lows.slice(-252));
  const ret5 = closes.length > 5 ? pct(c, closes[closes.length-6]) : null;
  const ret20 = closes.length > 20 ? pct(c, closes[closes.length-21]) : null;
  const ret60 = closes.length > 60 ? pct(c, closes[closes.length-61]) : null;
  const retYtd = (() => {
    const y = new Date().getFullYear();
    const first = bars.find(b => new Date(b.time).getFullYear() === y)?.close;
    return first ? pct(c, first) : null;
  })();

  let score = 50;
  const reasons = [];
  const cautions = [];
  function add(points, reason) { score += points; if (reason) (points >= 0 ? reasons : cautions).push(reason); }
  if (c > e20) add(8, 'Fiyat EMA20 üzerinde'); else add(-8, 'Fiyat EMA20 altında');
  if (c > e50) add(8, 'Fiyat EMA50 üzerinde'); else add(-8, 'Fiyat EMA50 altında');
  if (e20 > e50) add(7, 'Kısa trend uzun trende göre güçlü'); else add(-7, 'Kısa trend zayıflıyor');
  if (s200 && c > s200) add(6, 'Fiyat SMA200 üzerinde'); else if (s200) add(-6, 'Fiyat SMA200 altında');
  if (mh > 0 && ml > ms) add(8, 'MACD pozitif bölgede / kesişim olumlu'); else add(-8, 'MACD momentumu zayıf');
  if (r14 >= 45 && r14 <= 65) add(7, 'RSI sağlıklı momentum bölgesinde');
  else if (r14 < 30) add(4, 'RSI aşırı satım bölgesinde tepki potansiyeli');
  else if (r14 > 75) add(-7, 'RSI aşırı alım bölgesinde');
  else if (r14 < 40) add(-5, 'RSI zayıf bölgede');
  if (st > 80) add(-3, 'Stokastik aşırı alım sinyali');
  else if (st < 20) add(3, 'Stokastik aşırı satım sinyali');
  if (bb && c > bb.upper) add(-5, 'Bollinger üst bandı üzerinde; geri çekilme riski');
  else if (bb && c < bb.lower) add(4, 'Bollinger alt bandında; tepki ihtimali');
  if (volRatio && volRatio > 1.35 && c > prev) add(5, 'Yükseliş hacimle destekleniyor');
  else if (volRatio && volRatio > 1.35 && c < prev) add(-5, 'Düşüş hacimle destekleniyor');
  if (ret20 > 0) add(4, 'Aylık getiri pozitif'); else add(-3, 'Aylık getiri negatif');

  score = Math.max(0, Math.min(100, score));
  let verdict = 'NÖTR / İZLE';
  if (score >= 78) verdict = 'GÜÇLÜ TEKNİK GÖRÜNÜM';
  else if (score >= 63) verdict = 'POZİTİF / İZLE';
  else if (score < 35) verdict = 'ZAYIF / RİSKLİ';
  else if (score < 47) verdict = 'NEGATİF / BEKLE';

  const support = Math.min(lo20, bb?.lower ?? lo20);
  const resistance = Math.max(hi20, bb?.upper ?? hi20);
  const stop = a14 ? c - 1.8 * a14 : lo20;
  const target1 = a14 ? c + 1.5 * a14 : resistance;
  const target2 = a14 ? c + 2.5 * a14 : hi52;

  return {
    symbol: stripIS(symbol),
    price: round(c,2),
    previousClose: round(prev,2),
    change: round(c - prev,2),
    changePct: round(pct(c, prev),2),
    score: round(score,0),
    verdict,
    currency: meta.currency || 'TRY',
    marketState: meta.marketState,
    marketTime: meta.regularMarketTime ? meta.regularMarketTime * 1000 : null,
    lastBar: last(bars)?.date,
    bars: bars.slice(-160),
    indicators: {
      sma20: round(s20,2), sma50: round(s50,2), sma200: round(s200,2),
      ema20: round(e20,2), ema50: round(e50,2), rsi14: round(r14,2), atr14: round(a14,2),
      macd: round(ml,3), macdSignal: round(ms,3), macdHist: round(mh,3),
      bollingerUpper: round(bb?.upper,2), bollingerMid: round(bb?.mid,2), bollingerLower: round(bb?.lower,2), bollingerWidthPct: round(bb?.width,2),
      stochastic14: round(st,2), volumeRatio20: round(volRatio,2)
    },
    levels: { support: round(support,2), resistance: round(resistance,2), stop: round(stop,2), target1: round(target1,2), target2: round(target2,2), low52: round(lo52,2), high52: round(hi52,2) },
    returns: { d5: round(ret5,2), d20: round(ret20,2), d60: round(ret60,2), ytd: round(retYtd,2) },
    reasons: reasons.slice(0,5),
    cautions: cautions.slice(0,5)
  };
}

async function mapLimit(items, limit, fn) {
  const ret = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      ret[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
  return ret;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });
  const body = await readBody(req);
  const rawSymbols = body.symbols || req.query.symbols || req.query.s || 'ASELS,BIMAS,TUPRS,EREGL,EKGYO,MPARK,GUBRF,KTLEV';
  let symbols = Array.isArray(rawSymbols) ? rawSymbols : String(rawSymbols).split(',');
  symbols = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))].slice(0, Number(req.query.max || body.max || 120));
  const range = ALLOWED_RANGES.has(body.range || req.query.range) ? (body.range || req.query.range) : '1y';
  const interval = ALLOWED_INTERVALS.has(body.interval || req.query.interval) ? (body.interval || req.query.interval) : '1d';

  const started = Date.now();
  const results = await mapLimit(symbols, 8, async (s) => {
    try {
      const { meta, bars } = await fetchBars(s, range, interval);
      return { ok: true, ...analyze(s, bars, meta) };
    } catch (err) {
      return { ok: false, symbol: stripIS(s), error: err.message };
    }
  });

  const ok = results.filter(r => r.ok).sort((a,b) => b.score - a.score);
  const failed = results.filter(r => !r.ok);
  return send(res, 200, {
    ok: true,
    source: 'Yahoo Finance chart proxy',
    note: 'Ücretsiz/delayli veri kullanılır. Sinyaller teknik analiz amaçlıdır, yatırım tavsiyesi değildir.',
    range,
    interval,
    scanned: symbols.length,
    success: ok.length,
    failed,
    elapsedMs: Date.now() - started,
    results: ok
  });
}
