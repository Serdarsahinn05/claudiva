/**
 * `prismjs/components/*` için modül bildirimi.
 *
 * `@types/prismjs` yalnızca paketin ANA girişini (`prismjs`) tipliyor; dil
 * dosyaları alt yollardan geliyor ve tipsiz. Ana girişi kullanmıyoruz çünkü o
 * varsayılan dil setini de beraberinde çekiyor — tembel yükleme ve dil
 * seçimi `highlight.ts`'in kendi işi.
 *
 * Bildirim BOŞ olmak zorunda değil ama olmalı: bu modüller yan etkiden
 * ibarettir (kendilerini global `Prism`e kaydederler), dışa bir şey
 * vermezler. `highlight.ts` Prism'in yüzeyini kendi `PrismLike` arayüzüyle
 * daraltıyor, yani tip güvenliği burada değil orada.
 */
declare module 'prismjs/components/prism-core.js' {
  const Prism: unknown;
  export default Prism;
}

declare module 'prismjs/components/*';
