/**
 * Sohbet modu kabuğu: solda sohbet listesi, ortada konuşma, sağda (isteğe
 * bağlı) ekip çekmecesi.
 *
 * Grup sohbeti = başlıktaki takım kapsamı (TeamTabs ile aynı durum); bu
 * yüzden başlıktan takım değiştirmek de listeden seçmek de aynı şeydir.
 * Doğrudan sohbet (DM) ise tek ajanla konuşmadır.
 *
 * Panel modundan farkı yalnızca GÖRÜNÜM: aynı dökümler, aynı görevler, aynı
 * izin kapısı. Sunucu hangi kabukta olduğumuzu bilmez.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  AgentSnapshot,
  BudgetState,
  PermissionRequestInfo,
  Task,
  TranscriptEvent,
  UsageSummary,
} from '../../types';
import { api } from '../../api';
import { ALL_TEAMS, agentsInTeam, leadOf, teamsOf } from '../../teams';
import { buildFeed, isIncoming, previewOf, type ChatItem } from '../../chatFeed';
import { ROLE_LABEL, STATUS_LABEL } from '../../format';
import { sendToAgent } from '../../agentSend';
import { Avatar, ChatMessage } from './ChatMessage';
import { clock } from './chatFormat';
import { ChatComposer, type ReplyTarget } from './ChatComposer';
import { quoteOf } from '../../reply';
import { L, dateLocale } from '../../i18n';

interface Props {
  agents: AgentSnapshot[];
  tasks: Task[];
  transcripts: Record<string, TranscriptEvent[]>;
  permissions: PermissionRequestInfo[];
  usage: UsageSummary | null;
  budget: BudgetState | null;
  connected: boolean;
  projectDir: string;
  team: string;
  onTeam: (team: string) => void;
  loadTranscript: (id: string) => Promise<void>;
  refreshAgents: () => Promise<void>;
}

type Conv = { kind: 'team' } | { kind: 'dm'; id: string };

const SEEN_KEY = 'claudiva.chat.seen';

function loadSeen(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

export function ChatShell(props: Props) {
  const { agents, tasks, transcripts, permissions, team, onTeam } = props;
  const [conv, setConv] = useState<Conv>({ kind: 'team' });
  const [infoOpen, setInfoOpen] = useState(false);
  const [seen, setSeen] = useState<Record<string, number>>(loadSeen);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);

  // Liste önizlemeleri bütün ajanların dökümüne bakar: hepsi yüklenmeli.
  // (Panel modunda yalnız açık terminaller yükleniyordu.)
  useEffect(() => {
    for (const a of agents) if (!transcripts[a.config.id]) void props.loadTranscript(a.config.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.length]);

  const byId = useMemo(() => new Map(agents.map((a) => [a.config.id, a])), [agents]);
  const nameOf = (id: string) => (id === 'user' ? L.chat.you : byId.get(id)?.config.name ?? id);

  // DM'deki ajan silinirse gruba dön.
  useEffect(() => {
    if (conv.kind === 'dm' && !byId.has(conv.id)) setConv({ kind: 'team' });
  }, [conv, byId]);

  // ------------------------------------------------------------ konuşmalar
  const teams = useMemo(() => teamsOf(agents), [agents]);
  const groups = useMemo(() => {
    const list = [{ key: ALL_TEAMS, label: L.common.allTeam, members: agents }];
    if (teams.length > 1) {
      for (const t of teams) list.push({ key: t.name, label: t.name, members: agentsInTeam(agents, t.name) });
    }
    return list;
  }, [teams, agents]);

  const feedOf = (members: AgentSnapshot[]) => buildFeed({ agents: members, transcripts, tasks, permissions });

  const groupFeeds = useMemo(
    () => new Map(groups.map((g) => [g.key, feedOf(g.members)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groups, transcripts, tasks, permissions]
  );
  const dmFeeds = useMemo(
    () => new Map(agents.map((a) => [a.config.id, feedOf([a])])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agents, transcripts, tasks, permissions]
  );

  // Takım tek ise başlıktaki seçim ALL_TEAMS ya da o tek ad olabilir; ikisi de "Tüm ekip".
  const activeGroup = groups.find((g) => g.key === team) ?? groups[0];
  const convKey = conv.kind === 'team' ? `team:${activeGroup.key}` : `dm:${conv.id}`;
  const members = conv.kind === 'team' ? activeGroup.members : [byId.get(conv.id)].filter(Boolean) as AgentSnapshot[];
  const feed = (conv.kind === 'team' ? groupFeeds.get(activeGroup.key) : dmFeeds.get(conv.id)) ?? [];
  const lead = conv.kind === 'team' ? leadOf(members) : members[0] ?? null;
  const title = conv.kind === 'team' ? activeGroup.label : members[0]?.config.name ?? '';

  /**
   * İlk ziyarette (kayıt yok) mevcut geçmiş "görülmüş" sayılır: sohbet modunu
   * ilk açan kullanıcı aylık geçmişin tamamını okunmamış görmesin. Sayaç
   * bundan sonra gelen mesajları sayar.
   */
  /**
   * Görülme kaydını günceller. İŞLEVSEL güncelleme şart: aynı karede iki
   * efekt (taban + açık konuşma) yazıyor ve ikisi de eski `seen`i okusaydı
   * ikincisi birincinin yazdığını ezerdi (ölçüldü: taban 8 anahtar yazıp 1'e
   * düşüyordu).
   */
  const markSeen = (patch: (prev: Record<string, number>) => Record<string, number> | null) =>
    setSeen((prev) => {
      const next = patch(prev);
      if (!next) return prev;
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      } catch {
        /* gizli sekme: okunmamış sayacı oturumluk kalır */
      }
      return next;
    });

  /**
   * İlk ziyarette (kayıt yok) mevcut geçmiş "görülmüş" sayılır: sohbet modunu
   * ilk açan kullanıcı eski geçmişin tamamını okunmamış görmesin. Sayaç
   * bundan sonra gelen mesajları sayar. Bütün dökümler yüklenmeden çalışmaz,
   * yoksa taban boş akışa göre konup sonradan yüklenen geçmiş "yeni" sayılırdı.
   */
  useEffect(() => {
    if (!agents.length || agents.some((a) => !transcripts[a.config.id])) return;
    markSeen((prev) => {
      const next = { ...prev };
      let changed = false;
      const base = (key: string, items: ChatItem[]) => {
        if (next[key] === undefined) {
          next[key] = items.at(-1)?.ts ?? Date.now();
          changed = true;
        }
      };
      for (const [k, f] of groupFeeds) base(`team:${k}`, f);
      for (const [k, f] of dmFeeds) base(`dm:${k}`, f);
      return changed ? next : null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupFeeds, dmFeeds]);

  const unread = (key: string, items: ChatItem[]) => {
    const since = seen[key];
    if (since === undefined) return 0;
    return items.filter((i) => i.ts > since && isIncoming(i)).length;
  };

  // Açık konuşmanın son öğesi "görüldü".
  const lastTs = feed.at(-1)?.ts ?? 0;
  useEffect(() => {
    if (!lastTs) return;
    markSeen((prev) => ((prev[convKey] ?? 0) >= lastTs ? null : { ...prev, [convKey]: lastTs }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convKey, lastTs]);

  // ------------------------------------------------------------ kaydırma
  const threadRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  // Son öğe kimliği + metin sayısı: canlı turda balon büyüdükçe de aşağıda kal.
  const last = feed.at(-1);
  const tailSig = last ? `${last.id}:${last.type === 'turn' ? last.texts.length + last.tools.length : 0}` : '';
  useLayoutEffect(() => {
    const el = threadRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [feed.length, tailSig]);
  useLayoutEffect(() => {
    stick.current = true;
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [convKey]);

  // ------------------------------------------------------------ yanıt
  // Konuşma değişince bekleyen yanıt düşer: başka sohbetteki mesaja yanıt
  // bu sohbete gitmemeli.
  useEffect(() => setReplyTo(null), [convKey]);

  function reply(item: ChatItem) {
    const q = quoteOf(item, nameOf);
    if (!q) return;
    // Ajanın sözüne verilen yanıt o ajana gider; kendi mesajına yanıt hedef değiştirmez.
    const agentId =
      item.type === 'turn'
        ? item.agentId
        : item.type === 'result'
          ? item.task.assignedTo
          : item.type === 'delegation'
            ? item.task.assignedTo
            : undefined;
    setReplyTo({ ...q, agentId });
  }

  /** Alıntıya tıklanınca yanıtlanan mesaja kaydır ve kısa süre vurgula. */
  function jump(id: string) {
    const el = threadRef.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(id)}"]`);
    if (!el) return;
    stick.current = false;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('cm-flash');
    void el.offsetWidth; // aynı mesaja ikinci tıklamada animasyon yeniden başlasın
    el.classList.add('cm-flash');
    window.setTimeout(() => el.classList.remove('cm-flash'), 1600);
  }

  // ------------------------------------------------------------ eylemler
  async function toggleAutoApprove() {
    const next = !(members.length > 0 && members.every((a) => a.config.autoApprove));
    await Promise.all(members.map((a) => api.updateAgent(a.config.id, { autoApprove: next })));
    await props.refreshAgents();
  }

  async function directSend(text: string) {
    const agent = members[0];
    if (!agent) return;
    await sendToAgent(text, {
      agent,
      agents,
      tasks,
      usage: props.usage,
      budget: props.budget,
      projectDir: props.projectDir,
      connected: props.connected,
      events: transcripts[agent.config.id] ?? [],
      clearTranscript: async () => {
        await api.clearTranscript(agent.config.id);
        await props.loadTranscript(agent.config.id);
      },
      refreshAgents: props.refreshAgents,
    });
  }

  const openTasks = tasks.filter(
    (t) => (t.status === 'running' || t.status === 'pending') && members.some((m) => m.config.id === t.assignedTo)
  );
  const workingCount = members.filter((a) => a.status === 'working').length;

  return (
    <main className="chat-wrap">
    <div className={`chat${infoOpen ? ' info-open' : ''}`}>
      <aside className="chat-list" aria-label="Sohbetler">
        <div className="chat-list-head">{L.chat.chats}</div>

        <div className="chat-list-sec">{L.chat.teams}</div>
        {groups.map((g) => {
          const f = groupFeeds.get(g.key) ?? [];
          const active = conv.kind === 'team' && g.key === activeGroup.key;
          const n = active ? 0 : unread(`team:${g.key}`, f);
          const busy = g.members.some((a) => a.status === 'working');
          return (
            <button
              key={g.key}
              className={`chat-conv${active ? ' active' : ''}`}
              onClick={() => {
                onTeam(g.key);
                setConv({ kind: 'team' });
              }}
            >
              <span className="chat-conv-icon" aria-hidden>
                #
              </span>
              <span className="chat-conv-body">
                <span className="chat-conv-top">
                  <span className="chat-conv-name">{g.label}</span>
                  {f.length > 0 && <time>{clock(f[f.length - 1].ts)}</time>}
                </span>
                <span className="chat-conv-prev">
                  {busy && <span className="led led-working" />}
                  {previewOf(f.at(-1), nameOf)}
                </span>
              </span>
              {n > 0 && <span className="chat-unread">{n}</span>}
            </button>
          );
        })}

        <div className="chat-list-sec">{L.chat.direct}</div>
        {agents.map((a) => {
          const f = dmFeeds.get(a.config.id) ?? [];
          const active = conv.kind === 'dm' && conv.id === a.config.id;
          const n = active ? 0 : unread(`dm:${a.config.id}`, f);
          return (
            <button
              key={a.config.id}
              className={`chat-conv${active ? ' active' : ''}`}
              onClick={() => setConv({ kind: 'dm', id: a.config.id })}
            >
              <Avatar agent={a} size="sm" />
              <span className="chat-conv-body">
                <span className="chat-conv-top">
                  <span className="chat-conv-name">{a.config.name}</span>
                  {f.length > 0 && <time>{clock(f[f.length - 1].ts)}</time>}
                </span>
                <span className="chat-conv-prev">
                  {a.pendingPermissions.length > 0 ? L.chat.awaitingApproval : previewOf(f.at(-1), nameOf)}
                </span>
              </span>
              {n > 0 && <span className="chat-unread">{n}</span>}
            </button>
          );
        })}
      </aside>

      <section className="chat-main">
        <header className="chat-head">
          <div className="chat-head-title">
            <h2>{title}</h2>
            <span className="chat-head-sub">
              {conv.kind === 'team'
                ? L.chat.headTeam(members.length, lead?.config.name ?? null, workingCount)
                : members[0]
                  ? `${ROLE_LABEL[members[0].config.role] ?? members[0].config.role} · ${STATUS_LABEL[members[0].status]}`
                  : ''}
            </span>
          </div>
          <div className="chat-head-faces" aria-hidden>
            {members.slice(0, 6).map((a) => (
              <Avatar key={a.config.id} agent={a} size="sm" />
            ))}
            {members.length > 6 && <span className="chat-more">+{members.length - 6}</span>}
          </div>
          <button
            className={`icon-btn chat-info-btn${infoOpen ? ' on' : ''}`}
            onClick={() => setInfoOpen((v) => !v)}
            aria-pressed={infoOpen}
            title={L.chat.infoTitle}
          >
            i
          </button>
        </header>

        <div
          className="chat-thread"
          ref={threadRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {feed.length === 0 ? (
            <div className="chat-empty">
              <h3>{conv.kind === 'team' ? L.chat.emptyTeamTitle : L.chat.emptyDmTitle(title)}</h3>
              <p>
                {conv.kind === 'team'
                  ? L.chat.emptyTeamBody(lead?.config.name ?? L.chat.leadFallback)
                  : L.chat.emptyDmBody}
              </p>
            </div>
          ) : (
            <Thread feed={feed} byId={byId} leadId={lead?.config.id} onReply={reply} onJump={jump} />
          )}
          {/* Çalışan ama henüz tek satır üretmemiş ajan: mesaj gönderildiği an
              ile ilk olay arasında akış sessiz kalıyordu, "gitti mi?" diye
              sorduruyordu. Canlı balonu olan ajan için ayrıca çizilmez. */}
          {members
            .filter(
              (a) =>
                a.status === 'working' &&
                !feed.some((i) => i.type === 'turn' && i.live && i.agentId === a.config.id)
            )
            .map((a) => (
              <div key={`typing:${a.config.id}`} className="cm-row">
                <Avatar agent={a} />
                <div className="cm-bubble cm-typing-bubble">
                  <div className="cm-typing">
                    <span className="cm-dots" aria-hidden>
                      <i />
                      <i />
                      <i />
                    </span>
                    {a.config.name} {a.currentActivity ?? L.chat.thinking}
                  </div>
                </div>
              </div>
            ))}
          
        </div>

        <ChatComposer
          key={convKey}
          mode={conv.kind === 'team' ? 'group' : 'dm'}
          members={members}
          lead={lead}
          tasks={tasks}
          budget={props.budget}
          label={title}
          onDirectSend={conv.kind === 'dm' ? directSend : undefined}
          onToggleAutoApprove={toggleAutoApprove}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </section>

      {infoOpen && (
        <aside className="chat-info" aria-label={L.chat.infoAria}>
          <div className="chat-list-sec">{L.chat.members}</div>
          {members.map((a) => (
            <button key={a.config.id} className="chat-member" onClick={() => setConv({ kind: 'dm', id: a.config.id })}>
              <Avatar agent={a} size="sm" />
              <span className="chat-conv-body">
                <span className="chat-conv-name">{a.config.name}</span>
                <span className="chat-conv-prev">
                  {ROLE_LABEL[a.config.role] ?? a.config.role} · {a.currentActivity ?? STATUS_LABEL[a.status]}
                </span>
              </span>
            </button>
          ))}
          <div className="chat-list-sec">{L.chat.openTasks(openTasks.length)}</div>
          {openTasks.length === 0 && <p className="chat-info-empty">{L.chat.noOpenTasks}</p>}
          {openTasks.map((t) => (
            <div key={t.id} className="chat-task">
              <span className={`cm-status s-${t.status}`}>{L.taskStatus[t.status]}</span>
              <span className="chat-task-title">{t.title}</span>
              <span className="chat-conv-prev">
                {nameOf(t.assignedBy)} → {nameOf(t.assignedTo)}
              </span>
            </div>
          ))}
        </aside>
      )}
    </div>
    </main>
  );
}

/** Gün ayıraçları ve art arda gelen mesajların başlık birleştirmesi. */
function Thread({
  feed,
  byId,
  leadId,
  onReply,
  onJump,
}: {
  feed: ChatItem[];
  byId: Map<string, AgentSnapshot>;
  leadId?: string;
  onReply: (item: ChatItem) => void;
  onJump: (id: string) => void;
}) {
  const out: ReactNode[] = [];
  let day = '';
  let prev: ChatItem | null = null;
  for (const item of feed) {
    const d = new Date(item.ts).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', weekday: 'long' });
    if (d !== day) {
      day = d;
      prev = null;
      out.push(
        <div key={`day:${item.id}`} className="chat-day">
          <span>{d}</span>
        </div>
      );
    }
    const continued =
      !!prev &&
      prev.type === 'turn' &&
      item.type === 'turn' &&
      prev.agentId === item.agentId &&
      item.ts - prev.ts < 5 * 60_000;
    out.push(
      <ChatMessage
        key={item.id}
        item={item}
        byId={byId}
        leadId={leadId}
        continued={continued}
        onReply={onReply}
        onJump={onJump}
      />
    );
    prev = item;
  }
  return <>{out}</>;
}
