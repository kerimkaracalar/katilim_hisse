const $ = (id) => document.getElementById(id);
const fmt = (v, d=2) => Number.isFinite(Number(v)) ? Number(v).toLocaleString('tr-TR',{minimumFractionDigits:d, maximumFractionDigits:d}) : '—';
const pct = (v) => Number.isFinite(Number(v)) ? `${Number(v) >= 0 ? '+' : ''}${fmt(Number(v),2)}%` : '—';
const clsBy = (v) => Number(v) >= 0 ? 'green' : 'red';

const state = {
  universe: [],
  results: [],
  selected: null,
  watch: JSON.parse(localStorage.getItem('katilim_watch_v1') || '[]')
};

function setStatus(text, type='muted') {
  $('marketClock').className = `pill ${type}`;
  $('marketClock').textContent = text;
}
function setSource(text, type='warning') {
  $('sourceBadge').className = `pill ${type}`;
  $('sourceBadge').textContent = text;
}
function getName(symbol) {
  return state.universe.find(x => x.symbol === symbol)?.name || symbol;
}
function getSector(symbol) {
  return state.universe.find(x => x.symbol === symbol)?.sector || '';
}
function tagClass(score){ return score >= 63 ? 'good' : score < 47 ? 'bad' : 'mid'; }

async function loadUniverse() {
  const index = $('indexSelect').value;
  setStatus('⏳ Katılım listesi alınıyor...', 'muted');
  try {
    const res = await fetch(`/api/katilim?index=${encodeURIComponent(index)}`);
    const data = await res.json();
    state.universe = data.items || [];
    $('universeCount').textContent = state.universe.length;
    $('universeSource').textContent = data.source || '—';
    setSource(data.source?.includes('Borsa') ? '✅ Resmi BIST katılım listesi' : '⚠️ Yedek katılım listesi', data.source?.includes('Borsa') ? 'good' : 'warning');
    setStatus(`✅ ${index} listesi hazır`, 'good');
    if (data.warning) console.warn(data.warning);
    renderSuggestions('');
    renderWatchList();
  } catch (err) {
    setStatus(`❌ Liste alınamadı: ${err.message}`, 'warning');
  }
}

async function scanUniverse() {
  if (!state.universe.length) await loadUniverse();
  const max = Number($('limitSelect').value || 50);
  const symbols = state.universe.slice(0, max).map(x => x.symbol);
  if (!symbols.length) return;
  $('resultsBody').innerHTML = `<tr><td colspan="8" class="empty">⏳ ${symbols.length} katılım hissesi teknik olarak taranıyor...</td></tr>`;
  setStatus('⏳ Teknik tarama çalışıyor...', 'muted');
  $('scanMeta').textContent = 'EMA, SMA, RSI, MACD, ATR, Bollinger, hacim ve destek/direnç hesaplanıyor.';
  const started = performance.now();
  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ symbols, range: $('rangeSelect').value, interval: $('intervalSelect').value, max })
    });
    const data = await res.json();
    state.results = data.results || [];
    $('scannedCount').textContent = `${data.success || 0}/${data.scanned || 0}`;
    $('positiveCount').textContent = state.results.filter(x => x.score >= 63).length;
    $('weakCount').textContent = state.results.filter(x => x.score < 47).length;
    $('scanMeta').textContent = `${data.source} · ${Math.round(performance.now()-started)} ms · Başarısız: ${(data.failed||[]).length}`;
    setStatus(`✅ Tarama tamamlandı · ${new Date().toLocaleTimeString('tr-TR')}`, 'good');
    renderResults();
    if (state.results.length) selectSymbol(state.results[0].symbol);
  } catch (err) {
    $('resultsBody').innerHTML = `<tr><td colspan="8" class="empty">❌ Tarama hatası: ${err.message}</td></tr>`;
    setStatus(`❌ Tarama hatası`, 'warning');
  }
}

function renderResults() {
  if (!state.results.length) {
    $('resultsBody').innerHTML = `<tr><td colspan="8" class="empty">Veri bulunamadı.</td></tr>`;
    return;
  }
  $('resultsBody').innerHTML = state.results.map(r => `
    <tr data-symbol="${r.symbol}">
      <td><b class="mono">${r.symbol}</b><br><small>${getName(r.symbol)}</small></td>
      <td><div class="scorebar" title="${r.score}/100"><i style="width:${r.score}%"></i></div><small>${r.score}/100</small></td>
      <td class="mono">${fmt(r.price,2)}</td>
      <td class="mono ${clsBy(r.changePct)}">${pct(r.changePct)}</td>
      <td class="mono">${fmt(r.indicators?.rsi14,1)}</td>
      <td class="mono ${clsBy(r.indicators?.macdHist)}">${fmt(r.indicators?.macdHist,3)}</td>
      <td class="mono ${clsBy(r.returns?.d20)}">${pct(r.returns?.d20)}</td>
      <td><span class="tag ${tagClass(r.score)}">${r.verdict}</span></td>
    </tr>
  `).join('');
  [...$('resultsBody').querySelectorAll('tr[data-symbol]')].forEach(tr => tr.addEventListener('click', () => selectSymbol(tr.dataset.symbol)));
}

async function selectSymbol(symbol) {
  let data = state.results.find(x => x.symbol === symbol);
  if (!data) {
    setStatus(`⏳ ${symbol} verisi alınıyor...`, 'muted');
    const res = await fetch('/api/scan', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ symbols: [symbol], range: $('rangeSelect').value, interval: $('intervalSelect').value, max: 1 })
    });
    const json = await res.json();
    data = json.results?.[0];
    if (!data) return setStatus(`❌ ${symbol} verisi alınamadı`, 'warning');
  }
  state.selected = data;
  renderDetail(data);
}

function renderDetail(a) {
  $('detailPanel').classList.remove('hidden');
  $('detailSymbol').textContent = a.symbol;
  $('detailName').textContent = `${getName(a.symbol)} ${getSector(a.symbol) ? '· ' + getSector(a.symbol) : ''}`;
  $('scoreValue').textContent = a.score;
  $('scoreRing').style.setProperty('--deg', `${Math.round(a.score * 3.6)}deg`);
  $('detailPrice').textContent = `${fmt(a.price,2)} ${a.currency || 'TRY'}`;
  $('detailChange').className = `change mono ${clsBy(a.changePct)}`;
  $('detailChange').textContent = `${fmt(a.change,2)} · ${pct(a.changePct)} · Son bar: ${a.lastBar || '—'}`;
  $('detailVerdict').textContent = a.verdict;
  $('detailVerdict').className = `verdict tag ${tagClass(a.score)}`;
  $('detailMiniText').textContent = miniSummary(a);
  renderMetrics(a);
  renderLevels(a);
  renderLists(a);
  drawChart(a.bars || []);
  renderTV(a.symbol);
  $('aiOutput').textContent = 'AI analizi için butona basın. Gemini yoksa yerel teknik özet oluşturulur.';
  window.scrollTo({ top: $('detailPanel').offsetTop - 12, behavior: 'smooth' });
}

function miniSummary(a) {
  const rsi = a.indicators?.rsi14;
  const macd = a.indicators?.macdHist;
  const support = a.levels?.support;
  const res = a.levels?.resistance;
  return `RSI ${fmt(rsi,1)}, MACD histogram ${fmt(macd,3)}. Yakın destek ${fmt(support,2)}, direnç ${fmt(res,2)}. Teknik skor fiyat trendi, momentum, hacim ve volatilite bileşenlerinden hesaplanır.`;
}
function renderMetrics(a) {
  const m = a.indicators || {};
  const ret = a.returns || {};
  const rows = [
    ['EMA20', m.ema20], ['EMA50', m.ema50], ['SMA200', m.sma200], ['RSI14', m.rsi14], ['MACD Hist', m.macdHist], ['ATR14', m.atr14],
    ['Boll. Üst', m.bollingerUpper], ['Boll. Alt', m.bollingerLower], ['Hacim/Ort.', m.volumeRatio20], ['5G', ret.d5, true], ['1A', ret.d20, true], ['YTD', ret.ytd, true]
  ];
  $('metricGrid').innerHTML = rows.map(([k,v,isPct]) => `<div class="metric"><div class="k">${k}</div><div class="v mono ${isPct ? clsBy(v) : ''}">${isPct ? pct(v) : fmt(v, isPct ? 2 : (k.includes('MACD')||k.includes('Hacim') ? 2 : 2))}</div></div>`).join('');
}
function renderLevels(a) {
  const l = a.levels || {};
  const rows = [['Destek',l.support],['Direnç',l.resistance],['Takip stop',l.stop],['Hedef 1',l.target1],['Hedef 2',l.target2],['52H bandı',`${fmt(l.low52,2)} / ${fmt(l.high52,2)}`]];
  $('levelGrid').innerHTML = rows.map(([k,v]) => `<div class="level"><div class="k">${k}</div><div class="v mono">${typeof v === 'number' ? fmt(v,2) : v}</div></div>`).join('');
}
function renderLists(a) {
  $('reasonList').innerHTML = (a.reasons?.length ? a.reasons : ['Net olumlu sinyal sınırlı.']).map(x => `<li>${x}</li>`).join('');
  $('cautionList').innerHTML = (a.cautions?.length ? a.cautions : ['Belirgin teknik uyarı sınırlı.']).map(x => `<li>${x}</li>`).join('');
}

function drawChart(bars) {
  const canvas = $('priceCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#151f31'; ctx.fillRect(0,0,w,h);
  if (!bars.length) return;
  const closes = bars.map(b=>b.close);
  const min = Math.min(...closes), max = Math.max(...closes);
  const pad = 24;
  const x = i => pad + i * ((w - pad*2) / Math.max(1, closes.length-1));
  const y = v => h - pad - ((v - min) / Math.max(0.0001, max-min)) * (h - pad*2);
  ctx.strokeStyle = '#26334d'; ctx.lineWidth = 1;
  for (let i=0;i<5;i++){ const yy = pad + i*(h-pad*2)/4; ctx.beginPath(); ctx.moveTo(pad,yy); ctx.lineTo(w-pad,yy); ctx.stroke(); }
  const grad = ctx.createLinearGradient(0,0,w,0); grad.addColorStop(0,'#5798ff'); grad.addColorStop(1,'#2ecc71');
  ctx.strokeStyle = grad; ctx.lineWidth = 3; ctx.beginPath();
  closes.forEach((v,i)=>{ if(i===0) ctx.moveTo(x(i),y(v)); else ctx.lineTo(x(i),y(v)); }); ctx.stroke();
  ctx.fillStyle = 'rgba(87,152,255,.10)'; ctx.lineTo(x(closes.length-1), h-pad); ctx.lineTo(x(0), h-pad); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8492ad'; ctx.font = '12px DM Mono, monospace';
  ctx.fillText(fmt(max,2), pad, 15); ctx.fillText(fmt(min,2), pad, h-8);
  ctx.fillStyle = '#edf3ff'; ctx.fillText(`${bars[0].date} → ${bars[bars.length-1].date}`, w-235, h-8);
}

function renderTV(symbol) {
  const tvSymbol = `BIST:${symbol}`;
  $('tvChart').innerHTML = '<div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div></div>';
  const chartScript = document.createElement('script');
  chartScript.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
  chartScript.async = true;
  chartScript.text = JSON.stringify({ symbols: [[`${tvSymbol}|1D`]], chartOnly:false, width:'100%', height:420, locale:'tr', colorTheme:'dark', autosize:true, showVolume:true, showMA:true, hideDateRanges:false, scalePosition:'right', valuesTracking:'1', changeMode:'price-and-percent', chartType:'area', isTransparent:true });
  $('tvChart').querySelector('.tradingview-widget-container').appendChild(chartScript);

  $('tvTech').innerHTML = '<div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div></div>';
  const techScript = document.createElement('script');
  techScript.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
  techScript.async = true;
  techScript.text = JSON.stringify({ interval:'1D', width:'100%', isTransparent:true, height:420, symbol:tvSymbol, showIntervalTabs:true, displayMode:'multiple', locale:'tr', colorTheme:'dark' });
  $('tvTech').querySelector('.tradingview-widget-container').appendChild(techScript);
}

async function runAI() {
  if (!state.selected) return;
  $('aiOutput').textContent = '⏳ AI/teknik yorum hazırlanıyor...';
  try {
    const res = await fetch('/api/ai', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ analysis: state.selected, universeSummary: state.results.slice(0,10).map(x => ({symbol:x.symbol, score:x.score, verdict:x.verdict, changePct:x.changePct})) })
    });
    const data = await res.json();
    $('aiOutput').innerHTML = simpleMarkdown(data.text || 'Yorum üretilemedi.') + (data.mode ? `<p><small>Mod: ${data.mode}${data.reason ? ' · ' + data.reason : ''}</small></p>` : '');
  } catch (err) {
    $('aiOutput').textContent = `AI hatası: ${err.message}`;
  }
}
function simpleMarkdown(txt) {
  return String(txt).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/^\*\*(.*?)\*\*/gm,'<b>$1</b>').replace(/\n/g,'<br>');
}

function renderSuggestions(q) {
  const term = (q || '').toUpperCase().trim();
  const list = state.universe.filter(x => !term || x.symbol.includes(term) || x.name.toUpperCase().includes(term)).slice(0, 12);
  const box = $('suggestions');
  if (!term) { box.classList.remove('show'); return; }
  box.innerHTML = list.map(x => `<div class="sug" data-symbol="${x.symbol}"><span><b class="mono">${x.symbol}</b><br><small>${x.name}</small></span><small>${x.sector || ''}</small></div>`).join('') || '<div class="sug">Sonuç yok</div>';
  box.classList.add('show');
  [...box.querySelectorAll('.sug[data-symbol]')].forEach(el => el.addEventListener('click', () => { $('symbolSearch').value = el.dataset.symbol; box.classList.remove('show'); selectSymbol(el.dataset.symbol); }));
}

function saveWatch() { localStorage.setItem('katilim_watch_v1', JSON.stringify(state.watch)); renderWatchList(); }
function addWatch() {
  const symbol = state.selected?.symbol || $('symbolSearch').value.toUpperCase().trim();
  if (!symbol) return;
  if (!state.watch.includes(symbol)) state.watch.push(symbol);
  saveWatch();
}
function renderWatchList() {
  const box = $('watchList');
  if (!state.watch.length) { box.className = 'watch-list empty'; box.textContent = 'Henüz hisse eklenmedi.'; return; }
  box.className = 'watch-list';
  box.innerHTML = state.watch.map(s => `<div class="watch-item"><span><b class="mono">${s}</b><br><small>${getName(s)}</small></span><button data-rm="${s}">×</button></div>`).join('');
  [...box.querySelectorAll('[data-rm]')].forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); state.watch = state.watch.filter(x => x !== btn.dataset.rm); saveWatch(); }));
  [...box.querySelectorAll('.watch-item')].forEach(item => item.addEventListener('click', () => selectSymbol(item.querySelector('b').textContent)));
}

function bootClock() {
  const now = new Date();
  const tr = now.toLocaleString('tr-TR', { timeZone:'Europe/Istanbul', hour:'2-digit', minute:'2-digit', second:'2-digit' });
  if (!$('marketClock').textContent.includes('⏳') && !$('marketClock').textContent.includes('✅')) return;
}

$('loadUniverseBtn').addEventListener('click', loadUniverse);
$('scanBtn').addEventListener('click', scanUniverse);
$('watchBtn').addEventListener('click', addWatch);
$('aiBtn').addEventListener('click', runAI);
$('indexSelect').addEventListener('change', loadUniverse);
$('symbolSearch').addEventListener('input', e => renderSuggestions(e.target.value));
$('symbolSearch').addEventListener('keydown', e => { if (e.key === 'Enter') selectSymbol(e.target.value.toUpperCase().trim()); });
document.addEventListener('click', e => { if (!e.target.closest('.searchbox')) $('suggestions').classList.remove('show'); });

loadUniverse().then(() => renderWatchList());
setInterval(bootClock, 1000);
