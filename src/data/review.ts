/*
 * Entradas da análise crítica pela direção (ISO 9001:2015, 9.3.2), montadas a partir dos módulos.
 * O resultado é gravado na análise como "foto" do período: se os dados mudarem depois,
 * a ata continua mostrando o que foi discutido na reunião.
 */
import type { DB, ReviewSection } from './types';
import { auditFindings, brl, fmtDate, fmtKpi, kpiOk, lastValue, nf, riskLevel, today } from './utils';

const pct = (a: number, b: number) => (b ? `${nf((a / b) * 100)}%` : '—');
const inPeriod = (d: string | undefined, from: string, to: string) => !!d && d >= from && d <= to;

export function reviewInputs(db: DB, from: string, to: string, excludeId?: string): ReviewSection[] {
  const T = today();
  const k = (id: string) => db.kpis.find((x) => x.id === id);
  const kLine = (id: string, name?: string) => {
    const x = k(id); const v = x && lastValue(x);
    return x && v ? `${name ?? x.name}: ${fmtKpi(x, v.value)} (meta ${x.higherIsBetter ? '≥' : '≤'} ${fmtKpi(x, x.target)}) · ${kpiOk(x, v.value) ? 'na meta' : 'fora da meta'}.` : null;
  };

  // a) ações de análises críticas anteriores
  const prevDecisions = db.reviews.filter((r) => r.id !== excludeId && r.date < to).flatMap((r) => r.decisions.map((d) => ({ ...d, code: r.code })));
  const a = prevDecisions.length
    ? [`${prevDecisions.filter((d) => d.done).length} de ${prevDecisions.length} decisões anteriores concluídas.`,
      ...prevDecisions.filter((d) => !d.done).map((d) => `Pendente (${d.code}): ${d.text} · ${d.owner}, prazo ${fmtDate(d.due)}${d.due < T ? ' (vencido)' : ''}.`)]
    : ['Primeira análise crítica registrada no sistema.'];

  // c1) satisfação do cliente
  const complaints = db.ncs.filter((n) => n.origin === 'Reclamação de cliente' && inPeriod(n.openedAt, from, to));
  const c1 = [kLine('ppm'), `${complaints.length} reclamação(ões) de cliente registrada(s) no período${complaints.length ? `: ${complaints.map((n) => n.code).join(', ')}` : ''}.`].filter(Boolean) as string[];

  // c2) objetivos da qualidade
  const withV = db.kpis.filter((x) => lastValue(x));
  const off = withV.filter((x) => !kpiOk(x, lastValue(x)!.value));
  const c2 = [`${withV.length - off.length} de ${withV.length} indicadores na meta no último mês fechado.`, ...(off.length ? [`Fora da meta: ${off.map((x) => x.name).join(', ')}.`] : [])];

  // c3) desempenho dos processos e conformidade dos produtos
  const c3 = [kLine('oee'), kLine('fpy'), kLine('copq'), kLine('aderencia')].filter(Boolean) as string[];

  // c4) não conformidades e ações corretivas
  const opened = db.ncs.filter((n) => inPeriod(n.openedAt, from, to));
  const closed = db.ncs.filter((n) => inPeriod(n.closedAt, from, to));
  const open = db.ncs.filter((n) => n.stage !== 'encerrada');
  const late = open.filter((n) => n.dueAt < T);
  const effective = closed.filter((n) => n.verification.effective === true);
  const onTime = closed.filter((n) => (n.closedAt ?? '') <= n.dueAt);
  const c4 = [
    `${opened.length} não conformidade(s) aberta(s) e ${closed.length} encerrada(s) no período.`,
    `Em aberto hoje: ${open.length}, sendo ${late.length} vencida(s)${late.length ? ` (${late.map((n) => n.code).join(', ')})` : ''}.`,
    `Encerradas no prazo: ${pct(onTime.length, closed.length)}. Eficácia confirmada: ${pct(effective.length, closed.length)}.`,
  ];

  // c5) monitoramento e medição
  const docsLate = db.docs.filter((d) => d.status !== 'obsoleto' && d.nextReview < T);
  const c5 = [kLine('calib'), `${docsLate.length} documento(s) com revisão periódica vencida${docsLate.length ? `: ${docsLate.map((d) => d.code).join(', ')}` : ''}.`].filter(Boolean) as string[];

  // c6) auditorias
  const auds = db.audits.filter((x) => x.done && inPeriod(x.date, from, to));
  const f = auds.reduce((s, x) => { const y = auditFindings(x); return { nc: s.nc + y.nc, obs: s.obs + y.obs, om: s.om + y.om }; }, { nc: 0, obs: 0, om: 0 });
  const planned = db.audits.filter((x) => !x.done);
  const c6 = [
    `${auds.length} auditoria(s) interna(s) realizada(s)${auds.length ? `: ${auds.map((x) => x.code).join(', ')}` : ''}.`,
    `Constatações: ${f.nc} não conformidade(s), ${f.obs} observação(ões), ${f.om} oportunidade(s) de melhoria.`,
    `${planned.length} auditoria(s) programada(s) daqui para frente.`,
  ];

  // c7) provedores externos
  const supplier = db.ncs.filter((n) => n.origin === 'Fornecedor' && inPeriod(n.openedAt, from, to));
  const c7 = [`${supplier.length} não conformidade(s) de fornecedor no período${supplier.length ? `: ${supplier.map((n) => `${n.code} (${n.title})`).join('; ')}` : ''}.`];

  // d) recursos
  const actions = db.ncs.flatMap((n) => n.actions).filter((x) => inPeriod(x.when, from, to));
  const d = [`Investimento em ações corretivas no período: ${brl(actions.reduce((s, x) => s + (x.howMuch || 0), 0))} em ${actions.length} ação(ões).`];

  // e) ações para riscos e oportunidades
  const risks = db.risks.filter((r) => r.kind === 'risco');
  const hot = risks.filter((r) => r.probability * r.impact >= 10);
  const e = [
    `${risks.length} risco(s) mapeado(s): ${risks.filter((r) => r.status === 'controlado').length} controlado(s), ${risks.filter((r) => r.status === 'tratamento').length} em tratamento, ${risks.filter((r) => r.status === 'aberto').length} aberto(s).`,
    ...(hot.length ? [`Riscos altos ou críticos: ${hot.map((r) => `${r.code} ${r.title} (${riskLevel(r.probability, r.impact).label.toLowerCase()}, ${r.status === 'controlado' ? 'controlado' : 'sem controle'})`).join('; ')}.`] : []),
  ];

  // f) oportunidades de melhoria
  const oms = auds.flatMap((x) => x.items.filter((i) => i.result === 'OM').map((i) => `${x.code}: ${i.evidence}`));
  const opps = db.risks.filter((r) => r.kind === 'oportunidade' && r.status !== 'controlado').map((r) => `${r.code}: ${r.title}`);
  const fx = [...oms, ...opps];

  return [
    { clause: '9.3.2 a', title: 'Ações de análises críticas anteriores', items: a },
    { clause: '9.3.2 c1', title: 'Satisfação do cliente', items: c1 },
    { clause: '9.3.2 c2', title: 'Objetivos da qualidade', items: c2 },
    { clause: '9.3.2 c3', title: 'Desempenho dos processos e conformidade dos produtos', items: c3 },
    { clause: '9.3.2 c4', title: 'Não conformidades e ações corretivas', items: c4 },
    { clause: '9.3.2 c5', title: 'Resultados de monitoramento e medição', items: c5 },
    { clause: '9.3.2 c6', title: 'Resultados de auditorias', items: c6 },
    { clause: '9.3.2 c7', title: 'Desempenho de provedores externos', items: c7 },
    { clause: '9.3.2 d', title: 'Adequação de recursos', items: d },
    { clause: '9.3.2 e', title: 'Eficácia das ações para riscos e oportunidades', items: e },
    { clause: '9.3.2 f', title: 'Oportunidades de melhoria', items: fx.length ? fx : ['Nenhuma registrada no período.'] },
  ];
}
