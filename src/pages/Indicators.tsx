import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { useStore } from '../data/store';
import { fmtKpi, kpiOk, lastMonths, lastValue, monthKey, monthLabel, nf } from '../data/utils';
import { Empty, Headline, KpiPill, LineChart, Modal, Sparkline } from '../components/ui';

export default function Indicators() {
  const { db, update } = useStore();
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ name: '', processId: db.processes[1].id, owner: '', unit: '%', target: 90, higherIsBetter: true, formula: '', decimals: 1 });
  const pname = (id: string) => db.processes.find((p) => p.id === id)?.name ?? '—';
  const off = db.kpis.filter((k) => { const v = lastValue(k); return v && !kpiOk(k, v.value); });
  const create = () => {
    const id = f.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) + '-' + Math.random().toString(36).slice(2, 5);
    update((d) => { d.kpis.push({ id, ...f, values: [] }); });
    setCreating(false); nav(`/indicadores/${id}`);
  };
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Indicadores</h1><p>Monitoramento, medição e análise do desempenho dos processos (ISO 9001:2015, cláusula 9.1).</p></div>
        <button className="btn primary" onClick={() => setCreating(true)}><Plus />Novo indicador</button>
      </div>
      <Headline tone={off.length ? 'warn' : 'ok'} title={off.length ? `${off.length} de ${db.kpis.length} indicadores ficaram fora da meta no último mês.` : 'Todos os indicadores ficaram na meta no último mês.'}>
        {off.length ? `Fora da meta: ${off.map((k) => k.name).join(', ')}.` : ''}
      </Headline>
      <div className="card" style={{ padding: 0 }}>
        <div className="tscroll" style={{ border: 0 }}>
          <table>
            <thead><tr><th>Indicador</th><th>Processo</th><th>Último mês</th><th>Meta</th><th>12 meses</th><th>Meses na meta</th><th>Situação</th></tr></thead>
            <tbody>{db.kpis.map((k) => { const v = lastValue(k); const hits = k.values.filter((x) => kpiOk(k, x.value)).length; return (
              <tr key={k.id} className="link" onClick={() => nav(`/indicadores/${k.id}`)}>
                <td><Link to={`/indicadores/${k.id}`} style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}><div className="t">{k.name}</div><div className="s">{k.owner}</div></Link></td>
                <td>{pname(k.processId)}</td>
                <td style={{ whiteSpace: 'nowrap', fontWeight: 650 }}>{v ? fmtKpi(k, v.value) : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }} className="ink2">{k.higherIsBetter ? '≥' : '≤'} {fmtKpi(k, k.target)}</td>
                <td><Sparkline k={k} /></td>
                <td style={{ whiteSpace: 'nowrap' }}>{k.values.length ? `${hits} de ${k.values.length}` : '—'}</td>
                <td><KpiPill k={k} v={v?.value} /></td>
              </tr>
            ); })}</tbody>
          </table>
        </div>
      </div>
      {creating && (
        <Modal title="Novo indicador" onClose={() => setCreating(false)} footer={<><button className="btn" onClick={() => setCreating(false)}>Cancelar</button><button className="btn primary" disabled={!f.name.trim() || !f.owner.trim()} onClick={create}>Criar</button></>}>
          <div className="form-grid">
            <label className="field full"><span>Nome *</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Retrabalho na montagem" /></label>
            <label className="field"><span>Processo</span><select className="input" value={f.processId} onChange={(e) => setF({ ...f, processId: e.target.value })}>{db.processes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="field"><span>Responsável *</span><input className="input" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></label>
            <label className="field"><span>Unidade</span><input className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="%, ppm, R$ mil, h" /></label>
            <label className="field"><span>Meta</span><input className="input" type="number" value={f.target} onChange={(e) => setF({ ...f, target: +e.target.value })} /></label>
            <label className="field"><span>Sentido</span><select className="input" value={f.higherIsBetter ? 'up' : 'down'} onChange={(e) => setF({ ...f, higherIsBetter: e.target.value === 'up' })}><option value="up">Quanto maior, melhor</option><option value="down">Quanto menor, melhor</option></select></label>
            <label className="field"><span>Casas decimais</span><input className="input" type="number" min={0} max={3} value={f.decimals} onChange={(e) => setF({ ...f, decimals: +e.target.value })} /></label>
            <label className="field full"><span>Fórmula</span><input className="input" value={f.formula} onChange={(e) => setF({ ...f, formula: e.target.value })} placeholder="Como o valor é calculado" /></label>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function IndicatorDetail() {
  const { id } = useParams();
  const { db, update } = useStore();
  const k = db.kpis.find((x) => x.id === id);
  const months = lastMonths(12);
  const thisMonth = monthKey(new Date());
  const [mv, setMv] = useState<{ month: string; value: string } | null>(null);
  if (!k) return <div className="page"><Link className="crumb" to="/indicadores"><ArrowLeft size={14} />Indicadores</Link><Empty>Indicador não encontrado.</Empty></div>;
  const p = db.processes.find((x) => x.id === k.processId);
  const v = lastValue(k);
  const hits = k.values.filter((x) => kpiOk(k, x.value)).length;
  const avg = k.values.length ? k.values.reduce((s, x) => s + x.value, 0) / k.values.length : NaN;
  const free = [...months, thisMonth].filter((m) => !k.values.some((x) => x.month === m));
  const save = () => {
    if (!mv || mv.value === '' || Number.isNaN(+mv.value.replace(',', '.'))) return;
    const value = +(+mv.value.replace(',', '.')).toFixed(k.decimals);
    update((d) => { const x = d.kpis.find((y) => y.id === k.id); if (!x) return; const e = x.values.find((y) => y.month === mv.month); if (e) e.value = value; else x.values.push({ month: mv.month, value }); x.values.sort((a, b) => a.month.localeCompare(b.month)); if (x.values.length > 24) x.values.shift(); });
    setMv(null);
  };
  return (
    <div className="page">
      <div>
        <Link className="crumb" to="/indicadores"><ArrowLeft size={14} />Indicadores</Link>
        <div className="page-head">
          <div>
            <h1>{k.name}</h1>
            <p>{k.formula}</p>
            <div className="meta-row" style={{ marginTop: 8 }}>
              <KpiPill k={k} v={v?.value} />
              <span>Processo <b><Link to={`/processos/${k.processId}`}>{p?.name}</Link></b></span><span>Responsável <b>{k.owner}</b></span>
              <span>Meta <b>{k.higherIsBetter ? '≥' : '≤'} {fmtKpi(k, k.target)}</b></span>
            </div>
          </div>
          <button className="btn primary" onClick={() => setMv({ month: free[free.length - 1] ?? thisMonth, value: '' })}><Plus />Lançar resultado</button>
        </div>
      </div>
      <div className="tiles">
        <div className="tile"><span className="lab">Último mês</span><span className="val">{v ? fmtKpi(k, v.value) : '—'}</span><span className="sub">{v ? monthLabel(v.month) : 'sem dados'}</span></div>
        <div className="tile"><span className="lab">Média do período</span><span className="val">{Number.isNaN(avg) ? '—' : fmtKpi(k, avg)}</span><span className="sub">{k.values.length} meses</span></div>
        <div className="tile"><span className="lab">Meses na meta</span><span className="val">{k.values.length ? `${hits}/${k.values.length}` : '—'}</span><span className="sub">{k.values.length ? `${nf((hits / k.values.length) * 100)}% do período` : ''}</span></div>
      </div>
      <section className="card">
        <h2>Evolução mensal</h2>
        <p className="how">Pontos vermelhos ficaram fora da meta. A linha tracejada é a meta.</p>
        {k.values.length >= 2 ? <LineChart k={k} /> : <Empty>Lance pelo menos dois meses para ver o gráfico.</Empty>}
      </section>
      <section className="card">
        <h2>Resultados</h2>
        <div className="tscroll" style={{ marginTop: 10 }}><table>
          <thead><tr><th>Mês</th><th>Resultado</th><th>Situação</th><th></th></tr></thead>
          <tbody>{[...k.values].reverse().map((x) => (
            <tr key={x.month}><td>{monthLabel(x.month)}</td><td style={{ fontWeight: 650 }}>{fmtKpi(k, x.value)}</td><td><KpiPill k={k} v={x.value} /></td>
              <td style={{ textAlign: 'right' }}><button className="btn small ghost" onClick={() => setMv({ month: x.month, value: String(x.value).replace('.', ',') })}>Editar</button></td></tr>
          ))}</tbody>
        </table></div>
      </section>
      {mv && (
        <Modal title="Lançar resultado" onClose={() => setMv(null)} footer={<><button className="btn" onClick={() => setMv(null)}>Cancelar</button><button className="btn primary" disabled={mv.value === ''} onClick={save}>Salvar</button></>}>
          <div className="form-grid">
            <label className="field"><span>Mês</span><select className="input" value={mv.month} onChange={(e) => setMv({ ...mv, month: e.target.value })}>
              {[...new Set([...free, mv.month])].sort().map((m) => <option key={m} value={m}>{monthLabel(m)}{k.values.some((x) => x.month === m) ? ' (já lançado)' : ''}</option>)}
            </select></label>
            <label className="field"><span>Resultado ({k.unit})</span><input className="input" inputMode="decimal" value={mv.value} onChange={(e) => setMv({ ...mv, value: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} /></label>
          </div>
        </Modal>
      )}
    </div>
  );
}
