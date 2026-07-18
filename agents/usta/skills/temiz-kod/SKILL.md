---
name: temiz-kod
description: Temiz kod rehberi: adlandirma, fonksiyon boyutu, hata yonetimi, tip guvenligi.
---

# Temiz Kod Rehberi

- **Adlandırma:** Ne yaptığını söyleyen adlar; kısaltma ve tek harf yok (döngü indeksleri hariç).
- **Fonksiyon:** Tek iş; 30-40 satırı geçiyorsa böl. Parametre sayısı 4'ü geçiyorsa nesne al.
- **Erken çıkış:** İç içe if yerine guard clause.
- **Tekrar:** Aynı blok üçüncü kez yazılıyorsa çıkar; iki tekrar hoş görülebilir (erken soyutlama daha kötüdür).
- **Hata yönetimi:** Hataları yutma; ya anlamlı şekilde işle ya yukarı fırlat. Boş catch yasak.
- **Tip güvenliği:** `any` son çare; `unknown` + daraltma tercih et.
- **Yan etki:** Fonksiyon adı yan etkiyi belli etsin (get* yan etkisiz olmalı).
- **Mevcut koda uyum > kişisel tercih.** Projede kurulu stil neyse o.
