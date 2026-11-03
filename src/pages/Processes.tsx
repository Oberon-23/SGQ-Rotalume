import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useStore } from '../data/store';
import type { ProcessType } from '../data/types';
import { fmtDate, fmtKpi, isOpen, lastValue } from '../data/utils';
import { Empty, KpiPill, SeverityPill, Sparkline, StagePill } from '../components/ui';

const ROWS: { type: ProcessType; label: string }[] = [
  { type: 'gestao', label: 'Processos de gestão' },
  { type: 'principal', label: 'Processos principais (cadeia de valor)' },
  { type: 'apoio', label: 'Processos de apoio' },
];

export default function Processes() {
  const { db } = useStore();
  const openBy = (id: string) => db.ncs.filter((n) => n.processId === id && isOpen(n)).length;
  return (
    <div className="page">
      <div className="page-head"><div><h1>Mapa de processos</h1><p>Como a Rotalume Indústria transforma o pedido do cliente em produto entregue (ISO 9001:2015, cláusula 4.4). Clique em um processo para ver o SIPOC.</p></div></div>
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
    </div>
  );
}

export function ProcessDetail() {
  const { id } = useParams();
  const { db } = useStore();
  const p = db.processes.find((x) => x.id === id);
  if (!p) return <div className="page"><Link className="crumb" to="/processos"><ArrowLeft size={14} />Processos</Link><Empty>Processo não encontrado.</Empty></div>;
  const ncs = db.ncs.filter((n) => n.processId === p.id);
  const kpis = db.kpis.filter((k) => k.processId === p.id);
  const docs = db.docs.filter((d) => d.processId === p.id);
  const audits = db.audits.filter((a) => a.processId === p.id);
  const S = p.sipoc;
  const col = (letter: string, title: string, items: string[]) => (
    <div><h4><em>{letter}</em>{title}</h4><ul>{items.map((x) => <li key={x}>{x}</li>)}</ul></div>
  );
  return (
    <div className="page">
      <div>
        <Link className="crumb" to="/processos"><ArrowLeft size={14} />Mapa de processos</Link>
        <div className="page-head"><div>
          <h1><span className="mono" style={{ fontSize: 18, color: 'var(--muted)', marginRight: 10 }}>{p.code}</span>{p.name}</h1>
          <p>{p.objective}</p>
          <div className="meta-row" style={{ marginTop: 8 }}><span>Dono do processo <b>{p.owner}</b></span><span>Tipo <b>{ROWS.find((r) => r.type === p.type)?.label.replace('Processos ', '')}</b></span></div>
        </div></div>
      </div>
      <section className="card">
        <h2>SIPOC</h2>
        <p className="how">Fornecedores, entradas, etapas do processo, saídas e clientes.</p>
        <div className="sipoc">
          {col('S', 'Fornecedores', S.suppliers)}{col('I', 'Entradas', S.inputs)}{col('P', 'Processo', S.steps)}{col('O', 'Saídas', S.outputs)}{col('C', 'Clientes', S.customers)}
        </div>
        <h2 style={{ margin: '18px 0 10px' }}>Fluxo</h2>
        <div className="flow">{S.steps.map((s, i) => <span key={s} style={{ display: 'contents' }}>{i > 0 && <ArrowRight className="ar" size={16} />}<span className="st">{i + 1}. {s}</span></span>)}</div>
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
    </div>
  );
}
