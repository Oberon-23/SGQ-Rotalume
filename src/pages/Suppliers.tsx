import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '../data/store';
import type { Supplier, SupplierEval, SupplierStatus } from '../data/types';
import { IQF_TONE, IQF_WEIGHTS, iqf, iqfClass, lastIqf, supplierAlert } from '../data/quality';
import { lastMonths, monthLabel, nf } from '../data/utils';
import { Confirm, Empty, Headline, Modal } from '../components/ui';
import { Pager, SortTh, useTable } from '../components/Table';
import History from '../components/History';
import { ReadOnlyNote } from '../components/DemoBar';
import { CodeTitle, Crumb, Missing } from '../components/bits';

const STATUS: Record<SupplierStatus, [string, string]> = { qualificado: ['Qualificado', 'ok'], condicional: ['Condicional', 'warn'], bloqueado: ['Bloqueado', 'bad'] };
const ClassPill = ({ v }: { v?: number }) => v === undefined ? <span className="pill">Sem nota</span> : <span className={`pill ${IQF_TONE[iqfClass(v)]}`}>{iqfClass(v)} · {nf(v, 1)}</span>;

/** Barras do IQF mês a mês, com as faixas A (85) e B (70). */
function IqfChart({ s }: { s: Supplier }) {
  const W = 560, H = 190, L = 34, B = 24, T = 10;
  const n = s.evals.length;
  const bw = (W - L - 10) / Math.max(n, 1);
  const y = (v: number) => T + (1 - v / 100) * (H - T - B);
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`IQF de ${s.name} nos últimos ${n} meses`}>
        {[0, 70, 85, 100].map((v) => <g key={v}><line x1={L} x2={W - 10} y1={y(v)} y2={y(v)} stroke={v === 70 || v === 85 ? 'var(--ink-2)' : 'var(--line-2)'} strokeDasharray={v === 70 || v === 85 ? '4 4' : undefined} /><text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{v}</text></g>)}
        {s.evals.map((e, i) => {
          const v = iqf(e), c = iqfClass(v);
          return (
            <g key={e.month}>
              <rect x={L + i * bw + bw * 0.2} y={y(v)} width={bw * 0.6} height={y(0) - y(v)} rx="4" fill={c === 'A' ? 'var(--accent)' : c === 'B' ? 'var(--warn)' : 'var(--bad)'}><title>{`${monthLabel(e.month)}: IQF ${nf(v, 1)} (classe ${c})`}</title></rect>
              <text x={L + i * bw + bw / 2} y={y(v) - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink-2)">{nf(v, 0)}</text>
              <text x={L + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--muted)">{monthLabel(e.month)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function SupplierForm({ onClose }: { onClose: () => void }) {
  const { db, update, notify } = useStore();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', item: '', critical: true, owner: 'Bianca Rocha' });
  const save = () => {
    const n = Math.max(0, ...db.suppliers.map((s) => +s.code.slice(2) || 0)) + 1;
    const code = `F-${String(n).padStart(2, '0')}`;
    update((d) => { d.suppliers.push({ id: code.toLowerCase(), code, ...f, status: 'condicional', evals: [] }); });
    notify(`${code} cadastrado como condicional até a primeira avaliação.`);
    onClose(); nav(`/fornecedores/${code.toLowerCase()}`);
  };
  return (
    <Modal title="Novo fornecedor" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!f.name.trim() || !f.item.trim() || !f.owner.trim()} onClick={save}>Cadastrar</button></>}>
      <div className="form-grid">
        <label className="field full"><span>Razão social *</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="field full"><span>O que fornece *</span><input className="input" value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} /></label>
        <label className="field"><span>Responsável pela avaliação *</span><input className="input" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></label>
        <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={f.critical} onChange={(e) => setF({ ...f, critical: e.target.checked })} />Item crítico para o produto</label>
      </div>
    </Modal>
  );
}

function EvalForm({ s, onClose }: { s: Supplier; onClose: () => void }) {
  const { update, notify } = useStore();
  const months = lastMonths(3).reverse();
  const [f, setF] = useState<SupplierEval>({ month: months.find((m) => !s.evals.some((e) => e.month === m)) ?? months[0], quality: 90, delivery: 90, service: 90, note: '' });
  const v = iqf(f);
  const num = (k: 'quality' | 'delivery' | 'service', label: string, help: string) => (
    <label className="field"><span>{label} ({Math.round(IQF_WEIGHTS[k] * 100)}%)</span><input className="input" type="number" min={0} max={100} value={f[k]} onChange={(e) => setF({ ...f, [k]: Math.max(0, Math.min(100, +e.target.value)) })} /><small className="muted">{help}</small></label>
  );
  const save = () => {
    update((d) => { const x = d.suppliers.find((y) => y.id === s.id); if (!x) return; x.evals = [...x.evals.filter((e) => e.month !== f.month), f].sort((a, b) => a.month.localeCompare(b.month)); });
    notify(`IQF de ${monthLabel(f.month)}: ${nf(v, 1)} (classe ${iqfClass(v)}).`);
    onClose();
  };
  return (
    <Modal title={`Avaliar ${s.name}`} onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Salvar avaliação</button></>}>
      <div className="form-grid">
        <label className="field full"><span>Mês</span><select className="input" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })}>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}{s.evals.some((e) => e.month === m) ? ' (substitui a avaliação)' : ''}</option>)}</select></label>
        {num('quality', 'Qualidade', 'Lotes aprovados no recebimento ÷ lotes recebidos')}
        {num('delivery', 'Entrega', 'Entregas no prazo e na quantidade ÷ entregas')}
        {num('service', 'Atendimento', 'Resposta a NCs, documentação e comunicação')}
        <div className="field"><span>IQF calculado</span><div><ClassPill v={v} /></div></div>
        <label className="field full"><span>Observação</span><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ex.: lote bloqueado (NC-2026-067)" /></label>
      </div>
    </Modal>
  );
}

export default function Suppliers() {
  const { db, can } = useStore();
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const [only, setOnly] = useState<'todos' | 'criticos' | 'alerta'>('todos');
  const rows = db.suppliers.filter((s) => only === 'todos' || (only === 'criticos' ? s.critical : !!supplierAlert(s))).sort((a, b) => (lastIqf(a) ?? 0) - (lastIqf(b) ?? 0));
  const t = useTable(rows, { name: (s: Supplier) => s.name, iqf: (s: Supplier) => lastIqf(s), status: (s: Supplier) => Object.keys(STATUS).indexOf(s.status), crit: (s: Supplier) => (s.critical ? 0 : 1) });
  const cls = (c: string) => db.suppliers.filter((s) => { const v = lastIqf(s); return v !== undefined && iqfClass(v) === c; }).length;
  const alerts = db.suppliers.filter((s) => supplierAlert(s));
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Fornecedores</h1><p>Avaliação mensal pelo índice de qualidade do fornecedor (IQF): 50% qualidade, 30% entrega e 20% atendimento. Classe A a partir de 85, B de 70 a 84, C abaixo de 70 (ISO 9001:2015, cláusula 8.4).</p></div>
        {can('create', 'suppliers') && <button className="btn primary" onClick={() => setCreating(true)}><Plus />Novo fornecedor</button>}
      </div>
      <Headline tone={alerts.length ? 'warn' : 'ok'} title={alerts.length ? `${alerts.length} ${alerts.length === 1 ? 'fornecedor pede' : 'fornecedores pedem'} ação.` : 'Todos os fornecedores dentro do esperado.'}>
        {alerts.map((s) => `${s.name}: ${supplierAlert(s)}`).join(' ')}
      </Headline>
      <div className="tiles">
        {(['A', 'B', 'C'] as const).map((c) => <div key={c} className="tile"><span className="lab">Classe {c}<span className={`pill ${IQF_TONE[c]}`}>{c === 'A' ? '≥ 85' : c === 'B' ? '70 a 84' : '< 70'}</span></span><span className="val">{cls(c)}</span><span className="sub">no último mês avaliado</span></div>)}
      </div>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Filtro">
          {([['todos', 'Todos'], ['criticos', 'Itens críticos'], ['alerta', 'Pedem ação']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={only === k} onClick={() => setOnly(k)}>{l}</button>)}
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {rows.length ? (
          <div className="tscroll" tabIndex={0} style={{ border: 0 }}>
            <table>
              <thead><tr><SortTh t={t} k="name">Fornecedor</SortTh><SortTh t={t} k="crit">Item</SortTh><SortTh t={t} k="iqf">IQF</SortTh><th>Tendência</th><SortTh t={t} k="status">Situação</SortTh></tr></thead>
              <tbody>{t.view.map((s) => (
                <tr key={s.id} className="link" onClick={() => nav(`/fornecedores/${s.id}`)}>
                  <td><Link to={`/fornecedores/${s.id}`} style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}><div className="t">{s.name}</div><div className="s"><span className="mono">{s.code}</span> · {s.item}</div></Link></td>
                  <td>{s.critical ? <span className="pill accent">Crítico</span> : <span className="muted">Comum</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><ClassPill v={lastIqf(s)} /></td>
                  <td><span className="mini-bars" role="img" aria-label={`IQF: ${s.evals.map((e) => nf(iqf(e), 0)).join(', ')}`}>{s.evals.map((e) => { const v = iqf(e); return <span key={e.month} className={IQF_TONE[iqfClass(v)]} style={{ height: `${Math.max(8, v - 40)}%` }} />; })}</span></td>
                  <td><span className={`pill dot ${STATUS[s.status][1]}`}>{STATUS[s.status][0]}</span></td>
                </tr>))}
              </tbody>
            </table>
          </div>
        ) : <Empty>Nenhum fornecedor com esse filtro.</Empty>}
        {rows.length > 0 && <Pager t={t} noun="fornecedores" />}
      </div>
      {creating && <SupplierForm onClose={() => setCreating(false)} />}
    </div>
  );
}

export function SupplierDetail() {
  const { id } = useParams();
  const { db, update, notify, can } = useStore();
  const nav = useNavigate();
  const [modal, setModal] = useState<'eval' | 'delete' | null>(null);
  const s = db.suppliers.find((x) => x.id === id);
  if (!s) return <Missing to="/fornecedores" back="Fornecedores">Fornecedor não encontrado.</Missing>;
  const canEdit = can('edit', 'suppliers', s);
  const alert = supplierAlert(s);
  const ncs = db.ncs.filter((n) => n.origin === 'Fornecedor' && `${n.title} ${n.description}`.toLowerCase().includes(s.item.split(' ')[0].toLowerCase()));
  const setStatus = (st: SupplierStatus) => { update((d) => { const x = d.suppliers.find((y) => y.id === s.id); if (x) x.status = st; }); notify(`${s.name}: ${STATUS[st][0].toLowerCase()}.`); };
  const remove = () => { update((d) => { d.suppliers = d.suppliers.filter((y) => y.id !== s.id); }); notify(`${s.code} excluído.`); nav('/fornecedores'); };
  return (
    <div className="page">
      <div>
        <Crumb to="/fornecedores">Fornecedores</Crumb>
        <div className="page-head">
          <div>
            <CodeTitle code={s.code}>{s.name}</CodeTitle>
            <div className="meta-row" style={{ marginTop: 8 }}>
              <span className={`pill dot ${STATUS[s.status][1]}`}>{STATUS[s.status][0]}</span><ClassPill v={lastIqf(s)} />{s.critical && <span className="pill accent">Item crítico</span>}
              <span>Fornece <b>{s.item}</b></span><span>Avaliado por <b>{s.owner}</b></span>
            </div>
          </div>
          <div className="head-actions">
            {canEdit && <button className="btn primary" onClick={() => setModal('eval')}><Plus />Lançar avaliação</button>}
            {can('delete', 'suppliers', s) && <button className="btn ghost danger" onClick={() => setModal('delete')} aria-label="Excluir fornecedor"><Trash2 />Excluir</button>}
          </div>
        </div>
      </div>
      <ReadOnlyNote show={!canEdit} />
      {alert && <Headline tone="warn" title={alert} />}
      <div className="grid">
        <section className="card s7">
          <h2>IQF mês a mês</h2>
          <p className="how">Linhas tracejadas: limite da classe A (85) e da classe B (70).</p>
          {s.evals.length ? <IqfChart s={s} /> : <Empty>Nenhuma avaliação lançada.</Empty>}
        </section>
        <section className="card s5">
          <h2>Situação</h2>
          <p className="how">Condicional: compra com inspeção reforçada. Bloqueado: não recebe novos pedidos.</p>
          <div className="seg" role="group" aria-label="Situação do fornecedor">
            {(Object.keys(STATUS) as SupplierStatus[]).map((st) => <button key={st} type="button" disabled={!canEdit} aria-pressed={s.status === st} onClick={() => setStatus(st)}>{STATUS[st][0]}</button>)}
          </div>
          <h2 style={{ marginTop: 18 }}>Não conformidades ligadas</h2>
          {ncs.length ? <ul className="list">{ncs.map((n) => <li key={n.id}><Link to={`/nao-conformidades/${n.id}`} style={{ minWidth: 0 }}><b>{n.code}</b><div className="s">{n.title}</div></Link></li>)}</ul> : <Empty>Nenhuma.</Empty>}
        </section>
        <section className="card s12">
          <h2>Avaliações</h2>
          <div className="tscroll" tabIndex={0}><table>
            <thead><tr><th>Mês</th><th>Qualidade</th><th>Entrega</th><th>Atendimento</th><th>IQF</th><th>Observação</th></tr></thead>
            <tbody>{[...s.evals].reverse().map((e) => <tr key={e.month}><td>{monthLabel(e.month)}</td><td>{e.quality}</td><td>{e.delivery}</td><td>{e.service}</td><td style={{ whiteSpace: 'nowrap' }}><ClassPill v={iqf(e)} /></td><td className="ink2">{e.note || '—'}</td></tr>)}</tbody>
          </table></div>
        </section>
      </div>
      <History entity="suppliers" id={s.id} />
      {modal === 'eval' && <EvalForm s={s} onClose={() => setModal(null)} />}
      {modal === 'delete' && <Confirm title={`Excluir ${s.name}?`} onClose={() => setModal(null)} onConfirm={remove}><p>Se o fornecedor não atende mais, prefira "Bloqueado", que mantém o histórico de avaliações.</p></Confirm>}
    </div>
  );
}
