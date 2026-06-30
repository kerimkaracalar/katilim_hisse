# Katılım Radar BIST v1.3

Borsa İstanbul katılım hisseleri için teknik analiz, fırsat radarı ve AI destekli pozisyon takip planı.

## v1.3 veri kaynağı düzeltmesi

Bu sürümde odak tamamen veri çekme tarafıdır.

Yeni öncelik sırası:

1. **İş Yatırım HisseTekil** günlük tarihsel fiyat verisi  
   `/api/history?symbol=ASELS&range=1y`
2. **Yahoo Finance chart proxy** fallback  
   `/api/market?symbol=ASELS&range=1y&interval=1d`
3. **TradingView widgetları** sadece görsel/canlı takip içindir; teknik hesaplamaya doğrudan dahil edilmez.

> Not: BIST gerçek zamanlı piyasa verileri lisanslı veri dağıtıcıları üzerinden sağlanır. Bu panel ücretsiz/gecikmeli kaynaklar kullanır. Çıktılar yatırım tavsiyesi değildir.

## Yeni API endpointleri

### 1) İş Yatırım tarihsel veri testi

```txt
/api/history?symbol=ASELS&range=1y
```

Başarılıysa JSON içinde `bars` dizisi dolu gelir.

### 2) Ana market endpointi

```txt
/api/market?symbol=ASELS&range=1y&interval=1d
```

Önce İş Yatırım denenir, olmazsa Yahoo fallback denenir.

### 3) Çoklu son fiyat snapshot

```txt
/api/snapshot?symbols=ASELS,BIMAS,TUPRS&range=1mo
```

Son bar, değişim ve kaynak bilgisini verir.

### 4) Teknik tarama

```txt
/api/scan?symbols=ASELS,BIMAS,TUPRS&range=1y&interval=1d
```

veya uygulama içinden `Teknik taramayı başlat`.

## Dosya yapısı

```txt
api/
  ai.js
  history.js
  isyatirim.js
  katilim.js
  market.js
  scan.js
  snapshot.js
public/
  index.html
  app.js
  styles.css
package.json
vercel.json
```

## Vercel ayarları

Framework Preset: `Other`  
Output Directory: `public`  
Root Directory: `api` ve `public` klasörlerinin bulunduğu üst klasör olmalı. `public` root directory yapılmamalı.

## Kontrol sırası

Deploy sonrası sırayla test et:

```txt
/api/history?symbol=ASELS&range=1y
/api/market?symbol=ASELS&range=1y&interval=1d
/api/snapshot?symbols=ASELS,BIMAS,TUPRS&range=1mo
/api/scan?symbols=ASELS,BIMAS,TUPRS&range=1y&interval=1d
```

`history` çalışıyorsa veri çekme sorununun ana kısmı çözülmüştür.
