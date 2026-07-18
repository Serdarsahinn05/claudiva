---
name: hata-avi
description: Bir hatayi yeniden uretip kok nedeni bulur ve duzeltir; belirti yamalamaz.
---

# Hata Avi

Bir hatayi **kok neden odakli** coz. Belirtiyi yamalamak yasak.

1. **Yeniden uret.** Hatayi tetikleyen en kucuk adimi bul. Uretemiyorsan kosullari raporla, tahminle yama yapma.
2. **Daralt.** Girdi mi, durum mu, ortam mi? Ikiye bolerek ara.
3. **Kok neden.** Belirtiden koke inen neden zincirini kur.
4. **Duzelt.** Sadece kok nedeni; kapsam disina tasma.
5. **Dogrula.** Ayni adimlarla hatanin kayboldugunu VE yan etki cikmadigini goster.

Raporunda uc basligi ayri ayri yaz: **kok neden**, **duzeltme**, **nasil dogruladigin**.
Ayni hatanin tekrarlayabilecegi baska yerleri de not et.

Detayli yontem icin `hata-ayiklama` skill'ine bak.

## Eksik bilgi
Komuttan sonra yazilan metin varsa onu girdi kabul et. Zorunlu bir bilgi eksikse tahmin etme; TEK bir soruyla sor, sonra devam et.
