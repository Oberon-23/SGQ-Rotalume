import { describe, expect, it } from 'vitest';
import { seed } from './seed';
import { diffDB, appendLog } from './changes';
import { RemoteSource, errorText, mergeOps, rowsToDB, type MiniClient, type Op } from './remote';

/** Cliente falso: guarda o que seria enviado ao Supabase. */
function fakeClient(opts: { rows?: unknown[]; log?: unknown[]; fail?: { code?: string; message: string } } = {}) {
  const calls: { table: string; op: string; payload: unknown }[] = [];
  const ok = <T,>(data: T) => Promise.resolve({ data, error: opts.fail ?? null });
  const client: MiniClient = {
    from: (table) => ({
      select: () => ({ order: () => ({ range: (a: number, b: number) => ok((opts.rows ?? []).slice(a, b + 1)), limit: () => ok(opts.log ?? []) }) }),
      upsert: (rows) => { calls.push({ table, op: 'upsert', payload: rows }); return ok(null); },
      delete: () => ({ match: (m) => { calls.push({ table, op: 'delete', payload: m }); return ok(null); } }),
    }),
  };
  return { client, calls };
}
const user = { name: 'Marina Lopes', role: 'gestor' as const };
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe('fonte de dados no Supabase', () => {
  it('monta o banco a partir das linhas, ignorando módulos desconhecidos', () => {
    const db = rowsToDB([{ entidade: 'ncs', id: 'a', dados: { id: 'a' } }, { entidade: 'xyz', id: 'b', dados: { id: 'b' } }], []);
    expect(db.ncs).toHaveLength(1);
    expect(db.suppliers).toEqual([]);
  });

  it('lê em páginas de 1000 linhas', async () => {
    const rows = Array.from({ length: 2300 }, (_, i) => ({ entidade: 'ncs', id: `n${i}`, dados: { id: `n${i}` } }));
    const { client } = fakeClient({ rows });
    const db = await new RemoteSource(client, 'emp').fetchAll();
    expect(db.ncs).toHaveLength(2300);
  });

  it('a última versão de cada registro vence ao juntar mudanças', () => {
    const m = new Map<string, Op>();
    mergeOps(m, [{ entity: 'ncs', id: 'a', action: 'create', after: { id: 'a', v: 1 } }]);
    mergeOps(m, [{ entity: 'ncs', id: 'a', action: 'update', after: { id: 'a', v: 2 } }]);
    expect([...m.values()]).toEqual([{ kind: 'upsert', entity: 'ncs', id: 'a', dados: { id: 'a', v: 2 } }]);
    mergeOps(m, [{ entity: 'ncs', id: 'a', action: 'delete', before: { id: 'a' } }]);
    expect([...m.values()][0].kind).toBe('delete');
  });

  it('junta várias edições seguidas num envio só, com a trilha', async () => {
    const { client, calls } = fakeClient();
    const src = new RemoteSource(client, 'emp', 10);
    let db = seed(); db.log = [];
    for (const t of ['a', 'ab', 'abc']) {
      const next = structuredClone(db);
      next.ncs[0].title = t;
      const ch = diffDB(db, next);
      next.log = appendLog(db.log, ch, user, next);
      src.persist(next, ch);
      db = next;
    }
    await tick(40);
    const ups = calls.filter((c) => c.table === 'registros' && c.op === 'upsert');
    expect(ups).toHaveLength(1);
    expect((ups[0].payload as { dados: { title: string } }[])[0].dados.title).toBe('abc');
    const log = calls.filter((c) => c.table === 'trilha');
    expect(log).toHaveLength(1);
    expect((log[0].payload as unknown[]).length).toBe(1); // edições seguidas no mesmo campo viram uma linha
  });

  it('exclusão vira delete com a chave da empresa', async () => {
    const { client, calls } = fakeClient();
    const src = new RemoteSource(client, 'emp', 5);
    const db = seed();
    const next = structuredClone(db);
    next.risks = next.risks.slice(1);
    src.persist(next, diffDB(db, next));
    await src.flush();
    expect(calls.find((c) => c.op === 'delete')?.payload).toEqual({ empresa_id: 'emp', entidade: 'risks', id: db.risks[0].id });
  });

  it('avisa a tela quando o banco recusa', async () => {
    const { client } = fakeClient({ fail: { code: '42501', message: 'new row violates row-level security policy' } });
    const src = new RemoteSource(client, 'emp', 5);
    const seen: { saving: boolean; error?: string }[] = [];
    src.onStatus((s) => seen.push(s));
    const db = seed();
    const next = structuredClone(db); next.ncs[0].title = 'x';
    src.persist(next, diffDB(db, next));
    await src.flush();
    expect(seen[0]).toEqual({ saving: true });
    expect(seen.at(-1)?.error).toMatch(/seu papel não permite/);
  });

  it('sem mudança, não envia nada', async () => {
    const { client, calls } = fakeClient();
    const src = new RemoteSource(client, 'emp', 5);
    src.persist(seed(), []);
    await tick(20);
    expect(calls).toHaveLength(0);
  });

  it('mensagens de erro em português', () => {
    expect(errorText({ message: 'Failed to fetch' })).toMatch(/Sem conexão/);
    expect(errorText(null)).toBe('Erro desconhecido.');
    expect(errorText({ message: 'outra coisa' })).toBe('outra coisa');
  });
});
