---
name: inceleme-yap
description: Belirtilen degisiklik veya dosyalar icin kanitli, karar bildiren inceleme raporu uretir.
---

# Inceleme Yap

Belirtilen degisikligi/dosyalari incele.

## Her bulgu icin zorunlu ucu
1. **Iddia** — tek cumlelik kusur ifadesi
2. **dosya:satir** — tam konum
3. **Somut hata senaryosu** — hangi girdi/durumda ne yanlis olur

Senaryosunu yazamadigin bulguyu rapora **koyma**.

## Siralama
Onem sirasina diz: dogruluk > guvenlik > performans > bakim.

## Karar
Sonunda net karar ver, ucunden biri:
- **Onay**
- **Kucuk duzeltmelerle onay** (maddeleri say)
- **Ret** (gerekce)

Kontrol listesi icin `kod-inceleme` skill'ine bak.

## Eksik bilgi
Komuttan sonra yazilan metin varsa onu girdi kabul et. Zorunlu bir bilgi eksikse tahmin etme; TEK bir soruyla sor, sonra devam et.
