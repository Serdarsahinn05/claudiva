/**
 * Tek bir ajana mesaj göndermenin TEK yolu (terminal ve sohbet DM'i).
 *
 * `/usage`, `/clear`, `/help` gibi komutlar CLI'da da istemci tarafında
 * işlenir; ajana gönderilirse "ben bunu çalıştıramam" cevabı gelir. Bu ayrım
 * iki yüzeyde ayrı ayrı yazılırsa biri yeni bir yerel komutu tanımaz ve komut
 * modele düz metin olarak gider — bu yüzden burada tek kez duruyor.
 */
import { api } from './api';
import { matchLocal, type LocalContext } from './localCommands';

export type SendContext = Omit<LocalContext, 'args'>;

export async function sendToAgent(text: string, ctx: SendContext): Promise<void> {
  const id = ctx.agent.config.id;
  // Panelin ürettiği satır sunucudaki döküme yazılır (ajana gitmez); bileşen
  // state'inde tutulsaydı başka ajana geçince kaybolurdu.
  const pushLocal = (kind: 'user' | 'local' | 'error', t: string) =>
    api.pushLocal(id, kind, t).catch(() => {});

  const local = matchLocal(text);
  if (local) {
    await pushLocal('user', text);
    try {
      const out = await local.cmd.run({ ...ctx, args: local.args });
      if (out) await pushLocal('local', out);
    } catch (e) {
      await pushLocal('error', (e as Error).message);
    }
    return;
  }
  await api.sendMessage(id, text);
}
