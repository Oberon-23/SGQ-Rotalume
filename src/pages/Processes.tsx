import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../data/store';
import type { Process, ProcessType } from '../data/types';
import { fmtDate, fmtKpi, isOpen, lastValue } from '../data/utils';
import { Confirm, Empty, KpiPill, LinesField, Modal, SeverityPill, Sparkline, StagePill } from '../components/ui';
import History from '../components/History';
import { ReadOnlyNote } from '../components/DemoBar';

const ROWS: { type: ProcessType; label: string }[] = [
  { type: 'gestao', label: 'Processos de gestão' },
  { type: 'principal', label: 'Processos principais (cadeia de valor)' },
  { type: 'apoio', label: 'Processos de apoio' },
];

const TYPE_LABEL: Record<ProcessType, string> = { gestao: 'Gestão', principal: 'Principal (cadeia de valor)', apoio: 'Apoio' };

const SIPOC_FIELDS: { k: keyof Process['sipoc']; label: string }[] = [
  { k: 'suppliers', label: 'Fornecedores' }, { k: 'inputs', label: 'Entradas' }, { k: 'steps', label: 'Etapas do processo' }, { k: 'outputs', label: 'Saídas' }, { k: 'customers', label: 'Clientes' },
];

/** Formulário de processo, usado para criar e editar. */
function ProcessForm({ initial, onClose }: { initial?: Process; onClose: () => void }) {
  const { db, update, notify } = useStore();
  const nav = useNavigate();
  const nextNum = Math.max(0, ...db.processes.map((p) => +(p.code.match(/\d+/)?.[0] ?? 0))) + 1;
  const [f, setF] = useState<Omit<Process, 'id'>>(initial ? structuredClone(initial) : {
    code: `P${String(nextNum).padStart(2, '0')}`, name: '', type: 'principal', owner: '', objective: '',
    sipoc: { suppliers: [], inputs: [], steps: [], outputs: [], customers: [] },
  });
  const dup = db.processes.some((p) => p.code.toLowerCase() === f.code.trim().toLowerCase() && p.id !== initial?.id);
  const ok = f.name.trim() && f.owner.trim() && f.code.trim() && !dup;
  const save = () => {
    if (initial) {
      update((d) => { const i = d.processes.findIndex((p) => p.id === initial.id); if (i >= 0) d.processes[i] = { ...f, id: initial.id }; });
      notify('Processo atualizado.');
      onClose();
    } else {
      const id = f.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      update((d) => { d.processes.push({ ...f, code: f.code.trim(), id }); });
      notify(`Processo ${f.code} criado.`);
      onClose(); nav(`/processos/${id}`);
    }
  };
  return (
    <Modal title={initial ? `Editar ${initial.code}` : 'Novo processo'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!ok} onClick={save}>{initial ? 'Salvar' : 'Criar processo'}</button></>}>
      <div className="form-grid">
        <label className="field"><span>Código *</span><input className="input" value={f.code} disabled={!!initial} onChange={(e) => setF({ ...f, code: e.target.value })} />{dup && <small style={{ color: 'var(--bad)' }}>Já existe um processo com esse código.</small>}</label>
        <label className="field"><span>Tipo</span><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as ProcessType })}>{ROWS.map((r) => <option key={r.type} value={r.type}>{TYPE_LABEL[r.type]}</option>)}</select></label>
        <label className="field full"><span>Nome *</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Tratamento térmico" /></label>
        <label className="field full"><span>Dono do processo *</span><input className="input" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></label>
        <label className="field full"><span>Objetivo</span><textarea className="input" value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} placeholder="Para que o processo existe e como se mede o sucesso" /></label>
      </div>
      <p className="sub-h">SIPOC · um item por linha</p>
      <div className="sipoc-form">
        {SIPOC_FIELDS.map(({ k, label }) => <LinesField key={k} label={label} value={f.sipoc[k]} onChange={(v) => setF((cur) => ({ ...cur, sipoc: { ...cur.sipoc, [k]: v } }))} />)}
      </div>
    </Modal>
  );
}

export default function Processes() {
  const { db, can } = useStore();
  const [creating, setCreating] = useState(false);
  const openBy = (id: string) => db.ncs.filter((n) => n.processId === id && isOpen(n)).length;
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Mapa de processos</h1><p>Como a Rotalume Indústria transforma o pedido do cliente em produto entregue (ISO 9001:2015, cláusula 4.4). Clique em um processo para ver e editar o SIPOC.</p></div>
        {can('create', 'processes') && <button className="btn primary" onClick={() => setCreating(true)}><Plus />Novo processo</button>}
      </div>
      <div className="pmap">
        {ROWS.map((r) => (
          <section key={r.type} className={`prow ${r.type}`}>
            <h3>{r.label}</h3>
            {r.type === 'principal' && <div className="pmap-ends"><span>Requisitos do cliente</span><span>Cliente satisfeito</span></div>}
            <div className="pboxes">
              {db.processes.filter((p) => p.type === r.type).map((p) => (
                <Link key={p.id} to={`/processos/${p.id}`} className="pbox">
                  <small className="mono">{p.code}</small><b>{p.name}</b>
                  <small>{p.owner}{openBy(p.id) ? ` · ${openBy(p.id)} NC aberta${openBy(p.id) > 1 ? 's' : ''}` : ''}</small>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      {creating && <ProcessForm onClose={() => setCreating(false)} />}
    </div>
  );
}

export function ProcessDetail() {
  const { id } = useParams();
  const { db, update, notify, can } = useStore();
  const nav = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const p = db.processes.find((x) => x.id === id);
  if (!p) return <div className="page"><Link className="crumb" to="/processos"><ArrowLeft size={14} />Processos</Link><Empty>Processo não encontrado.</Empty></div>;
  const ncs = db.ncs.filter((n) => n.processId === p.id);
  const kpis = db.kpis.filter((k) => k.processId === p.id);
  const docs = db.docs.filter((d) => d.processId === p.id);
  const audits = db.audits.filter((a) => a.processId === p.id);
  const S = p.sipoc;
  const links = ncs.length + kpis.length + docs.length + audits.length;
  const col = (letter: string, title: string, items: string[]) => (
    <div><h4><em>{letter}</em>{title}</h4>{items.length ? <ul>{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <span className="muted" style={{ fontSize: 13 }}>Não preenchido</span>}</div>
  );
  const remove = () => { update((d) => { d.processes = d.processes.filter((x) => x.id !== p.id); }); notify(`Processo ${p.code} excluído.`); nav('/processos'); };
  return (
    <div className="page">
      <div>
        <Link className="crumb" to="/processos"><ArrowLeft size={14} />Mapa de processos</Link>
        <div className="page-head"><div>
          <h1><span className="mono" style={{ fontSize: 18, color: 'var(--muted)', marginRight: 10 }}>{p.code}</span>{p.name}</h1>
          <p>{p.objective}</p>
          <div className="meta-row" style={{ marginTop: 8 }}><span>Dono do processo <b>{p.owner}</b></span><span>Tipo <b>{TYPE_LABEL[p.type]}</b></span></div>
        </div>
        <div className="head-actions">
          {can('edit', 'processes', p) && <button className="btn" onClick={() => setEditing(true)}><Pencil />Editar processo e SIPOC</button>}
          {can('delete', 'processes', p) && <button className="btn ghost danger" onClick={() => setDeleting(true)} aria-label="Excluir processo"><Trash2 />Excluir</button>}
        </div></div>
      </div>
      <ReadOnlyNote show={!can('edit', 'processes', p)} />
      <section className="card">
        <h2>SIPOC</h2>
        <p className="how">Fornecedores, entradas, etapas do processo, saídas e clientes.</p>
        <div className="sipoc">
          {col('S', 'Fornecedores', S.suppliers)}{col('I', 'Entradas', S.inputs)}{col('P', 'Processo', S.steps)}{col('O', 'Saídas', S.outputs)}{col('C', 'Clientes', S.customers)}
        </div>
        <h2 style={{ margin: '18px 0 10px' }}>Fluxo</h2>
        <div className="flow">{S.steps.length === 0 && <span className="muted" style={{ fontSize: 13 }}>Cadastre as etapas do processo para ver o fluxo.</span>}{S.steps.map((s, i) => <span key={i} style={{ display: 'contents' }}>{i > 0 && <ArrowRight className="ar" size={16} />}<span className="st">{i + 1}. {s}</span></span>)}</div>
      </section>
      <div className="grid">
        <section className="card s6">
          <h2>Indicadores</h2>
          {kpis.length ? <ul className="list">{kpis.map((k) => { const v = lastValue(k); return <li key={k.id}><Link to={`/indicadores/${k.id}`}><b>{k.name}</b><div className="s">{v ? fmtKpi(k, v.value) : 'Sem resultado'} · meta {fmtKpi(k, k.target)}</div></Link><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Sparkline k={k} /><KpiPill k={k} v={v?.value} /></span></li>; })}</ul> : <Empty>Nenhum indicador ligado a este processo.</Empty>}
        </section>
        <section className="card s6">
          <h2>Documentos</h2>
          {docs.length ? <ul className="list">{docs.map((d) => <li key={d.id}><Link to={`/documentos/${d.id}`}><b>{d.code}</b> <span className="ink2">{d.title}</span><div className="s">{d.type} · revisão {d.version}</div></Link></li>)}</ul> : <Empty>Nenhum documento ligado a este processo.</Empty>}
        </section>
        <section className="card s6">
          <h2>Não conformidades</h2>
          {ncs.length ? <ul className="list">{ncs.map((n) => <li key={n.id}><Link to={`/nao-conformidades/${n.id}`} style={{ minWidth: 0 }}><b>{n.code}</b> <span className="ink2">{n.title}</span></Link><span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}><SeverityPill s={n.severity} /><StagePill s={n.stage} /></span></li>)}</ul> : <Empty>Nenhuma não conformidade neste processo.</Empty>}
        </section>
        <section className="card s6">
          <h2>Auditorias</h2>
          {audits.length ? <ul className="list">{audits.map((a) => <li key={a.id}><Link to={`/auditorias/${a.id}`}><b>{a.code}</b><div className="s">{fmtDate(a.date)} · {a.auditor}</div></Link><span className={`pill dot ${a.done ? 'ok' : 'info'}`}>{a.done ? 'Realizada' : 'Programada'}</span></li>)}</ul> : <Empty>Nenhuma auditoria neste processo.</Empty>}
        </section>
      </div>
      <History entity="processes" id={p.id} />
      {editing && <ProcessForm initial={p} onClose={() => setEditing(false)} />}
      {deleting && (
        <Confirm title={`Excluir ${p.code} · ${p.name}?`} blocked={links > 0} onClose={() => setDeleting(false)} onConfirm={remove}>
          {links > 0
            ? <p>Este processo tem {[ncs.length && `${ncs.length} não conformidade(s)`, kpis.length && `${kpis.length} indicador(es)`, docs.length && `${docs.length} documento(s)`, audits.length && `${audits.length} auditoria(s)`].filter(Boolean).join(', ')} ligados a ele. Mova esses registros para outro processo antes de excluir, para não perder o histórico.</p>
            : <p>O processo sai do mapa. Essa ação não pode ser desfeita (a não ser restaurando um backup).</p>}
        </Confirm>
      )}
    </div>
  );
}
