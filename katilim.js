// /api/market?symbol=ASELS&range=1y&interval=1d
// Free proxy for Yahoo Finance chart endpoint. BIST symbols use .IS suffix.

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const ALLOWED_INTERVALS = new Set(['1m','2m','5m','15m','30m','60m','90m','1h','1d','5d','1wk','1mo','3mo']);
const ALLOWED_RANGES = new Set(['1d','5d','1mo','3mo','6mo','1y','2y','5y','10y','ytd','max']);

function send(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(payload));
}

function normalizeSymbol(input = '') {
  const clean = String(input).trim().toUpperCase().replace(/[^A-Z0-9.]/g, '');
  if (!clean) return '';
  if (clean.endsWith('.IS')) return clean;
  return `${clean}.IS`;
}

function toBarSeries(result) {
  const quote = result?.indicators?.quote?.[0] || {};
  const adjclose = result?.indicators?.adjclose?.[0]?.adjclose || [];
  const ts = result?.timestamp || [];
  const bars = ts.map((t, i) => ({
    time: t * 1000,
    date: new Date(t * 1000).toISOString().slice(0, 10),
    open: quote.open?.[i] ?? null,
    high: quote.high?.[i] ?? null,
    low: quote.low?.[i] ?? null,
    close: quote.close?.[i] ?? adjclose[i] ?? null,
    volume: quote.volume?.[i] ?? 0
  })).filter(b => Number.isFinite(b.close));
  return bars;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });
  const symbol = normalizeSymbol(req.query.symbol || req.query.s || 'ASELS');
  const range = ALLOWED_RANGES.has(req.query.range) ? req.query.range : '1y';
  const interval = ALLOWED_INTERVALS.has(req.query.interval) ? req.query.interval : '1d';

  if (!symbol || !/^[A-Z0-9]{2,10}\.IS$/.test(symbol)) {
    return send(res, 400, { ok: false, error: 'Geçersiz BIST sembolü.' });
  }

  const url = `${YAHOO_BASE}${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 KatilimRadar/1.0',
        'Accept': 'application/json,text/plain,*/*'
      }
    });
    const raw = await upstream.text();
    if (!upstream.ok) {
      return send(res, upstream.status, { ok: false, source: 'yahoo', status: upstream.status, details: raw.slice(0, 500) });
    }
    const json = JSON.parse(raw);
    const result = json?.chart?.result?.[0];
    const err = json?.chart?.error;
    if (err || !result) return send(res, 502, { ok: false, source: 'yahoo', error: err || 'Boş veri döndü.' });

    const meta = result.meta || {};
    const bars = toBarSeries(result);
    return send(res, 200, {
      ok: true,
      source: 'Yahoo Finance chart proxy',
      note: 'Ücretsiz/delayli veri kaynağıdır; BIST resmi gerçek zamanlı veri yerine geçmez.',
      symbol: symbol.replace('.IS',''),
      yahooSymbol: symbol,
      exchangeName: meta.exchangeName,
      currency: meta.currency || 'TRY',
      marketState: meta.marketState,
      regularMarketPrice: meta.regularMarketPrice,
      chartPreviousClose: meta.chartPreviousClose,
      regularMarketTime: meta.regularMarketTime ? meta.regularMarketTime * 1000 : null,
      range,
      interval,
      bars
    });
  } catch (err) {
    return send(res, 500, { ok: false, source: 'server', error: err.message });
  }
}
