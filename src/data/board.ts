/*
 * Quadro Kanban de ações: junta as ações 5W2H das não conformidades em aberto e as decisões
 * da análise crítica num quadro só, com três colunas. Mover um cartão grava no próprio registro
 * de origem (e entra na trilha de auditoria como qualquer alteração).
 */
import type { BoardStatus, DB } from './types';
import { today } from './utils';

export const COLUMNS: { id: BoardStatus; label: string; help: string }[] = [
  { id: 'todo', label: 'A fazer', help: 'Planejado, ainda não começou' },
  { id: 'doing', label: 'Em andamento', help: 'Alguém está executando agora' },
  { id: 'done', label: 'Concluído', help: 'Feito, aguardando verificação de eficácia' },
];
/** Limite de trabalho em andamento por pessoa: acima disso o quadro avisa. */
export const WIP_PER_PERSON = 2;

export interface Card {
  key: string;
  kind: 'acao' | 'decisao';
  id: string;
  parentId: string;
  parentCode: string;
  parentTitle: string;
  path: string;
  title: string;
  who: string;
  due: string;
  cost?: number;
  status: BoardStatus;
  late: boolean;
  /** Dono do processo da NC (pode mover as ações dela). */
  processOwner?: string;
}

export const statusOf = (x: { done: boolean; status?: BoardStatus }): BoardStatus => (x.done ? 'done' : x.status === 'doing' ? 'doing' : 'todo');

export function cards(db: DB, T = today()): Card[] {
  const out: Card[] = [];
  db.ncs.filter((n) => n.stage !== 'encerrada').forEach((n) => n.actions.forEach((a) => {
    const status = statusOf(a);
    out.push({ key: `acao:${n.id}:${a.id}`, kind: 'acao', id: a.id, parentId: n.id, parentCode: n.code, parentTitle: n.title, path: `/nao-conformidades/${n.id}`,
      title: a.what || 'Ação sem descrição', who: a.who, due: a.when, cost: a.howMuch, status, late: status !== 'done' && !!a.when && a.when < T,
      processOwner: db.processes.find((p) => p.id === n.processId)?.owner });
  }));
  db.reviews.forEach((r) => r.decisions.forEach((d) => {
    const status = statusOf(d);
    out.push({ key: `decisao:${r.id}:${d.id}`, kind: 'decisao', id: d.id, parentId: r.id, parentCode: r.code, parentTitle: 'Análise crítica pela direção', path: `/analise-critica/${r.id}`,
      title: d.text || 'Decisão sem descrição', who: d.owner, due: d.due, status, late: status !== 'done' && !!d.due && d.due < T });
  }));
  return out;
}

/** Move o cartão para outra coluna, gravando no registro de origem. */
export function moveCard(db: DB, key: string, to: BoardStatus) {
  const [kind, parentId, id] = key.split(':');
  const item = kind === 'acao'
    ? db.ncs.find((n) => n.id === parentId)?.actions.find((a) => a.id === id)
    : db.reviews.find((r) => r.id === parentId)?.decisions.find((d) => d.id === id);
  if (!item) return;
  item.done = to === 'done';
  if (to === 'todo') delete item.status; else item.status = to;
}

/** Pessoas com mais cartões em andamento do que o limite. */
export const overWip = (list: Card[]) => {
  const n = new Map<string, number>();
  list.filter((c) => c.status === 'doing').forEach((c) => n.set(c.who, (n.get(c.who) ?? 0) + 1));
  return [...n].filter(([, v]) => v > WIP_PER_PERSON).map(([k]) => k);
};
