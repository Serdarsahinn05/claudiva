import type { AgentBackend } from '../backend.js';
import { ClaudeBackend } from './claudeBackend.js';

/**
 * Tek gerçek backend var — bu yüzden şimdilik `ProviderId` de tek üyeli
 * (bkz. types.ts). İkinci bir sağlayıcı eklendiğinde tek değişecek yer
 * burası ve `ProviderId` union'ı; `AgentSession` hiç değişmez.
 */
export function createBackend(provider: 'claude'): AgentBackend {
  switch (provider) {
    case 'claude':
      return new ClaudeBackend();
    default: {
      // ProviderId genişleyip buraya yeni bir dal eklenmeden derlenirse
      // TS burada yakalar (exhaustiveness check).
      const _exhaustive: never = provider;
      throw new Error(`Bilinmeyen sağlayıcı: ${_exhaustive}`);
    }
  }
}
