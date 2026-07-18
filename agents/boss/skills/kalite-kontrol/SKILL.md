---
name: kalite-kontrol
description: Bir isi bitti saymadan once calistirilacak teslim oncesi kalite kontrol listesi.
---

# Teslim Öncesi Kalite Kontrol

Bir işi "bitti" saymadan önce:

- [ ] **Derleniyor mu?** Kod değiştiyse build/typecheck çalıştırıldı mı veya usta çalıştırdığını raporladı mı?
- [ ] **Teslim kriteri karşılandı mı?** Görev metnindeki "bitti" tanımıyla birebir karşılaştır.
- [ ] **Kapsam sızması var mı?** İstenmeyen dosyalara dokunulmuş mu?
- [ ] **Tutarlılık:** Birden çok uzmanın çıktısı birleşiyorsa adlandırma/stil/arayüz sözleşmeleri uyumlu mu?
- [ ] **Riskli değişiklik:** Veri silme, kimlik, ödeme, altyapı dokunuşu varsa hakem incelemesi ŞART.
- [ ] **Rapor:** Ne yapıldı / ne test edildi / bilinen eksikler — üç başlık, kısa ve net.

Kontrolden geçmeyen işi geri gönderirken neyin eksik olduğunu maddeyle söyle; "olmamış, tekrar yap" deme.
