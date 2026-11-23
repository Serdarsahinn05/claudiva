/**
 * Takım sekmeleri.
 *
 * Bunlar BÖLÜM sekmesi değil KAPSAM sekmesidir — hangi ekranın açık olduğunu
 * değil, açık olan bütün ekranların KİMİ gösterdiğini belirler. Bu ayrım
 * kabuğun tamamının anlamını taşıyor: bir takım seçmek ofisi, görevleri,
 * terminalleri ve raporları aynı anda süzer, hiçbirini kapatmaz.
 *
 * Sekmede üç sayı var ve üçü de gerçek: toplam üye, çalışan üye, bekleyen
 * izin. Bekleyen izin sıfırdan büyükse sekme kehribar okunur — kullanıcı
 * başka bir takıma bakarken bile bir yerde onay beklendiğini görür.
 */
import type { AgentSnapshot } from '../types';
import { ALL_TEAMS, teamsOf } from '../teams';
import { L } from '../i18n';

interface Props {
  agents: AgentSnapshot[];
  value: string;
  onChange: (team: string) => void;
}

export function TeamTabs({ agents, value, onChange }: Props) {
  const teams = teamsOf(agents);

  // Tek takım varsa sekme şeridi bir seçim sunmuyor demektir; yer kaplamasın.
  if (teams.length < 2) return null;

  const totalPending = teams.reduce((n, t) => n + t.pending, 0);
  const totalActive = teams.reduce((n, t) => n + t.active, 0);

  return (
    <nav className="teams" aria-label={L.teamTabs.aria}>
      <button
        className={`team-tab${value === ALL_TEAMS ? ' sel' : ''}`}
        onClick={() => onChange(ALL_TEAMS)}
      >
        <span className="team-name">{L.teamTabs.all}</span>
        <span className="team-count">{agents.length}</span>
        {totalActive > 0 && <span className="team-live" title={L.teamTabs.working(totalActive)} />}
        {totalPending > 0 && <span className="team-pending">{totalPending}</span>}
      </button>

      <span className="team-sep" aria-hidden="true" />

      {teams.map((t) => (
        <button
          key={t.name}
          className={`team-tab${value === t.name ? ' sel' : ''}${t.pending ? ' waiting' : ''}`}
          onClick={() => onChange(t.name)}
          title={L.teamTabs.summary(t.count, t.active, t.pending)}
        >
          <span className="team-name">{t.name}</span>
          <span className="team-count">{t.count}</span>
          {t.active > 0 && <span className="team-live" title={L.teamTabs.working(t.active)} />}
          {t.pending > 0 && <span className="team-pending">{t.pending}</span>}
        </button>
      ))}
    </nav>
  );
}
