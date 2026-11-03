import { UserRound } from 'lucide-react';
import { useStore } from '../data/store';
import { ROLE_HELP, ROLE_LABEL, USERS } from '../data/access';

/** Barra do modo demonstração: troca o perfil para ver as permissões de cada papel. */
export default function DemoBar() {
  const { user, setUser, notify } = useStore();
  return (
    <div className="demo-bar">
      <span className="demo-tag">Modo demonstração</span>
      <label className="demo-user">
        <UserRound size={16} aria-hidden="true" />
        <span className="sr-only">Ver o sistema como</span>
        <select className="input" value={user.id} onChange={(e) => { setUser(e.target.value); const u = USERS.find((x) => x.id === e.target.value)!; notify(`Agora você está como ${u.name} (${ROLE_LABEL[u.role].toLowerCase()}).`); }}>
          {USERS.map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}</option>)}
        </select>
      </label>
      <span className="demo-help">{ROLE_HELP[user.role]}</span>
    </div>
  );
}

/** Aviso exibido no topo de um registro quando o perfil atual só pode ler. */
export function ReadOnlyNote({ show }: { show: boolean }) {
  const { user } = useStore();
  if (!show) return null;
  return <div className="ro-note" role="note">Somente leitura para <b>{user.name}</b> ({ROLE_LABEL[user.role].toLowerCase()}). Troque de perfil no topo da página para editar.</div>;
}
