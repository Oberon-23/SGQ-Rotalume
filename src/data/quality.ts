/*
 * Regras dos módulos de fornecedores, treinamentos, reclamações, objetivos e aprovação de documentos.
 * Funções puras: as telas e os testes usam as mesmas regras.
 */
import type { ApprovalStep, Complaint, DB, Doc, KPI, Objective, Supplier, SupplierEval, Training } from './types';
import type { User } from './access';
import { addMonths, daysBetween, kpiOk, lastValue, today } from './utils';

/* ---------- fornecedores: IQF ---------- */
export const IQF_WEIGHTS = { quality: 0.5, delivery: 0.3, service: 0.2 };
/** Índice de qualidade do fornecedor: 50% qualidade, 30% entrega, 20% atendimento. */
export const iqf = (e: SupplierEval) => Math.round((e.quality * IQF_WEIGHTS.quality + e.delivery * IQF_WEIGHTS.delivery + e.service * IQF_WEIGHTS.service) * 10) / 10;
export type IqfClass = 'A' | 'B' | 'C';
export const iqfClass = (v: number): IqfClass => (v >= 85 ? 'A' : v >= 70 ? 'B' : 'C');
export const IQF_TONE: Record<IqfClass, string> = { A: 'ok', B: 'warn', C: 'bad' };
export const lastIqf = (s: Supplier) => (s.evals.length ? iqf(s.evals[s.evals.length - 1]) : undefined);

/** O que a regra de avaliação pede para o fornecedor. */
export function supplierAlert(s: Supplier): string | null {
  const last = s.evals.slice(-2).map(iqf);
  if (!last.length || s.status === 'bloqueado') return null;
  if (last.length === 2 && last.every((v) => v < 70)) return 'Dois meses seguidos na classe C: avaliar bloqueio e pedir plano de ação.';
  if (iqfClass(last[last.length - 1]) === 'C') return s.critical ? 'Fornecedor crítico na classe C: pedir plano de ação.' : 'Classe C no último mês: acompanhar.';
  if (s.status === 'condicional' && last.every((v) => v >= 85)) return 'Dois meses na classe A: pode voltar a qualificado.';
  return null;
}

/* ---------- treinamentos ---------- */
export type TrainingState = 'programado' | 'avaliar' | 'concluido';
export function trainingState(t: Training, T = today()): TrainingState {
  if (t.date > T) return 'programado';
  return t.participants.some((p) => p.status === 'pendente' || p.status === 'concluido') ? 'avaliar' : 'concluido';
}
export const TRAINING_LABEL: Record<TrainingState, [string, string]> = { programado: ['Programado', 'info'], avaliar: ['Avaliar eficácia', 'warn'], concluido: ['Concluído', 'ok'] };
export const evalLate = (t: Training, T = today()) => trainingState(t, T) === 'avaliar' && t.evalBy < T;
/** Eficácia = participantes eficazes ÷ participantes avaliados. */
export function trainingEfficacy(t: Training) {
  const done = t.participants.filter((p) => p.status === 'eficaz' || p.status === 'ineficaz');
  return done.length ? Math.round((done.filter((p) => p.status === 'eficaz').length / done.length) * 100) : null;
}

/* ---------- reclamações ---------- */
export const COMPLAINT_LABEL: Record<Complaint['status'], [string, string]> = { recebida: ['Recebida', 'accent'], analise: ['Em análise', 'info'], respondida: ['Respondida', 'warn'], encerrada: ['Encerrada', 'ok'] };
export const complaintOpen = (c: Complaint) => c.status === 'recebida' || c.status === 'analise';
export const complaintLate = (c: Complaint, T = today()) => complaintOpen(c) && c.dueAt < T;
/** O que falta para a reclamação avançar. Lista vazia = pode avançar. */
export function complaintBlockers(c: Complaint): string[] {
  const b: string[] = [];
  if (c.status === 'analise' || c.status === 'recebida') {
    if (c.valid === null) b.push('Diga se a reclamação é procedente.');
    if (!c.response.trim()) b.push('Escreva a resposta ao cliente.');
    if (c.valid === true && !c.ncId) b.push('Reclamação procedente precisa de uma não conformidade.');
  }
  return b;
}
/** Média da nota de satisfação nas reclamações respondidas (1 a 5). */
export function satisfaction(list: Complaint[]) {
  const n = list.filter((c) => c.satisfaction).map((c) => c.satisfaction!);
  return n.length ? Math.round((n.reduce((a, b) => a + b, 0) / n.length) * 10) / 10 : null;
}

/* ---------- objetivos ---------- */
export type ObjectiveState = 'atingido' | 'caminho' | 'risco' | 'atrasado';
export const OBJECTIVE_LABEL: Record<ObjectiveState, [string, string]> = { atingido: ['Atingido', 'ok'], caminho: ['No caminho', 'info'], risco: ['Em risco', 'warn'], atrasado: ['Prazo vencido', 'bad'] };
/** Progresso de 0 a 100 entre o primeiro valor do indicador (linha de base) e a meta do objetivo. */
export function objectiveProgress(o: Objective, k?: KPI) {
  const base = k?.values[0]?.value, cur = k ? lastValue(k)?.value : undefined;
  if (!k || base === undefined || cur === undefined) return { base, cur, pct: 0, done: false };
  const done = kpiOk({ ...k, target: o.target }, cur);
  const span = o.target - base;
  const pct = done ? 100 : span === 0 ? 0 : Math.max(0, Math.min(99, Math.round(((cur - base) / span) * 100)));
  return { base, cur, pct, done };
}
export function objectiveState(o: Objective, k?: KPI, T = today()): ObjectiveState {
  const { pct, done } = objectiveProgress(o, k);
  if (done) return 'atingido';
  if (o.deadline < T) return 'atrasado';
  return pct >= 50 ? 'caminho' : 'risco';
}

/* ---------- aprovação de documentos ---------- */
export const STEP_LABEL: Record<ApprovalStep, string> = { elaboracao: 'Elaboração', revisao: 'Revisão técnica', aprovacao: 'Aprovação' };
export const STEPS: ApprovalStep[] = ['elaboracao', 'revisao', 'aprovacao'];
/** Quem age na etapa atual. */
export const stepOwner = (d: Doc) => (!d.approval ? undefined : d.approval.step === 'elaboracao' ? d.approval.author : d.approval.step === 'revisao' ? d.approval.reviewer : d.approval.approver);
/** Só quem está com a etapa (ou a gestão da qualidade) pode agir. Leitor nunca. */
export const canActOnApproval = (d: Doc, u: User) => !!d.approval && u.role !== 'leitor' && (u.role === 'gestor' || stepOwner(d) === u.name);
/** Separação de funções: quem elabora não revisa nem aprova a própria revisão. */
export function approvalProblems(a: { change: string; author: string; reviewer: string; approver: string }) {
  const p: string[] = [];
  if (!a.change.trim()) p.push('Descreva o que muda nesta revisão.');
  if (!a.author.trim() || !a.reviewer.trim() || !a.approver.trim()) p.push('Indique quem elabora, quem revisa e quem aprova.');
  if (a.author && (a.author === a.reviewer || a.author === a.approver)) p.push('Quem elabora não pode revisar nem aprovar a própria revisão.');
  return p;
}
const stamp = () => new Date().toISOString();

export function startRevision(d: Doc, a: { change: string; author: string; reviewer: string; approver: string }, user: string) {
  d.status = 'revisao';
  d.approval = { step: 'elaboracao', ...a, events: [{ at: stamp(), user, kind: 'iniciou', text: 'Revisão aberta.' }] };
}
/** Avança: elaboração → revisão → aprovação → publicada (nova revisão vigente). Devolve true quando publica. */
export function advance(d: Doc, user: string, text: string): boolean {
  const a = d.approval;
  if (!a) return false;
  if (a.step === 'elaboracao') { a.step = 'revisao'; a.events.unshift({ at: stamp(), user, kind: 'enviou', text: text || 'Enviado para revisão técnica.' }); return false; }
  if (a.step === 'revisao') { a.step = 'aprovacao'; a.events.unshift({ at: stamp(), user, kind: 'aprovou', text: text || 'Revisão técnica aprovada.' }); return false; }
  const T = today();
  d.version += 1;
  d.reviewedAt = T;
  d.nextReview = addMonths(T, 12);
  d.status = 'vigente';
  d.history.unshift({ version: d.version, date: T, author: a.author, change: `${a.change} Revisado por ${a.reviewer}, aprovado por ${user}.` });
  delete d.approval;
  return true;
}
export function sendBack(d: Doc, user: string, text: string) {
  if (!d.approval || !text.trim()) return;
  d.approval.step = 'elaboracao';
  d.approval.events.unshift({ at: stamp(), user, kind: 'devolveu', text });
}
export function cancelRevision(d: Doc) { delete d.approval; d.status = 'vigente'; }

/* ---------- anexos ---------- */
export const MAX_FILE = 400 * 1024;
export const MAX_FILES = 6;
export const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** Quantos dias faltam (negativo = vencido). */
export const daysLeft = (iso: string, T = today()) => daysBetween(T, iso);
/** Tudo o que os módulos novos pedem de atenção, para o painel. */
export function qualitySummary(db: DB, T = today()) {
  return {
    complaintsOpen: db.complaints.filter(complaintOpen).length,
    complaintsLate: db.complaints.filter((c) => complaintLate(c, T)).length,
    suppliersC: db.suppliers.filter((s) => { const v = lastIqf(s); return v !== undefined && iqfClass(v) === 'C'; }).length,
    trainingsToEval: db.trainings.filter((t) => trainingState(t, T) === 'avaliar').length,
    docsInApproval: db.docs.filter((d) => d.approval).length,
  };
}
