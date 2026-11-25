import { locale } from './i18n';
import type { SkillInfo } from './types';

/**
 * Paket skill'lerinin panelde görünen adı ve açıklaması, arayüz diline göre.
 *
 * Skill dosyası (`SKILL.md`) İngilizce kalır: açıklamayı okuyan MODEL, skill'i
 * ne zaman kullanacağına onunla karar veriyor (2026-11-24). Dizin adı da
 * İngilizce (2026-11-25, `server/src/skillRenames.ts`); slash komutu odur.
 * Kullanıcı ise panelde okunur bir ad ve kendi dilinde açıklama görür.
 *
 * Kural (`agentI18n.ts` ile aynı ruh): çeviri yalnız skill'in açıklaması
 * paketteki İngilizce metne HÂLÂ EŞİTSE uygulanır. Kullanıcı açıklamayı
 * değiştirdiyse kendi metni görünür; adı da dizin adı olarak kalır.
 * `SKILL.md` açıklaması değişirse buradaki `en` de güncellenmeli, yoksa
 * çeviri sessizce devre dışı kalır (yanlış metin göstermektense ham metin).
 */
interface Entry {
  en: [title: string, desc: string];
  tr: [title: string, desc: string];
}

const SKILLS: Record<string, Entry> = {
  'status-summary': {
    en: ['Status summary', 'Gives a short status summary of the current work - what is done, what is left, any blockers.'],
    tr: ['Durum özeti', 'Süren işin kısa özeti: ne bitti, ne kaldı, engel var mı.'],
  },
  'save-memory': {
    en: ['Save to memory', 'Saves lasting knowledge learned in this session to the memory folder as markdown.'],
    tr: ['Hafızaya yaz', 'Bu oturumda öğrenilen kalıcı bilgiyi hafıza klasörüne markdown olarak kaydeder.'],
  },
  'second-opinion': {
    en: ['Second opinion', 'Gives a critical, non-defensive second opinion on an approach or solution.'],
    tr: ['İkinci görüş', 'Bir yaklaşım ya da çözüm için eleştirel, savunmacı olmayan ikinci görüş verir.'],
  },
  'split-tasks': {
    en: ['Split tasks', 'Guide for splitting work across agents, with a task-brief template.'],
    tr: ['Görev bölme', 'İşi ajanlara bölmek için rehber ve görev tarifi şablonu.'],
  },
  'run-project': {
    en: ['Run a project', 'Runs any piece of work end to end with the team - analysis, splitting, delegation, synthesis.'],
    tr: ['İşi başlat', 'Bir işi ekiple baştan sona yürütür: analiz, bölme, devir, birleştirme.'],
  },
  'new-feature': {
    en: ['New feature', 'Plans a new feature request and has the team implement it.'],
    tr: ['Yeni özellik', 'Yeni bir özellik isteğini planlar ve ekibe uygulatır.'],
  },
  'plan-work': {
    en: ['Plan the work', 'Splits a request into subtasks, hands them to the team with delegate_task and gathers the results.'],
    tr: ['Plan yap', 'İsteği alt görevlere böler, delegate_task ile ekibe verir ve sonuçları toplar.'],
  },
  'quality-gate': {
    en: ['Quality gate', 'Pre-delivery quality checklist to run before counting any work as done.'],
    tr: ['Kalite kontrol', 'Bir işi bitti saymadan önce çalıştırılan teslim öncesi kontrol listesi.'],
  },
  'commit-pr': {
    en: ['Commit and PR', 'Produces a commit message and PR description for the current changes.'],
    tr: ['Commit ve PR', 'Mevcut değişiklikler için commit mesajı ve PR açıklaması yazar.'],
  },
  'docs-style': {
    en: ['Docs style', 'Writing style rules for READMEs, release notes and documentation in general.'],
    tr: ['Doküman stili', 'README, sürüm notu ve genel dokümantasyon için yazım kuralları.'],
  },
  'docs-update': {
    en: ['Update docs', 'Updates a document by verifying it against the code; never writes unverified behavior.'],
    tr: ['Doküman güncelle', 'Belgeyi koda karşı doğrulayarak günceller; doğrulanmamış davranış yazmaz.'],
  },
  'ui-component': {
    en: ['UI component', 'Builds a new UI component/screen, handling all four states (empty/loading/error/filled).'],
    tr: ['Arayüz bileşeni', 'Yeni bir bileşen ya da ekran kurar; dört durumu da ele alır (boş, yükleniyor, hata, dolu).'],
  },
  'ui-principles': {
    en: ['UI principles', 'UI design principles - hierarchy, spacing, typography, color, states, responsive.'],
    tr: ['Arayüz ilkeleri', 'Arayüz tasarım ilkeleri: hiyerarşi, boşluk, tipografi, renk, durumlar, duyarlılık.'],
  },
  'research-method': {
    en: ['Research method', 'Research method: defining criteria, source priority, cross-checking, report template.'],
    tr: ['Araştırma yöntemi', 'Araştırma yöntemi: ölçüt belirleme, kaynak önceliği, çapraz kontrol, rapor şablonu.'],
  },
  'research-topic': {
    en: ['Research a topic', 'Researches a topic comparatively and delivers a sourced, decision-focused report.'],
    tr: ['Araştır', 'Bir konuyu karşılaştırmalı araştırır; kaynaklı, karara dönük bir rapor verir.'],
  },
  'review-checklist': {
    en: ['Review checklist', 'Code review checklist: correctness, security, performance, maintainability.'],
    tr: ['Kod inceleme listesi', 'Kod inceleme kontrol listesi: doğruluk, güvenlik, performans, bakım.'],
  },
  'review-report': {
    en: ['Review report', 'Produces an evidence-backed review report with a verdict for the given change or files.'],
    tr: ['İnceleme raporu', 'Verilen değişiklik ya da dosyalar için kanıtlı, hükümlü bir inceleme raporu yazar.'],
  },
  'bug-hunt': {
    en: ['Bug hunt', 'Reproduces a bug, finds the root cause and fixes it; never patches the symptom.'],
    tr: ['Hata avı', 'Hatayı yeniden üretir, kök nedeni bulup düzeltir; belirtiyi yamamaz.'],
  },
  'clean-code': {
    en: ['Clean code', 'Clean code guide - naming, function size, error handling, type safety.'],
    tr: ['Temiz kod', 'Temiz kod rehberi: adlandırma, fonksiyon boyu, hata yönetimi, tip güvenliği.'],
  },
  'debug-method': {
    en: ['Debugging method', 'Debugging method - reproduce, narrow down, root cause, verify, report.'],
    tr: ['Hata ayıklama', 'Hata ayıklama yöntemi: yeniden üret, daralt, kök neden, doğrula, raporla.'],
  },
  refactor: {
    en: ['Refactor', 'Improves code for readability and duplication without changing behavior.'],
    tr: ['Yeniden düzenle', 'Davranışı değiştirmeden kodun okunurluğunu iyileştirir, tekrarı azaltır.'],
  },
  'test-strategy': {
    en: ['Test strategy', 'Test strategy: what to test, AAA structure, naming, bug report template.'],
    tr: ['Test stratejisi', 'Test stratejisi: neyi test etmeli, AAA yapısı, adlandırma, hata raporu şablonu.'],
  },
  'write-tests': {
    en: ['Write tests', 'Writes a behavior-focused test suite for a module, runs it and reports.'],
    tr: ['Test yaz', 'Bir modül için davranış odaklı test takımı yazar, çalıştırır ve raporlar.'],
  },
};

/** Paket skill'iyse ve açıklaması değiştirilmemişse arayüz dilindeki ad + açıklama. */
export function skillText(s: Pick<SkillInfo, 'name' | 'description'>): { title: string; desc: string; packaged: boolean } {
  const e = SKILLS[s.name];
  if (!e || s.description.trim() !== e.en[1]) return { title: s.name, desc: s.description, packaged: false };
  const [title, desc] = e[locale === 'tr' ? 'tr' : 'en'];
  return { title, desc, packaged: true };
}
