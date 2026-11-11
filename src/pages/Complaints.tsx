import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Star, Trash2, TriangleAlert } from 'lucide-react';
import { useStore } from '../data/store';
import type { Complaint, ComplaintStatus } from '../data/types';
import { COMPLAINT_LABEL, complaintBlockers, complaintLate, complaintOpen, satisfaction } from '../data/quality';
import { addDays, daysBetween, fmtDate, today } from '../data/utils';
import { Confirm, Empty, Headline, Modal } from '../components/ui';
import { Pager, SortTh, useTable } from '../components/Table';
import History from '../components/History';
import { ReadOnlyNote } from '../components/DemoBar';
import { CodeTitle, Crumb, Missing } from '../components/bits';
import { newNC } from './NCList';

const StatusPill = ({ c }: { c: Complaint }) => <span className={`pill dot ${COMPLAINT_LABEL[c.status][1]}`}>{COMPLAINT_LABEL[c.status][0]}</span>;
const ValidPill = ({ v }: { v: boolean | null }) => v === null ? <span className="muted">A definir</span> : v ? <span className="pill warn">Procedente</span> : <span className="pill">Improcedente</span>;

function ComplaintForm({ onClose }: { onClose: () => void }) {
  const { db, update, notify, user } = useStore();
  const nav = useNavigate();
  const [f, setF] = useState({ customer: '', product: '', description: '', quantity: 0, receivedAt: today(), owner: user.role === 'gestor' ? 'Fernanda Lima' : user.name });
  const ok = f.customer.trim() && f.product.trim() && f.description.trim() && f.owner.trim();
  const save = () => {
    const year = f.receivedAt.slice(0, 4);
    const n = Math.max(0, ...db.complaints.filter((c) => c.code.startsWith(`RC-${year}-`)).map((c) => +c.code.slice(8) || 0)) + 1;
    const code = `RC-${year}-${String(n).padStart(2, '0')}`;
    update((d) => { d.complaints.push({ id: code.toLowerCase(), code, ...f, dueAt: addDays(f.receivedAt, 10), status: 'recebida', valid: null, response: '' }); });
    notify(`${code} registrada. Prazo de resposta: 10 dias.`);
    onClose(); nav(`/reclamacoes/${code.toLowerCase()}`);
  };
  return (
    <Modal title="Nova reclamação de cliente" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!ok} onClick={save}>Registrar</button></>}>
      <div className="form-grid">
        <label className="field"><span>Cliente *</span><input className="input" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} /></label>
        <label className="field"><span>Produto ou pedido *</span><input className="input" value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} /></label>
        <label className="field full"><span>O que o cliente relatou *</span><textarea className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <label className="field"><span>Peças afetadas</span><input className="input" type="number" min={0} value={f.quantity} onChange={(e) => setF({ ...f, quantity: Math.max(0, +e.target.value) })} /></label>
        <label className="field"><span>Recebida em</span><input className="input" type="date" value={f.receivedAt} onChange={(e) => setF({ ...f, receivedAt: e.target.value })} /></label>
        <label className="field"><span>Responsável *</span><input className="input" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></label>
      </div>
    </Modal>
  );
}

export default function Complaints() {
  const { db, can } = useStore();
  const nav = useNavigate();
  const [status, setStatus] = useState<'abertas' | 'todas' | ComplaintStatus>('abertas');
  const [creating, setCreating] = useState(false);
  const rows = db.complaints.filter((c) => status === 'todas' || (status === 'abertas' ? c.status !== 'encerrada' : c.status === status)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const t = useTable(rows, { code: (c: Complaint) => c.code, received: (c: Complaint) => c.receivedAt, due: (c: Complaint) => (complaintOpen(c) ? c.dueAt : ''), status: (c: Complaint) => Object.keys(COMPLAINT_LABEL).indexOf(c.status), valid: (c: Complaint) => (c.valid === null ? 2 : c.valid ? 0 : 1) });
  const open = db.complaints.filter(complaintOpen);
  const late = db.complaints.filter((c) => complaintLate(c));
  const decided = db.complaints.filter((c) => c.valid !== null);
  const sat = satisfaction(db.complaints);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Reclamações de clientes</h1><p>Registro, análise, resposta em até 10 dias e satisfação do cliente (ISO 9001:2015, cláusulas 8.2.1 e 9.1.2). Reclamação procedente vira não conformidade.</p></div>
        {can('create', 'complaints') && <button className="btn primary" onClick={() => setCreating(true)}><Plus />Nova reclamação</button>}
      </div>
      <Headline tone={late.length ? 'bad' : open.length ? 'warn' : 'ok'} title={late.length ? `${late.length} ${late.length === 1 ? 'reclamação passou' : 'reclamações passaram'} do prazo de resposta.` : open.length ? `${open.length} ${open.length === 1 ? 'reclamação aguarda' : 'reclamações aguardam'} resposta, todas no prazo.` : 'Nenhuma reclamação aguardando resposta.'}>
        {late.map((c) => `${c.code} (${c.customer})`).join('; ')}
      </Headline>
      <div className="tiles">
        <div className="tile"><span className="lab">Aguardando resposta</span><span className="val">{open.length}</span><span className="sub">{late.length} fora do prazo</span></div>
        <div className="tile"><span className="lab">Procedentes</span><span className="val">{decided.length ? Math.round((decided.filter((c) => c.valid).length / decided.length) * 100) : 0}%</span><span className="sub">das {decided.length} já analisadas</span></div>
        <div className="tile"><span className="lab">Satisfação após a resposta</span><span className="val">{sat ?? '—'}<small style={{ fontSize: 16, color: 'var(--muted)' }}> / 5</small></span><span className="sub">média das notas dos clientes</span></div>
      </div>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Situação">
          {([['abertas', 'Em andamento'], ['encerrada', 'Encerradas'], ['todas', 'Todas']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>)}
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {rows.length ? (
          <div className="tscroll" tabIndex={0} style={{ border: 0 }}>
            <table>
              <thead><tr><SortTh t={t} k="code">Reclamação</SortTh><SortTh t={t} k="received">Recebida</SortTh><SortTh t={t} k="due">Responder até</SortTh><SortTh t={t} k="valid">Procedência</SortTh><SortTh t={t} k="status">Situação</SortTh></tr></thead>
              <tbody>{t.view.map((c) => (
                <tr key={c.id} className="link" onClick={() => nav(`/reclamacoes/${c.id}`)}>
                  <td><Link to={`/reclamacoes/${c.id}`} style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}><div className="t">{c.customer}: {c.product}</div><div className="s"><span className="mono">{c.code}</span> · {c.owner}</div></Link></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(c.receivedAt)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{!complaintOpen(c) ? <span className="muted">—</span> : complaintLate(c) ? <span className="pill dot bad">Venceu há {daysBetween(c.dueAt, today())} d</span> : fmtDate(c.dueAt)}</td>
                  <td><ValidPill v={c.valid} /></td>
                  <td><StatusPill c={c} /></td>
                </tr>))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Nenhuma reclamação com esse filtro.</Empty>}
        {rows.length > 0 && <Pager t={t} noun="reclamações" />}
      </div>
      {creating && <ComplaintForm onClose={() => setCreating(false)} />}
    </div>
  );
}

export function ComplaintDetail() {
  const { id } = useParams();
  const { db, update, notify, can } = useStore();
  const nav = useNavigate();
  const [modal, setModal] = useState<'delete' | 'nc' | null>(null);
  const [ncProc, setNcProc] = useState('p03');
  const c = db.complaints.find((x) => x.id === id);
  if (!c) return <Missing to="/reclamacoes" back="Reclamações de clientes">Reclamação não encontrada.</Missing>;
  const canEdit = can('edit', 'complaints', c);
  const nc = db.ncs.find((n) => n.id === c.ncId);
  const set = (patch: Partial<Complaint>) => update((d) => { const x = d.complaints.find((y) => y.id === c.id); if (x) Object.assign(x, patch, x.status === 'recebida' && !patch.status ? { status: 'analise' } : {}); });
  const blockers = complaintBlockers(c);
  const openNC = () => {
    const n = newNC(db.ncs.map((x) => x.code), {
      title: `Reclamação de cliente: ${c.description.slice(0, 70)}`, description: `${c.customer}, ${c.product}. ${c.description}${c.quantity ? ` (${c.quantity} peças)` : ''}`,
      processId: ncProc, origin: 'Reclamação de cliente', severity: c.quantity > 50 ? 'Crítica' : 'Maior', owner: db.processes.find((p) => p.id === ncProc)?.owner ?? c.owner, dueAt: addDays(today(), 30), containment: '',
    });
    n.complaintId = c.id;
    update((d) => { d.ncs.push(n); const x = d.complaints.find((y) => y.id === c.id); if (x) { x.ncId = n.id; x.valid = true; if (x.status === 'recebida') x.status = 'analise'; } });
    notify(`${n.code} aberta a partir de ${c.code}.`);
    setModal(null);
  };
  const remove = () => { update((d) => { d.complaints = d.complaints.filter((y) => y.id !== c.id); d.ncs.forEach((n) => { if (n.complaintId === c.id) delete n.complaintId; }); }); notify(`${c.code} excluída.`); nav('/reclamacoes'); };
  return (
    <div className="page">
      <div>
        <Crumb to="/reclamacoes">Reclamações de clientes</Crumb>
        <div className="page-head">
          <div>
            <CodeTitle code={c.code}>{c.customer}: {c.product}</CodeTitle>
            <div className="meta-row" style={{ marginTop: 8 }}>
              <StatusPill c={c} /><ValidPill v={c.valid} />
              {complaintLate(c) && <span className="pill dot bad">Resposta vencida há {daysBetween(c.dueAt, today())} dias</span>}
              <span>Recebida em <b>{fmtDate(c.receivedAt)}</b></span><span>Responder até <b>{fmtDate(c.dueAt)}</b></span>
              <span>Responsável <b>{c.owner}</b></span>{c.quantity > 0 && <span>Peças afetadas <b>{c.quantity}</b></span>}
            </div>
          </div>
          {can('delete', 'complaints', c) && <div className="head-actions"><button className="btn ghost danger" onClick={() => setModal('delete')} aria-label="Excluir reclamação"><Trash2 />Excluir</button></div>}
        </div>
      </div>
      <ReadOnlyNote show={!canEdit} />
      <div className="grid">
        <section className="card s7">
          <h2>Tratamento</h2>
          <p className="how">Do relato à resposta: decida a procedência, abra a não conformidade quando for procedente e responda ao cliente.</p>
          <dl className="kv"><dt>Relato do cliente</dt><dd>{c.description}</dd></dl>
          <ol className="flow">
            <li>
              <b>1. A reclamação procede?</b>
              <div className="seg" role="group" aria-label="Procedência">
                {([[true, 'Procedente'], [false, 'Improcedente']] as const).map(([v, l]) => <button key={l} type="button" disabled={!canEdit || c.status === 'encerrada'} aria-pressed={c.valid === v} onClick={() => set({ valid: v })}>{l}</button>)}
              </div>
            </li>
            <li>
              <b>2. Não conformidade</b>
              {nc ? <span><Link to={`/nao-conformidades/${nc.id}`}><b>{nc.code}</b></Link> <span className="ink2">{nc.title}</span></span>
                : c.valid === false ? <span className="muted">Não precisa: reclamação improcedente.</span>
                  : canEdit && c.status !== 'encerrada' ? <button className="btn small" onClick={() => setModal('nc')}><TriangleAlert />Abrir não conformidade</button> : <span className="muted">—</span>}
            </li>
            <li>
              <b>3. Resposta ao cliente</b>
              <textarea className="input" rows={4} disabled={!canEdit || c.status === 'encerrada' || c.status === 'respondida'} value={c.response} onChange={(e) => set({ response: e.target.value })} placeholder="O que foi feito, a causa e como o problema não volta a acontecer." aria-label="Resposta ao cliente" />
            </li>
          </ol>
          {canEdit && complaintOpen(c) && (
            <div className="advance">
              {blockers.length ? <ul className="blockers">{blockers.map((b) => <li key={b}>{b}</li>)}</ul> : null}
              <button className="btn primary" disabled={blockers.length > 0} onClick={() => { set({ status: 'respondida' }); notify(`${c.code}: resposta registrada.`); }}>Registrar resposta enviada</button>
            </div>
          )}
          {canEdit && c.status === 'respondida' && (
            <div className="advance">
              <span className="field"><span>Nota do cliente para o atendimento (1 a 5)</span>
                <span className="stars" role="group" aria-label="Satisfação do cliente">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} de 5`} aria-pressed={(c.satisfaction ?? 0) >= n} onClick={() => set({ satisfaction: n })}><Star /></button>)}</span>
              </span>
              <button className="btn primary" disabled={!c.satisfaction} onClick={() => { set({ status: 'encerrada' }); notify(`${c.code} encerrada.`); }}>Encerrar reclamação</button>
            </div>
          )}
          {c.status === 'encerrada' && c.satisfaction && <p className="ink2" style={{ marginTop: 14 }}>Nota do cliente: <b>{c.satisfaction} de 5</b>.</p>}
        </section>
        <section className="card s5">
          <h2>Histórico deste cliente</h2>
          {(() => { const others = db.complaints.filter((x) => x.customer === c.customer && x.id !== c.id); return others.length ? (
            <ul className="list">{others.map((x) => <li key={x.id}><Link to={`/reclamacoes/${x.id}`} style={{ minWidth: 0 }}><b>{x.code}</b><div className="s">{x.product} · {fmtDate(x.receivedAt)}</div></Link><StatusPill c={x} /></li>)}</ul>
          ) : <Empty>Primeira reclamação deste cliente.</Empty>; })()}
        </section>
      </div>
      <History entity="complaints" id={c.id} />
      {modal === 'nc' && (
        <Modal title={`Abrir não conformidade para ${c.code}`} onClose={() => setModal(null)} footer={<><button className="btn" onClick={() => setModal(null)}>Cancelar</button><button className="btn primary" onClick={openNC}>Abrir NC</button></>}>
          <p className="ink2" style={{ margin: 0 }}>A NC nasce com o relato do cliente, origem "Reclamação de cliente" e prazo de 30 dias. O dono do processo escolhido fica responsável.</p>
          <label className="field"><span>Processo onde o problema aconteceu</span><select className="input" value={ncProc} onChange={(e) => setNcProc(e.target.value)}>{db.processes.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
        </Modal>
      )}
      {modal === 'delete' && <Confirm title={`Excluir ${c.code}?`} onClose={() => setModal(null)} onConfirm={remove}><p>A reclamação sai do registro. A não conformidade ligada a ela continua existindo.</p></Confirm>}
    </div>
  );
}
