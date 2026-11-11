import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FilePlus2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../data/store';
import type { ApprovalEvent, Doc, DocStatus, DocType } from '../data/types';
import { STEPS, STEP_LABEL, advance, approvalProblems, canActOnApproval, cancelRevision, sendBack, startRevision, stepOwner } from '../data/quality';
import { addMonths, daysBetween, docDueSoon, docOverdue, fmtDate, today } from '../data/utils';
import { Confirm, Empty, Modal } from '../components/ui';
import { Pager, SortTh, useTable } from '../components/Table';
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

const DOC_COLS = (pname: (id: string) => string) => ({
  code: (d: Doc) => d.code, type: (d: Doc) => d.type, proc: (d: Doc) => pname(d.processId), ver: (d: Doc) => d.version, status: (d: Doc) => d.status, next: (d: Doc) => (d.status === 'obsoleto' ? '' : d.nextReview),
});

export default function Documents() {
  const { db, can } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('ativos');
  const [creating, setCreating] = useState(false);
  const pname = (id: string) => db.processes.find((p) => p.id === id)?.name ?? '—';
  const rows = db.docs.filter((d) => (!type || d.type === type) && (status === 'todos' || (status === 'ativos' ? d.status !== 'obsoleto' : status === 'vencidos' ? docOverdue(d) : status === 'aprovacao' ? !!d.approval : d.status === status))
    && (!q || `${d.code} ${d.title} ${d.owner}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.code.localeCompare(b.code));
  const t = useTable(rows, DOC_COLS(pname));
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Documentos</h1><p>Procedimentos, instruções e formulários com controle de revisão (ISO 9001:2015, cláusula 7.5). Cada documento é revisado pelo menos uma vez por ano, e toda revisão passa por elaboração, revisão técnica e aprovação.</p></div>
        {can('create', 'docs') && <button className="btn primary" onClick={() => setCreating(true)}><Plus />Novo documento</button>}
      </div>
      <div className="toolbar">
        <input className="input search" type="search" placeholder="Buscar por código, título ou responsável" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo"><option value="">Todos os tipos</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Situação"><option value="ativos">Ativos</option><option value="vencidos">Revisão vencida</option><option value="revisao">Em revisão</option><option value="aprovacao">Aguardando aprovação</option><option value="obsoleto">Obsoletos</option><option value="todos">Todos</option></select>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {rows.length ? (
          <div className="tscroll" tabIndex={0} style={{ border: 0 }}>
            <table>
              <thead><tr><SortTh t={t} k="code">Documento</SortTh><SortTh t={t} k="type">Tipo</SortTh><SortTh t={t} k="proc">Processo</SortTh><SortTh t={t} k="ver">Revisão</SortTh><SortTh t={t} k="status">Situação</SortTh><SortTh t={t} k="next">Próxima revisão</SortTh></tr></thead>
              <tbody>{t.view.map((d) => (
                <tr key={d.id} className="link" onClick={() => nav(`/documentos/${d.id}`)}>
                  <td><Link to={`/documentos/${d.id}`} style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}><div className="t mono" style={{ fontSize: 13.5 }}>{d.code}</div><div className="s">{d.title}</div></Link></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{d.type}</td><td>{pname(d.processId)}</td>
                  <td className="mono">rev. {d.version}</td>
                  <td>{d.approval ? <span className="pill dot warn">{STEP_LABEL[d.approval.step]}</span> : <span className={`pill dot ${STATUS[d.status][1]}`}>{STATUS[d.status][0]}</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><ReviewPill d={d} /></td>
                </tr>))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Nenhum documento com esses filtros.</Empty>}
        {rows.length > 0 && <Pager t={t} noun="documentos" />}
      </div>
      {creating && <DocForm onClose={() => setCreating(false)} />}
    </div>
  );
}

function StartRevision({ d, onClose }: { d: Doc; onClose: () => void }) {
  const { db, update, notify, user } = useStore();
  const people = [...new Set([...db.processes.map((p) => p.owner), 'Marina Lopes', 'Rafael Duarte', 'Diego Moraes'])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const procOwner = db.processes.find((p) => p.id === d.processId)?.owner ?? '';
  const [f, setF] = useState({ change: '', author: d.owner, reviewer: procOwner !== d.owner ? procOwner : 'Rafael Duarte', approver: d.owner === 'Marina Lopes' ? 'Eduardo Campos' : 'Marina Lopes' });
  const problems = approvalProblems(f);
  const save = () => { update((x) => { const y = x.docs.find((z) => z.id === d.id); if (y) startRevision(y, f, user.name); }); notify(`Revisão ${d.version + 1} de ${d.code} aberta. Etapa: elaboração.`); onClose(); };
  return (
    <Modal title={`Abrir a revisão ${d.version + 1} de ${d.code}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={problems.length > 0} onClick={save}>Abrir revisão</button></>}>
      <datalist id="people">{people.map((n) => <option key={n} value={n} />)}</datalist>
      <div className="form-grid">
        <label className="field full"><span>O que muda *</span><textarea className="input" value={f.change} onChange={(e) => setF({ ...f, change: e.target.value })} placeholder="Ex.: inclusão do recolhimento de cópias impressas (NC-2026-069)" /></label>
        <label className="field"><span>Elabora</span><input className="input" list="people" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} /></label>
        <label className="field"><span>Revisão técnica</span><input className="input" list="people" value={f.reviewer} onChange={(e) => setF({ ...f, reviewer: e.target.value })} /></label>
        <label className="field"><span>Aprovação final</span><input className="input" list="people" value={f.approver} onChange={(e) => setF({ ...f, approver: e.target.value })} /></label>
      </div>
      {problems.length > 0 && f.change.trim() !== '' && <ul className="blockers">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>Durante a revisão, a versão {d.version} continua valendo nos postos. A nova revisão só vale depois da aprovação final.</p>
    </Modal>
  );
}

const EVENT_LABEL: Record<ApprovalEvent['kind'], string> = { iniciou: 'abriu a revisão', enviou: 'enviou para revisão técnica', aprovou: 'aprovou a revisão técnica', devolveu: 'devolveu para ajuste', publicou: 'publicou' };

function ApprovalCard({ d }: { d: Doc }) {
  const { update, notify, user } = useStore();
  const [text, setText] = useState('');
  const a = d.approval!;
  const mine = canActOnApproval(d, user);
  const idx = STEPS.indexOf(a.step);
  const owner = stepOwner(d);
  const go = () => {
    let published = false;
    update((x) => { const y = x.docs.find((z) => z.id === d.id); if (y) published = advance(y, user.name, text.trim()); });
    notify(published || a.step === 'aprovacao' ? `Revisão ${d.version + 1} de ${d.code} aprovada e publicada.` : a.step === 'elaboracao' ? 'Enviado para revisão técnica.' : 'Revisão técnica aprovada. Falta a aprovação final.');
    setText('');
  };
  const back = () => { update((x) => { const y = x.docs.find((z) => z.id === d.id); if (y) sendBack(y, user.name, text.trim()); }); notify('Devolvido para ajuste na elaboração.'); setText(''); };
  const cancel = () => { update((x) => { const y = x.docs.find((z) => z.id === d.id); if (y) cancelRevision(y); }); notify('Revisão cancelada. A versão vigente continua valendo.'); };
  const label = a.step === 'elaboracao' ? 'Enviar para revisão técnica' : a.step === 'revisao' ? 'Aprovar revisão técnica' : 'Aprovar e publicar';
  return (
    <section className="card approval">
      <div className="card-h"><div><h2>Revisão {d.version + 1} em andamento</h2><p className="how" style={{ margin: '2px 0 0' }}>{a.change}</p></div></div>
      <ol className="appr-steps" aria-label="Etapas da aprovação">
        {STEPS.map((s, i) => (
          <li key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''} aria-current={i === idx ? 'step' : undefined}>
            <b>{STEP_LABEL[s]}</b><span>{s === 'elaboracao' ? a.author : s === 'revisao' ? a.reviewer : a.approver}</span>
          </li>
        ))}
        <li className=""><b>Publicada</b><span>vira a revisão vigente</span></li>
      </ol>
      <div className="grid" style={{ marginTop: 14 }}>
        <div className="s7">
          {mine ? (
            <div className="appr-act">
              <label className="field"><span>Comentário {a.step !== 'elaboracao' ? '(obrigatório para devolver)' : ''}</span><textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={a.step === 'elaboracao' ? 'Opcional' : 'O que foi conferido, ou o que precisa ser ajustado'} /></label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn primary" onClick={go}>{label}</button>
                {a.step !== 'elaboracao' && <button className="btn" disabled={!text.trim()} onClick={back}>Devolver para ajuste</button>}
                {a.step === 'elaboracao' && <button className="btn ghost" onClick={cancel}>Cancelar revisão</button>}
              </div>
              {user.name !== owner && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Você está agindo como gestão da qualidade. Esta etapa é de {owner}.</p>}
            </div>
          ) : <p className="ink2" style={{ margin: 0 }}>Aguardando <b>{owner}</b> ({STEP_LABEL[a.step].toLowerCase()}). {user.role === 'leitor' ? '' : 'Troque de perfil no topo da página para agir como outra pessoa.'}</p>}
        </div>
        <div className="s5">
          <ul className="timeline">
            {a.events.map((e, i) => <li key={i}><b>{e.user}</b> {EVENT_LABEL[e.kind]} <span className="muted">· {new Date(e.at).toLocaleDateString('pt-BR')}</span>{e.text && <div className="ink2">{e.text}</div>}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function DocumentDetail() {
  const { id } = useParams();
  const { db, update, notify, can } = useStore();
  const nav = useNavigate();
  const [modal, setModal] = useState<'edit' | 'delete' | 'revise' | null>(null);
  const d = db.docs.find((x) => x.id === id);
  if (!d) return <div className="page"><Link className="crumb" to="/documentos"><ArrowLeft size={14} />Documentos</Link><Empty>Documento não encontrado.</Empty></div>;
  const p = db.processes.find((x) => x.id === d.processId);
  const canEdit = can('edit', 'docs', d);
  const mentions = db.ncs.filter((n) => `${n.description} ${n.rootCause} ${n.actions.map((a) => a.how).join(' ')}`.includes(d.code));
  const trainings = db.trainings.filter((t) => t.docId === d.id);
  const setStatus = (s: DocStatus) => update((db2) => { const x = db2.docs.find((y) => y.id === d.id); if (x) x.status = s; });
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
              <span>Revisão vigente <b className="mono">{d.version}</b> de <b>{fmtDate(d.reviewedAt)}</b></span><span>Responsável <b>{d.owner}</b></span>
              <span>Próxima revisão <ReviewPill d={d} /></span>
            </div>
          </div>
          {canEdit && <div className="head-actions">
            {d.status !== 'obsoleto' && !d.approval && <button className="btn primary" onClick={() => setModal('revise')}><FilePlus2 />Abrir nova revisão</button>}
            {!d.approval && (d.status !== 'obsoleto' ? <button className="btn ghost" onClick={() => setStatus('obsoleto')}>Tornar obsoleto</button> : <button className="btn" onClick={() => setStatus('vigente')}>Reativar</button>)}
            <button className="btn" onClick={() => setModal('edit')}><Pencil />Editar</button>
            {can('delete', 'docs', d) && <button className="btn ghost danger" onClick={() => setModal('delete')} aria-label="Excluir documento"><Trash2 />Excluir</button>}
          </div>}
        </div>
      </div>
      <ReadOnlyNote show={!canEdit && !d.approval} />
      {d.approval && <ApprovalCard d={d} />}
      <div className="grid">
        <section className="card s8">
          <h2>Histórico de revisões</h2>
          <p className="how">Toda revisão passa por elaboração, revisão técnica e aprovação. A versão anterior deve ser recolhida dos postos.</p>
          <div className="tscroll" tabIndex={0}><table>
            <thead><tr><th>Rev.</th><th>Data</th><th>Autor</th><th>O que mudou</th></tr></thead>
            <tbody>{d.history.map((h) => <tr key={h.version}><td className="mono">{h.version}</td><td style={{ whiteSpace: 'nowrap' }}>{fmtDate(h.date)}</td><td style={{ whiteSpace: 'nowrap' }}>{h.author}</td><td>{h.change}</td></tr>)}</tbody>
          </table></div>
        </section>
        <section className="card s4">
          <h2>Citado em</h2>
          {mentions.length ? <ul className="list">{mentions.map((n) => <li key={n.id}><Link to={`/nao-conformidades/${n.id}`}><b>{n.code}</b><div className="s">{n.title}</div></Link></li>)}</ul> : <Empty>Nenhuma não conformidade cita este documento.</Empty>}
          <h2 style={{ marginTop: 16 }}>Treinamentos</h2>
          {trainings.length ? <ul className="list">{trainings.map((t) => <li key={t.id}><Link to={`/treinamentos/${t.id}`}><b>{t.code}</b><div className="s">{t.title} · {fmtDate(t.date)}</div></Link></li>)}</ul> : <Empty>Ninguém treinado neste documento ainda.</Empty>}
        </section>
      </div>
      <History entity="docs" id={d.id} />
      {modal === 'edit' && <DocForm initial={d} onClose={() => setModal(null)} />}
      {modal === 'revise' && <StartRevision d={d} onClose={() => setModal(null)} />}
      {modal === 'delete' && (
        <Confirm title={`Excluir ${d.code}?`} onClose={() => setModal(null)} onConfirm={remove}>
          <p>O documento e todo o histórico de revisões serão apagados. Se ele só deixou de ser usado, prefira "Tornar obsoleto", que mantém o registro.</p>
        </Confirm>
      )}
    </div>
  );
}
