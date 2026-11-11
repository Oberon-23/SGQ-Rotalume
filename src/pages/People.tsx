import { useEffect, useState } from 'react';
import { useStore } from '../data/store';
import { listProfiles, setRole, type Profile } from '../data/cloud';
import { ROLE_HELP, ROLE_LABEL } from '../data/access';
import type { Role } from '../data/types';
import { Empty } from '../components/ui';

/** Gestão de acesso (só no modo banco): a gestora define o papel de cada pessoa. */
export default function People() {
  const { user, notify, mode } = useStore();
  const [list, setList] = useState<Profile[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (mode === 'banco') listProfiles().then(setList).catch((e) => setError(e.message)); }, [mode]);
  if (mode !== 'banco') return <div className="page"><h1>Pessoas e acesso</h1><Empty>Disponível quando você entra com conta. Na demonstração, troque de perfil no topo da página.</Empty></div>;
  const admin = user.role === 'gestor';
  const change = async (p: Profile, papel: Role) => {
    try { await setRole(p.user_id, papel); setList((l) => l?.map((x) => (x.user_id === p.user_id ? { ...x, papel } : x)) ?? null); notify(`${p.nome} agora é ${ROLE_LABEL[papel].toLowerCase()}.`); }
    catch (e) { notify((e as Error).message); }
  };
  return (
    <div className="page">
      <div className="page-head"><div><h1>Pessoas e acesso</h1><p>Quem usa o sistema e o que cada um pode fazer. A regra vale no banco de dados: mesmo pela API, ninguém passa do próprio papel.</p></div></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="card" style={{ padding: 0 }}>
        {!list ? <p className="muted" style={{ padding: 16 }} role="status">Carregando…</p> : (
          <div className="tscroll" tabIndex={0} style={{ border: 0 }}>
            <table>
              <thead><tr><th>Pessoa</th><th>Papel</th><th>O que pode fazer</th></tr></thead>
              <tbody>{list.map((p) => (
                <tr key={p.user_id}>
                  <td><b>{p.nome}</b>{p.user_id === user.id && <span className="muted"> (você)</span>}</td>
                  <td>{admin && p.user_id !== user.id
                    ? <select className="input" value={p.papel} aria-label={`Papel de ${p.nome}`} onChange={(e) => change(p, e.target.value as Role)}>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
                    : ROLE_LABEL[p.papel]}</td>
                  <td className="ink2" style={{ fontSize: 13.5 }}>{ROLE_HELP[p.papel]}</td>
                </tr>))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Para alguém entrar na equipe: a pessoa cria conta em /entrar e aparece aqui como leitora. Você não pode mudar o próprio papel, para a empresa nunca ficar sem gestão.</p>
    </div>
  );
}
