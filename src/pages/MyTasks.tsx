import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useStore } from '../data/store';
import { KIND_LABEL, SOON_DAYS, dueText, tasksFor, type Task } from '../data/pending';
import { Empty, Headline } from '../components/ui';
import { fmtDate } from '../data/utils';

/** Todas as pessoas que aparecem como responsáveis em algum registro. */
function people(db: ReturnType<typeof useStore>['db']) {
  const s = new Set<string>();
  db.processes.forEach((p) => s.add(p.owner));
  db.ncs.forEach((n) => { s.add(n.owner); n.actions.forEach((a) => a.who && s.add(a.who)); });
  db.docs.forEach((d) => s.add(d.owner));
  db.audits.forEach((a) => s.add(a.auditor));
  db.kpis.forEach((k) => s.add(k.owner));
  db.risks.forEach((r) => s.add(r.owner));
  db.reviews.forEach((r) => r.decisions.forEach((d) => d.owner && s.add(d.owner)));
  return [...s].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function TaskRow({ t }: { t: Task }) {
  const tone = t.days === undefined ? '' : t.days < 0 ? 'bad' : t.days <= SOON_DAYS ? 'warn' : '';
  return (
    <li className="task">
      <Link to={t.path} className="task-main">
        <span className="pill">{KIND_LABEL[t.kind]}</span>
        <b>{t.title}</b>
        <span className="s">{t.detail}{t.due ? ` · prazo ${fmtDate(t.due)}` : ''}</span>
      </Link>
      {t.due && <span className={`pill dot ${tone || 'info'}`}>{dueText(t)}</span>}
      <ArrowRight size={16} className="task-go" aria-hidden="true" />
    </li>
  );
}

export default function MyTasks() {
  const { db, user } = useStore();
  const [who, setWho] = useState(user.role === 'leitor' ? '' : user.name);
  const name = user.role === 'gestor' ? who : user.role === 'leitor' ? '' : user.name;
  const all = name ? tasksFor(db, name) : [];
  const late = all.filter((t) => (t.days ?? 1) < 0);
  const soon = all.filter((t) => t.days !== undefined && t.days >= 0 && t.days <= SOON_DAYS);
  const later = all.filter((t) => t.days === undefined || t.days > SOON_DAYS);
  const me = name === user.name;
  const group = (title: string, items: Task[], hint: string) => (
    <section className="card">
      <div className="card-h"><div><h2>{title}</h2><p className="how" style={{ margin: '2px 0 0' }}>{hint}</p></div><span className="muted" style={{ fontSize: 13 }}>{items.length}</span></div>
      {items.length ? <ul className="tasks">{items.map((t) => <TaskRow key={t.id} t={t} />)}</ul> : <p className="muted" style={{ margin: 0 }}>Nada aqui.</p>}
    </section>
  );
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>{me ? 'Minhas pendências' : `Pendências de ${name || '…'}`}</h1><p>Tudo que está sob responsabilidade {me ? 'sua' : 'dessa pessoa'}: não conformidades, ações do 5W2H, documentos a revisar, auditorias a conduzir, indicadores a lançar, riscos a reavaliar, decisões da direção, reclamações, aprovações de documentos e treinamentos a avaliar.</p></div>
        {user.role === 'gestor' && (
          <label className="field" style={{ minWidth: 240 }}><span>Ver pendências de</span>
            <select className="input" value={who} onChange={(e) => setWho(e.target.value)}>{people(db).map((p) => <option key={p}>{p}</option>)}</select>
          </label>
        )}
      </div>
      {user.role === 'leitor' ? <Empty>O perfil de leitor não tem pendências. Troque de perfil no topo da página para ver as pendências de outra pessoa.</Empty> : (
        <>
          <Headline tone={late.length ? 'bad' : soon.length ? 'warn' : 'ok'}
            title={late.length ? `${late.length} pendência${late.length === 1 ? ' vencida' : 's vencidas'}${soon.length ? ` e ${soon.length} vencendo nos próximos ${SOON_DAYS} dias` : ''}.` : soon.length ? `${soon.length} pendência${soon.length === 1 ? '' : 's'} vencendo nos próximos ${SOON_DAYS} dias.` : all.length ? 'Tudo em dia.' : 'Nenhuma pendência.'}>
            {all.length ? `${all.length} ${all.length === 1 ? 'item' : 'itens'} no total, do prazo mais curto para o mais longo.` : ''}
          </Headline>
          {all.length > 0 && <>
            {group('Vencidas', late, 'Passaram do prazo. Resolva ou renegocie o prazo com quem acompanha.')}
            {group(`Próximos ${SOON_DAYS} dias`, soon, 'Estas também aparecem no sino de notificações.')}
            {group('Mais adiante', later, 'Sem urgência por enquanto.')}
          </>}
        </>
      )}
    </div>
  );
}
