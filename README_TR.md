# Katılım Radar · BIST Katılım Hisseleri Teknik Analiz Paneli

Bu paket, önceki **Finans Pro Altın & Gümüş** sistemindeki mantığı Borsa İstanbul katılım hisselerine uyarlayan Vercel uyumlu çalışan bir web uygulamasıdır.

## Ne yapar?

- Sadece BIST katılım evreninden hisse seçer.
- Öncelik olarak Borsa İstanbul'un resmi katılım CSV listesini çekmeye çalışır.
- Resmi liste alınamazsa uygulama durmaz; yerel yedek listeyle çalışır ve ekranda uyarı gösterir.
- Yahoo Finance chart endpoint'ini Vercel serverless proxy üzerinden kullanarak ücretsiz fiyat/geçmiş veri çeker.
- EMA20, EMA50, SMA200, RSI14, MACD, ATR, Bollinger, Stochastic, hacim oranı, destek/direnç ve 52 haftalık bandı hesaplar.
- Hisseleri 0-100 teknik skorla sıralar.
- Seçilen hisse için grafik, destek/direnç, olumlu/riskli sinyaller ve TradingView widget'ları gösterir.
- Gemini API anahtarı varsa AI yorum üretir; yoksa otomatik kural tabanlı teknik özet verir.
- İzleme listesi tarayıcı localStorage içinde saklanır.

## Önemli veri notu

BIST gerçek zamanlı verisi normalde lisanslı veri dağıtıcıları üzerinden sunulur. Bu uygulama ücretsiz pratik kullanım için gecikmeli/ücretsiz kaynakları kullanır. Bu nedenle fiyatlar aracı kurum ekranındaki anlık fiyatla birebir aynı olmayabilir.

## Klasör yapısı

```text
katilim-radar/
  api/
    katilim.js   -> BIST resmi katılım CSV + yedek liste
    market.js    -> Tek hisse Yahoo chart proxy
    scan.js      -> Çoklu teknik tarama motoru
    ai.js        -> Gemini proxy + fallback teknik yorum
  public/
    index.html
    styles.css
    app.js
  package.json
  vercel.json
```

## Yerelde çalıştırma

1. Node.js 18+ kurulu olmalı.
2. Vercel CLI kurulu değilse:

```bash
npm i -g vercel
```

3. Proje klasöründe:

```bash
npm install
vercel dev
```

4. Tarayıcıda:

```text
http://localhost:3000
```

## Vercel'e yükleme

1. Bu klasörü GitHub'a yükleyin.
2. Vercel > New Project > GitHub repository seçin.
3. Framework Preset: Other.
4. Deploy.

## Opsiyonel Gemini AI kurulumu

Vercel > Project Settings > Environment Variables bölümüne ekleyin:

```text
GEMINI_API_KEY = kendi_gemini_api_keyiniz
GEMINI_MODEL = gemini-2.5-flash
```

Gemini hata verirse sistem kapanmaz; teknik fallback yorum üretir.

## Kullanım önerisi

- Günlük kısa tarama için: BIST Katılım 100 + 50 hisse limiti.
- Daha kapsamlı tarama için: BIST Katılım Tüm + 100/120 hisse limiti.
- Haftalık trend kontrolü için periyodu `Haftalık` seçin.
- Seçilen hisse detayında TradingView teknik özetiyle sistem skorunu birlikte kontrol edin.

## Yatırım uyarısı

Bu uygulama yatırım tavsiyesi vermez. Katılım uygunluğu ve teknik sinyaller zamanla değişebilir. Nihai karar öncesinde güncel KAP/BIST bilgileri, şirket finansalları ve kendi risk profiliniz dikkate alınmalıdır.
