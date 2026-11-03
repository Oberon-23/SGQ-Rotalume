import { Link } from 'react-router-dom';
import { useStore } from '../data/store';
import { auditFindings, daysBetween, docDueSoon, docOverdue, fmtDate, fmtKpi, isLate, isOpen, kpiOk, lastValue, lateActions, STAGES, today } from '../data/utils';
import { Headline, KpiPill, SeverityPill, Sparkline, StagePill } from '../components/ui';

export default function Dashboard() {
  const { db } = useStore();
  const T = today();
  const pname = (id: string) => db.processes.find((p) => p.id === id)?.name ?? '—';
  const open = db.ncs.filter(isOpen);
  const late = open.filter(isLate);
  const actionsLate = open.flatMap((n) => lateActions(n).map((a) => ({ a, n })));
  const nextAudits = db.audits.filter((a) => !a.done).sort((a, b) => a.date.localeCompare(b.date));
  const docsLate = db.docs.filter(docOverdue);
  const docsSoon = db.docs.filter(docDueSoon);
  const kOff = db.kpis.filter((k) => { const v = lastValue(k); return v && !kpiOk(k, v.value); });
  const lastAudit = db.audits.filter((a) => a.done).sort((a, b) => b.date.localeCompare(a.date))[0];

  const attention = [
    ...late.map((n) => ({ key: n.id, to: `/nao-conformidades/${n.id}`, title: `${n.code} · ${n.title}`, sub: `Prazo vencido há ${daysBetween(n.dueAt, T)} dias · ${pname(n.processId)}`, tone: 'bad' as const, tag: 'NC vencida' })),
    ...actionsLate.map(({ a, n }) => ({ key: a.id, to: `/nao-conformidades/${n.id}`, title: a.what, sub: `${n.code} · ${a.who} · venceu em ${fmtDate(a.when)}`, tone: 'bad' as const, tag: 'Ação atrasada' })),
    ...docsLate.map((d) => ({ key: d.id, to: `/documentos/${d.id}`, title: `${d.code} · ${d.title}`, sub: `Revisão venceu em ${fmtDate(d.nextReview)}`, tone: 'warn' as const, tag: 'Revisão vencida' })),
    ...kOff.map((k) => ({ key: k.id, to: `/indicadores/${k.id}`, title: k.name, sub: `Último mês: ${fmtKpi(k, lastValue(k)?.value ?? 0)} · meta ${fmtKpi(k, k.target)}`, tone: 'warn' as const, tag: 'Fora da meta' })),
  ];
  const tone = late.length || actionsLate.length ? 'bad' : attention.length ? 'warn' : 'ok';

  return (
    <div className="page">
      <div className="page-head"><div><h1>Painel do sistema da qualidade</h1><p>O que está aberto, o que venceu e o que precisa de decisão hoje.</p></div></div>
      <Headline tone={tone} title={late.length ? `${late.length} ${late.length === 1 ? 'não conformidade está vencida' : 'não conformidades estão vencidas'} e ${open.length - late.length} seguem no prazo.` : `Nenhuma não conformidade vencida. ${open.length} em andamento.`}>
        {kOff.length ? `${kOff.length} de ${db.kpis.length} indicadores ficaram fora da meta no último mês.` : 'Todos os indicadores ficaram na meta no último mês.'}
        {nextAudits[0] ? ` A próxima auditoria interna é em ${fmtDate(nextAudits[0].date)}, no processo ${pname(nextAudits[0].processId)}.` : ''}
      </Headline>

      <div className="tiles five">
        <Link className="tile" to="/nao-conformidades"><span className="lab">Não conformidades abertas</span><span className="val">{open.length}</span><span className="sub">{late.length} {late.length === 1 ? 'vencida' : 'vencidas'} · {open.filter((n) => n.severity !== 'Menor').length} maiores ou críticas</span></Link>
        <Link className="tile" to="/nao-conformidades"><span className="lab">Ações atrasadas</span><span className="val" style={{ color: actionsLate.length ? 'var(--bad)' : undefined }}>{actionsLate.length}</span><span className="sub">de {open.reduce((s, n) => s + n.actions.filter((a) => !a.done).length, 0)} ações pendentes</span></Link>
        <Link className="tile" to="/auditorias"><span className="lab">Auditorias programadas</span><span className="val">{nextAudits.length}</span><span className="sub">{lastAudit ? `Última: ${lastAudit.code}, ${auditFindings(lastAudit).nc} NC` : 'Nenhuma realizada'}</span></Link>
        <Link className="tile" to="/documentos"><span className="lab">Documentos a revisar</span><span className="val">{docsLate.length + docsSoon.length}</span><span className="sub">{docsLate.length} vencidos · {docsSoon.length} nos próximos 30 dias</span></Link>
        <Link className="tile" to="/indicadores"><span className="lab">Indicadores na meta</span><span className="val">{db.kpis.length - kOff.length}/{db.kpis.length}</span><span className="sub">no último mês fechado</span></Link>
      </div>

      <div className="grid">
        <section className="card s7">
          <div className="card-h"><h2>Precisa de atenção</h2><span className="muted" style={{ fontSize: 13 }}>{attention.length} itens</span></div>
          {attention.length ? (
            <ul className="list">
              {attention.slice(0, 8).map((x) => (
                <li key={x.key}><Link to={x.to} style={{ minWidth: 0 }}><b>{x.title}</b><div className="s">{x.sub}</div></Link><span className={`pill dot ${x.tone}`}>{x.tag}</span></li>
              ))}
            </ul>
          ) : <p className="muted">Nada pendente. Bom trabalho!</p>}
        </section>
        <section className="card s5">
          <h2>Não conformidades por etapa</h2>
          <p className="how">O ciclo PDCA de cada tratamento, da contenção à verificação de eficácia.</p>
          <ul className="list">
            {STAGES.filter((s) => s.id !== 'encerrada').map((s) => {
              const n = open.filter((x) => x.stage === s.id).length;
              return (
                <li key={s.id}>
                  <span><span className="mono muted" style={{ fontSize: 12, marginRight: 8 }}>{s.pdca}</span>{s.label}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 45%' }}>
                    <span style={{ flex: 1, height: 8, background: 'var(--surface-2)', borderRadius: 8, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${open.length ? (n / open.length) * 100 : 0}%`, background: 'var(--accent)', borderRadius: 8 }} /></span>
                    <b style={{ width: 18, textAlign: 'right' }}>{n}</b>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="card s7">
          <div className="card-h"><h2>Não conformidades em aberto</h2><Link className="btn small" to="/nao-conformidades">Ver todas</Link></div>
          <ul className="list">
            {open.sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 6).map((n) => (
              <li key={n.id}><Link to={`/nao-conformidades/${n.id}`} style={{ minWidth: 0 }}><b>{n.code}</b> <span className="ink2">{n.title}</span><div className="s">{pname(n.processId)} · prazo {fmtDate(n.dueAt)}{isLate(n) ? ' · vencida' : ''}</div></Link>
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}><SeverityPill s={n.severity} /><StagePill s={n.stage} /></span></li>
            ))}
          </ul>
        </section>
        <section className="card s5">
          <div className="card-h"><h2>Indicadores</h2><Link className="btn small" to="/indicadores">Ver todos</Link></div>
          <ul className="list">
            {db.kpis.map((k) => { const v = lastValue(k); return (
              <li key={k.id}><Link to={`/indicadores/${k.id}`} style={{ minWidth: 0 }}><b style={{ fontSize: 14 }}>{k.name}</b><div className="s">{v ? fmtKpi(k, v.value) : 'Sem resultado'} · meta {fmtKpi(k, k.target)}</div></Link>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sparkline k={k} /><KpiPill k={k} v={v?.value} /></span></li>
            ); })}
          </ul>
        </section>
      </div>
    </div>
  );
}
