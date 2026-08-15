/**
 * Sunucu tarafında sürülen tarayıcı — Browser panelinin ve ajanların ortak
 * yüzeyi.
 *
 * İKİ AKTÖR, İKİ AYRI İZİN REJİMİ ve bu ayrım bilinçli:
 *
 *  · **Kullanıcı** panelden sürdüğünde izin SORULMAZ. Tıklayan zaten o; her
 *    tıklama için onay istemek kendi eylemini kendine onaylatmaktır.
 *  · **Ajan** MCP araçlarıyla sürdüğünde mevcut `canUseTool` kapısı kendiliğinden
 *    devrededir (bütün MCP araçları oradan geçiyor) — panelde izin bandı çıkar,
 *    kullanıcı verir ya da reddeder. Ayrı bir kapı YAZILMADI: ikinci bir kapı
 *    ilkiyle ayrışır ve biri sessizce delinirdi.
 *
 * Playwright TEMBEL yüklenir. Paket ya da indirilmiş tarayıcı yoksa sunucu
 * ayakta kalır ve yalnızca bu panel "kurulu değil" der — Browser'ı hiç
 * kullanmayan bir kurulumda 300MB'lık bir tarayıcı zorunluluk olmamalı.
 */
import type { Browser, Page } from 'playwright-core';

/** Sabit görüntü alanı; panel tıklama koordinatını buna göre ölçekler. */
export const VIEWPORT = { width: 1280, height: 800 };

/** Sayfa yüklenmesi için üst sınır — kırık bir site paneli kilitlemesin. */
const NAV_TIMEOUT = 25_000;

export interface BrowserState {
  running: boolean;
  url: string;
  title: string;
  /** Playwright ya da indirilmiş tarayıcı yoksa dolu gelir. */
  unavailable?: string;
  viewport: { width: number; height: number };
}

/**
 * Yalnızca `http`/`https`. `file://` yerel diski, `chrome://` tarayıcı iç
 * sayfalarını açardı; ikisi de bu panelin işi değil ve ajan eliyle
 * sürüldüğünde dosya sızdırma yoluna dönerdi.
 */
function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) throw new Error('Adres gerekli.');
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    throw new Error('Adres çözümlenemedi.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Yalnızca http ve https adresleri açılabilir.');
  }
  return u.toString();
}

export class BrowserSession {
  private browser: Browser | null = null;
  private page: Page | null = null;
  /** Kurulum eksikse sebebi; her istekte yeniden denememek için saklanır. */
  private unavailable: string | null = null;

  async state(): Promise<BrowserState> {
    const base = { viewport: VIEWPORT };
    if (this.unavailable) return { ...base, running: false, url: '', title: '', unavailable: this.unavailable };
    if (!this.page) return { ...base, running: false, url: '', title: '' };
    try {
      return { ...base, running: true, url: this.page.url(), title: await this.page.title() };
    } catch {
      // Sayfa kapanmış olabilir; durumu sıfırla ki panel yeniden açabilsin.
      await this.close();
      return { ...base, running: false, url: '', title: '' };
    }
  }

  /** Açık sayfayı döndürür, yoksa tarayıcıyı başlatır. */
  private async ensure(): Promise<Page> {
    if (this.page) return this.page;
    if (this.unavailable) throw new Error(this.unavailable);

    let chromium;
    try {
      ({ chromium } = await import('playwright-core'));
    } catch {
      this.unavailable = 'Playwright kurulu değil (npm i -w server playwright-core).';
      throw new Error(this.unavailable);
    }

    try {
      this.browser = await chromium.launch({ headless: true });
    } catch (e) {
      // En sık sebep: paket var ama tarayıcı indirilmemiş.
      this.unavailable =
        `Chromium başlatılamadı — indirilmemiş olabilir: npx playwright-core install chromium. ` +
        `(${(e as Error).message.split('\n')[0]})`;
      throw new Error(this.unavailable);
    }

    const ctx = await this.browser.newContext({ viewport: VIEWPORT });
    this.page = await ctx.newPage();
    this.page.setDefaultTimeout(NAV_TIMEOUT);
    return this.page;
  }

  async navigate(rawUrl: string): Promise<BrowserState> {
    const url = normalizeUrl(rawUrl);
    const page = await this.ensure();
    // `domcontentloaded`: `load` üçüncü taraf isteklerini de bekliyor ve reklam
    // taşıyan sayfalarda zaman aşımına düşüyordu — sayfa çoktan okunur hâldeyken.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    return await this.state();
  }

  async back(): Promise<BrowserState> {
    const page = await this.ensure();
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => null);
    return await this.state();
  }

  async reload(): Promise<BrowserState> {
    const page = await this.ensure();
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
    return await this.state();
  }

  async click(x: number, y: number): Promise<BrowserState> {
    const page = await this.ensure();
    const before = page.url();
    await page.mouse.click(x, y);
    await this.settle(page, before);
    return await this.state();
  }

  /**
   * Tıklama/tuş sonrası sayfanın yerleşmesini bekler.
   *
   * ÜÇ YAKLAŞIM ÖLÇÜLDÜ, İLK İKİSİ BAŞARISIZ:
   *  1. Sabit bekleme (400ms): durum geçiş anında okunuyordu — panel başlığı
   *     Chromium'un ara başlığını ("Loading https://…"), adresi HÂLÂ ESKİ
   *     sayfayı gösteriyordu.
   *  2. `waitForLoadState('domcontentloaded')`: gezinme yeni belgeye henüz
   *     COMMIT edilmediği için ESKİ belgenin durumu sorulur, o da çoktan
   *     yüklüdür ve çağrı anında döner — hiçbir şey beklenmez.
   *     `framenavigated` de çare değil: o olay commit'ten SONRA çıkıyor,
   *     yavaş bir sunucuda 450ms'lik pencereye hiç yetişmiyor.
   *  3. **`waitForURL`** — çalışan yol. Gezinme isteğinin gönderildiğini
   *     `request` olayından (commit'ten ÖNCE tetiklenir) anlar, sonra adresin
   *     gerçekten değişmesini ve yeni belgenin yerleşmesini bekler.
   *
   * Gezinme başlamadıysa yalnızca kısa pencere kadar durulur; her tıklamaya
   * sabit bir saniye yüklemek panelin dokunma hissini öldürürdü.
   */
  private async settle(page: Page, before: string): Promise<void> {
    let navRequested = false;
    const onReq = (req: { isNavigationRequest(): boolean; frame(): unknown }) => {
      if (req.isNavigationRequest() && req.frame() === page.mainFrame()) navRequested = true;
    };
    page.on('request', onReq);
    await page.waitForTimeout(400);
    page.off('request', onReq);

    if (!navRequested) return;
    await page
      .waitForURL((u) => u.toString() !== before, { timeout: 10_000, waitUntil: 'domcontentloaded' })
      .catch(() => null);
    // Başlık gezinmeden hemen sonra hâlâ ara değeri taşıyabiliyor.
    await page.waitForTimeout(150);
  }

  async type(text: string, submit = false): Promise<BrowserState> {
    const page = await this.ensure();
    const before = page.url();
    await page.keyboard.type(text, { delay: 12 });
    if (submit) {
      await page.keyboard.press('Enter');
      await this.settle(page, before);
    }
    return await this.state();
  }

  async scroll(dy: number): Promise<BrowserState> {
    const page = await this.ensure();
    await page.mouse.wheel(0, dy);
    await page.waitForTimeout(150);
    return await this.state();
  }

  async screenshot(): Promise<Buffer> {
    const page = await this.ensure();
    return await page.screenshot({ type: 'png' });
  }

  /**
   * Sayfanın okunabilir metni — ajan için. Ekran görüntüsü insana, metin
   * modele: bir sayfayı "okumak" için görüntü yollamak hem pahalı hem de
   * gereksiz, metin zaten sayfada duruyor.
   */
  async readText(limit = 12_000): Promise<{ url: string; title: string; text: string }> {
    const page = await this.ensure();
    const text = await page.evaluate(() => document.body?.innerText ?? '');
    const clean = text.replace(/\n{3,}/g, '\n\n').trim();
    return {
      url: page.url(),
      title: await page.title(),
      text: clean.length > limit ? `${clean.slice(0, limit)}\n… (kırpıldı)` : clean,
    };
  }

  /** Sayfadaki bağlantılar — ajanın gezinmek için ihtiyaç duyduğu tek şey. */
  async links(limit = 60): Promise<{ text: string; href: string }[]> {
    const page = await this.ensure();
    return await page.evaluate((max) => {
      const out: { text: string; href: string }[] = [];
      for (const a of Array.from(document.querySelectorAll('a[href]')).slice(0, max)) {
        const href = (a as HTMLAnchorElement).href;
        const text = (a.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
        if (href.startsWith('http') && text) out.push({ text, href });
      }
      return out;
    }, limit);
  }

  async close(): Promise<void> {
    const b = this.browser;
    this.page = null;
    this.browser = null;
    await b?.close().catch(() => null);
  }
}
