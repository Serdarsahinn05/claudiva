/**
 * Açılış perdesini (index.html'deki #boot) yönetir.
 *
 * Perde SÜREYE göre değil VERİYE göre kalkar: sunucu 60ms'de cevap verirse
 * 60ms'de kalkar. Sabit süreli bir açılış ekranı her sayfa yenilemesinde
 * kullanıcıdan vergi almak olurdu — panel geliştirirken sayfa çok yenileniyor.
 */

const FADE_MS = 260;
/** Bu süreden uzun sürerse bekleyişin sebebini söyle (boş boş bekletme). */
const SLOW_MS = 2500;

let slowTimer: number | undefined;

/** Sunucu geç kalıyorsa durum metnini güncelle — sessiz bekleyiş kaygı verir. */
export function watchSlowBoot(): void {
  slowTimer = window.setTimeout(() => {
    const el = document.getElementById('boot-status');
    if (el) el.textContent = 'sunucu yanıt vermiyor — yeniden deneniyor';
  }, SLOW_MS);
}

export function dismissBoot(): void {
  window.clearTimeout(slowTimer);
  const el = document.getElementById('boot');
  if (!el) return;
  el.classList.add('boot-out');
  // Geçiş bitince DOM'dan çıkar. transitionend tek başına yeterli değil:
  // sekme arka plandayken tetiklenmeyebilir ve perde ekranda asılı kalırdı.
  window.setTimeout(() => el.remove(), FADE_MS + 60);
}
