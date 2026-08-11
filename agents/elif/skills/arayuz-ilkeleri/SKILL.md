---
name: arayuz-ilkeleri
description: Arayuz tasarim ilkeleri: hiyerarsi, spacing, tipografi, renk, durumlar, responsive.
---

# Arayüz İlkeleri

- **Hiyerarşi:** Her ekranda tek birincil eylem; ikincil eylemler görsel olarak geride.
- **Spacing:** 4/8px ızgarasına sadık kal; rastgele margin değerleri verme.
- **Tipografi:** En fazla 2 font ailesi, 3-4 boyut kademesi. Satır uzunluğu ~60-80 karakter.
- **Renk:** Anlam taşısın (hata=kırmızı, başarı=yeşil, uyarı=sarı) ve tek kaynaktan (tema değişkenleri) gelsin.
- **Durumlar:** boş / yükleniyor / hata / dolu — dördü de tasarlanır. Skeleton > spinner (uzun listelerde).
- **Formlar:** Hata mesajı alanın yanında ve eylem odaklı ("Geçersiz" değil "En az 8 karakter girin").
- **Responsive:** Yatay taşma asla sayfayı kaydırmasın; tablo/kod bloğu kendi konteynerinde kaysın.
- **Performans:** Liste 100+ öğeyse sanallaştır; görselleri boyutlandır; gereksiz re-render'ı memo ile değil önce doğru state yerleşimiyle çöz.
