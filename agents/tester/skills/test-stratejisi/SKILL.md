---
name: test-stratejisi
description: Test stratejisi: ne test edilir, AAA yapisi, adlandirma, hata raporu sablonu.
---

# Test Stratejisi

## Ne test edilir (öncelik sırasıyla)
1. Para/veri kaybettiren yollar (kayıt, silme, ödeme, yetki)
2. Karmaşık saf mantık (hesaplama, ayrıştırma, durum makinesi)
3. Sözleşmeler (API girdi/çıktı şekilleri)
4. Regresyonlar (düzeltilen her hata bir test bırakır)

## Ne test edilmez
- Framework'ün kendisi, basit getter/setter, üçüncü parti kütüphane davranışı.

## Test yapısı: AAA
```
Arrange  // durumu kur
Act      // TEK eylem
Assert   // sonucu doğrula (1-3 anlamlı assertion)
```

## Adlandırma
`<fonksiyon> _ <koşul> _ <beklenen>` — ör. `dispatch_bilinmeyenAjan_hataFirlatir`.

## Hata raporu şablonu
- Başlık: tek cümle, belirti değil davranış ("X girilince Y kayboluyor")
- Adımlar: 1-2-3, en küçük yeniden üretme
- Beklenen / Gerçekleşen
- Ortam + dosya:satır (biliniyorsa)
