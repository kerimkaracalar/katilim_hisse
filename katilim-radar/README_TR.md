# Katılım Radar BIST v1.2

Bu sürümde amaç ikiye ayrıldı:

1. **TradingView widgetları**: Anlık/görsel fiyat takibi için kullanılır. Widget içindeki veri sayfa içi teknik hesaplamaya doğrudan okunmaz.
2. **Teknik analiz motoru**: `/api/scan` üzerinden ücretsiz chart verisini çeker, EMA/SMA/RSI/MACD/ATR/Bollinger/Stochastic/hacim/destek-direnç hesaplar ve fırsat skorları üretir.

## Yeni özellikler

- Katılım fırsat radarı
- Fırsat türleri:
  - Hacimli direnç kırılımı
  - Trend devam fırsatı
  - Destek bölgesi takibi
  - Aşırı satım tepki adayı
- Teknik pozisyon planı:
  - Takip bölgesi
  - Geçersizleşme/takip stop
  - Hedef 1 / hedef 2
  - Risk/ödül oranı
  - Vade notu
- AI analizi artık bu verileri kullanır:
  - Çekilen fiyat barları
  - Teknik göstergeler
  - Destek/direnç
  - Fırsat skoru
  - Pozisyon planı
  - Evren taramasındaki en güçlü adaylar
- Otomatik tarama butonu: sayfa açıkken 15 dakikada bir yeniden tarama yapar.

## Vercel yapı

Klasör yapısı:

```text
api/
  ai.js
  katilim.js
  market.js
  scan.js
public/
  index.html
  app.js
  styles.css
package.json
```

Vercel ayarları:

```text
Framework Preset: Other
Root Directory: api ve public klasörlerinin bulunduğu üst klasör
Output Directory: public
Build Command: boş bırakılabilir
```

AI için Environment Variables:

```text
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

Not: Bu sistem yatırım tavsiyesi vermez. Teknik analiz ve takip planı üretir.
