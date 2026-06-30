# Katılım Radar BIST v1.5

Bu sürüm veri katmanına odaklanır.

## Ana değişiklikler

- İş Yatırım `HisseTekil` veri çekimi daha dayanıklı hale getirildi.
- Aynı endpoint için hem `.json` uzantılı hem uzantısız format denenir.
- `Website` / `WebSite` path varyasyonları denenir.
- 1 hafta öncesine kadar olan tarihsel veri server memory cache'e alınır.
- Son 1 haftalık veri her sorguda canlı/güncel kaynaktan çekilip cache'li geçmişle birleştirilir.
- `/api/cache` endpointi eklendi. Katılım evreni arka planda küçük parçalar halinde cache'e hazırlanır.
- Teknik tarama artık tek büyük istek yerine 8'li parçalar halinde çalışır; bu Vercel timeout riskini azaltır.
- Fiyat panosu kartları tıklanabilir hale getirildi; karttan hisse detayına gidilir.
- Tarama sırasında sonuçlar parça parça ekranda görünür.

## Test endpointleri

```txt
/api/history?symbol=ASELS&range=1y
/api/market?symbol=ASELS&range=1y&interval=1d
/api/snapshot?symbols=ASELS,BIMAS,TUPRS&range=3mo
/api/scan?symbols=ASELS,BIMAS,TUPRS&range=1y&interval=1d
/api/cache?symbols=ASELS,BIMAS,TUPRS&range=1y
```

## Veri mantığı

```txt
TradingView widgetları = görsel/anlık referans
İş Yatırım HisseTekil = ana OHLC/hacim ve teknik analiz verisi
Yahoo Finance = fallback
AI = yalnızca çekilen bar verileri + teknik göstergeler + fırsat skoru üzerinden yorum
```

## Not

BIST gerçek zamanlı verisi lisanslıdır. Bu sistem ücretsiz ve gecikmeli kaynakları kullanır; yatırım tavsiyesi değildir.
