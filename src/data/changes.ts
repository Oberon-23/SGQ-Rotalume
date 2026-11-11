/*
 * Detecção de alterações e trilha de auditoria.
 *
 * Toda gravação passa por `diffDB`, que compara o banco antes e depois e devolve a lista de
 * registros criados, alterados e excluídos. Essa lista alimenta duas coisas:
 *  1. a trilha de auditoria (quem mudou o quê, quando e qual era o valor anterior);
 *  2. a fonte de dados (`DataSource.persist`), que num backend real grava só o que mudou.
 */
import type { DB, Entity, LogEntry, LogField, Role } from './types';
import { brl, fmtDate, nf, stageLabel } from './utils';
import type { NCStage } from './types';

export const ENTITIES: Entity[] = ['processes', 'ncs', 'audits', 'docs', 'kpis', 'risks', 'reviews', 'suppliers', 'trainings', 'complaints', 'objectives'];

export const ENTITY_LABEL: Record<Entity, string> = {
  processes: 'Processo', ncs: 'Não conformidade', audits: 'Auditoria', docs: 'Documento', kpis: 'Indicador', risks: 'Risco/oportunidade', reviews: 'Análise crítica',
  suppliers: 'Fornecedor', trainings: 'Treinamento', complaints: 'Reclamação de cliente', objectives: 'Objetivo da qualidade',
};
export const ENTITY_PATH: Record<Entity, string> = {
  processes: '/processos', ncs: '/nao-conformidades', audits: '/auditorias', docs: '/documentos', kpis: '/indicadores', risks: '/riscos', reviews: '/analise-critica',
  suppliers: '/fornecedores', trainings: '/treinamentos', complaints: '/reclamacoes', objectives: '/objetivos',
};

type Rec = { id: string } & Record<string, unknown>;
export interface Change { entity: Entity; id: string; action: 'create' | 'update' | 'delete'; before?: Rec; after?: Rec }

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Registros criados, alterados e excluídos entre dois estados do banco. */
export function diffDB(prev: DB, next: DB): Change[] {
  const out: Change[] = [];
  for (const entity of ENTITIES) {
    const a = new Map(((prev[entity] ?? []) as unknown as Rec[]).map((r) => [r.id, r]));
    const b = new Map(((next[entity] ?? []) as unknown as Rec[]).map((r) => [r.id, r]));
    for (const [id, after] of b) {
      const before = a.get(id);
      if (!before) out.push({ entity, id, action: 'create', after });
      else if (before !== after && !same(before, after)) out.push({ entity, id, action: 'update', before, after });
    }
    for (const [id, before] of a) if (!b.has(id)) out.push({ entity, id, action: 'delete', before });
  }
  return out;
}

/* ---------- descrição legível dos campos ---------- */

const LABELS: Record<string, string> = {
  title: 'Título', name: 'Nome', code: 'Código', owner: 'Responsável', processId: 'Processo', description: 'Descrição',
  origin: 'Origem', severity: 'Gravidade', stage: 'Etapa', dueAt: 'Prazo', closedAt: 'Encerrada em', openedAt: 'Aberta em',
  containment: 'Contenção', whys: '5 Porquês', rootCause: 'Causa raiz', category: 'Categoria 6M', actions: 'Plano de ação',
  'verification.effective': 'Eficácia', 'verification.evidence': 'Evidência de eficácia', 'verification.date': 'Data da verificação',
  auditId: 'Auditoria de origem', type: 'Tipo', objective: 'Objetivo',
  'sipoc.suppliers': 'SIPOC: fornecedores', 'sipoc.inputs': 'SIPOC: entradas', 'sipoc.steps': 'SIPOC: etapas', 'sipoc.outputs': 'SIPOC: saídas', 'sipoc.customers': 'SIPOC: clientes',
  auditor: 'Auditor', date: 'Data', done: 'Situação', scope: 'Escopo', items: 'Checklist',
  status: 'Status', summary: 'Resumo', version: 'Revisão', reviewedAt: 'Revisado em', nextReview: 'Próxima revisão', history: 'Histórico de revisões',
  unit: 'Unidade', target: 'Meta', higherIsBetter: 'Sentido', formula: 'Fórmula', decimals: 'Casas decimais', values: 'Resultados',
  kind: 'Tipo', cause: 'Causa', consequence: 'Consequência', probability: 'Probabilidade', impact: 'Impacto', treatment: 'Tratamento', action: 'Ação', reviewAt: 'Revisar em',
  from: 'Início do período', to: 'Fim do período', participants: 'Participantes', context: 'Contexto', inputs: 'Entradas', decisions: 'Decisões', conclusion: 'Conclusão', closed: 'Situação',
  attachments: 'Anexos', complaintId: 'Reclamação de origem', item: 'Item fornecido', critical: 'Crítico', evals: 'Avaliações (IQF)',
  instructor: 'Instrutor', hours: 'Carga horária', evalBy: 'Avaliar eficácia até', notes: 'Observações', docId: 'Documento',
  customer: 'Cliente', product: 'Produto', quantity: 'Quantidade', receivedAt: 'Recebida em', valid: 'Procedente', response: 'Resposta ao cliente', ncId: 'Não conformidade', satisfaction: 'Satisfação',
  kpiId: 'Indicador', deadline: 'Prazo', plan: 'Plano',
  'approval.step': 'Aprovação: etapa', 'approval.change': 'Aprovação: o que muda', 'approval.author': 'Aprovação: elabora', 'approval.reviewer': 'Aprovação: revisa', 'approval.approver': 'Aprovação: aprova', 'approval.events': 'Aprovação: andamento',
};
const label = (entity: Entity, f: string) => {
  if (f.startsWith('ishikawa.')) return `Ishikawa: ${f.slice(9)}`;
  if (entity === 'processes' && f === 'owner') return 'Dono do processo';
  if (entity === 'audits' && f === 'done') return 'Situação';
  return LABELS[f] ?? f;
};

const cut = (s: string, n = 140) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Converte um valor em texto curto para a trilha. */
export function fmtValue(entity: Entity, field: string, v: unknown, db?: DB): string {
  if (v === undefined || v === null || v === '') return '—';
  if (field === 'processId' && db) return db.processes.find((p) => p.id === v)?.name ?? String(v);
  if (field === 'stage') return stageLabel(v as NCStage);
  if (field === 'done' && entity === 'audits') return v ? 'Realizada' : 'Programada';
  if (field === 'closed') return v ? 'Concluída' : 'Em andamento';
  if (field === 'higherIsBetter') return v ? 'Maior é melhor' : 'Menor é melhor';
  if (field === 'verification.effective') return v === true ? 'Eficaz' : v === false ? 'Não eficaz' : '—';
  if (field === 'status' && entity === 'docs') return ({ vigente: 'Vigente', revisao: 'Em revisão', obsoleto: 'Obsoleto' } as Record<string, string>)[v as string] ?? String(v);
  if (field === 'status' && entity === 'risks') return ({ aberto: 'Aberto', tratamento: 'Em tratamento', controlado: 'Controlado' } as Record<string, string>)[v as string] ?? String(v);
  if (field === 'status' && entity === 'suppliers') return ({ qualificado: 'Qualificado', condicional: 'Condicional', bloqueado: 'Bloqueado' } as Record<string, string>)[v as string] ?? String(v);
  if (field === 'status' && entity === 'complaints') return ({ recebida: 'Recebida', analise: 'Em análise', respondida: 'Respondida', encerrada: 'Encerrada' } as Record<string, string>)[v as string] ?? String(v);
  if (field === 'approval.step') return ({ elaboracao: 'Elaboração', revisao: 'Revisão técnica', aprovacao: 'Aprovação' } as Record<string, string>)[v as string] ?? String(v);
  if (field === 'valid' && typeof v === 'boolean') return v ? 'Procedente' : 'Improcedente';
  if (field === 'type' && entity === 'processes') return ({ gestao: 'Gestão', principal: 'Principal', apoio: 'Apoio' } as Record<string, string>)[v as string] ?? String(v);
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'number') return nf(v, Number.isInteger(v) ? 0 : 2);
  if (typeof v === 'string') return /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtDate(v) : cut(v);
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === 'string')) return v.filter(Boolean).length ? cut((v as string[]).filter(Boolean).join('; ')) : '—';
    const arr = v as Record<string, unknown>[];
    if (field === 'actions') return `${plural(arr.length, 'ação', 'ações')}, ${arr.filter((a) => a.done).length} concluída(s), ${brl(arr.reduce((s, a) => s + ((a.howMuch as number) || 0), 0))}`;
    if (field === 'items') return `${plural(arr.length, 'requisito', 'requisitos')}, ${arr.filter((i) => i.result).length} avaliado(s), ${arr.filter((i) => i.result === 'NC').length} NC`;
    if (field === 'values') return plural(arr.length, 'mês lançado', 'meses lançados');
    if (field === 'history') return arr.length ? `rev. ${arr[0].version}: ${cut(String(arr[0].change), 80)}` : '—';
    if (field === 'decisions') return `${plural(arr.length, 'decisão', 'decisões')}, ${arr.filter((d) => d.done).length} concluída(s)`;
    if (field === 'inputs') return plural(arr.length, 'seção', 'seções');
    if (field === 'attachments') return arr.length ? cut(arr.map((a) => a.name).join('; ')) : '—';
    if (field === 'evals') return plural(arr.length, 'mês avaliado', 'meses avaliados');
    if (field === 'participants') return `${plural(arr.length, 'participante', 'participantes')}, ${arr.filter((p) => p.status === 'eficaz').length} eficaz(es)`;
    if (field === 'approval.events') return arr.length ? cut(`${arr[0].user}: ${arr[0].text}`, 90) : '—';
    return plural(arr.length, 'item', 'itens');
  }
  return cut(JSON.stringify(v));
}

/** Achata um nível de objetos (sipoc.steps, verification.evidence, ishikawa.Método). */
function flat(r: Rec): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) for (const [k2, v2] of Object.entries(v)) o[`${k}.${k2}`] = v2;
    else o[k] = v;
  }
  return o;
}

const recLabel = (entity: Entity, r?: Rec) => {
  if (!r) return '';
  if (entity === 'kpis') return String(r.name ?? r.id);
  if (entity === 'processes') return `${r.code} · ${r.name}`;
  return String(r.code ?? r.title ?? r.name ?? r.id);
};

/** Campos alterados de um registro, com valor anterior e novo já formatados. */
export function describe(c: Change, db?: DB): LogField[] {
  if (c.action !== 'update' || !c.before || !c.after) return [];
  const a = flat(c.before), b = flat(c.after);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => k !== 'id');
  return keys.filter((k) => !same(a[k], b[k])).map((k) => ({ field: label(c.entity, k), from: fmtValue(c.entity, k.replace(/^ishikawa\..*/, 'ishikawa'), a[k], db), to: fmtValue(c.entity, k.replace(/^ishikawa\..*/, 'ishikawa'), b[k], db) }));
}

const MERGE_WINDOW_MS = 3 * 60 * 1000;
export const LOG_LIMIT = 1500;

/**
 * Acrescenta as alterações à trilha (mais recente primeiro).
 * Edições seguidas no mesmo campo, pela mesma pessoa, em poucos minutos viram uma linha só
 * (senão cada tecla digitada geraria um registro), mantendo o valor original como "antes".
 */
export function appendLog(log: LogEntry[], changes: Change[], user: { name: string; role: Role }, db: DB, now = new Date()): LogEntry[] {
  let out = log.slice();
  for (const c of changes) {
    const action = c.action === 'create' ? 'criou' : c.action === 'delete' ? 'excluiu' : 'alterou';
    const fields = describe(c, db);
    if (action === 'alterou' && !fields.length) continue;
    const last = out[0];
    if (action === 'alterou' && last && last.action === 'alterou' && last.user === user.name && last.entity === c.entity && last.entityId === c.id
      && now.getTime() - new Date(last.at).getTime() < MERGE_WINDOW_MS
      && last.fields.map((f) => f.field).join('|') === fields.map((f) => f.field).join('|')) {
      const merged = last.fields.map((f, i) => ({ ...f, to: fields[i].to })).filter((f) => f.from !== f.to);
      out = merged.length ? [{ ...last, at: now.toISOString(), fields: merged }, ...out.slice(1)] : out.slice(1);
      continue;
    }
    out.unshift({
      id: Math.random().toString(36).slice(2, 10), at: now.toISOString(), user: user.name, role: user.role,
      entity: c.entity, entityId: c.id, label: recLabel(c.entity, c.after ?? c.before), action, fields,
    });
  }
  return out.slice(0, LOG_LIMIT);
}
