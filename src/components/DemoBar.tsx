import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CircleHelp, Cloud, CloudOff, LogIn, LogOut, Search, UserRound } from 'lucide-react';
import { cloudConfigured } from '../data/cloud';
import { useStore } from '../data/store';
import { ROLE_HELP, ROLE_LABEL, USERS } from '../data/access';
import { dueText, notifications, tasksFor } from '../data/pending';

const SEEN_KEY = 'sgq-seen';
const readSeen = (): Record<string, string[]> => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; } };

/** Sino: prazos vencidos ou chegando. O número mostra só o que ainda não foi visto. */
function NotificationBell() {
  const { db, user } = useStore();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const ref = useRef<HTMLDivElement>(null);
  const items = user.role === 'leitor' ? [] : notifications(tasksFor(db, user.name));
  const unread = items.filter((t) => !(seen[user.id] ?? []).includes(t.id)).length;
  useEffect(() => {
    if (!open) return;
    const ids = items.map((t) => t.id);
    const next = { ...readSeen(), [user.id]: ids };
    setSeen(next);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* sem armazenamento */ }
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="bell" ref={ref}>
      <button className="btn ghost icon" aria-label={`Notificações${unread ? `: ${unread} novas` : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell />{unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Notificações">
          <div className="pop-h"><b>Prazos</b><span className="muted">vencidos ou nos próximos 7 dias</span></div>
          {items.length ? <ul>{items.slice(0, 8).map((t) => (
            <li key={t.id}><Link to={t.path} onClick={() => setOpen(false)}><b>{t.title}</b><span className={(t.days ?? 0) < 0 ? 'late' : 'soon'}>{dueText(t)} · {t.detail}</span></Link></li>
          ))}</ul> : <p className="muted" style={{ margin: '8px 0' }}>{user.role === 'leitor' ? 'Leitores não recebem avisos de prazo.' : 'Nenhum prazo chegando. Tudo em dia.'}</p>}
          <Link className="btn small" style={{ width: '100%' }} to="/minhas-pendencias" onClick={() => setOpen(false)}>Ver todas as minhas pendências</Link>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>Em produção, estes avisos também chegam por e-mail.</p>
        </div>
      )}
    </div>
  );
}

/** Barra do topo: perfil de demonstração, busca, notificações e ajuda. */
export default function TopBar({ onSearch, onHelp }: { onSearch: () => void; onHelp: () => void }) {
  const { user, setUser, notify, mode, signOut, saved } = useStore();
  if (mode === 'banco') return (
    <div className="demo-bar">
      <span className="demo-tag live" title="Dados no banco (Supabase), compartilhados com a equipe">{saved ? <Cloud size={14} /> : <CloudOff size={14} />}{saved ? 'Banco' : 'Salvando…'}</span>
      <span className="who-am-i"><UserRound size={16} aria-hidden="true" /><b>{user.name}</b><span className="muted">{ROLE_LABEL[user.role]}</span></span>
      <div className="top-tools">
        <button className="btn ghost search-btn" onClick={onSearch} aria-label="Buscar (Ctrl+K)"><Search /><span className="lbl">Buscar</span><kbd>Ctrl K</kbd></button>
        <NotificationBell />
        <button className="btn ghost icon" onClick={onHelp} aria-label="Apresentação do sistema" title="Apresentação do sistema"><CircleHelp /></button>
        <button className="btn ghost icon" onClick={signOut} aria-label="Sair da conta" title="Sair da conta"><LogOut /></button>
      </div>
    </div>
  );
  return (
    <div className="demo-bar">
      <span className="demo-tag" title="Os dados são fictícios e ficam salvos só neste navegador">Demo</span>
      <label className="demo-user">
        <UserRound size={16} aria-hidden="true" />
        <span className="sr-only">Ver o sistema como</span>
        <select className="input" title={ROLE_HELP[user.role]} value={user.id} onChange={(e) => { setUser(e.target.value); const u = USERS.find((x) => x.id === e.target.value)!; notify(`Agora você está como ${u.name} (${ROLE_LABEL[u.role].toLowerCase()}).`); }}>
          {USERS.map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}</option>)}
        </select>
      </label>
      <span className="demo-help">{ROLE_HELP[user.role]}</span>
      <div className="top-tools">
        <button className="btn ghost search-btn" onClick={onSearch} aria-label="Buscar (Ctrl+K)"><Search /><span className="lbl">Buscar</span><kbd>Ctrl K</kbd></button>
        <NotificationBell />
        <button className="btn ghost icon" onClick={onHelp} aria-label="Apresentação do sistema" title="Apresentação do sistema"><CircleHelp /></button>
        {cloudConfigured && <Link className="btn small" to="/entrar"><LogIn />Entrar</Link>}
      </div>
    </div>
  );
}

/** Aviso exibido no topo de um registro quando o perfil atual só pode ler. */
export function ReadOnlyNote({ show }: { show: boolean }) {
  const { user, mode } = useStore();
  if (!show) return null;
  return <div className="ro-note" role="note">Somente leitura para <b>{user.name}</b> ({ROLE_LABEL[user.role].toLowerCase()}). {mode === 'banco' ? 'Peça à gestão da qualidade para mudar seu papel em Pessoas e acesso.' : 'Troque de perfil no topo da página para editar.'}</div>;
}
