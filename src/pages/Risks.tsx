import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../data/store';
import type { Risk, RiskKind, RiskStatus } from '../data/types';
import { BENEFIT_LABEL, IMPACT_LABEL, OPP_TREATMENTS, PROB_LABEL, RISK_TREATMENTS, addDays, daysBetween, fmtDate, riskLevel, today } from '../data/utils';
import { Confirm, Empty, Headline, Modal } from '../components/ui';
import { Pager, SortTh, useTable } from '../components/Table';
import History from '../components/History';
import { ReadOnlyNote } from '../components/DemoBar';

const STATUS: Record<RiskStatus, [string, string]> = { aberto: ['Aberto', 'warn'], tratamento: ['Em tratamento', 'info'], controlado: ['Controlado', 'ok'] };
export const LevelPill = ({ r }: { r: Pick<Risk, 'probability' | 'impact' | 'kind'> }) => {
  const l = riskLevel(r.probability, r.impact, r.kind);
  return <span className={`pill lvl-${l.tone}`} title={`Probabilidade ${r.probability} × ${r.kind === 'risco' ? 'impacto' : 'benefício'} ${r.impact}`}>{l.label} · {l.score}</span>;
};
const reviewLate = (r: Risk) => r.reviewAt < today();
const withoutIds = (r: Risk): Omit<Risk, 'id' | 'code'> => { const o: Partial<Risk> = { ...r }; delete o.id; delete o.code; return o as Omit<Risk, 'id' | 'code'>; };

/** Matriz 5×5 probabilidade × impacto. Clicar numa célula filtra a lista. */
function Matrix({ items, kind, sel, onSel, mark }: { items: Risk[]; kind: RiskKind | 'todos'; sel?: string | null; onSel?: (k: string | null) => void; mark?: [number, number] }) {
  const xLabel = kind === 'oportunidade' ? 'Benefício' : kind === 'risco' ? 'Impacto' : 'Impacto ou benefício';
  return (
    <div className="matrix" role="grid" aria-label={`Matriz de probabilidade por ${xLabel.toLowerCase()}`}>
      <span className="ax y" style={{ gridRow: '1 / 6', gridColumn: 1 }}>Probabilidade</span>
      {[5, 4, 3, 2, 1].map((p) => (
        <div key={p} role="row" style={{ display: 'contents' }}>
          <span className="ax rl" title={PROB_LABEL[p]} style={{ gridRow: 6 - p, gridColumn: 2 }}>{p}</span>
          {[1, 2, 3, 4, 5].map((i) => {
            const n = items.filter((r) => r.probability === p && r.impact === i).length;
            const key = `${p}-${i}`;
            const l = riskLevel(p, i);
            const isMark = mark && mark[0] === p && mark[1] === i;
            return (
              <button key={i} role="gridcell" type="button" className={`cell lvl-${l.tone}${n || isMark ? '' : ' empty'}${sel === key ? ' sel' : ''}${isMark ? ' me' : ''}`}
                disabled={!onSel} style={{ gridRow: 6 - p, gridColumn: i + 2, ...(!onSel ? { cursor: 'default' } : {}) }}
                aria-label={`Probabilidade ${p}, ${xLabel.toLowerCase()} ${i}: ${n} registro${n === 1 ? '' : 's'}`} aria-pressed={sel === key}
                onClick={() => onSel?.(sel === key ? null : key)}>{isMark ? '●' : n || '·'}</button>
            );
          })}
        </div>
      ))}
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className="ax" style={{ gridRow: 6, gridColumn: i + 2 }}>{i}</span>)}
      <span className="ax x" style={{ gridRow: 7, gridColumn: '3 / 8' }}>{xLabel}</span>
    </div>
  );
}

function RiskForm({ initial, onClose }: { initial?: Risk; onClose: () => void }) {
  const { db, update, notify } = useStore();
  const nav = useNavigate();
  const [f, setF] = useState<Omit<Risk, 'id' | 'code'>>(initial ? withoutIds(initial) : {
    kind: 'risco', processId: db.processes[0]?.id ?? '', title: '', cause: '', consequence: '', probability: 3, impact: 3,
    treatment: 'Mitigar', action: '', owner: '', reviewAt: addDays(today(), 90), status: 'aberto',
  });
  const opp = f.kind === 'oportunidade';
  const ok = f.title.trim() && f.owner.trim() && f.processId && f.reviewAt;
  const save = () => {
    if (initial) {
      update((d) => { const x = d.risks.find((y) => y.id === initial.id); if (x) Object.assign(x, f); });
      notify(`${initial.code} atualizado.`); onClose(); return;
    }
    const pre = opp ? 'O' : 'R';
    const n = Math.max(0, ...db.risks.filter((r) => r.code.startsWith(pre + '-')).map((r) => +r.code.slice(2) || 0)) + 1;
    const code = `${pre}-${String(n).padStart(2, '0')}`;
    update((d) => { d.risks.push({ id: code.toLowerCase(), code, ...f }); });
    notify(`${code} registrado.`);
    onClose(); nav(`/riscos/${code.toLowerCase()}`);
  };
  const lvl = riskLevel(f.probability, f.impact, f.kind);
  return (
    <Modal title={initial ? `Editar ${initial.code}` : 'Novo risco ou oportunidade'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!ok} onClick={save}>{initial ? 'Salvar' : 'Registrar'}</button></>}>
      <div className="form-grid">
        <div className="field full"><span>Tipo</span>
          <div className="seg" role="group" aria-label="Tipo" style={{ justifySelf: 'start' }}>
            {(['risco', 'oportunidade'] as RiskKind[]).map((k) => <button key={k} type="button" disabled={!!initial} aria-pressed={f.kind === k} onClick={() => setF({ ...f, kind: k, treatment: k === 'risco' ? 'Mitigar' : 'Explorar' })}>{k === 'risco' ? 'Risco' : 'Oportunidade'}</button>)}
          </div>
        </div>
        <label className="field full"><span>{opp ? 'Oportunidade' : 'Risco'} *</span><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={opp ? 'Ex.: Reaproveitar o calor da estufa' : 'Ex.: Fornecedor único de um item crítico'} /></label>
        <label className="field"><span>Processo</span><select className="input" value={f.processId} onChange={(e) => setF({ ...f, processId: e.target.value })}>{db.processes.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></label>
        <label className="field"><span>Responsável *</span><input className="input" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></label>
        <label className="field"><span>{opp ? 'De onde vem' : 'Causa'}</span><textarea className="input" value={f.cause} onChange={(e) => setF({ ...f, cause: e.target.value })} /></label>
        <label className="field"><span>{opp ? 'Benefício esperado' : 'Consequência'}</span><textarea className="input" value={f.consequence} onChange={(e) => setF({ ...f, consequence: e.target.value })} /></label>
        <label className="field"><span>Probabilidade</span><select className="input" value={f.probability} onChange={(e) => setF({ ...f, probability: +e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} · {PROB_LABEL[n]}</option>)}</select></label>
        <label className="field"><span>{opp ? 'Benefício' : 'Impacto'}</span><select className="input" value={f.impact} onChange={(e) => setF({ ...f, impact: +e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} · {(opp ? BENEFIT_LABEL : IMPACT_LABEL)[n]}</option>)}</select></label>
        <div className="field full"><span>Nível</span><div><span className={`pill lvl-${lvl.tone}`}>{lvl.label} · {lvl.score}</span> <span className="muted" style={{ fontSize: 13 }}>probabilidade × {opp ? 'benefício' : 'impacto'}</span></div></div>
        <label className="field"><span>Tratamento</span><select className="input" value={f.treatment} onChange={(e) => setF({ ...f, treatment: e.target.value })}>{(opp ? OPP_TREATMENTS : RISK_TREATMENTS).map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="field"><span>Situação</span><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as RiskStatus })}>{(Object.keys(STATUS) as RiskStatus[]).map((s) => <option key={s} value={s}>{STATUS[s][0]}</option>)}</select></label>
        <label className="field full"><span>Ação</span><textarea className="input" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} placeholder="O que será feito, e por quem" /></label>
        <label className="field"><span>Reavaliar em</span><input className="input" type="date" value={f.reviewAt} onChange={(e) => setF({ ...f, reviewAt: e.target.value })} /></label>
      </div>
    </Modal>
  );
}

export default function Risks() {
  const { db, can } = useStore();
  const nav = useNavigate();
  const [kind, setKind] = useState<RiskKind | 'todos'>('risco');
  const [proc, setProc] = useState('');
  const [status, setStatus] = useState('');
  const [cell, setCell] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const pname = (id: string) => db.processes.find((p) => p.id === id)?.name ?? '—';
  const base = db.risks.filter((r) => (kind === 'todos' || r.kind === kind) && (!proc || r.processId === proc) && (!status || r.status === status));
  const rows = base.filter((r) => !cell || `${r.probability}-${r.impact}` === cell)
    .sort((a, b) => b.probability * b.impact - a.probability * a.impact || a.code.localeCompare(b.code));
  const t = useTable(rows, {
    title: (r: Risk) => r.title, level: (r: Risk) => r.probability * r.impact, treat: (r: Risk) => r.treatment, owner: (r: Risk) => r.owner, review: (r: Risk) => r.reviewAt, status: (r: Risk) => ['aberto', 'tratamento', 'controlado'].indexOf(r.status),
  });
  const risks = db.risks.filter((r) => r.kind === 'risco');
  const hot = risks.filter((r) => r.probability * r.impact >= 10 && r.status !== 'controlado');
  const late = db.risks.filter(reviewLate);
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Riscos e oportunidades</h1><p>O que pode dar errado (ou certo) em cada processo, avaliado por probabilidade e impacto, com ação e data de reavaliação (ISO 9001:2015, cláusula 6.1).</p></div>
        {can('create', 'risks') && <button className="btn primary" onClick={() => setCreating(true)}><Plus />Novo registro</button>}
      </div>
      <Headline tone={hot.length ? 'warn' : 'ok'} title={hot.length ? `${hot.length} ${hot.length === 1 ? 'risco alto ou crítico ainda não está controlado' : 'riscos altos ou críticos ainda não estão controlados'}.` : 'Nenhum risco alto ou crítico sem controle.'}>
        {hot.length ? `${hot.map((r) => `${r.code} ${r.title}`).join('; ')}.` : ''}{late.length ? ` ${late.length} registro${late.length === 1 ? '' : 's'} com reavaliação vencida.` : ''}
      </Headline>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Tipo">
          {([['risco', 'Riscos'], ['oportunidade', 'Oportunidades'], ['todos', 'Todos']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setCell(null); }}>{l} ({k === 'todos' ? db.risks.length : db.risks.filter((r) => r.kind === k).length})</button>)}
        </div>
        <select className="input" value={proc} onChange={(e) => { setProc(e.target.value); setCell(null); }} aria-label="Processo"><option value="">Todos os processos</option>{db.processes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setCell(null); }} aria-label="Situação"><option value="">Todas as situações</option>{(Object.keys(STATUS) as RiskStatus[]).map((s) => <option key={s} value={s}>{STATUS[s][0]}</option>)}</select>
      </div>
      <div className="risk-layout">
        <section className="card matrix-card">
          <h2>Matriz {kind === 'oportunidade' ? 'de priorização' : 'de risco'}</h2>
          <p className="how">Cada número é a quantidade de registros na célula. Clique para filtrar a lista.</p>
          <div className="mc-inner">
            <Matrix items={base} kind={kind} sel={cell} onSel={setCell} />
            <div className="mc-side">
              <div className="legend">{(['low', 'mid', 'high', 'crit'] as const).map((t) => <span key={t} className={`pill lvl-${t}`}>{{ low: 'Baixo 1–4', mid: 'Moderado 5–9', high: 'Alto 10–16', crit: 'Crítico 20–25' }[t]}</span>)}</div>
              <p className="how" style={{ margin: 0 }}>Nível = probabilidade × {kind === 'oportunidade' ? 'benefício' : 'impacto'}, de 1 a 25. Riscos altos e críticos precisam de ação e reavaliação mais frequente; os baixos podem ser aceitos e monitorados.</p>
              <div className="mc-stats">
                {(Object.keys(STATUS) as RiskStatus[]).map((st) => <div key={st}><span className="val">{base.filter((r) => r.status === st).length}</span><span className={`pill dot ${STATUS[st][1]}`}>{STATUS[st][0]}</span></div>)}
              </div>
            </div>
          </div>
        </section>
        <section className="card" style={{ padding: 0, minWidth: 0 }}>
          {cell && <div style={{ padding: '12px 16px 0', fontSize: 13.5 }} className="ink2">Filtrando probabilidade {cell.split('-')[0]} × {kind === 'oportunidade' ? 'benefício' : 'impacto'} {cell.split('-')[1]}. <button className="btn small ghost" onClick={() => setCell(null)}>Limpar</button></div>}
          {rows.length ? (
            <div className="tscroll" style={{ border: 0 }}>
              <table>
                <thead><tr><SortTh t={t} k="title">Registro</SortTh><SortTh t={t} k="level">Nível</SortTh><SortTh t={t} k="treat">Tratamento</SortTh><SortTh t={t} k="owner">Responsável</SortTh><SortTh t={t} k="review">Reavaliar</SortTh><SortTh t={t} k="status">Situação</SortTh></tr></thead>
                <tbody>{t.view.map((r) => (
                  <tr key={r.id} className="link" onClick={() => nav(`/riscos/${r.id}`)}>
                    <td><Link to={`/riscos/${r.id}`} style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}><div className="t">{r.title}</div><div className="s"><span className="mono">{r.code}</span> · {pname(r.processId)}</div></Link></td>
                    <td style={{ whiteSpace: 'nowrap' }}><LevelPill r={r} /></td>
                    <td>{r.treatment}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.owner}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{reviewLate(r) ? <span className="pill dot bad">Venceu há {daysBetween(r.reviewAt, today())} d</span> : fmtDate(r.reviewAt)}</td>
                    <td><span className={`pill dot ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <Empty>Nenhum registro com esses filtros.</Empty>}
          {rows.length > 0 && <Pager t={t} noun="registros" />}
        </section>
      </div>
      {creating && <RiskForm onClose={() => setCreating(false)} />}
    </div>
  );
}

export function RiskDetail() {
  const { id } = useParams();
  const { db, update, notify, can } = useStore();
  const nav = useNavigate();
  const [modal, setModal] = useState<'edit' | 'delete' | null>(null);
  const r = db.risks.find((x) => x.id === id);
  if (!r) return <div className="page"><Link className="crumb" to="/riscos"><ArrowLeft size={14} />Riscos e oportunidades</Link><Empty>Registro não encontrado.</Empty></div>;
  const p = db.processes.find((x) => x.id === r.processId);
  const opp = r.kind === 'oportunidade';
  const canEdit = can('edit', 'risks', r);
  const setStatus = (s: RiskStatus) => { update((d) => { const x = d.risks.find((y) => y.id === r.id); if (x) x.status = s; }); notify(`${r.code}: ${STATUS[s][0].toLowerCase()}.`); };
  const remove = () => { update((d) => { d.risks = d.risks.filter((y) => y.id !== r.id); }); notify(`${r.code} excluído.`); nav('/riscos'); };
  return (
    <div className="page">
      <div>
        <Link className="crumb" to="/riscos"><ArrowLeft size={14} />Riscos e oportunidades</Link>
        <div className="page-head">
          <div>
            <h1><span className="mono" style={{ fontSize: 18, color: 'var(--muted)', marginRight: 10 }}>{r.code}</span>{r.title}</h1>
            <div className="meta-row" style={{ marginTop: 8 }}>
              <span className="pill">{opp ? 'Oportunidade' : 'Risco'}</span><LevelPill r={r} /><span className={`pill dot ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
              <span>Processo <b>{p ? <Link to={`/processos/${p.id}`}>{p.name}</Link> : '—'}</b></span><span>Responsável <b>{r.owner}</b></span>
              <span>Reavaliar em {reviewLate(r) ? <span className="pill dot bad">{fmtDate(r.reviewAt)} (vencida)</span> : <b>{fmtDate(r.reviewAt)}</b>}</span>
            </div>
          </div>
          {canEdit && <div className="head-actions">
            <button className="btn" onClick={() => setModal('edit')}><Pencil />Editar e reavaliar</button>
            {can('delete', 'risks', r) && <button className="btn ghost danger" onClick={() => setModal('delete')} aria-label="Excluir registro"><Trash2 />Excluir</button>}
          </div>}
        </div>
      </div>
      <ReadOnlyNote show={!canEdit} />
      <div className="grid">
        <section className="card s7">
          <h2>Análise</h2>
          <dl className="kv">
            <dt>{opp ? 'De onde vem' : 'Causa'}</dt><dd>{r.cause || '—'}</dd>
            <dt>{opp ? 'Benefício esperado' : 'Consequência'}</dt><dd>{r.consequence || '—'}</dd>
            <dt>Probabilidade</dt><dd>{r.probability} · {PROB_LABEL[r.probability]}</dd>
            <dt>{opp ? 'Benefício' : 'Impacto'}</dt><dd>{r.impact} · {(opp ? BENEFIT_LABEL : IMPACT_LABEL)[r.impact]}</dd>
            <dt>Tratamento</dt><dd>{r.treatment}</dd>
            <dt>Ação</dt><dd>{r.action || '—'}</dd>
          </dl>
          {canEdit && (
            <div style={{ marginTop: 16 }}>
              <span className="muted" style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Atualizar situação</span>
              <div className="seg" role="group" aria-label="Situação">
                {(Object.keys(STATUS) as RiskStatus[]).map((s) => <button key={s} type="button" aria-pressed={r.status === s} onClick={() => setStatus(s)}>{STATUS[s][0]}</button>)}
              </div>
            </div>
          )}
        </section>
        <section className="card s5">
          <h2>Posição na matriz</h2>
          <p className="how">O ponto marca este registro.</p>
          <Matrix items={[]} kind={r.kind} mark={[r.probability, r.impact]} />
        </section>
      </div>
      <History entity="risks" id={r.id} />
      {modal === 'edit' && <RiskForm initial={r} onClose={() => setModal(null)} />}
      {modal === 'delete' && (
        <Confirm title={`Excluir ${r.code}?`} onClose={() => setModal(null)} onConfirm={remove}>
          <p>Se o risco deixou de existir, prefira marcar como controlado e manter o registro para a próxima auditoria.</p>
        </Confirm>
      )}
    </div>
  );
}
