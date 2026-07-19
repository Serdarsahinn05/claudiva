/**
 * Açılış perdesini (index.html'deki #boot) yönetir.
 *
 * Perde iki koşulun İKİSİNİ birden bekler: veri hazır olacak VE en az
 * `MIN_VISIBLE_MS` geçmiş olacak.
 *
 * Alt sınır neden var: yalnızca veriye bağlıyken sunucu yerelde hızlı cevap
 * verdiği için logo ~190ms parlayıp kayboluyordu — ölçüldü, göz zar zor
 * seçiyordu. Açılış animasyonunun görülmesi istendiği için alt sınır kondu.
 * Süre tarama çubuğunun döngüsüyle (1.1sn) eşleşiyor: perde, çubuk turunu
 * yarıda kesmeden kalkıyor.
 */

const FADE_MS = 260;
/** Perdenin ekranda kalacağı en az süre (sayfa yüklenmeye başladığından beri). */
const MIN_VISIBLE_MS = 1100;

let dismissed = false;

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
  if (dismissed) return; // etki iki kez koşabilir (StrictMode); perde bir kez kalkar
  dismissed = true;
  // performance.now() sayfanın yüklenmeye başladığı andan beri geçen süre —
  // kullanıcının "ne kadar bekledim" algısıyla aynı başlangıç noktası.
  const kalan = Math.max(0, MIN_VISIBLE_MS - performance.now());
  window.setTimeout(hide, kalan);
}

function hide(): void {
  for (const t of timers) window.clearTimeout(t);
  timers = [];
  const el = document.getElementById('boot');
  if (!el) return;
  el.classList.add('boot-out');
  // Geçiş bitince DOM'dan çıkar. transitionend tek başına yeterli değil:
  // sekme arka plandayken tetiklenmeyebilir ve perde ekranda asılı kalırdı.
  window.setTimeout(() => el.remove(), FADE_MS + 60);
}
