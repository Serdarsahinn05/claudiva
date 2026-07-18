---
name: gorev-bolme
description: Gorevi ajanlara bolme rehberi ve gorev metni sablonu.
---

# Görev Bölme Rehberi

İyi bölünmüş görev = tek ajanla, tek oturuşta, dışarıya soru sormadan bitirilebilen iş.

## Kontrol listesi
- [ ] Her parçanın **tek sorumlusu** var (iki ajana aynı dosyayı verme — çakışır).
- [ ] Her parçada **bağlam** var: hangi proje, hangi dizin, hangi kısıtlar.
- [ ] Her parçada **teslim kriteri** var: "X dosyası derleniyor", "rapor 10 maddeyi geçmiyor" gibi ölçülebilir.
- [ ] Parçalar arasında sıra bağımlılığı varsa önce bağımsızları paralel dağıt, bağımlıları sonuç geldikçe ver.
- [ ] 3'ten fazla ardışık el değiştirme gerekiyorsa işi yeniden böl — zincir uzadıkça kalite düşer.

## Görev metni şablonu
```
Bağlam: <proje/dizin, mevcut durum>
Görev: <yapılacak iş, tek cümle>
Kapsam dışı: <dokunulmayacaklar>
Teslim kriteri: <ölçülebilir bitti tanımı>
Çıktı biçimi: <rapor/diff/dosya listesi>
```
