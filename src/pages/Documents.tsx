import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FilePlus2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../data/store';
import type { Doc, DocStatus, DocType } from '../data/types';
import { addMonths, daysBetween, docDueSoon, docOverdue, fmtDate, today } from '../data/utils';
import { Confirm, Empty, Modal } from '../components/ui';
import History from '../components/History';
import { ReadOnlyNote } from '../components/DemoBar';

const TYPES: DocType[] = ['Manual', 'Procedimento', 'Instrução de trabalho', 'Formulário'];
const PREFIX: Record<DocType, string> = { Manual: 'MQ', Procedimento: 'PR', 'Instrução de trabalho': 'IT', Formulário: 'FR' };
const STATUS: Record<DocStatus, [string, string]> = { vigente: ['Vigente', 'ok'], revisao: ['Em revisão', 'warn'], obsoleto: ['Obsoleto', ''] };

function ReviewPill({ d }: { d: Parameters<typeof docOverdue>[0] }) {
  if (d.status === 'obsoleto') return <span className="muted">—</span>;
  if (docOverdue(d)) return <span className="pill dot bad">Venceu há {daysBetween(d.nextReview, today())} d</span>;
  if (docDueSoon(d)) return <span className="pill dot warn">Em {daysBetween(today(), d.nextReview)} dias</span>;
  return <span className="ink2">{fmtDate(d.nextReview)}</span>;
}

/** Criar documento ou editar os dados de um existente. */
function DocForm({ initial, onClose }: { initial?: Doc; onClose: () => void }) {
  const { db, update, notify } = useStore();
  const nav = useNavigate();
  const [f, setF] = useState(initial
    ? { title: initial.title, type: initial.type, processId: initial.processId, owner: initial.owner, summary: initial.summary, nextReview: initial.nextReview }
    : { title: '', type: 'Procedimento' as DocType, processId: db.processes[0]?.id ?? '', owner: '', summary: '', nextReview: addMonths(today(), 12) });
  const save = () => {
    if (initial) {
      update((d) => { const x = d.docs.find((y) => y.id === initial.id); if (x) Object.assign(x, f); });
      notify('Documento atualizado.'); onClose(); return;
    }
    const pre = PREFIX[f.type];
    const n = Math.max(0, ...db.docs.filter((d) => d.code.startsWith(pre + '-')).map((d) => +d.code.slice(pre.length + 1) || 0)) + 1;
    const code = `${pre}-${String(n).padStart(3, '0')}`;
    update((d) => { d.docs.push({ id: code.toLowerCase(), code, ...f, status: 'vigente', version: 0, reviewedAt: today(), history: [{ version: 0, date: today(), author: f.owner, change: 'Emissão inicial.' }] }); });
    notify(`${code} criado.`);
    onClose(); nav(`/documentos/${code.toLowerCase()}`);
  };
  return (
    <Modal title={initial ? `Editar ${initial.code}` : 'Novo documento'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!f.title.trim() || !f.owner.trim() || !f.processId || !f.nextReview} onClick={save}>{initial ? 'Salvar' : 'Criar'}</button></>}>
      <div className="form-grid">
        <label className="field full"><span>Título *</span><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label className="field"><span>Tipo</span><select className="input" value={f.type} disabled={!!initial} onChange={(e) => setF({ ...f, type: e.target.value as DocType })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="field"><span>Processo</span><select className="input" value={f.processId} onChange={(e) => setF({ ...f, processId: e.target.value })}>{db.processes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="field"><span>Responsável *</span><input className="input" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></label>
        <label className="field"><span>Próxima revisão</span><input className="input" type="date" value={f.nextReview} onChange={(e) => setF({ ...f, nextReview: e.target.value })} /></label>
        <label className="field full"><span>Resumo</span><textarea className="input" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} placeholder="Para que serve o documento" /></label>
      </div>
      {initial && <p className="muted" style={{ margin: 0, fontSize: 13 }}>O tipo define o código ({initial.code}) e não muda. Alterações no conteúdo do documento devem gerar uma nova revisão.</p>}
    </Modal>
  );
}

export default function Documents() {
  const { db, can } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('ativos');
  const [creating, setCreating] = useState(false);
  const pname = (id: string) => db.processes.find((p) => p.id === id)?.name ?? '—';
  const rows = db.docs.filter((d) => (!type || d.type === type) && (status === 'todos' || (status === 'ativos' ? d.status !== 'obsoleto' : status === 'vencidos' ? docOverdue(d) : d.status === status))
    && (!q || `${d.code} ${d.title} ${d.owner}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.code.localeCompare(b.code));
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Documentos</h1><p>Procedimentos, instruções e formulários com controle de revisão (ISO 9001:2015, cláusula 7.5). Cada documento é revisado pelo menos uma vez por ano.</p></div>
        {can('create', 'docs') && <button className="btn primary" onClick={() => setCreating(true)}><Plus />Novo documento</button>}
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
      {creating && <DocForm onClose={() => setCreating(false)} />}
    </div>
  );
}

export function DocumentDetail() {
  const { id } = useParams();
  const { db, update, notify, can } = useStore();
  const nav = useNavigate();
  const [rev, setRev] = useState<{ change: string; author: string } | null>(null);
  const [modal, setModal] = useState<'edit' | 'delete' | null>(null);
  const d = db.docs.find((x) => x.id === id);
  if (!d) return <div className="page"><Link className="crumb" to="/documentos"><ArrowLeft size={14} />Documentos</Link><Empty>Documento não encontrado.</Empty></div>;
  const p = db.processes.find((x) => x.id === d.processId);
  const canEdit = can('edit', 'docs', d);
  const mentions = db.ncs.filter((n) => `${n.description} ${n.rootCause} ${n.actions.map((a) => a.how).join(' ')}`.includes(d.code));
  const setStatus = (s: DocStatus) => update((db2) => { const x = db2.docs.find((y) => y.id === d.id); if (x) x.status = s; });
  const publish = () => {
    if (!rev) return;
    update((db2) => { const x = db2.docs.find((y) => y.id === d.id); if (!x) return; x.version += 1; x.reviewedAt = today(); x.nextReview = addMonths(today(), 12); x.status = 'vigente'; x.history.unshift({ version: x.version, date: today(), author: rev.author, change: rev.change }); });
    notify(`Revisão ${d.version + 1} de ${d.code} publicada.`);
    setRev(null);
  };
  const remove = () => { update((db2) => { db2.docs = db2.docs.filter((y) => y.id !== d.id); }); notify(`${d.code} excluído.`); nav('/documentos'); };
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
          {canEdit && <div className="head-actions">
            {d.status !== 'obsoleto' && <button className="btn primary" onClick={() => setRev({ change: '', author: d.owner })}><FilePlus2 />Publicar nova revisão</button>}
            {d.status === 'vigente' && <button className="btn" onClick={() => setStatus('revisao')}>Marcar em revisão</button>}
            {d.status !== 'obsoleto' ? <button className="btn ghost" onClick={() => setStatus('obsoleto')}>Tornar obsoleto</button> : <button className="btn" onClick={() => setStatus('vigente')}>Reativar</button>}
            <button className="btn" onClick={() => setModal('edit')}><Pencil />Editar</button>
            {can('delete', 'docs', d) && <button className="btn ghost danger" onClick={() => setModal('delete')} aria-label="Excluir documento"><Trash2 />Excluir</button>}
          </div>}
        </div>
      </div>
      <ReadOnlyNote show={!canEdit} />
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
      <History entity="docs" id={d.id} />
      {modal === 'edit' && <DocForm initial={d} onClose={() => setModal(null)} />}
      {modal === 'delete' && (
        <Confirm title={`Excluir ${d.code}?`} onClose={() => setModal(null)} onConfirm={remove}>
          <p>O documento e todo o histórico de revisões serão apagados. Se ele só deixou de ser usado, prefira "Tornar obsoleto", que mantém o registro.</p>
        </Confirm>
      )}
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
