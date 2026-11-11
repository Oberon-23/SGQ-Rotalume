/*
 * Fonte de dados no Supabase (Postgres).
 *
 * Cada registro do SGQ vira uma linha em `registros` (empresa, módulo, id, dados em JSON).
 * As regras de quem pode ver e alterar o quê ficam no banco (db/schema.sql), então a
 * interface só esconde botões; quem decide é o Postgres.
 *
 * Gravação: as mudanças são juntadas por alguns instantes (para não gravar a cada tecla)
 * e enviadas de uma vez. Se o banco recusar, a tela volta ao que está no servidor.
 */
import type { DB, Entity, LogEntry } from './types';
import type { Change } from './changes';
import { ENTITIES, LOG_LIMIT } from './changes';
import { DB_VERSION } from './seed';
import { today } from './utils';
import type { DataSource } from './source';

export interface RegistroRow { entidade: string; id: string; dados: Record<string, unknown>; atualizado_por?: string | null }
export interface TrilhaRow { ref: string; entrada: LogEntry }

/** Banco vazio, para uma empresa que ainda não tem nada cadastrado. */
export const emptyDB = (): DB => ({ version: DB_VERSION, seededAt: today(), processes: [], ncs: [], audits: [], docs: [], kpis: [], risks: [], reviews: [], suppliers: [], trainings: [], complaints: [], objectives: [], log: [] });

/** Monta o banco do sistema a partir das linhas do Postgres (já na ordem de criação). */
export function rowsToDB(rows: RegistroRow[], log: TrilhaRow[]): DB {
  const db = emptyDB();
  for (const r of rows) {
    if (!(ENTITIES as string[]).includes(r.entidade)) continue;
    (db[r.entidade as Entity] as unknown[]).push(r.dados);
  }
  db.log = log.map((l) => l.entrada).slice(0, LOG_LIMIT);
  return db;
}

export type Op = { kind: 'upsert'; entity: Entity; id: string; dados: Record<string, unknown> } | { kind: 'delete'; entity: Entity; id: string };
const key = (e: string, id: string) => `${e}:${id}`;

/** Junta as mudanças pendentes: a última versão de cada registro vence. */
export function mergeOps(pending: Map<string, Op>, changes: Change[]) {
  for (const c of changes) {
    const k = key(c.entity, c.id);
    if (c.action === 'delete') pending.set(k, { kind: 'delete', entity: c.entity, id: c.id });
    else pending.set(k, { kind: 'upsert', entity: c.entity, id: c.id, dados: c.after as Record<string, unknown> });
  }
  return pending;
}

/** Entradas da trilha que ainda não foram enviadas (ou mudaram ao juntar edições seguidas). */
export function newLog(log: LogEntry[], sent: Map<string, string>, max = 50) {
  return log.slice(0, max).filter((e) => sent.get(e.id) !== JSON.stringify(e));
}

/** Erro do banco em português, para o aviso na tela. */
export function errorText(e: { code?: string; message?: string } | null | undefined) {
  if (!e) return 'Erro desconhecido.';
  if (e.code === '42501' || /row-level security|permission denied/i.test(e.message ?? '')) return 'O banco recusou: seu papel não permite essa alteração.';
  if (/fetch|network|Failed to fetch/i.test(e.message ?? '')) return 'Sem conexão com o banco. Verifique a internet.';
  return e.message ?? 'Erro ao gravar.';
}

/* ---------- o mínimo do cliente do Supabase que usamos (facilita testar) ---------- */
type Result<T = unknown> = PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>;
export interface Table {
  select(cols: string): { order(col: string, o?: { ascending?: boolean }): { range(a: number, b: number): Result<unknown[]>; limit(n: number): Result<unknown[]> } };
  upsert(rows: unknown[], o?: { onConflict?: string }): Result;
  delete(): { match(m: Record<string, unknown>): Result };
}
export interface MiniClient { from(t: string): Table }

export type Status = { saving: boolean; error?: string };

export class RemoteSource implements DataSource {
  readonly name = 'Banco de dados (Supabase)';
  private pending = new Map<string, Op>();
  private sentLog = new Map<string, string>();
  private latest: DB | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<(s: Status) => void>();
  private flushing: Promise<void> | null = null;

  private client: MiniClient;
  readonly empresaId: string;
  private delay: number;
  constructor(client: MiniClient, empresaId: string, delay = 700) { this.client = client; this.empresaId = empresaId; this.delay = delay; }

  /** Lê tudo da empresa (o RLS já garante que só vem o que a pessoa pode ver). */
  async fetchAll(): Promise<DB> {
    const rows: RegistroRow[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.client.from('registros').select('entidade,id,dados').order('ordem').range(from, from + 999);
      if (error) throw new Error(errorText(error));
      rows.push(...((data ?? []) as RegistroRow[]));
      if (!data || data.length < 1000) break;
    }
    const { data: log, error } = await this.client.from('trilha').select('ref,entrada').order('em', { ascending: false }).limit(LOG_LIMIT);
    if (error) throw new Error(errorText(error));
    const db = rowsToDB(rows, (log ?? []) as TrilhaRow[]);
    db.log.forEach((e) => this.sentLog.set(e.id, JSON.stringify(e)));
    return db;
  }

  load() { return null; }
  async resync() { try { return await this.fetchAll(); } catch { return null; } }
  clear() { /* no banco, restaurar exemplos é feito pela tela de dados */ }

  onStatus(fn: (s: Status) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit(s: Status) { this.listeners.forEach((f) => f(s)); }

  persist(next: DB, changes: Change[]) {
    this.latest = next;
    if (!changes.length) return;
    mergeOps(this.pending, changes);
    this.emit({ saving: true });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.flush(); }, this.delay);
  }

  /** Envia o que estiver pendente. Pode ser chamado a qualquer hora (ex.: ao sair da página). */
  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.flushing) await this.flushing;
    const ops = [...this.pending.values()];
    this.pending.clear();
    const log = this.latest ? newLog(this.latest.log, this.sentLog, LOG_LIMIT) : [];
    if (!ops.length && !log.length) { this.emit({ saving: false }); return; }
    this.flushing = (async () => {
      try {
        const ups = ops.filter((o): o is Extract<Op, { kind: 'upsert' }> => o.kind === 'upsert');
        if (ups.length) {
          const { error } = await this.client.from('registros').upsert(ups.map((o) => ({ empresa_id: this.empresaId, entidade: o.entity, id: o.id, dados: o.dados })), { onConflict: 'empresa_id,entidade,id' });
          if (error) throw error;
        }
        for (const o of ops.filter((x) => x.kind === 'delete')) {
          const { error } = await this.client.from('registros').delete().match({ empresa_id: this.empresaId, entidade: o.entity, id: o.id });
          if (error) throw error;
        }
        if (log.length) {
          const { error } = await this.client.from('trilha').upsert(log.map((e) => ({ ref: e.id, empresa_id: this.empresaId, entrada: e })), { onConflict: 'ref' });
          if (error) throw error;
          log.forEach((e) => this.sentLog.set(e.id, JSON.stringify(e)));
        }
        this.emit({ saving: false });
      } catch (e) {
        this.emit({ saving: false, error: errorText(e as { code?: string; message?: string }) });
      } finally { this.flushing = null; }
    })();
    return this.flushing;
  }
}
