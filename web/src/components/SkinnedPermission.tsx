import { useRef } from 'react';
import type { CliSkin } from '../cliSkins';
import type { PermissionRequestInfo } from '../types';
import { answerPermission, PERMISSION_OPTIONS, type PermissionChoice } from '../permissions';
import { ClaudePermission } from './brainless/claude/claude-permission';
import { CodexPermissions } from './brainless/codex/codex-permissions';
import { GrokPermission } from './brainless/grok/grok-permission';
import { L } from '../i18n';

/**
 * İzin istekleri skin'e göre gerçek brainless permission bileşenleriyle çizilir.
 * Üçü de `onChoose(index)` callback'i verir; tutarlı sıra kullanıyoruz:
 *   0 → izin ver · 1 → izin ver + bu ajanda bir daha sorma (autoApprove) · 2 → reddet
 * (Grok'un doğal sırası farklıdır ama öngörülebilirlik için kendi sıramızı
 *  dayatıyoruz.) CodexPermissions aslında `/permissions` mod seçicisidir; görsel
 *  Codex olduğu için kendi 3 seçeneğimizle onaya çeviriyoruz.
 */
const OPTIONS = [...PERMISSION_OPTIONS];

export function SkinnedPermission({
  agentId,
  req,
  skin,
}: {
  agentId: string;
  req: PermissionRequestInfo;
  skin: CliSkin;
}) {
  const done = useRef(false);
  const title = req.title ?? L.chat.runPrompt(req.toolName);
  const command = JSON.stringify(req.input).slice(0, 300);

  async function choose(i: number) {
    if (done.current) return;
    done.current = true;
    await answerPermission(agentId, req, i as PermissionChoice);
  }

  if (skin === 'codex') {
    return (
      <CodexPermissions
        title={title}
        options={[
          { label: OPTIONS[0], description: command },
          { label: OPTIONS[1], description: L.permissionDesc.always },
          { label: OPTIONS[2], description: L.permissionDesc.deny },
        ]}
        onChoose={choose}
      />
    );
  }
  if (skin === 'grok') {
    return <GrokPermission title={title} command={command} options={OPTIONS} onChoose={choose} />;
  }
  return (
    <ClaudePermission
      title={req.toolName}
      command={command}
      question={title}
      options={OPTIONS}
      onChoose={choose}
    />
  );
}
