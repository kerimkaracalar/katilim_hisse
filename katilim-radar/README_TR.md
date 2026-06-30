# Katılım Radar BIST v1.4 – Veri Kaynağı Düzeltmeli Sürüm

Bu sürümün odağı veri çekme problemidir.

## Düzeltilen ana sorun

İş Yatırım HisseTekil endpointinde tarihsel veri URL'sinin sonunda `.json` uzantısı gerekir. Önceki sürümde URL şu şekilde kuruluyordu:

```text
...&enddate=30-06-2026
```

Doğru kullanım:

```text
...&enddate=30-06-2026.json
```

Bu sürümde `api/isyatirim.js` buna göre düzeltildi.

## Veri mimarisi

1. Ana kaynak: İş Yatırım HisseTekil günlük tarihsel veri
2. Fallback: Yahoo Finance chart proxy
3. Teknik analiz: çekilen OHLC + hacim barlarından hesaplanır
4. TradingView: yalnızca dış grafik/link görsel referansı; hesaplamaya dahil edilmez

## Yeni ekran düzeni

Çalışmayan TradingView endeks widgetları ana ekrandan çıkarıldı. Yerine sistemin gerçekten çektiği verilerden oluşan fiyat panosu eklendi. Böylece ekranda görülen fiyatlar ile teknik analiz motorunun kullandığı veri aynı kaynaklardan gelir.

## Deploy sonrası test

Önce bu endpointleri açın:

```text
/api/history?symbol=ASELS&range=1y
/api/market?symbol=ASELS&range=1y&interval=1d
/api/snapshot?symbols=ASELS,BIMAS,TUPRS&range=3mo
/api/scan?symbols=ASELS,BIMAS,TUPRS&range=1y&interval=1d
```

Başarılı yanıtta `provider: "isyatirim"` veya fallback olarak `provider: "yahoo"` görmelisiniz.

## Not

BIST gerçek zamanlı verileri lisanslı veri sağlayıcılarına tabidir. Bu sistem ücretsiz/gecikmeli kaynaklarla teknik analiz üretir ve yatırım tavsiyesi değildir.
