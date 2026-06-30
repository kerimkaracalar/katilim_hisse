// /api/katilim?index=XK100|XK030|XK050|XKTUM&source=kt|bist|auto
// Uses Kuveyt Türk Yatırım katılım sayfası first, then official Borsa İstanbul CSV, then bundled seed list.

import { fetchKuveytTurkPage } from './kuveytturk.js';

const OFFICIAL_CSV = 'https://borsaistanbul.com/datum/hisse_endeks_katilim_ds.csv';

const SEED = [
  {symbol:'ASELS', name:'ASELSAN', indexes:['XK030','XK050','XK100','XKTUM'], sector:'Savunma'},
  {symbol:'BIMAS', name:'BIM Mağazalar', indexes:['XK030','XK050','XK100','XKTUM'], sector:'Perakende'},
  {symbol:'TUPRS', name:'Tüpraş', indexes:['XK030','XK050','XK100','XKTUM'], sector:'Petrol'},
  {symbol:'EREGL', name:'Ereğli Demir Çelik', indexes:['XK030','XK050','XK100','XKTUM'], sector:'Ana Metal'},
  {symbol:'EKGYO', name:'Emlak Konut GMYO', indexes:['XK030','XK050','XK100','XKTUM'], sector:'GYO'},
  {symbol:'MPARK', name:'MLP Sağlık', indexes:['XK030','XK050','XK100','XKTUM'], sector:'Sağlık'},
  {symbol:'GUBRF', name:'Gübre Fabrikaları', indexes:['XK030','XK050','XK100','XKTUM'], sector:'Kimya'},
  {symbol:'KTLEV', name:'Katılımevim', indexes:['XK030','XK050','XK100','XKTUM'], sector:'Finansman'},
  {symbol:'THYAO', name:'Türk Hava Yolları', indexes:['XK050','XK100','XKTUM'], sector:'Ulaştırma'},
  {symbol:'KONTR', name:'Kontrolmatik', indexes:['XK050','XK100','XKTUM'], sector:'Teknoloji'},
  {symbol:'CIMSA', name:'Çimsa', indexes:['XK050','XK100','XKTUM'], sector:'Çimento'},
  {symbol:'KONYA', name:'Konya Çimento', indexes:['XK050','XK100','XKTUM'], sector:'Çimento'},
  {symbol:'ALFAS', name:'Alfa Solar Enerji', indexes:['XK050','XK100','XKTUM'], sector:'Enerji'},
  {symbol:'GESAN', name:'Girişim Elektrik', indexes:['XK050','XK100','XKTUM'], sector:'Elektrik'},
  {symbol:'EUPWR', name:'Europower Enerji', indexes:['XK050','XK100','XKTUM'], sector:'Elektrik'},
  {symbol:'CWENE', name:'CW Enerji', indexes:['XK050','XK100','XKTUM'], sector:'Enerji'},
  {symbol:'ASTOR', name:'Astor Enerji', indexes:['XK050','XK100','XKTUM'], sector:'Elektrik'},
  {symbol:'SMRTG', name:'Smart Güneş', indexes:['XK100','XKTUM'], sector:'Enerji'},
  {symbol:'BIOEN', name:'Biotrend Enerji', indexes:['XK100','XKTUM'], sector:'Enerji'},
  {symbol:'YEOTK', name:'Yeo Teknoloji', indexes:['XK100','XKTUM'], sector:'Teknoloji'},
  {symbol:'KCAER', name:'Kocaer Çelik', indexes:['XK100','XKTUM'], sector:'Metal'},
  {symbol:'KOCMT', name:'Koç Metalurji', indexes:['XK100','XKTUM'], sector:'Metal'},
  {symbol:'TUKAS', name:'Tukaş', indexes:['XK100','XKTUM'], sector:'Gıda'},
  {symbol:'PENGD', name:'Penguen Gıda', indexes:['XKTUM'], sector:'Gıda'},
  {symbol:'KERVT', name:'Kerevitaş', indexes:['XKTUM'], sector:'Gıda'},
  {symbol:'ULKER', name:'Ülker', indexes:['XK100','XKTUM'], sector:'Gıda'},
  {symbol:'SOKM', name:'Şok Marketler', indexes:['XK100','XKTUM'], sector:'Perakende'},
  {symbol:'MAVI', name:'Mavi Giyim', indexes:['XK100','XKTUM'], sector:'Perakende'},
  {symbol:'EBEBK', name:'Ebebek', indexes:['XK100','XKTUM'], sector:'Perakende'},
  {symbol:'VESBE', name:'Vestel Beyaz Eşya', indexes:['XK100','XKTUM'], sector:'Dayanıklı Tüketim'},
  {symbol:'VESTL', name:'Vestel', indexes:['XK100','XKTUM'], sector:'Teknoloji'},
  {symbol:'TTRAK', name:'Türk Traktör', indexes:['XK100','XKTUM'], sector:'Otomotiv'},
  {symbol:'TOASO', name:'Tofaş', indexes:['XK100','XKTUM'], sector:'Otomotiv'},
  {symbol:'FROTO', name:'Ford Otosan', indexes:['XK100','XKTUM'], sector:'Otomotiv'},
  {symbol:'OTKAR', name:'Otokar', indexes:['XK100','XKTUM'], sector:'Otomotiv'},
  {symbol:'KARSN', name:'Karsan', indexes:['XKTUM'], sector:'Otomotiv'},
  {symbol:'AGHOL', name:'Anadolu Grubu Holding', indexes:['XK100','XKTUM'], sector:'Holding'},
  {symbol:'BERA', name:'Bera Holding', indexes:['XK100','XKTUM'], sector:'Holding'},
  {symbol:'ALBRK', name:'Albaraka Türk', indexes:['XK100','XKTUM'], sector:'Katılım Bankası'},
  {symbol:'KRDMA', name:'Kardemir A', indexes:['XKTUM'], sector:'Metal'},
  {symbol:'KRDMB', name:'Kardemir B', indexes:['XKTUM'], sector:'Metal'},
  {symbol:'KRDMD', name:'Kardemir D', indexes:['XK100','XKTUM'], sector:'Metal'},
  {symbol:'BRSAN', name:'Borusan Boru', indexes:['XK100','XKTUM'], sector:'Metal'},
  {symbol:'CEMTS', name:'Çemtaş', indexes:['XKTUM'], sector:'Metal'},
  {symbol:'BUCIM', name:'Bursa Çimento', indexes:['XKTUM'], sector:'Çimento'},
  {symbol:'AKCNS', name:'Akçansa', indexes:['XKTUM'], sector:'Çimento'},
  {symbol:'OYAKC', name:'Oyak Çimento', indexes:['XK100','XKTUM'], sector:'Çimento'},
  {symbol:'ENJSA', name:'Enerjisa Enerji', indexes:['XK100','XKTUM'], sector:'Enerji'},
  {symbol:'AKSEN', name:'Aksa Enerji', indexes:['XK100','XKTUM'], sector:'Enerji'},
  {symbol:'CANTE', name:'Çan2 Termik', indexes:['XK100','XKTUM'], sector:'Enerji'},
  {symbol:'ODAS', name:'Odaş Elektrik', indexes:['XK100','XKTUM'], sector:'Enerji'},
  {symbol:'ZOREN', name:'Zorlu Enerji', indexes:['XKTUM'], sector:'Enerji'},
  {symbol:'ENERY', name:'Enerya Enerji', indexes:['XK100','XKTUM'], sector:'Enerji'},
  {symbol:'AHGAZ', name:'Ahlatcı Doğalgaz', indexes:['XK100','XKTUM'], sector:'Enerji'},
  {symbol:'DAPGM', name:'DAP Gayrimenkul', indexes:['XK100','XKTUM'], sector:'GYO'},
  {symbol:'KLGYO', name:'Kiler GYO', indexes:['XKTUM'], sector:'GYO'},
  {symbol:'SNGYO', name:'Sinpaş GYO', indexes:['XKTUM'], sector:'GYO'},
  {symbol:'AKFGY', name:'Akfen GYO', indexes:['XKTUM'], sector:'GYO'},
  {symbol:'GENIL', name:'Gen İlaç', indexes:['XK100','XKTUM'], sector:'Sağlık'},
  {symbol:'EGEEN', name:'Ege Endüstri', indexes:['XK100','XKTUM'], sector:'Otomotiv'},
  {symbol:'SASA', name:'Sasa Polyester', indexes:['XK100','XKTUM'], sector:'Kimya'},
  {symbol:'HEKTS', name:'Hektaş', indexes:['XK100','XKTUM'], sector:'Kimya'},
  {symbol:'BRISA', name:'Brisa', indexes:['XK100','XKTUM'], sector:'Lastik'},
  {symbol:'PETKM', name:'Petkim', indexes:['XK100','XKTUM'], sector:'Kimya'},
  {symbol:'TMSN', name:'Tümosan', indexes:['XKTUM'], sector:'Makine'},
  {symbol:'MAKIM', name:'Makim Makina', indexes:['XKTUM'], sector:'Makine'},
  {symbol:'FORTE', name:'Forte Bilgi İletişim', indexes:['XKTUM'], sector:'Teknoloji'},
  {symbol:'MIATK', name:'Mia Teknoloji', indexes:['XK100','XKTUM'], sector:'Teknoloji'},
  {symbol:'ARDYZ', name:'Ard Grup', indexes:['XKTUM'], sector:'Teknoloji'},
  {symbol:'LOGO', name:'Logo Yazılım', indexes:['XK100','XKTUM'], sector:'Teknoloji'},
  {symbol:'PAPIL', name:'Papilon Savunma', indexes:['XKTUM'], sector:'Teknoloji'},
  {symbol:'SNICA', name:'Sanica Isı', indexes:['XKTUM'], sector:'Sanayi'},
  {symbol:'DGNMO', name:'Doğanlar Mobilya', indexes:['XKTUM'], sector:'Mobilya'},
  {symbol:'LILAK', name:'Lila Kağıt', indexes:['XK100','XKTUM'], sector:'Kağıt'},
  {symbol:'KLSER', name:'Kaleseramik', indexes:['XK100','XKTUM'], sector:'Seramik'},
  {symbol:'RUBNS', name:'Rubenis Tekstil', indexes:['XKTUM'], sector:'Tekstil'},
  {symbol:'BOSSA', name:'Bossa', indexes:['XKTUM'], sector:'Tekstil'},
  {symbol:'ISSEN', name:'İşbir Sentetik', indexes:['XKTUM'], sector:'Tekstil'},
  {symbol:'EKSUN', name:'Eksun Gıda', indexes:['XKTUM'], sector:'Gıda'},
  {symbol:'DARDL', name:'Dardanel', indexes:['XKTUM'], sector:'Gıda'},
  {symbol:'OFSYM', name:'Ofis Yem', indexes:['XKTUM'], sector:'Gıda'},
  {symbol:'MERCN', name:'Mercan Kimya', indexes:['XKTUM'], sector:'Kimya'},
  {symbol:'RNPOL', name:'Rainbow Polikarbonat', indexes:['XKTUM'], sector:'Plastik'},
  {symbol:'ORGE', name:'Orge Enerji Elektrik', indexes:['XKTUM'], sector:'Elektrik'},
  {symbol:'HATSN', name:'Hat-San Gemi', indexes:['XKTUM'], sector:'Ulaşım Araçları'},
  {symbol:'TURSG', name:'Türkiye Sigorta', indexes:['XK100','XKTUM'], sector:'Sigorta'}
];

function send(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(payload));
}

function cleanCell(v='') {
  return String(v).trim().replace(/^"|"$/g, '').replace(/\.E$/i,'').toUpperCase();
}

function detectDelimiter(line) {
  const counts = [';','\t',','].map(d => [d, (line.match(new RegExp(d === '\t' ? '\\t' : d, 'g')) || []).length]);
  return counts.sort((a,b) => b[1]-a[1])[0][0];
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!lines.length) return [];

  const delim = detectDelimiter(lines[0]);
  const rows = lines.map(l => l.split(delim).map(x => x.trim().replace(/^"|"$/g,'')));

  // BIST'in güncel katılım CSV formatı genelde başlıksızdır:
  // ACSEL.E;ACIPAYAM SELULOZ;XKTUM;BIST KATILIM TUM;BIST PARTICIPATION ALL SHARES;27/04/2026
  // Aynı hisse XK030/XK050/XK100/XKTUM satırlarında tekrar edebilir. Bu yüzden önce bu formatı deneriz.
  const grouped = new Map();
  let rowStyleCount = 0;

  for (const r of rows) {
    const rawSymbol = cleanCell(r[0] || '');
    const symbol = rawSymbol.replace(/\.E$/i, '');
    const indexCode = cleanCell(r[2] || '');
    if (/^[A-Z0-9]{2,8}$/.test(symbol) && /^XK(030|050|100|TUM)$/.test(indexCode)) {
      rowStyleCount++;
      if (!grouped.has(symbol)) {
        grouped.set(symbol, { symbol, name: r[1] || symbol, sector: '', indexes: new Set() });
      }
      grouped.get(symbol).indexes.add(indexCode);
    }
  }

  if (rowStyleCount > 0) {
    return Array.from(grouped.values()).map(x => ({
      symbol: x.symbol,
      name: x.name,
      sector: x.sector,
      indexes: Array.from(x.indexes.size ? x.indexes : new Set(['XKTUM']))
    }));
  }

  // Eski/başlıklı format fallback'i
  const header = rows[0].map(h => h.toLocaleUpperCase('tr-TR'));
  const symbolIdx = header.findIndex(h => /KOD|CODE|SEMBOL|SYMBOL|BILEŞEN|BILESEN/.test(h));
  const nameIdx = header.findIndex(h => /AD|UNVAN|NAME/.test(h));
  const sectorIdx = header.findIndex(h => /SEKT|SECTOR/.test(h));
  const indexCols = header.map((h, i) => ({h, i})).filter(x => /(XK030|XK050|XK100|XKTUM|KATILIM 30|KATILIM 50|KATILIM 100|KATILIM TUM|KATILIM TÜM)/.test(x.h));

  const out = [];
  for (const r of rows.slice(1)) {
    let symbol = symbolIdx >= 0 ? cleanCell(r[symbolIdx]).replace(/\.E$/i,'') : '';
    if (!symbol) {
      const possible = r.map(cleanCell).map(x => x.replace(/\.E$/i,'')).find(x => /^[A-Z0-9]{3,6}$/.test(x));
      symbol = possible || '';
    }
    if (!/^[A-Z0-9]{3,6}$/.test(symbol)) continue;
    const name = nameIdx >= 0 ? r[nameIdx] : symbol;
    const sector = sectorIdx >= 0 ? r[sectorIdx] : '';
    const indexes = new Set(['XKTUM']);
    for (const col of indexCols) {
      const val = String(r[col.i] || '').trim().toUpperCase();
      if (!val || val === '0' || val === 'HAYIR' || val === 'NO') continue;
      if (/XK030|KATILIM 30/.test(col.h)) indexes.add('XK030');
      if (/XK050|KATILIM 50/.test(col.h)) indexes.add('XK050');
      if (/XK100|KATILIM 100/.test(col.h)) indexes.add('XK100');
      if (/XKTUM|KATILIM TUM|KATILIM TÜM/.test(col.h)) indexes.add('XKTUM');
    }
    out.push({ symbol, name: name || symbol, sector, indexes: Array.from(indexes) });
  }
  return out;
}

async function loadOfficial() {
  const r = await fetch(OFFICIAL_CSV, {
    headers: { 'User-Agent': 'Mozilla/5.0 KatilimRadar/1.0', 'Accept': 'text/csv,text/plain,*/*' }
  });
  if (!r.ok) throw new Error(`BIST CSV HTTP ${r.status}`);
  const buf = await r.arrayBuffer();
  let text;
  try { text = new TextDecoder('windows-1254').decode(buf); }
  catch { text = new TextDecoder('utf-8').decode(buf); }
  const parsed = parseCSV(text);
  if (!parsed.length) throw new Error('BIST CSV parse edilemedi.');
  return parsed;
}

function pickIndex(list, index) {
  const idx = String(index || 'XK100').toUpperCase();
  return list.filter(x => (x.indexes || []).includes(idx) || idx === 'ALL').sort((a,b) => a.symbol.localeCompare(b.symbol));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });
  const index = String(req.query.index || 'XK100').toUpperCase();
  const sourcePref = String(req.query.source || 'auto').toLowerCase();
  const forceSeed = req.query.seed === '1';
  const errors = [];

  if (!forceSeed && sourcePref !== 'bist') {
    try {
      const kt = await fetchKuveytTurkPage();
      const list = kt.universe || [];
      const items = pickIndex(list, index);
      if (items.length >= 10) {
        return send(res, 200, {
          ok: true,
          source: 'Kuveyt Türk Yatırım · Katılım Endeksinde Yer Alan Şirketler',
          sourceUrl: kt.url,
          index,
          count: items.length,
          updatedAt: kt.fetchedAt || new Date().toISOString(),
          cache: kt.cache,
          diagnostics: kt.diagnostics,
          indexes: kt.indexes || [],
          items
        });
      }
      errors.push(`Kuveyt Türk liste yetersiz/parse edilemedi (${items.length})`);
    } catch (e) { errors.push(`Kuveyt Türk: ${e.message}`); }
  }

  if (!forceSeed && sourcePref !== 'kt') {
    try {
      const list = await loadOfficial();
      const items = pickIndex(list, index);
      return send(res, 200, {
        ok: true,
        source: 'Borsa İstanbul resmi katılım CSV',
        sourceUrl: OFFICIAL_CSV,
        index,
        count: items.length,
        updatedAt: new Date().toISOString(),
        warning: errors.length ? errors.join(' | ') : undefined,
        items
      });
    } catch (err) { errors.push(`BIST CSV: ${err.message}`); }
  }

  const items = pickIndex(SEED, index);
  return send(res, 200, {
    ok: true,
    source: 'Bundled seed fallback',
    warning: `Kuveyt Türk/BIST kaynakları alınamadı; yerel yedek liste kullanılıyor. Detay: ${errors.join(' | ') || 'Seed requested'}`,
    officialUrl: OFFICIAL_CSV,
    index,
    count: items.length,
    updatedAt: new Date().toISOString(),
    items
  });
}
