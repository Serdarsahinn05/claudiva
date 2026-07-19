/**
 * Açılış perdesini (index.html'deki #boot) yönetir.
 *
 * Perde SÜREYE göre değil VERİYE göre kalkar: sunucu 60ms'de cevap verirse
 * 60ms'de kalkar. Sabit süreli bir açılış ekranı her sayfa yenilemesinde
 * kullanıcıdan vergi almak olurdu — panel geliştirirken sayfa çok yenileniyor.
 */

const FADE_MS = 260;

/**
 * Bekleyiş mesajları kademeli.
 *
 * Tek eşikli ve sert bir "sunucu yanıt vermiyor" yanlıştı: bu projede birkaç
 * saniyelik kesinti RUTİN — kod düzenlemek `tsx --watch`i yeniden başlatıyor ve
 * `npm run dev`de vite sunucudan önce hazır oluyor. İkisi de arıza değil, ama
 * panel arıza varmış gibi konuşuyordu. Önce sakin bekleme, ancak gerçekten
 * uzun sürünse teşhis.
 */
const STAGES: { at: number; text: string }[] = [
  { at: 4000, text: 'sunucu bekleniyor — yeniden deneniyor' },
  { at: 12000, text: 'sunucu yanıt vermiyor · `npm run dev` ile başlattığından emin ol' },
];

let timers: number[] = [];

export function watchSlowBoot(): void {
  timers = STAGES.map((s) =>
    window.setTimeout(() => {
      const el = document.getElementById('boot-status');
      if (el) el.textContent = s.text;
    }, s.at),
  );
}

export function dismissBoot(): void {
  for (const t of timers) window.clearTimeout(t);
  timers = [];
  const el = document.getElementById('boot');
  if (!el) return;
  el.classList.add('boot-out');
  // Geçiş bitince DOM'dan çıkar. transitionend tek başına yeterli değil:
  // sekme arka plandayken tetiklenmeyebilir ve perde ekranda asılı kalırdı.
  window.setTimeout(() => el.remove(), FADE_MS + 60);
}
