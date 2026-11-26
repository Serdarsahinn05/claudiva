// Claudiva tanıtım sitesi: dil, sekmeler, kopyala.
//
// İngilizce metin HTML'nin kendisidir (arama motorları ve JS'siz okur için).
// Türkçe burada; ilk yüklemede İngilizce metinler bellekte saklanır, dil
// değişince ikisi arasında geçilir. Anahtar `data-i18n` (metin),
// `data-i18n-alt` (görsel açıklaması), `data-i18n-label` (aria-label).

const TR = {
  skip: 'İçeriğe geç',
  'nav.how': 'Nasıl çalışır',
  'nav.modes': 'Modlar',
  'nav.features': 'Özellikler',
  'nav.install': 'Kurulum',
  'hero.eyebrow': 'Claude Code için · açık kaynak · MIT',
  'hero.title': 'Bütün bir Claude ajan ekibi, tek panelde.',
  'hero.lead':
    'İki terminalde açılan iki <code>claude</code> oturumu birbirini göremez, birbirine iş veremez, ne harcadıklarını da bilemezsin. Claudiva hepsini tek ekrana koyar: lider işi böler, ajanlar projende paralel çalışır, sen kimin ne yaptığını, hangi dosyalara dokunduğunu ve neye mal olduğunu görürsün.',
  'hero.download': 'Windows için indir',
  'hero.req': 'Node.js 20+ ve oturum açılmış Claude Code gerekir. Aboneliğini kullanır, API anahtarı istemez.',
  'how.title': 'Nasıl çalışır',
  'how.s1.t': 'Ekibe yaz',
  'how.s1.p': 'İstediğini bir kez yaz. İlk açılışta sekiz kişilik bir ekip kurulur; istediğin zaman kendi ajanlarını eklersin.',
  'how.s2.t': 'Lider böler',
  'how.s2.p': 'Bağımsız parçalar aynı anda dağıtılır; iş, parçaların toplamı kadar değil en uzun parçası kadar sürer.',
  'how.s3.t': 'Kontrol sende',
  'how.s3.p': 'Araç izinlerini paneldeki banttan onaylarsın ya da güvendiğin ajanlara oto-onay verirsin. İstersen önce planı görürsün.',
  'how.s4.t': 'Güvenme, bak',
  'how.s4.p': 'Her teslimde ajanın gerçekten yazdığı dosyalar görünür; söylenen değil ölçülen. Ve işin neye mal olduğu.',
  'modes.title': 'Üç çalışma biçimi',
  'modes.sub': 'Aynı ekip, aynı veri, üç görünüm. Ctrl+K ile istediğin an geç.',
  'modes.panels': 'Paneller',
  'modes.chat': 'Sohbet',
  'modes.board': 'Pano',
  'modes.panels.p': 'Terminaller, görev panosu, kod ve harcama yan yana. Panelleri üç yuva arasında sürükle; açık her ajan kendi terminal gözünü alır.',
  'modes.chat.p': 'Ekip bir grup sohbeti gibi. Ajanlar birbirine iş devreder, sen @ajan ile araya girersin; her teslim kartı gerçekte kaç dosya yazıldığını gösterir.',
  'modes.board.p': 'Kendi dizdiğin widget panosu: ekibe iş ver, delegasyon ağını, bütçe kadranını ve kimin ne zaman çalıştığını gösteren ısı haritasını izle.',
  'feat.title': 'Panelde neler var',
  'feat.deleg.t': 'Paralel delegasyon',
  'feat.deleg.p': 'Dört rol; yalnız liderler iş dağıtabilir. Görevler birlikte başlar, zincirlenebilir; bir adım düşerse zincir eksik girdiyle devam etmez, durur.',
  'feat.reports.t': 'Söylenenin yanında ölçülen',
  'feat.reports.p': 'Raporlar ajanın söylediğini dokunduğu dosyaların yanına koyar; devrettiği ajanların işi de dahil.',
  'feat.spend.t': 'Harcama ve bütçe',
  'feat.spend.p': 'Ajan, model ve zamana göre token ve maliyet. Günlük sınır koy, sınıra gelince ajanlar durur.',
  'feat.skills.t': "Skill'ler, ajanlar, MCP",
  'feat.skills.p': "Skill'leri aç kapat, kataloglardan, skills.sh'tan ya da GitHub linkinden kur; ajanları ve MCP sunucularını hazır şablonlardan başlat.",
  'feat.browser.t': 'Ortak tarayıcı',
  'feat.browser.p': 'Ajanlar gerçek bir Chromium sürer, sen aynı sayfayı izlersin. Her tarayıcı eylemi izin kapısından geçer.',
  'feat.local.t': 'Yerel ve senin',
  'feat.local.p': "Senin makinende, senin proje klasöründe, senin Claude aboneliğinle çalışır. Ajan verisi projenin .claudiva klasöründe kalır.",
  'styles.title': 'Dört stil, açık ve koyu',
  'styles.sub': 'Yalnız renk değil: her stilin kendi yazı tipi, biçimleri ve genel durum ekranı var. Arayüz Türkçe ve İngilizce.',
  'styles.glass': 'Cam',
  'styles.obs': 'Gözlemevi',
  'styles.studio': 'Stüdyo',
  'styles.phos': 'Fosfor',
  'inst.title': 'Başla',
  'inst.sub': 'Node.js 20+ ve claude login ile oturum açılmış Claude Code gerekir.',
  'inst.try': 'Dene',
  'inst.try.p': 'Proje klasöründe çalıştır. Panel tarayıcında açılır.',
  'inst.global': 'Her gün',
  'inst.global.p': 'Bir kez kur, sonra her projede claudiva yaz.',
  'inst.desktop': 'Masaüstü uygulaması',
  'inst.desktop.p': 'Windows kurulumu, yönetici izni istemez. Proje klasörünü seç, panel kendi penceresinde açılır. Henüz kod imzalı değil; SmartScreen sorarsa: Ek bilgi → Yine de çalıştır.',
  'inst.desktop.btn': "Releases'tan indir",
  'foot.license': 'MIT lisansı · Serdarsahinn05',
  'foot.releases': 'Sürümler',
  'foot.issues': 'Sorunlar',
  'foot.disclaimer': "Claudiva bağımsız bir projedir; Anthropic ile bağlantılı değildir ve Anthropic tarafından onaylanmamıştır. Claude ve Claude Code, Anthropic'in ticari markalarıdır.",
  'alt.panels': 'Paneller modunda Claudiva: genel durum, liderin terminali ve görev panosu',
  'alt.panelsDark': 'Cam stilinde Paneller modu, koyu',
  'alt.chat': 'Sohbet modu: ölçülmüş dosya sayılı teslim kartları ve yan panelde lider',
  'alt.board': 'Pano modu: delegasyon ağı, canlı akış ve etkinlik ısı haritası',
  copy: 'Kopyala',
  copied: 'Kopyalandı',
  title: 'Claudiva · Bütün bir Claude ajan ekibi, tek panelde',
};

const EN_EXTRA = { copy: 'Copy', copied: 'Copied', title: document.title };
const KEY = 'claudiva.site.lang';

// İngilizce özgün metinleri bir kez sakla.
const original = new Map();
for (const el of document.querySelectorAll('[data-i18n]')) original.set(el, el.innerHTML);
const originalAlt = new Map();
for (const el of document.querySelectorAll('[data-i18n-alt]')) originalAlt.set(el, el.alt);

function t(key, lang) {
  return lang === 'tr' ? TR[key] : EN_EXTRA[key];
}

function apply(lang) {
  document.documentElement.lang = lang;
  for (const [el, en] of original) {
    el.innerHTML = lang === 'tr' && TR[el.dataset.i18n] ? TR[el.dataset.i18n] : en;
  }
  for (const [el, en] of originalAlt) {
    el.alt = lang === 'tr' && TR[el.dataset.i18nAlt] ? TR[el.dataset.i18nAlt] : en;
  }
  for (const el of document.querySelectorAll('[data-i18n-label]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel, lang));
  }
  document.title = t('title', lang);
  const btn = document.getElementById('lang');
  // Düğme, GEÇİLECEK dili gösterir.
  btn.textContent = lang === 'tr' ? 'EN' : 'TR';
  btn.setAttribute('aria-label', lang === 'tr' ? 'English' : 'Türkçe');
}

apply(document.documentElement.lang === 'tr' ? 'tr' : 'en');

document.getElementById('lang').addEventListener('click', () => {
  const next = document.documentElement.lang === 'tr' ? 'en' : 'tr';
  try { localStorage.setItem(KEY, next); } catch {}
  apply(next);
});

// Sekmeler (WAI-ARIA tabs: ok tuşları, Home/End).
const tabs = [...document.querySelectorAll('[role="tab"]')];
function select(tab, focus) {
  for (const x of tabs) {
    const on = x === tab;
    x.setAttribute('aria-selected', String(on));
    x.tabIndex = on ? 0 : -1;
    document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
  }
  if (focus) tab.focus();
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => select(tab, false));
  tab.addEventListener('keydown', (e) => {
    const n = tabs.length;
    const to = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    select(tabs[to], true);
  });
});

// Kopyala.
for (const btn of document.querySelectorAll('[data-copy]')) {
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
    } catch {
      return;
    }
    const lang = document.documentElement.lang;
    btn.classList.add('done');
    btn.setAttribute('aria-label', t('copied', lang));
    setTimeout(() => {
      btn.classList.remove('done');
      btn.setAttribute('aria-label', t('copy', lang));
    }, 1600);
  });
}
