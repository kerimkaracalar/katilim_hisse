# Katılım Radar BIST v1.6

Bu sürümde sistem karar destek yapısına çevrildi:

- **Katılım evreni ana kaynak:** Kuveyt Türk Yatırım `Katılım Endeksinde Yer Alan Şirketler` bölümü.
- **Katılım evreni fallback:** Borsa İstanbul resmi katılım CSV.
- **Güncel fiyat snapshot ana kaynak:** OYAK Yatırım katılım piyasa verileri tablosu.
- **Geçmiş OHLC / teknik analiz ana kaynak:** İş Yatırım `HisseTekil` günlük tarihsel verisi.
- **Fallback:** Yahoo Finance chart proxy.
- **AI:** Sadece sistemin çektiği fiyat/geçmiş bar/teknik gösterge/fırsat skoru/pozisyon planı verilerini yorumlar.

> Not: Kuveyt Türk sayfası katılım listesi, endeks bilgileri ve şirket uygunluk/detail referansı için kullanılır. Hisse bazlı tam OHLC geçmiş veri sayfada yoksa teknik analiz için İş Yatırım/Yahoo kaynakları kullanılır.

## Yeni endpointler

### Kuveyt Türk katılım evreni

```txt
/api/kuveytturk?mode=universe&index=XK100
/api/kuveytturk?mode=indexes
/api/kuveytturk?mode=company&symbol=ASELS
```

### Katılım listesi

```txt
/api/katilim?index=XK100
```

Öncelik Kuveyt Türk Yatırım, sonra BIST resmi CSV, sonra yerel seed listedir.

### Güncel fiyat panosu

```txt
/api/snapshot?symbols=ASELS,BIMAS,TUPRS&index=XKTUM&range=3mo
```

Öncelik OYAK Yatırım güncel tablo, sonra İş Yatırım/Yahoo fallback.

### Geçmiş fiyat / teknik analiz

```txt
/api/history?symbol=ASELS&range=1y
/api/market?symbol=ASELS&range=1y&interval=1d
/api/scan?symbols=ASELS,BIMAS,TUPRS&range=1y&interval=1d
```

## Test sırası

1. `/api/kuveytturk?mode=universe&index=XK100`
2. `/api/katilim?index=XK100`
3. `/api/oyak?index=XKTUM`
4. `/api/snapshot?symbols=ASELS,BIMAS,TUPRS&index=XKTUM`
5. `/api/market?symbol=ASELS&range=1y&interval=1d`
6. `/api/scan?symbols=ASELS,BIMAS,TUPRS&range=1y&interval=1d`

## Veri mimarisi

```txt
Kuveyt Türk Yatırım -> Katılım evreni + endeks/şirket referansı
OYAK Yatırım        -> Güncel fiyat snapshot/fiyat panosu
İş Yatırım          -> Geçmiş günlük OHLC + hacim
Yahoo Finance       -> Fallback chart data
TradingView         -> Görsel widget / manuel doğrulama
AI                  -> Sadece bu veri paketinin karar destek yorumu
```

## Yasal/teknik not

Bu uygulama yatırım tavsiyesi değildir. BIST gerçek zamanlı veri lisanslı veri dağıtıcıları üzerinden sağlanır; ücretsiz web kaynakları gecikmeli, eksik veya erişime kapalı olabilir. Vercel memory cache kalıcı veritabanı değildir; kalıcı cache için sonraki adımda Upstash Redis / Vercel KV eklenebilir.
