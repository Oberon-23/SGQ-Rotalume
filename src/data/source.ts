/*
 * Fonte de dados do SGQ.
 *
 * As telas nunca falam direto com o armazenamento: tudo passa pelo store (store.tsx), que
 * calcula o que mudou e chama `persist` da fonte ativa. Para levar o sistema a um banco real,
 * basta escrever outra implementação de `DataSource` (veja docs/arquitetura.md) e trocar a
 * linha `export const source = localSource` no fim deste arquivo. As telas não mudam.
 */
import type { DB } from './types';
import type { Change } from './changes';
import { DB_VERSION, seedReviews, seedRisks } from './seed';
import { today } from './utils';

export interface DataSource {
  /** Nome exibido na tela de dados. */
  readonly name: string;
  /** Carrega o banco, ou null se ainda não houver nada salvo. */
  load(): DB | null;
  /** Grava o novo estado. `changes` traz só os registros criados, alterados ou excluídos. */
  persist(next: DB, changes: Change[]): void;
  /** Apaga tudo (usado ao restaurar os dados de exemplo). */
  clear(): void;
}

const KEY = 'sgq-rotalume';

/** Modo demonstração: tudo fica no navegador de quem está usando. */
export const localSource: DataSource = {
  name: 'Navegador (modo demonstração)',
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? migrate(JSON.parse(raw)) : null;
    } catch { return null; }
  },
  persist(next) {
    localStorage.setItem(KEY, JSON.stringify(next));
  },
  clear() {
    try { localStorage.removeItem(KEY); } catch { /* sem armazenamento */ }
  },
};

/**
 * Atualiza dados salvos por versões anteriores, sem perder o que o usuário cadastrou.
 * v1 → v2: entram os módulos de riscos e análise crítica (com exemplos) e a trilha de auditoria.
 * Devolve null se o conteúdo não for um banco do SGQ.
 */
export function migrate(raw: unknown): DB | null {
  const d = raw as Partial<DB> | null;
  if (!d || typeof d !== 'object' || typeof d.version !== 'number') return null;
  if (!['processes', 'ncs', 'audits', 'docs', 'kpis'].every((k) => Array.isArray((d as Record<string, unknown>)[k]))) return null;
  if (d.version > DB_VERSION) return null;
  let db = d as DB;
  if (db.version === 1) {
    const T = today();
    const ids = new Set(db.processes.map((p) => p.id));
    db = { ...db, version: 2, risks: seedRisks(T).filter((r) => ids.has(r.processId)), reviews: seedReviews(T), log: [] };
  }
  if (!Array.isArray(db.risks) || !Array.isArray(db.reviews) || !Array.isArray(db.log)) return null;
  // versões anteriores podiam gravar buracos na lista de porquês (viravam null no JSON)
  db.ncs.forEach((n) => { n.whys = Array.from(n.whys ?? [], (w) => w ?? ''); });
  return db;
}

export const source: DataSource = localSource;
