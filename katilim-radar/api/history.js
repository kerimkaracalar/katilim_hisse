// /api/history?symbol=ASELS&range=1y
// Direct İş Yatırım historical daily data endpoint wrapper.

import { cleanSymbol, fetchIsYatirimBars } from './isyatirim.js';

const ALLOWED_RANGES = new Set(['1d','5d','1mo','3mo','6mo','1y','2y','5y','ytd','max']);
function send(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });
  const symbol = cleanSymbol(req.query.symbol || req.query.s || 'ASELS');
  const range = ALLOWED_RANGES.has(req.query.range) ? req.query.range : '1y';
  if (!symbol) return send(res, 400, { ok: false, error: 'Geçersiz sembol.' });
  try {
    const data = await fetchIsYatirimBars(symbol, range);
    return send(res, 200, { ok: true, ...data, note: 'İş Yatırım HisseTekil günlük tarihsel veri wrapperıdır.' });
  } catch (err) {
    return send(res, 502, { ok: false, source: 'İş Yatırım HisseTekil', symbol, error: err.message });
  }
}
