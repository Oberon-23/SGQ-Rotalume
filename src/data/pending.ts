/*
 * Pendências de cada pessoa, calculadas a partir dos módulos.
 * Alimentam a página "Minhas pendências", o card do painel e o sino de notificações.
 * Em produção, a mesma função roda num agendamento no servidor e dispara os e-mails de prazo.
 */
import type { DB } from './types';
import { daysBetween, lastMonths, monthLabel, stageLabel, today } from './utils';
import { COMPLAINT_LABEL, STEP_LABEL, complaintOpen, stepOwner, trainingState } from './quality';

export type TaskKind = 'nc' | 'acao' | 'documento' | 'auditoria' | 'indicador' | 'risco' | 'decisao' | 'reclamacao' | 'treinamento' | 'aprovacao' | 'fornecedor';

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  detail: string;
  path: string;
  due?: string;      // data limite, quando houver
  days?: number;     // dias até o prazo (negativo = vencido)
}

export const KIND_LABEL: Record<TaskKind, string> = {
  nc: 'Não conformidade', acao: 'Ação 5W2H', documento: 'Documento', auditoria: 'Auditoria', indicador: 'Indicador', risco: 'Risco', decisao: 'Decisão da direção',
  reclamacao: 'Reclamação', treinamento: 'Treinamento', aprovacao: 'Aprovação de documento', fornecedor: 'Fornecedor',
};

/** Janela para um prazo contar como "chegando" nas notificações. */
export const SOON_DAYS = 7;

export function tasksFor(db: DB, name: string): Task[] {
  const T = today();
  const out: Task[] = [];
  const add = (t: Omit<Task, 'days'>) => out.push({ ...t, days: t.due ? daysBetween(T, t.due) : undefined });

  db.ncs.filter((n) => n.stage !== 'encerrada').forEach((n) => {
    if (n.owner === name) add({ id: `nc-${n.id}`, kind: 'nc', title: `${n.code} · ${n.title}`, detail: `Conduzir: ${stageLabel(n.stage).toLowerCase()}`, path: `/nao-conformidades/${n.id}`, due: n.dueAt });
    n.actions.filter((a) => !a.done && a.who === name).forEach((a) =>
      add({ id: `acao-${a.id}`, kind: 'acao', title: a.what || 'Ação sem descrição', detail: `Plano de ação da ${n.code}`, path: `/nao-conformidades/${n.id}`, due: a.when }));
  });

  db.docs.filter((d) => d.approval && stepOwner(d) === name).forEach((d) =>
    add({ id: `apr-${d.id}`, kind: 'aprovacao', title: `${d.code} · ${d.title}`, detail: d.approval!.step === 'elaboracao' ? 'Concluir a elaboração e enviar para revisão' : `${STEP_LABEL[d.approval!.step]}: revisão ${d.version + 1}`, path: `/documentos/${d.id}` }));

  db.docs.filter((d) => d.owner === name && d.status !== 'obsoleto' && !d.approval).forEach((d) => {
    const days = daysBetween(T, d.nextReview);
    if (days <= 30 || d.status === 'revisao') add({ id: `doc-${d.id}`, kind: 'documento', title: `${d.code} · ${d.title}`, detail: d.status === 'revisao' ? 'Em revisão: publicar a nova revisão' : 'Revisão periódica', path: `/documentos/${d.id}`, due: d.nextReview });
  });

  db.audits.filter((a) => !a.done && a.auditor === name).forEach((a) => {
    const p = db.processes.find((x) => x.id === a.processId);
    add({ id: `aud-${a.id}`, kind: 'auditoria', title: `${a.code} · ${p?.name ?? 'Auditoria'}`, detail: 'Conduzir a auditoria interna', path: `/auditorias/${a.id}`, due: a.date });
  });

  const lastClosed = lastMonths(1)[0];
  db.kpis.filter((k) => k.owner === name && !k.values.some((v) => v.month === lastClosed)).forEach((k) =>
    add({ id: `kpi-${k.id}`, kind: 'indicador', title: k.name, detail: `Lançar o resultado de ${monthLabel(lastClosed)}`, path: `/indicadores/${k.id}`, due: `${T.slice(0, 7)}-10` }));

  db.risks.filter((r) => r.owner === name && (r.status !== 'controlado' || daysBetween(T, r.reviewAt) <= 30)).forEach((r) =>
    add({ id: `risk-${r.id}`, kind: 'risco', title: `${r.code} · ${r.title}`, detail: r.status === 'controlado' ? 'Reavaliar o risco' : 'Tratar e reavaliar', path: `/riscos/${r.id}`, due: r.reviewAt }));

  db.reviews.forEach((rv) => rv.decisions.filter((d) => !d.done && d.owner === name).forEach((d) =>
    add({ id: `dec-${rv.id}-${d.id}`, kind: 'decisao', title: d.text || 'Decisão sem descrição', detail: `Análise crítica ${rv.code}`, path: `/analise-critica/${rv.id}`, due: d.due })));

  db.complaints.filter((c) => c.owner === name && complaintOpen(c)).forEach((c) =>
    add({ id: `rc-${c.id}`, kind: 'reclamacao', title: `${c.code} · ${c.customer}`, detail: `${COMPLAINT_LABEL[c.status][0]}: responder ao cliente`, path: `/reclamacoes/${c.id}`, due: c.dueAt }));

  db.trainings.filter((t) => t.owner === name && trainingState(t, T) === 'avaliar').forEach((t) =>
    add({ id: `tr-${t.id}`, kind: 'treinamento', title: `${t.code} · ${t.title}`, detail: 'Avaliar a eficácia do treinamento', path: `/treinamentos/${t.id}`, due: t.evalBy }));

  db.suppliers.filter((s) => s.owner === name && s.status !== 'bloqueado' && !s.evals.some((e) => e.month === lastClosed)).forEach((s) =>
    add({ id: `sup-${s.id}`, kind: 'fornecedor', title: `${s.code} · ${s.name}`, detail: `Avaliar o IQF de ${monthLabel(lastClosed)}`, path: `/fornecedores/${s.id}`, due: `${T.slice(0, 7)}-10` }));

  return out.sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));
}

/** O que vira notificação: vencido ou com prazo nos próximos dias. */
export const notifications = (tasks: Task[]) => tasks.filter((t) => t.days !== undefined && t.days <= SOON_DAYS);

export const dueText = (t: Task) => t.days === undefined ? '' : t.days < 0 ? `Venceu há ${-t.days} dia${t.days === -1 ? '' : 's'}` : t.days === 0 ? 'Vence hoje' : `Vence em ${t.days} dia${t.days === 1 ? '' : 's'}`;
