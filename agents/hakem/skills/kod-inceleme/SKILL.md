---
name: kod-inceleme
description: Kod inceleme kontrol listesi: dogruluk, guvenlik, performans, bakim.
---

# Kod İnceleme Kontrol Listesi

## Doğruluk
- [ ] Sınır koşulları: boş dizi, null/undefined, 0, negatif, çok büyük girdi.
- [ ] Hata yolları: throw/reject yakalanıyor mu, kaynaklar (dosya, bağlantı, timer) kapanıyor mu?
- [ ] Eşzamanlılık: paylaşılan durum, yarış koşulu, await unutulmuş promise.
- [ ] Değişiklik, çağıran TÜM yerlerle uyumlu mu (imza/sözleşme değiştiyse)?

## Güvenlik
- [ ] Kullanıcı girdisi doğrulanıyor mu (injection, path traversal, XSS)?
- [ ] Gizli bilgi (anahtar, şifre) kodda/logda mı?
- [ ] Yetki kontrolü doğru katmanda mı?

## Performans
- [ ] Döngü içinde IO/sorgu var mı? N+1?
- [ ] Büyüyebilen veri yapısı sınırsız mı (bellek sızıntısı)?

## Bakım
- [ ] Adlandırma yanıltıcı mı? Ölü kod kaldı mı?
- [ ] Test: kritik yol testsiz mi kalmış?
