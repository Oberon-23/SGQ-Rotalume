import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, Download, Plus, UserPen, X } from 'lucide-react';
import { Pager, SortTh, useTable, type Columns } from '../components/Table';
import { csv, download } from '../data/csv';
import { nextCode, useStore } from '../data/store';
import type { NonConformity, Origin, Severity } from '../data/types';
import { SIX_M } from '../data/types';
import { addDays, daysBetween, fmtDate, isLate, isOpen, STAGES, stageIndex, stageLabel, today } from '../data/utils';
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

const SEV_RANK: Record<Severity, number> = { Menor: 1, Maior: 2, Crítica: 3 };

export default function NCList() {
  const { db, can, update, notify } = useStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<null | 'owner' | 'due'>(null);
  const [bulkValue, setBulkValue] = useState('');
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
  const cols = useMemo<Columns<NonConformity>>(() => ({
    code: (n) => n.code, proc: (n) => pname(n.processId), sev: (n) => SEV_RANK[n.severity], stage: (n) => stageIndex(n.stage), owner: (n) => n.owner, due: (n) => (n.stage === 'encerrada' ? n.closedAt : n.dueAt),
  }), [db.processes]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = useTable(rows, cols);
  const sel = rows.filter((n) => selected.has(n.id));
  const editable = sel.filter((n) => can('edit', 'ncs', n));
  const pageAll = t.view.length > 0 && t.view.every((n) => selected.has(n.id));
  const toggle = (id: string) => setSelected((cur) => { const x = new Set(cur); if (x.has(id)) x.delete(id); else x.add(id); return x; });
  const togglePage = () => setSelected((cur) => { const x = new Set(cur); t.view.forEach((n) => (pageAll ? x.delete(n.id) : x.add(n.id))); return x; });
  const applyBulk = () => {
    const ids = new Set(editable.map((n) => n.id));
    update((d) => d.ncs.forEach((n) => { if (ids.has(n.id)) { if (bulk === 'owner') n.owner = bulkValue.trim(); else n.dueAt = bulkValue; } }));
    notify(`${ids.size} não conformidade${ids.size === 1 ? '' : 's'} atualizada${ids.size === 1 ? '' : 's'}.`);
    setBulk(null); setBulkValue('');
  };
  const exportSel = () => {
    const data: (string | number | undefined)[][] = [['Código', 'Título', 'Processo', 'Origem', 'Gravidade', 'Etapa', 'Responsável', 'Aberta em', 'Prazo', 'Encerrada em']];
    sel.forEach((n) => data.push([n.code, n.title, pname(n.processId), n.origin, n.severity, stageLabel(n.stage), n.owner, n.openedAt, n.dueAt, n.closedAt]));
    download(`nao-conformidades-selecionadas-${today()}.csv`, csv(data), 'text/csv;charset=utf-8');
    notify(`${sel.length} não conformidade${sel.length === 1 ? '' : 's'} exportada${sel.length === 1 ? '' : 's'}.`);
  };

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Não conformidades</h1><p>Registro, contenção, análise de causa, plano de ação e verificação de eficácia (ISO 9001:2015, cláusula 10.2).</p></div>
        {can('create', 'ncs') && <button className="btn primary" onClick={() => setCreating(true)}><Plus />Registrar não conformidade</button>}
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
        {sel.length > 0 && (
          <div className="bulk" role="region" aria-label="Ações em lote">
            <b>{sel.length} selecionada{sel.length === 1 ? '' : 's'}{editable.length < sel.length ? ` (${editable.length} editáve${editable.length === 1 ? 'l' : 'is'} pelo seu perfil)` : ''}</b>
            <button className="btn small" disabled={!editable.length} onClick={() => { setBulk('owner'); setBulkValue(''); }}><UserPen />Reatribuir responsável</button>
            <button className="btn small" disabled={!editable.length} onClick={() => { setBulk('due'); setBulkValue(addDays(today(), 15)); }}><CalendarClock />Alterar prazo</button>
            <button className="btn small" onClick={exportSel}><Download />Exportar CSV</button>
            <button className="btn small ghost" onClick={() => setSelected(new Set())}><X />Limpar</button>
          </div>
        )}
        {rows.length ? (<>
          <div className="tscroll" style={{ border: 0 }}>
            <table>
              <thead><tr>
                <th className="sel"><input type="checkbox" checked={pageAll} onChange={togglePage} aria-label="Selecionar todas desta página" /></th>
                <SortTh t={t} k="code">Não conformidade</SortTh><SortTh t={t} k="proc">Processo</SortTh><SortTh t={t} k="sev">Gravidade</SortTh><SortTh t={t} k="stage">Etapa</SortTh><SortTh t={t} k="owner">Responsável</SortTh><SortTh t={t} k="due">Prazo</SortTh>
              </tr></thead>
              <tbody>
                {t.view.map((n) => (
                  <tr key={n.id} className={`link${selected.has(n.id) ? ' picked' : ''}`} onClick={() => nav(`/nao-conformidades/${n.id}`)}>
                    <td className="sel" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(n.id)} onChange={() => toggle(n.id)} aria-label={`Selecionar ${n.code}`} /></td>
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
          <Pager t={t} noun="não conformidades" />
        </>) : <Empty>Nenhuma não conformidade com esses filtros.</Empty>}
      </div>
      {creating && <NCForm onClose={() => setCreating(false)} />}
      {bulk && (
        <Modal title={bulk === 'owner' ? 'Reatribuir responsável' : 'Alterar prazo'} onClose={() => setBulk(null)}
          footer={<><button className="btn" onClick={() => setBulk(null)}>Cancelar</button><button className="btn primary" disabled={!bulkValue.trim()} onClick={applyBulk}>Aplicar em {editable.length}</button></>}>
          {bulk === 'owner'
            ? <label className="field"><span>Novo responsável</span><input className="input" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="Nome de quem assume o tratamento" /></label>
            : <label className="field"><span>Novo prazo</span><input className="input" type="date" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} /></label>}
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Vale para: {editable.map((n) => n.code).join(', ')}. Cada alteração entra no histórico do registro.{editable.length < sel.length ? ` ${sel.length - editable.length} selecionada(s) ficam de fora porque seu perfil não pode editá-las.` : ''}</p>
        </Modal>
      )}
    </div>
  );
}
