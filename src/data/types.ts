/* Modelo de dados do SGQ. Tudo é salvo no navegador (localStorage). */

export type ProcessType = 'gestao' | 'principal' | 'apoio';

export interface Process {
  id: string;
  code: string;
  name: string;
  type: ProcessType;
  owner: string;
  objective: string;
  sipoc: { suppliers: string[]; inputs: string[]; steps: string[]; outputs: string[]; customers: string[] };
}

export type NCStage = 'registro' | 'analise' | 'plano' | 'verificacao' | 'encerrada';
export type Severity = 'Menor' | 'Maior' | 'Crítica';
export type Origin = 'Inspeção de processo' | 'Auditoria interna' | 'Reclamação de cliente' | 'Fornecedor' | 'Metrologia';
export const SIX_M = ['Método', 'Máquina', 'Mão de obra', 'Material', 'Medição', 'Meio ambiente'] as const;
export type SixM = (typeof SIX_M)[number];

export interface Action {
  id: string;
  what: string;   // O quê
  why: string;    // Por quê
  where: string;  // Onde
  who: string;    // Quem
  when: string;   // Quando (data ISO)
  how: string;    // Como
  howMuch: number; // Quanto (R$)
  done: boolean;
  /** Coluna no quadro Kanban. Sem valor: "a fazer" (ou "concluído", se done). */
  status?: BoardStatus;
}

export type BoardStatus = 'todo' | 'doing' | 'done';

export interface NonConformity {
  id: string;
  code: string;
  title: string;
  description: string;
  processId: string;
  origin: Origin;
  severity: Severity;
  stage: NCStage;
  owner: string;
  openedAt: string;
  dueAt: string;
  closedAt?: string;
  containment: string;
  whys: string[];
  rootCause: string;
  category: SixM | '';
  ishikawa: Record<SixM, string[]>;
  actions: Action[];
  verification: { effective: boolean | null; evidence: string; date: string };
  auditId?: string;
  complaintId?: string;
  attachments?: Attachment[];
}

/** Arquivo de evidência anexado a um registro (guardado no navegador como data URL). */
export interface Attachment { id: string; name: string; type: string; size: number; data: string; at: string; user: string }

export type AuditResult = 'C' | 'NC' | 'OBS' | 'OM' | null;
export interface AuditItem {
  id: string;
  clause: string;
  requirement: string;
  result: AuditResult;
  evidence: string;
  ncId?: string;
}
export interface Audit {
  id: string;
  code: string;
  processId: string;
  auditor: string;
  date: string;
  done: boolean;
  scope: string;
  items: AuditItem[];
  attachments?: Attachment[];
}

export type DocType = 'Manual' | 'Procedimento' | 'Instrução de trabalho' | 'Formulário';
export type DocStatus = 'vigente' | 'revisao' | 'obsoleto';
export interface DocVersion { version: number; date: string; author: string; change: string }
export interface Doc {
  id: string;
  code: string;
  title: string;
  type: DocType;
  processId: string;
  owner: string;
  status: DocStatus;
  summary: string;
  version: number;
  reviewedAt: string;
  nextReview: string;
  history: DocVersion[];
  /** Revisão em andamento: elaboração → revisão técnica → aprovação. */
  approval?: DocApproval;
}

export type ApprovalStep = 'elaboracao' | 'revisao' | 'aprovacao';
export interface ApprovalEvent { at: string; user: string; text: string; kind: 'enviou' | 'aprovou' | 'devolveu' | 'iniciou' | 'publicou' }
export interface DocApproval {
  step: ApprovalStep;
  change: string;     // o que muda nesta revisão
  author: string;     // quem elabora
  reviewer: string;   // revisão técnica
  approver: string;   // aprovação final
  events: ApprovalEvent[];
}

export interface KPIValue { month: string; value: number } // month = 'AAAA-MM'
export interface KPI {
  id: string;
  name: string;
  processId: string;
  owner: string;
  unit: string;
  target: number;
  higherIsBetter: boolean;
  formula: string;
  decimals: number;
  values: KPIValue[];
}

/* ---------- riscos e oportunidades (ISO 9001, 6.1) ---------- */
export type RiskKind = 'risco' | 'oportunidade';
export type RiskStatus = 'aberto' | 'tratamento' | 'controlado';
export interface Risk {
  id: string;
  code: string;
  kind: RiskKind;
  processId: string;
  title: string;
  cause: string;
  consequence: string;   // para oportunidade: o benefício esperado
  probability: number;   // 1 a 5
  impact: number;        // 1 a 5
  treatment: string;     // Mitigar, Evitar, Transferir, Aceitar | Explorar, Ampliar, Compartilhar
  action: string;
  owner: string;
  reviewAt: string;
  status: RiskStatus;
}

/* ---------- análise crítica pela direção (ISO 9001, 9.3) ---------- */
export interface ReviewSection { clause: string; title: string; items: string[] }
export interface ReviewDecision { id: string; text: string; owner: string; due: string; done: boolean; status?: BoardStatus }
export interface Review {
  id: string;
  code: string;
  date: string;
  from: string;          // período analisado
  to: string;
  participants: string;
  context: string;       // mudanças em questões internas e externas (9.3.2 b)
  inputs: ReviewSection[]; // entradas montadas a partir dos módulos
  decisions: ReviewDecision[];
  conclusion: string;
  closed: boolean;
}

/* ---------- fornecedores (ISO 9001, 8.4) ---------- */
export type SupplierStatus = 'qualificado' | 'condicional' | 'bloqueado';
export interface SupplierEval { month: string; quality: number; delivery: number; service: number; note: string }
export interface Supplier {
  id: string;
  code: string;
  name: string;
  item: string;
  critical: boolean;
  owner: string;
  status: SupplierStatus;
  evals: SupplierEval[];   // mais antiga primeiro
}

/* ---------- competência e treinamentos (ISO 9001, 7.2) ---------- */
export type ParticipantStatus = 'pendente' | 'concluido' | 'eficaz' | 'ineficaz';
export interface Participant { name: string; status: ParticipantStatus }
export interface Training {
  id: string;
  code: string;
  title: string;
  processId: string;
  docId?: string;          // documento que motivou o treinamento
  instructor: string;
  date: string;
  hours: number;
  owner: string;           // quem avalia a eficácia
  evalBy: string;          // data limite da avaliação de eficácia
  participants: Participant[];
  notes: string;
}

/* ---------- reclamações de cliente (ISO 9001, 8.2.1 e 9.1.2) ---------- */
export type ComplaintStatus = 'recebida' | 'analise' | 'respondida' | 'encerrada';
export interface Complaint {
  id: string;
  code: string;
  customer: string;
  product: string;
  description: string;
  quantity: number;
  receivedAt: string;
  dueAt: string;
  owner: string;
  status: ComplaintStatus;
  valid: boolean | null;   // procedente?
  response: string;
  ncId?: string;
  satisfaction?: number;   // 1 a 5, nota do cliente após a resposta
}

/* ---------- objetivos da qualidade (ISO 9001, 6.2) ---------- */
export interface Objective {
  id: string;
  code: string;
  title: string;
  kpiId: string;
  target: number;
  deadline: string;
  owner: string;
  plan: string;
}

/* ---------- usuários de demonstração e trilha de auditoria ---------- */
export type Role = 'gestor' | 'dono' | 'auditor' | 'leitor';
export type Entity = 'processes' | 'ncs' | 'audits' | 'docs' | 'kpis' | 'risks' | 'reviews' | 'suppliers' | 'trainings' | 'complaints' | 'objectives';
export interface LogField { field: string; from: string; to: string }
export interface LogEntry {
  id: string;
  at: string;            // data e hora ISO
  user: string;
  role: Role;
  entity: Entity;
  entityId: string;
  label: string;         // código ou nome do registro, para leitura humana
  action: 'criou' | 'alterou' | 'excluiu';
  fields: LogField[];
}

export interface DB {
  version: number;
  seededAt: string;
  processes: Process[];
  ncs: NonConformity[];
  audits: Audit[];
  docs: Doc[];
  kpis: KPI[];
  risks: Risk[];
  reviews: Review[];
  suppliers: Supplier[];
  trainings: Training[];
  complaints: Complaint[];
  objectives: Objective[];
  log: LogEntry[];
}
