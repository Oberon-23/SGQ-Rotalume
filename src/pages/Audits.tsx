import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Plus, TriangleAlert } from 'lucide-react';
import { nextCode, useStore } from '../data/store';
import { auditChecklist } from '../data/seed';
import type { AuditItem, AuditResult } from '../data/types';
import { addDays, auditFindings, daysBetween, fmtDate, today } from '../data/utils';
import { Empty, Modal } from '../components/ui';
import { newNC } from './NCList';

const RES: { v: Exclude<AuditResult, null>; label: string; long: string }[] = [
  { v: 'C', label: 'C', long: 'Conforme' },
  { v: 'NC', label: 'NC', long: 'Não conformidade' },
  { v: 'OBS', label: 'OBS', long: 'Observação' },
  { v: 'OM', label: 'OM', long: 'Oportunidade de melhoria' },
];

export default function Audits() {
  const { db, update } = useStore();
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ processId: db.processes[0].id, auditor: '', date: addDays(today(), 30), scope: '' });
  const pname = (id: string) => db.processes.find((p) => p.id === id)?.name ?? '—';
  const list = [...db.audits].sort((a, b) => (a.done === b.done ? (a.done ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)) : a.done ? 1 : -1));
  const done = db.audits.filter((a) => a.done);
  const totals = done.reduce((s, a) => { const x = auditFindings(a); return { nc: s.nc + x.nc, obs: s.obs + x.obs, om: s.om + x.om }; }, { nc: 0, obs: 0, om: 0 });
  const covered = new Set(db.audits.map((a) => a.processId)).size;
  const create = () => {
    const code = nextCode(db.audits.map((a) => a.code), 'AUD');
    update((d) => { d.audits.push({ id: code.toLowerCase(), code, done: false, items: auditChecklist(), ...f }); });
    setCreating(false); nav(`/auditorias/${code.toLowerCase()}`);
  };
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Auditorias internas</h1><p>Programa de auditorias por processo, com checklist dos requisitos da ISO 9001:2015 (cláusula 9.2).</p></div>
        <button className="btn primary" onClick={() => setCreating(true)}><Plus />Programar auditoria</button>
      </div>
      <div className="tiles">
        <div className="tile"><span className="lab">Realizadas</span><span className="val">{done.length}</span><span className="sub">de {db.audits.length} no programa</span></div>
        <div className="tile"><span className="lab">Processos cobertos</span><span className="val">{covered}/{db.processes.length}</span><span className="sub">auditados ou programados</span></div>
        <div className="tile"><span className="lab">Constatações</span><span className="val">{totals.nc + totals.obs + totals.om}</span><span className="sub">{totals.nc} NC · {totals.obs} observações · {totals.om} melhorias</span></div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="tscroll" style={{ border: 0 }}>
          <table>
            <thead><tr><th>Auditoria</th><th>Processo</th><th>Data</th><th>Auditor</th><th>Situação</th><th>Constatações</th></tr></thead>
            <tbody>
              {list.map((a) => { const x = auditFindings(a); const soon = !a.done && daysBetween(today(), a.date) <= 15; return (
                <tr key={a.id} className="link" onClick={() => nav(`/auditorias/${a.id}`)}>
                  <td><Link to={`/auditorias/${a.id}`} style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}><div className="t">{a.code}</div><div className="s">{a.scope}</div></Link></td>
                  <td>{pname(a.processId)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.date)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{a.auditor}</td>
                  <td>{a.done ? <span className="pill dot ok">Realizada</span> : a.date < today() ? <span className="pill dot bad">Atrasada</span> : <span className={`pill dot ${soon ? 'warn' : 'info'}`}>{soon ? `Em ${daysBetween(today(), a.date)} dias` : 'Programada'}</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{a.done ? <span className="ink2">{x.nc} NC · {x.obs} OBS · {x.om} OM</span> : <span className="muted">—</span>}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      </div>
      {creating && (
        <Modal title="Programar auditoria interna" onClose={() => setCreating(false)} footer={<><button className="btn" onClick={() => setCreating(false)}>Cancelar</button><button className="btn primary" disabled={!f.auditor.trim()} onClick={create}>Programar</button></>}>
          <div className="form-grid">
            <label className="field full"><span>Processo auditado</span><select className="input" value={f.processId} onChange={(e) => setF({ ...f, processId: e.target.value })}>{db.processes.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
            <label className="field"><span>Auditor *</span><input className="input" value={f.auditor} onChange={(e) => setF({ ...f, auditor: e.target.value })} placeholder="Não pode auditar o próprio trabalho" /></label>
            <label className="field"><span>Data</span><input className="input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
            <label className="field full"><span>Escopo</span><textarea className="input" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} placeholder="O que será verificado" /></label>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>O checklist com 10 requisitos da ISO 9001 é criado automaticamente.</p>
        </Modal>
      )}
    </div>
  );
}

export function AuditDetail() {
  const { id } = useParams();
  const { db, update } = useStore();
  const nav = useNavigate();
  const a = db.audits.find((x) => x.id === id);
  if (!a) return <div className="page"><Link className="crumb" to="/auditorias"><ArrowLeft size={14} />Auditorias</Link><Empty>Auditoria não encontrada.</Empty></div>;
  const p = db.processes.find((x) => x.id === a.processId)!;
  const x = auditFindings(a);
  const setItem = (itemId: string, fn: (i: AuditItem) => void) => update((d) => { const i = d.audits.find((y) => y.id === a.id)?.items.find((y) => y.id === itemId); if (i) fn(i); });
  const openNC = (itemId: string) => {
    const item = a.items.find((i) => i.id === itemId)!;
    const nc = newNC(db.ncs.map((n) => n.code), {
      title: `Constatação da ${a.code}: requisito ${item.clause}`, description: `${item.requirement}\nEvidência: ${item.evidence || '(descrever)'}`,
      processId: a.processId, origin: 'Auditoria interna', severity: 'Menor', owner: p.owner, dueAt: addDays(today(), 30), containment: '', auditId: a.id,
    });
    update((d) => { d.ncs.unshift(nc); const i = d.audits.find((y) => y.id === a.id)?.items.find((y) => y.id === itemId); if (i) i.ncId = nc.id; });
    nav(`/nao-conformidades/${nc.id}`);
  };
  return (
    <div className="page">
      <div>
        <Link className="crumb" to="/auditorias"><ArrowLeft size={14} />Auditorias</Link>
        <div className="page-head">
          <div>
            <h1><span className="mono" style={{ fontSize: 18, color: 'var(--muted)', marginRight: 10 }}>{a.code}</span>Auditoria em {p.name}</h1>
            <p>{a.scope}</p>
            <div className="meta-row" style={{ marginTop: 8 }}>
              {a.done ? <span className="pill dot ok">Realizada</span> : <span className="pill dot info">Programada</span>}
              <span>Data <b>{fmtDate(a.date)}</b></span><span>Auditor <b>{a.auditor}</b></span><span>Dono do processo <b>{p.owner}</b></span>
            </div>
          </div>
          {!a.done ? <button className="btn primary" disabled={x.pending > 0} title={x.pending ? 'Avalie todos os requisitos' : ''} onClick={() => update((d) => { const y = d.audits.find((z) => z.id === a.id); if (y) { y.done = true; y.date = y.date > today() ? today() : y.date; } })}><Check />Concluir auditoria</button>
            : <button className="btn" onClick={() => update((d) => { const y = d.audits.find((z) => z.id === a.id); if (y) y.done = false; })}>Reabrir</button>}
        </div>
      </div>
      <div className="tiles">
        <div className="tile"><span className="lab">Avaliados</span><span className="val">{a.items.length - x.pending}/{a.items.length}</span><span className="sub">requisitos do checklist</span></div>
        <div className="tile"><span className="lab">Não conformidades</span><span className="val" style={{ color: x.nc ? 'var(--bad)' : undefined }}>{x.nc}</span><span className="sub">{a.items.filter((i) => i.result === 'NC' && i.ncId).length} com tratamento aberto</span></div>
        <div className="tile"><span className="lab">Observações</span><span className="val">{x.obs}</span><span className="sub">pontos de atenção</span></div>
        <div className="tile"><span className="lab">Melhorias</span><span className="val">{x.om}</span><span className="sub">oportunidades sugeridas</span></div>
      </div>
      <section className="card">
        <h2>Checklist ISO 9001:2015</h2>
        <p className="how"><b>C</b> conforme · <b>NC</b> não conformidade · <b>OBS</b> observação · <b>OM</b> oportunidade de melhoria. Toda NC precisa de tratamento.</p>
        {a.items.map((i) => (
          <div key={i.id} className="check-row">
            <span className="clause">{i.clause}</span>
            <span style={{ fontSize: 14 }}>{i.requirement}</span>
            <div className="seg res-seg" role="group" aria-label={`Resultado do requisito ${i.clause}`}>
              {RES.map((r) => <button key={r.v} type="button" className={`r-${r.v}`} title={r.long} aria-label={r.long} aria-pressed={i.result === r.v} disabled={a.done} onClick={() => setItem(i.id, (y) => { y.result = y.result === r.v ? null : r.v; })}>{r.label}</button>)}
            </div>
            <div className="evid" style={{ display: 'grid', gap: 8 }}>
              <textarea className="input" style={{ minHeight: 44 }} disabled={a.done} value={i.evidence} onChange={(e) => setItem(i.id, (y) => { y.evidence = e.target.value; })} placeholder="Evidência objetiva: o que foi visto, onde, documento, registro" aria-label={`Evidência do requisito ${i.clause}`} />
              {i.result === 'NC' && (i.ncId
                ? <Link to={`/nao-conformidades/${i.ncId}`} className="pill dot bad" style={{ justifySelf: 'start', textDecoration: 'none' }}>Tratamento: {db.ncs.find((n) => n.id === i.ncId)?.code ?? 'não encontrado'}</Link>
                : <button className="btn small" style={{ justifySelf: 'start' }} onClick={() => openNC(i.id)}><TriangleAlert />Abrir não conformidade</button>)}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
