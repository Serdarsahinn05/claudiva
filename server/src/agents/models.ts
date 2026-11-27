/**
 * Ajan modeli: kısa ad (`haiku` / `sonnet` / `opus`) ya da tam model kimliği.
 *
 * Kısa adlar Claude Code'a OLDUĞU GİBİ gider; CLI onları o anki en güncel
 * sürüme çözer. Eskiden burada sabit bir tablo vardı (`sonnet` →
 * `claude-sonnet-5`); yeni sürüm çıkınca panel eski modelde kalıyordu.
 *
 * Doğrulama yazma anında: `/model sonnet 5.5` gibi bir giriş eskiden olduğu
 * gibi kaydediliyor, hata ancak mesaj gönderilince ("model yok") çıkıyordu.
 */
// CLI'ın `supportedModels()` listesindeki kısa adlar (ölçüldü 2026-11-27:
// default, opus, sonnet, fable, haiku) + belgelenmiş `opusplan`/`best`.
const ALIAS = /^(default|haiku|sonnet|opus|fable|opusplan|best)(\[1m\])?$/;
const FULL_ID = /^claude-[a-z0-9.-]+(\[1m\])?$/;

export const MODEL_CHOICES = ['haiku', 'sonnet', 'opus', 'fable'] as const;

export function isValidModel(model: unknown): model is string {
  return typeof model === 'string' && (ALIAS.test(model) || FULL_ID.test(model));
}

/**
 * Diskte kalmış geçersiz değeri kurtarır (ör. `sonnet 5.5` → `sonnet`).
 * Tanınan bir aile adı yoksa `sonnet`.
 */
export function repairModel(model: unknown): string {
  if (isValidModel(model)) return model;
  const family = typeof model === 'string' ? /haiku|sonnet|opus|fable/i.exec(model)?.[0] : undefined;
  return family ? family.toLowerCase() : 'sonnet';
}
