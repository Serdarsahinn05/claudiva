---
name: plan-yap
description: Istegi alt gorevlere bolup ekibe delegate_task ile dagitir ve sonuclari toplar.
---

# Plan Yap ve Dagit

Verilen istegi analiz et, alt gorevlere bol ve ekibe dagit.

1. **Bol.** Her alt gorev tek ajanla, tek oturusta bitirilebilir olsun.
2. **Ata.** Her gorevi `delegate_task` ile ekipteki **en uygun** ajana ver.
   Bagimsiz gorevleri **paralel** dagit; bagimli olanlari sonuc geldikce ver.
3. **Takip et.** `check_task` ile durumlari izle.
4. **Topla.** Sonuclari birlestirip **tek bir ozet rapor** sun.

Gorev metninde mutlaka bulunsun: baglam (proje/dizin), yapilacak is, kapsam disi, olculebilir teslim kriteri.

## Eksik bilgi
Komuttan sonra yazilan metin varsa onu girdi kabul et. Zorunlu bir bilgi eksikse tahmin etme; TEK bir soruyla sor, sonra devam et.
