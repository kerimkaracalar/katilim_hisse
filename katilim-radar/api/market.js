// /api/market?symbol=ASELS&range=1y&interval=1d
// Primary: İş Yatırım HisseTekil daily historical data. Fallback: Yahoo Finance chart proxy.

import { cleanSymbol, fetchBestBars } from './isyatirim.js';

const ALLOWED_INTERVALS = new Set(['1m','2m','5m','15m','30m','60m','90m','1h','1d','5d','1wk','1mo','3mo']);
const ALLOWED_RANGES = new Set(['1d','5d','1mo','3mo','6mo','1y','2y','5y','10y','ytd','max']);

function send(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });
  const symbol = cleanSymbol(req.query.symbol || req.query.s || 'ASELS');
  const range = ALLOWED_RANGES.has(req.query.range) ? req.query.range : '1y';
  const interval = ALLOWED_INTERVALS.has(req.query.interval) ? req.query.interval : '1d';

  if (!symbol || !/^[A-Z0-9]{2,12}$/.test(symbol)) {
    return send(res, 400, { ok: false, error: 'Geçersiz BIST sembolü.' });
  }

  try {
    const data = await fetchBestBars(symbol, range, interval);
    const last = data.lastBar || data.bars[data.bars.length - 1];
    const prev = data.bars[data.bars.length - 2];
    return send(res, 200, {
      ok: true,
      source: data.source,
      provider: data.provider,
      attempts: data.attempts,
      note: 'Ana kaynak İş Yatırım günlük tarihsel veridir; gerekirse Yahoo fallback kullanılır. Veriler gecikmeli/eksik olabilir.',
      symbol,
      currency: data.currency || 'TRY',
      marketState: data.marketState || null,
      regularMarketPrice: data.regularMarketPrice ?? last?.close ?? null,
      chartPreviousClose: prev?.close ?? null,
      regularMarketTime: data.marketTime || last?.time || null,
      range,
      interval: data.interval || interval,
      bars: data.bars
    });
  } catch (err) {
    return send(res, 502, { ok: false, source: 'market-proxy', symbol, error: err.message, attempts: err.attempts || [] });
  }
}
