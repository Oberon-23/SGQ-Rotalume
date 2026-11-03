import { useState } from 'react';
import { Link } from 'react-router-dom';
import { History as HistoryIcon } from 'lucide-react';
import { useStore } from '../data/store';
import type { Entity, LogEntry } from '../data/types';
import { ENTITY_LABEL, ENTITY_PATH } from '../data/changes';
import { ROLE_LABEL } from '../data/access';

export const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

const VERB: Record<LogEntry['action'], string> = { criou: 'criou', alterou: 'alterou', excluiu: 'excluiu' };

export function LogLine({ e, showRecord }: { e: LogEntry; showRecord?: boolean }) {
  const { db } = useStore();
  const exists = e.action !== 'excluiu' && (db[e.entity] as { id: string }[]).some((r) => r.id === e.entityId);
  const rec = showRecord ? (exists ? <Link to={`${ENTITY_PATH[e.entity]}/${e.entityId}`}>{e.label}</Link> : <b>{e.label}</b>) : null;
  return (
    <li className="log-line">
      <div className="log-meta"><time dateTime={e.at}>{fmtDateTime(e.at)}</time><span><b>{e.user}</b> <span className="muted">· {ROLE_LABEL[e.role]}</span></span></div>
      <div className="log-what">
        {VERB[e.action]} {showRecord ? <>{ENTITY_LABEL[e.entity].toLowerCase()} {rec}</> : e.action === 'criou' ? 'o registro' : e.action === 'excluiu' ? 'o registro' : ''}
        {e.fields.length > 0 && (
          <ul>{e.fields.map((f, i) => <li key={i}><span className="lf">{f.field}:</span> <s>{f.from}</s> <span aria-hidden="true">→</span><span className="sr-only">para</span> <b>{f.to}</b></li>)}</ul>
        )}
      </div>
    </li>
  );
}

/** Histórico de alterações de um registro (trilha de auditoria). */
export default function History({ entity, id }: { entity: Entity; id: string }) {
  const { db } = useStore();
  const [all, setAll] = useState(false);
  const rows = db.log.filter((e) => e.entity === entity && e.entityId === id);
  const shown = all ? rows : rows.slice(0, 6);
  return (
    <section className="card">
      <div className="card-h">
        <div><h2><HistoryIcon size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />Histórico de alterações</h2>
          <p className="how" style={{ margin: '2px 0 0' }}>Quem alterou o quê e quando, com o valor anterior. Não pode ser editado.</p></div>
        <span className="muted" style={{ fontSize: 13 }}>{rows.length} registro{rows.length === 1 ? '' : 's'}</span>
      </div>
      {rows.length ? <ul className="log">{shown.map((e) => <LogLine key={e.id} e={e} />)}</ul> : <p className="muted" style={{ margin: 0 }}>Nenhuma alteração registrada ainda.</p>}
      {rows.length > 6 && <button className="btn small ghost" style={{ marginTop: 8 }} onClick={() => setAll(!all)}>{all ? 'Mostrar menos' : `Ver todos (${rows.length})`}</button>}
    </section>
  );
}
