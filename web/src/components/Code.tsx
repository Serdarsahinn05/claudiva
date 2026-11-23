import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { highlight, langOf, preload, whenReady } from '../highlight';
import type { AgentSnapshot, FileContent, TreeEntry } from '../types';
import { L } from '../i18n';

/**
 * Kod paneli — ajanların üzerinde çalıştığı kod tabanı.
 *
 * Değişiklikler panelinden AYRI bir soruyu yanıtlar. O panel "son commit'e göre
 * ne farklı"yı gösteriyor; commit'lenen dosya listeden düşüyor ve ajanın okuyup
 * değiştirmediği dosya hiç görünmüyordu. Burada kod tabanının kendisi var,
 * üstünde de atıf: hangi dosyaya kim dokundu.
 *
 * Sözdizimi renklendirme `highlight.ts` üzerinden gelir (Prism, tembel
 * yüklenir). Eskiden bilerek YOKTU; gerekçe "en küçük highlighter bile bu
 * paneli paketin en büyük parçası yapardı" idi ve bu ölçülünce doğru çıkmadı —
 * ayrıntılı ölçüm o dosyanın başında. Renk okumayı taşıyan tek şey değil:
 * satır numarası, mono tipografi ve dokunuş rozeti yerinde duruyor.
 */

const MAX_RENDER_LINES = 4000;

interface Props {
  agents: AgentSnapshot[];
}

function fmtSize(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} KB`;
  return `${n} B`;
}

/**
 * Satırın ikon adı. Klasör açıkken `iconOpen`e geçer (VS Code'daki gibi:
 * açık klasörün ağzı açık çizilir), dosyada tek ad var.
 */
function iconNameOf(entry: TreeEntry, isOpen: boolean): string | undefined {
  if (entry.kind === 'dir' && isOpen) return entry.iconOpen ?? entry.icon;
  return entry.icon;
}

function rel(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  return L.time.ago(s);
}

export function Code({ agents }: Props) {
  /** Açık dizinler → içerikleri. Kök ('') her zaman yüklü. */
  const [dirs, setDirs] = useState<Record<string, TreeEntry[]>>({});
  const [open, setOpen] = useState<Set<string>>(new Set(['']));
  const [sel, setSel] = useState<string | null>(null);
  const [file, setFile] = useState<FileContent | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  /**
   * Prism ayrı bir yığında ve asenkron gelir. Bu sayaç yükleme bitince bir kez
   * artar ve renklendirmeyi yeniden hesaplatır — yani dosya, Prism'i beklemeden
   * ANINDA düz metin olarak açılır, renk hazır olunca üstüne biner.
   */
  const [hlTick, setHlTick] = useState(0);

  const nameOf = useCallback(
    (id: string) => agents.find((a) => a.config.id === id)?.config.name ?? id,
    [agents],
  );

  const loadDir = useCallback(async (p: string) => {
    try {
      const res = await api.fileTree(p);
      setDirs((d) => ({ ...d, [p]: res.entries }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadDir('');
    // Panel açılır açılmaz Prism'i getirt: ilk dosya seçildiğinde çoktan hazır
    // olsun. Panel hiç açılmazsa bu yığın hiç indirilmez.
    preload();
    whenReady(() => setHlTick((n) => n + 1));
  }, [loadDir]);

  useEffect(() => {
    if (!sel) {
      setFile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .fileRead(sel)
      .then((f) => {
        if (!cancelled) {
          setFile(f);
          setError('');
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sel]);

  function toggleDir(p: string) {
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(p)) {
        next.delete(p);
      } else {
        next.add(p);
        if (!dirs[p]) void loadDir(p);
      }
      return next;
    });
  }

  /**
   * Açık dalları düz bir listeye serer. Özyinelemeli bileşen yerine düz liste:
   * derin ağaçlarda iç içe kaplar sanal kaydırmayı imkânsız kılıyor ve girinti
   * zaten tek bir sayıyla anlatılabiliyor.
   */
  const rows = useMemo(() => {
    const out: { entry: TreeEntry; depth: number }[] = [];
    const walk = (p: string, depth: number) => {
      for (const e of dirs[p] ?? []) {
        out.push({ entry: e, depth });
        if (e.kind === 'dir' && open.has(e.path)) walk(e.path, depth + 1);
      }
    };
    walk('', 0);
    return out;
  }, [dirs, open]);

  /**
   * Çizilecek metin: ilk `MAX_RENDER_LINES` satır. Kırpma renklendirmeden ÖNCE
   * yapılıyor — tokenize maliyeti çizilmeyecek satırlara ödenmesin.
   */
  const shownText = useMemo(() => {
    if (!file?.text) return '';
    const all = file.text.split('\n');
    return (all.length > MAX_RENDER_LINES ? all.slice(0, MAX_RENDER_LINES) : all).join('\n');
  }, [file]);

  /** Satır numarası sayacı — renklendirmeden bağımsız, oluk ayrı bir `<pre>`. */
  const lineCount = useMemo(
    () => (shownText ? shownText.split('\n').length : 0),
    [shownText],
  );

  const spans = useMemo(
    () => highlight(shownText, file ? langOf(file.path) : null),
    // hlTick: Prism sonradan hazır olduğunda aynı metni yeniden renklendirir.
    [shownText, file, hlTick],
  );

  return (
    <div className="code">
      <section className="pl-head">
        <div>
          <h2 className="plate-title">{L.code.title}</h2>
          <p className="pl-head-desc">
            {L.code.desc}
          </p>
        </div>
        <button onClick={() => void loadDir('')}>{L.actions.refresh}</button>
      </section>

      {error && <div className="error">{error}</div>}

      <div className="code-split">
        <div className="code-tree" role="tree" aria-label={L.code.treeAria}>
          {rows.map(({ entry, depth }) => (
            <button
              key={entry.path}
              type="button"
              role="treeitem"
              aria-expanded={entry.kind === 'dir' ? open.has(entry.path) : undefined}
              aria-selected={sel === entry.path}
              className={`code-node${sel === entry.path ? ' sel' : ''} ${entry.kind}`}
              style={{ paddingLeft: `${6 + depth * 13}px` }}
              onClick={() => (entry.kind === 'dir' ? toggleDir(entry.path) : setSel(entry.path))}
              title={entry.path}
            >
              <span className="code-caret">
                {entry.kind === 'dir' ? (open.has(entry.path) ? '▾' : '▸') : ''}
              </span>
              {/*
                İkon `<img>` ile geliyor, satır içi SVG ile değil: eşleme
                tablosu 450 KB ve sunucuda kalıyor, SVG'nin kendisi de pakete
                girmiyor (bkz. server/src/fileIcons.ts). `<img>` olunca
                tarayıcı İKON ADINA göre önbelleğe alıyor — 57 tane `.tsx`
                tek indirme demek. `loading="lazy"` uzun ağaçlarda görünmeyen
                satırların isteğini hiç atmıyor.
              */}
              {iconNameOf(entry, open.has(entry.path)) && (
                <img
                  className="code-icon"
                  src={`/api/file-icon/${iconNameOf(entry, open.has(entry.path))}.svg`}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  draggable={false}
                  /*
                    İkon paketi kurulu değilse uç 404 döner ve tarayıcı KIRIK
                    RESİM kutusu çizer — ağacın her satırında. Böyle bir
                    durumda ikon hiç olmamalı: satır ikonsuz da tam okunur.
                  */
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <span className="code-name">{entry.name}</span>
              {entry.kind === 'file' && entry.size !== undefined && (
                <span className="code-size">{fmtSize(entry.size)}</span>
              )}
            </button>
          ))}
          {!rows.length && <div className="muted center">{L.code.treeLoading}</div>}
        </div>

        <div className="code-view">
          {!sel ? (
            <div className="muted center">{L.code.pick}</div>
          ) : loading ? (
            <div className="muted center">Okunuyor…</div>
          ) : !file ? (
            <div className="muted center">{error || L.code.openFailed}</div>
          ) : (
            <>
              <div className="code-head">
                <span className="code-path">{file.path}</span>
                <span className="code-meta">
                  {fmtSize(file.size)}
                  {file.lines > 0 && L.code.lines(file.lines)}
                  {langOf(file.path) && ` · ${langOf(file.path)}`}
                </span>
              </div>

              {/* Atıf: git farkından düşmüş (commit'lenmiş) dosyada da durur. */}
              {file.touches.length > 0 && (
                <div className="code-touches">
                  {file.touches.slice(0, 4).map((t, i) => (
                    <span className="code-touch" key={`${t.agentId}-${t.ts}-${i}`}>
                      <strong>{nameOf(t.agentId)}</strong> · {t.tool} · {rel(t.ts)}
                    </span>
                  ))}
                  {file.touches.length > 4 && (
                    <span className="code-touch dim">+{file.touches.length - 4} dokunuş</span>
                  )}
                </div>
              )}

              {file.tooLarge ? (
                <div className="muted center">
                  {L.code.tooLarge(fmtSize(file.size))}
                </div>
              ) : file.binary ? (
                <div className="muted center">İkili dosya ({fmtSize(file.size)}) — metin olarak okunamaz.</div>
              ) : (
                <div className="code-body">
                  <pre className="code-gutter" aria-hidden="true">
                    {Array.from({ length: lineCount }, (_, i) => `${i + 1}\n`).join('')}
                  </pre>
                  {/*
                    Parçalar `<span>` olarak çiziliyor, HTML dizgesi olarak
                    değil: `Prism.highlight()` + `dangerouslySetInnerHTML` yolu
                    bu panele — diskteki rastgele dosyaları okuyan bir panele —
                    gereksiz bir enjeksiyon yüzeyi açardı. Sınıfsız parçalar
                    düz metin olarak kalıyor, yani sıradan bir dosyada fazladan
                    DOM düğümü yok.
                  */}
                  <pre className="code-text">
                    {spans.map((s, i) =>
                      s.cls ? (
                        <span key={i} className={`syn-${s.cls}`}>
                          {s.text}
                        </span>
                      ) : (
                        s.text
                      ),
                    )}
                  </pre>
                </div>
              )}

              {file.lines > MAX_RENDER_LINES && (
                <div className="code-clip">
                  {L.code.clipped(MAX_RENDER_LINES, file.lines)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
