import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { nextCode, useStore } from '../data/store';
import type { NonConformity, Origin, Severity } from '../data/types';
import { SIX_M } from '../data/types';
import { addDays, daysBetween, fmtDate, isLate, isOpen, STAGES, today } from '../data/utils';
import { Empty, Modal, SeverityPill, StagePill } from '../components/ui';

const ORIGINS: Origin[] = ['Inspeção de processo', 'Auditoria interna', 'Reclamação de cliente', 'Fornecedor', 'Metrologia'];
const SEVS: Severity[] = ['Menor', 'Maior', 'Crítica'];

export function newNC(codes: string[], data: { title: string; description: string; processId: string; origin: Origin; severity: Severity; owner: string; dueAt: string; containment: string; auditId?: string }): NonConformity {
  const code = nextCode(codes, 'NC');
  return {
    id: code.toLowerCase(), code, stage: 'registro', openedAt: today(), whys: ['', '', '', '', ''], rootCause: '', category: '',
    ishikawa: Object.fromEntries(SIX_M.map((m) => [m, []])) as unknown as NonConformity['ishikawa'], actions: [],
    verification: { effective: null, evidence: '', date: '' }, ...data,
  };
}

/** Registro de NC. Com `nc`, edita os dados gerais de uma NC existente, em qualquer etapa. */
export function NCForm({ onClose, nc }: { onClose: () => void; nc?: NonConformity }) {
  const { db, update, notify } = useStore();
  const nav = useNavigate();
  const [f, setF] = useState(nc
    ? { title: nc.title, description: nc.description, processId: nc.processId, origin: nc.origin, severity: nc.severity, owner: nc.owner, dueAt: nc.dueAt, containment: nc.containment }
    : { title: '', description: '', processId: (db.processes.find((p) => p.type === 'principal') ?? db.processes[0])?.id ?? '', origin: 'Inspeção de processo' as Origin, severity: 'Menor' as Severity, owner: '', dueAt: addDays(today(), 30), containment: '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const ok = f.title.trim() && f.owner.trim() && f.processId && f.dueAt;
  const save = () => {
    if (nc) {
      update((d) => { const x = d.ncs.find((y) => y.id === nc.id); if (x) Object.assign(x, f); });
      notify('Dados da não conformidade atualizados.');
      onClose();
      return;
    }
    const n = newNC(db.ncs.map((x) => x.code), f);
    update((d) => { d.ncs.unshift(n); });
    notify(`${n.code} registrada.`);
    onClose();
    nav(`/nao-conformidades/${n.id}`);
  };
  return (
    <Modal title={nc ? `Editar ${nc.code}` : 'Registrar não conformidade'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!ok} onClick={save}>{nc ? 'Salvar' : 'Registrar'}</button></>}>
      <div className="form-grid">
        <label className="field full"><span>Título *</span><input className="input" value={f.title} onChange={set('title')} placeholder="Ex.: Diâmetro do eixo fora da especificação" /></label>
        <label className="field full"><span>O que aconteceu</span><textarea className="input" value={f.description} onChange={set('description')} placeholder="Onde, quando, quantas peças, como foi detectado" /></label>
        <label className="field"><span>Processo</span><select className="input" value={f.processId} onChange={set('processId')}>{db.processes.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
        <label className="field"><span>Origem</span><select className="input" value={f.origin} onChange={set('origin')}>{ORIGINS.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label className="field"><span>Gravidade</span><select className="input" value={f.severity} onChange={set('severity')}>{SEVS.map((o) => <option key={o}>{o}</option>)}</select></label>
        <label className="field"><span>Prazo para encerrar</span><input className="input" type="date" value={f.dueAt} onChange={set('dueAt')} /></label>
        <label className="field full"><span>Responsável *</span><input className="input" value={f.owner} onChange={set('owner')} placeholder="Quem conduz o tratamento" /></label>
        <label className="field full"><span>Contenção imediata</span><textarea className="input" value={f.containment} onChange={set('containment')} placeholder="O que foi feito agora para proteger o cliente (segregar, inspecionar 100%...)" /></label>
      </div>
    </Modal>
  );
}

export default function NCList() {
  const { db } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('abertas');
  const [proc, setProc] = useState('');
  const [sev, setSev] = useState('');
  const [creating, setCreating] = useState(false);
  const pname = (id: string) => db.processes.find((p) => p.id === id)?.name ?? '—';

  const rows = useMemo(() => db.ncs.filter((n) =>
    (stage === 'todas' || (stage === 'abertas' ? isOpen(n) : stage === 'vencidas' ? isLate(n) : n.stage === stage)) &&
    (!proc || n.processId === proc) && (!sev || n.severity === sev) &&
    (!q || `${n.code} ${n.title} ${n.description} ${n.owner}`.toLowerCase().includes(q.toLowerCase()))
  ).sort((a, b) => (isOpen(a) === isOpen(b) ? a.dueAt.localeCompare(b.dueAt) : isOpen(a) ? -1 : 1)), [db.ncs, q, stage, proc, sev]);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Não conformidades</h1><p>Registro, contenção, análise de causa, plano de ação e verificação de eficácia (ISO 9001:2015, cláusula 10.2).</p></div>
        <button className="btn primary" onClick={() => setCreating(true)}><Plus />Registrar não conformidade</button>
      </div>
      <div className="toolbar">
        <input className="input search" type="search" placeholder="Buscar por código, título ou responsável" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <select className="input" value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Situação">
          <option value="abertas">Abertas</option><option value="vencidas">Vencidas</option><option value="todas">Todas</option>
          {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select className="input" value={proc} onChange={(e) => setProc(e.target.value)} aria-label="Processo"><option value="">Todos os processos</option>{db.processes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className="input" value={sev} onChange={(e) => setSev(e.target.value)} aria-label="Gravidade"><option value="">Todas as gravidades</option>{SEVS.map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {rows.length ? (
          <div className="tscroll" style={{ border: 0 }}>
            <table>
              <thead><tr><th>Não conformidade</th><th>Processo</th><th>Gravidade</th><th>Etapa</th><th>Responsável</th><th>Prazo</th></tr></thead>
              <tbody>
                {rows.map((n) => (
                  <tr key={n.id} className="link" onClick={() => nav(`/nao-conformidades/${n.id}`)}>
                    <td><Link to={`/nao-conformidades/${n.id}`} style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}><div className="t">{n.code}</div><div className="s">{n.title}</div></Link></td>
                    <td><div style={{ fontSize: 13.5 }}>{pname(n.processId)}</div><div className="s">{n.origin}</div></td>
                    <td><SeverityPill s={n.severity} /></td>
                    <td><StagePill s={n.stage} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{n.owner}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{n.stage === 'encerrada' ? <span className="s">Encerrada em {fmtDate(n.closedAt)}</span> : <>{fmtDate(n.dueAt)}{isLate(n) && <div><span className="pill dot bad">Vencida há {daysBetween(n.dueAt, today())} d</span></div>}</>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Nenhuma não conformidade com esses filtros.</Empty>}
      </div>
      {creating && <NCForm onClose={() => setCreating(false)} />}
    </div>
  );
}
