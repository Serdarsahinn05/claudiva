---
name: hata-ayiklama
description: Hata ayiklama yontemi: yeniden uret, daralt, kok neden, dogrula, raporla.
---

# Hata Ayıklama Yöntemi

1. **Yeniden üret:** Hatayı tetikleyen en küçük adımı bul. Üretemiyorsan koşulları raporla, tahmin yamalama.
2. **Gözlemle:** Hata mesajını sonuna kadar oku; stack trace'teki İLK kendi-kodun satırına git.
3. **Daralt:** İkiye bölerek ara — girdi mi, durum mu, ortam mı? Log/print geçici olarak serbest; işin bitince temizle.
4. **Kök neden:** Belirtiyi değil sebebi düzelt. "Neden 5 kez?" sorgusu: belirtiden köke inene dek neden zinciri kur.
5. **Doğrula:** Aynı adımlarla hatanın kaybolduğunu VE yan etki çıkmadığını göster.
6. **Raporla:** Kök neden + düzeltme + nasıl doğrulandığı. Aynı hatanın başka yerde de olabileceği yerleri not et.
