import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FilePlus2, Plus } from 'lucide-react';
import { useStore } from '../data/store';
import type { DocStatus, DocType } from '../data/types';
import { addMonths, daysBetween, docDueSoon, docOverdue, fmtDate, today } from '../data/utils';
import { Empty, Modal } from '../components/ui';

const TYPES: DocType[] = ['Manual', 'Procedimento', 'Instrução de trabalho', 'Formulário'];
const PREFIX: Record<DocType, string> = { Manual: 'MQ', Procedimento: 'PR', 'Instrução de trabalho': 'IT', Formulário: 'FR' };
const STATUS: Record<DocStatus, [string, string]> = { vigente: ['Vigente', 'ok'], revisao: ['Em revisão', 'warn'], obsoleto: ['Obsoleto', ''] };

function ReviewPill({ d }: { d: Parameters<typeof docOverdue>[0] }) {
  if (d.status === 'obsoleto') return <span className="muted">—</span>;
  if (docOverdue(d)) return <span className="pill dot bad">Venceu há {daysBetween(d.nextReview, today())} d</span>;
  if (docDueSoon(d)) return <span className="pill dot warn">Em {daysBetween(today(), d.nextReview)} dias</span>;
  return <span className="ink2">{fmtDate(d.nextReview)}</span>;
}

export default function Documents() {
  const { db, update } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('ativos');
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ title: '', type: 'Procedimento' as DocType, processId: db.processes[1].id, owner: '', summary: '' });
  const pname = (id: string) => db.processes.find((p) => p.id === id)?.name ?? '—';
  const rows = db.docs.filter((d) => (!type || d.type === type) && (status === 'todos' || (status === 'ativos' ? d.status !== 'obsoleto' : status === 'vencidos' ? docOverdue(d) : d.status === status))
    && (!q || `${d.code} ${d.title} ${d.owner}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.code.localeCompare(b.code));
  const create = () => {
    const pre = PREFIX[f.type];
    const n = db.docs.filter((d) => d.code.startsWith(pre + '-')).length + 1;
    const code = `${pre}-${String(n).padStart(3, '0')}`;
    update((d) => { d.docs.push({ id: code.toLowerCase(), code, ...f, status: 'vigente', version: 0, reviewedAt: today(), nextReview: addMonths(today(), 12), history: [{ version: 0, date: today(), author: f.owner, change: 'Emissão inicial.' }] }); });
    setCreating(false); nav(`/documentos/${code.toLowerCase()}`);
  };
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Documentos</h1><p>Procedimentos, instruções e formulários com controle de revisão (ISO 9001:2015, cláusula 7.5). Cada documento é revisado pelo menos uma vez por ano.</p></div>
        <button className="btn primary" onClick={() => setCreating(true)}><Plus />Novo documento</button>
      </div>
      <div className="toolbar">
        <input className="input search" type="search" placeholder="Buscar por código, título ou responsável" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo"><option value="">Todos os tipos</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Situação"><option value="ativos">Ativos</option><option value="vencidos">Revisão vencida</option><option value="revisao">Em revisão</option><option value="obsoleto">Obsoletos</option><option value="todos">Todos</option></select>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {rows.length ? (
          <div className="tscroll" style={{ border: 0 }}>
            <table>
              <thead><tr><th>Documento</th><th>Tipo</th><th>Processo</th><th>Revisão</th><th>Situação</th><th>Próxima revisão</th></tr></thead>
              <tbody>{rows.map((d) => (
                <tr key={d.id} className="link" onClick={() => nav(`/documentos/${d.id}`)}>
                  <td><Link to={`/documentos/${d.id}`} style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}><div className="t mono" style={{ fontSize: 13.5 }}>{d.code}</div><div className="s">{d.title}</div></Link></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{d.type}</td><td>{pname(d.processId)}</td>
                  <td className="mono">rev. {d.version}</td>
                  <td><span className={`pill dot ${STATUS[d.status][1]}`}>{STATUS[d.status][0]}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}><ReviewPill d={d} /></td>
                </tr>))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Nenhum documento com esses filtros.</Empty>}
      </div>
      {creating && (
        <Modal title="Novo documento" onClose={() => setCreating(false)} footer={<><button className="btn" onClick={() => setCreating(false)}>Cancelar</button><button className="btn primary" disabled={!f.title.trim() || !f.owner.trim()} onClick={create}>Criar</button></>}>
          <div className="form-grid">
            <label className="field full"><span>Título *</span><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
            <label className="field"><span>Tipo</span><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as DocType })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="field"><span>Processo</span><select className="input" value={f.processId} onChange={(e) => setF({ ...f, processId: e.target.value })}>{db.processes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="field full"><span>Responsável *</span><input className="input" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></label>
            <label className="field full"><span>Resumo</span><textarea className="input" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} placeholder="Para que serve o documento" /></label>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function DocumentDetail() {
  const { id } = useParams();
  const { db, update } = useStore();
  const [rev, setRev] = useState<{ change: string; author: string } | null>(null);
  const d = db.docs.find((x) => x.id === id);
  if (!d) return <div className="page"><Link className="crumb" to="/documentos"><ArrowLeft size={14} />Documentos</Link><Empty>Documento não encontrado.</Empty></div>;
  const p = db.processes.find((x) => x.id === d.processId);
  const mentions = db.ncs.filter((n) => `${n.description} ${n.rootCause} ${n.actions.map((a) => a.how).join(' ')}`.includes(d.code));
  const setStatus = (s: DocStatus) => update((db2) => { const x = db2.docs.find((y) => y.id === d.id); if (x) x.status = s; });
  const publish = () => {
    if (!rev) return;
    update((db2) => { const x = db2.docs.find((y) => y.id === d.id); if (!x) return; x.version += 1; x.reviewedAt = today(); x.nextReview = addMonths(today(), 12); x.status = 'vigente'; x.history.unshift({ version: x.version, date: today(), author: rev.author, change: rev.change }); });
    setRev(null);
  };
  return (
    <div className="page">
      <div>
        <Link className="crumb" to="/documentos"><ArrowLeft size={14} />Documentos</Link>
        <div className="page-head">
          <div>
            <h1><span className="mono" style={{ fontSize: 18, color: 'var(--muted)', marginRight: 10 }}>{d.code}</span>{d.title}</h1>
            <p>{d.summary}</p>
            <div className="meta-row" style={{ marginTop: 8 }}>
              <span className={`pill dot ${STATUS[d.status][1]}`}>{STATUS[d.status][0]}</span>
              <span>Tipo <b>{d.type}</b></span><span>Processo <b><Link to={`/processos/${d.processId}`}>{p?.name}</Link></b></span>
              <span>Revisão <b className="mono">{d.version}</b> de <b>{fmtDate(d.reviewedAt)}</b></span><span>Responsável <b>{d.owner}</b></span>
              <span>Próxima revisão <ReviewPill d={d} /></span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {d.status !== 'obsoleto' && <button className="btn primary" onClick={() => setRev({ change: '', author: d.owner })}><FilePlus2 />Publicar nova revisão</button>}
            {d.status === 'vigente' && <button className="btn" onClick={() => setStatus('revisao')}>Marcar em revisão</button>}
            {d.status !== 'obsoleto' ? <button className="btn ghost" onClick={() => setStatus('obsoleto')}>Tornar obsoleto</button> : <button className="btn" onClick={() => setStatus('vigente')}>Reativar</button>}
          </div>
        </div>
      </div>
      <div className="grid">
        <section className="card s8">
          <h2>Histórico de revisões</h2>
          <p className="how">Toda alteração gera uma nova revisão. A versão anterior deve ser recolhida dos postos.</p>
          <div className="tscroll"><table>
            <thead><tr><th>Rev.</th><th>Data</th><th>Autor</th><th>O que mudou</th></tr></thead>
            <tbody>{d.history.map((h) => <tr key={h.version}><td className="mono">{h.version}</td><td style={{ whiteSpace: 'nowrap' }}>{fmtDate(h.date)}</td><td style={{ whiteSpace: 'nowrap' }}>{h.author}</td><td>{h.change}</td></tr>)}</tbody>
          </table></div>
        </section>
        <section className="card s4">
          <h2>Citado em</h2>
          {mentions.length ? <ul className="list">{mentions.map((n) => <li key={n.id}><Link to={`/nao-conformidades/${n.id}`}><b>{n.code}</b><div className="s">{n.title}</div></Link></li>)}</ul> : <Empty>Nenhuma não conformidade cita este documento.</Empty>}
        </section>
      </div>
      {rev && (
        <Modal title={`Publicar revisão ${d.version + 1}`} onClose={() => setRev(null)} footer={<><button className="btn" onClick={() => setRev(null)}>Cancelar</button><button className="btn primary" disabled={!rev.change.trim()} onClick={publish}>Publicar</button></>}>
          <div className="form-grid">
            <label className="field full"><span>O que mudou *</span><textarea className="input" value={rev.change} onChange={(e) => setRev({ ...rev, change: e.target.value })} placeholder="Ex.: inclusão do recolhimento de cópias impressas (NC-2026-069)" /></label>
            <label className="field full"><span>Autor</span><input className="input" value={rev.author} onChange={(e) => setRev({ ...rev, author: e.target.value })} /></label>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>A próxima revisão fica programada para {fmtDate(addMonths(today(), 12))}.</p>
        </Modal>
      )}
    </div>
  );
}
