/*
 * Testes das regras de acesso do banco (Row Level Security).
 * Roda o db/schema.sql num Postgres limpo, cria pessoas com papéis diferentes
 * e confere, direto no banco, o que cada uma consegue ver e alterar.
 *
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const url = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const DB = 'sgq_rls_' + process.pid;
const admin = new pg.Client({ connectionString: url });
let db;
const id = {};
const U = (n) => `00000000-0000-4000-8000-00000000000${n}`;

/** Executa como a pessoa logada (papel authenticated + id no JWT), como o Supabase faz. */
async function as(who, sql, params = []) {
  await db.query('begin');
  try {
    await db.query('set local role ' + (who ? 'authenticated' : 'anon'));
    if (who) await db.query("select set_config('request.jwt.claim.sub', $1, true)", [id[who]]);
    const r = await db.query(sql, params);
    await db.query('commit');
    return r;
  } catch (e) { await db.query('rollback'); throw e; }
}
const denied = (p) => assert.rejects(p, /row-level security|permission denied/);
const rec = (o) => JSON.stringify(o);

before(async () => {
  await admin.connect();
  await admin.query(`create database ${DB}`);
  db = new pg.Client({ connectionString: url.replace(/\/[^/]*$/, '/' + DB) });
  await db.connect();
  await db.query(readFileSync(new URL('./supabase-stub.sql', import.meta.url), 'utf8'));
  await db.query(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  // a primeira pessoa vira gestora; as outras entram como leitoras
  const people = [['marina', 'Marina Lopes'], ['diego', 'Diego Moraes'], ['rafael', 'Rafael Duarte'], ['visitante', 'Visitante']];
  for (const [i, [k, nome]] of people.entries()) {
    id[k] = U(i + 1);
    await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [id[k], `${k}@teste.dev`, { nome }]);
  }
  // alguém de outra empresa
  id.outro = U(9);
  const { rows: [e2] } = await db.query("insert into public.empresas (nome) values ('Outra') returning id");
  await db.query('insert into auth.users (id, email) values ($1, $2)', [id.outro, 'outro@teste.dev']);
  await db.query("update public.perfis set empresa_id = $1, papel = 'gestor' where user_id = $2", [e2.id, id.outro]);
  id.empresa = (await db.query('select empresa_id from public.perfis where user_id = $1', [id.marina])).rows[0].empresa_id;
  id.empresa2 = e2.id;
  // dados de exemplo gravados pela gestora
  const rows = [
    ['processes', { id: 'p04', owner: 'Rafael Duarte' }], ['processes', { id: 'p06', owner: 'Diego Moraes' }], ['processes', { id: 'p07', owner: 'Patrícia Nunes' }],
    ['ncs', { id: 'nc-1', owner: 'Diego Moraes', processId: 'p06', actions: [] }],
    ['ncs', { id: 'nc-2', owner: 'Patrícia Nunes', processId: 'p07', actions: [] }],
    ['ncs', { id: 'nc-3', owner: 'Patrícia Nunes', processId: 'p07', actions: [{ id: 'a1', who: 'Diego Moraes', done: false }] }],
    ['docs', { id: 'it-1', owner: 'Patrícia Nunes', processId: 'p07', approval: { author: 'Patrícia Nunes', reviewer: 'Rafael Duarte', approver: 'Marina Lopes' } }],
    ['suppliers', { id: 'f-1', owner: 'Bianca Rocha' }],
    ['reviews', { id: 'acd-1', decisions: [{ id: 'd1', owner: 'Diego Moraes', done: false }] }],
  ];
  for (const [ent, d] of rows) await as('marina', 'insert into public.registros (empresa_id, entidade, id, dados) values ($1, $2, $3, $4)', [id.empresa, ent, d.id, rec(d)]);
});

after(async () => { await db?.end(); await admin.query(`drop database if exists ${DB} with (force)`); await admin.end(); });

describe('perfis e papéis', () => {
  it('a primeira pessoa vira gestora e as outras, leitoras', async () => {
    const { rows } = await db.query('select nome, papel from public.perfis where empresa_id = $1 order by nome', [id.empresa]);
    assert.deepEqual(rows.map((r) => r.papel), ['leitor', 'gestor', 'leitor', 'leitor']);
  });
  it('só a gestão muda papéis, e não o próprio', async () => {
    assert.equal((await as('marina', "update public.perfis set papel = 'dono' where user_id = $1", [id.diego])).rowCount, 1);
    assert.equal((await as('marina', "update public.perfis set papel = 'auditor' where user_id = $1", [id.rafael])).rowCount, 1);
    assert.equal((await as('marina', "update public.perfis set papel = 'leitor' where user_id = $1", [id.marina])).rowCount, 0);
    assert.equal((await as('diego', "update public.perfis set papel = 'gestor' where user_id = $1", [id.diego])).rowCount, 0);
    assert.equal((await as('visitante', "update public.perfis set papel = 'gestor' where user_id = $1", [id.visitante])).rowCount, 0);
  });
  it('ninguém muda a própria empresa (coluna bloqueada)', async () => {
    await denied(as('marina', 'update public.perfis set empresa_id = $1 where user_id = $2', [id.empresa2, id.diego]));
  });
});

describe('separação entre empresas', () => {
  it('quem é de outra empresa não vê nada da Rotalume', async () => {
    assert.equal((await as('outro', 'select * from public.registros')).rowCount, 0);
    assert.equal((await as('outro', 'select * from public.perfis where empresa_id = $1', [id.empresa])).rowCount, 0);
  });
  it('nem consegue gravar na empresa dos outros', async () => {
    await denied(as('outro', 'insert into public.registros (empresa_id, entidade, id, dados) values ($1, $2, $3, $4)', [id.empresa, 'ncs', 'x', rec({ id: 'x' })]));
  });
  it('sem login não se lê nada', async () => {
    await denied(as(null, 'select * from public.registros'));
  });
});

describe('o que cada papel pode fazer', () => {
  it('leitor vê tudo e não altera nada', async () => {
    assert.ok((await as('visitante', 'select * from public.registros')).rowCount >= 9);
    await denied(as('visitante', 'insert into public.registros (empresa_id, entidade, id, dados) values ($1, $2, $3, $4)', [id.empresa, 'ncs', 'nc-x', rec({ id: 'nc-x' })]));
    assert.equal((await as('visitante', "update public.registros set dados = dados || '{\"title\":\"x\"}' where id = 'nc-1'")).rowCount, 0);
  });
  it('dono edita a própria NC e não a dos outros', async () => {
    assert.equal((await as('diego', "update public.registros set dados = dados || '{\"title\":\"ok\"}' where id = 'nc-1'")).rowCount, 1);
    assert.equal((await as('diego', "update public.registros set dados = dados || '{\"title\":\"x\"}' where id = 'nc-2'")).rowCount, 0);
  });
  it('quem tem uma ação 5W2H na NC pode registrar o andamento (Kanban)', async () => {
    assert.equal((await as('diego', "update public.registros set dados = jsonb_set(dados, '{actions,0,done}', 'true') where id = 'nc-3'")).rowCount, 1);
  });
  it('dono de uma decisão da direção pode movê-la; o resto da análise crítica é da gestão', async () => {
    assert.equal((await as('diego', "update public.registros set dados = jsonb_set(dados, '{decisions,0,done}', 'true') where id = 'acd-1'")).rowCount, 1);
    assert.equal((await as('rafael', "update public.registros set dados = dados || '{\"conclusion\":\"x\"}' where id = 'acd-1'")).rowCount, 0);
  });
  it('revisor de um documento em aprovação pode agir nele', async () => {
    assert.equal((await as('rafael', "update public.registros set dados = jsonb_set(dados, '{approval,step}', '\"aprovacao\"') where id = 'it-1'")).rowCount, 1);
    assert.equal((await as('diego', "update public.registros set dados = dados || '{\"title\":\"x\"}' where id = 'it-1'")).rowCount, 0);
  });
  it('só a gestão exclui', async () => {
    assert.equal((await as('diego', "delete from public.registros where id = 'nc-1'")).rowCount, 0);
    assert.equal((await as('rafael', "delete from public.registros where id = 'nc-2'")).rowCount, 0);
  });
  it('auditor programa auditoria, mas não no processo do qual é dono', async () => {
    await as('rafael', 'insert into public.registros (empresa_id, entidade, id, dados) values ($1, $2, $3, $4)', [id.empresa, 'audits', 'aud-1', rec({ id: 'aud-1', processId: 'p06' })]);
    await denied(as('rafael', 'insert into public.registros (empresa_id, entidade, id, dados) values ($1, $2, $3, $4)', [id.empresa, 'audits', 'aud-2', rec({ id: 'aud-2', processId: 'p04' })]));
    await denied(as('diego', 'insert into public.registros (empresa_id, entidade, id, dados) values ($1, $2, $3, $4)', [id.empresa, 'audits', 'aud-3', rec({ id: 'aud-3', processId: 'p07' })]));
  });
  it('objetivos são só da gestão; fornecedor só o avaliador edita', async () => {
    await denied(as('diego', 'insert into public.registros (empresa_id, entidade, id, dados) values ($1, $2, $3, $4)', [id.empresa, 'objectives', 'obj-9', rec({ id: 'obj-9' })]));
    assert.equal((await as('diego', "update public.registros set dados = dados || '{\"status\":\"bloqueado\"}' where id = 'f-1'")).rowCount, 0);
  });
  it('qualquer pessoa da equipe registra NC e reclamação', async () => {
    await as('rafael', 'insert into public.registros (empresa_id, entidade, id, dados) values ($1, $2, $3, $4)', [id.empresa, 'complaints', 'rc-9', rec({ id: 'rc-9', owner: 'Rafael Duarte' })]);
    await as('diego', 'insert into public.registros (empresa_id, entidade, id, dados) values ($1, $2, $3, $4)', [id.empresa, 'ncs', 'nc-9', rec({ id: 'nc-9', owner: 'Diego Moraes', processId: 'p06' })]);
  });
  it('o código no corpo do registro precisa bater com a chave', async () => {
    await assert.rejects(as('marina', 'insert into public.registros (empresa_id, entidade, id, dados) values ($1, $2, $3, $4)', [id.empresa, 'ncs', 'a', rec({ id: 'b' })]), /check constraint/);
  });
});

describe('trilha de auditoria', () => {
  it('cada um grava só em seu nome', async () => {
    await as('diego', 'insert into public.trilha (ref, empresa_id, entrada) values ($1, $2, $3)', ['t1', id.empresa, rec({ user: 'Diego Moraes' })]);
    await denied(as('diego', 'insert into public.trilha (ref, empresa_id, user_id, entrada) values ($1, $2, $3, $4)', ['t2', id.empresa, id.marina, rec({})]));
    await denied(as('visitante', 'insert into public.trilha (ref, empresa_id, entrada) values ($1, $2, $3)', ['t3', id.empresa, rec({})]));
  });
  it('ninguém apaga, e só o autor junta edições nos primeiros 5 minutos', async () => {
    await denied(as('marina', "delete from public.trilha where ref = 't1'"));
    assert.equal((await as('marina', "update public.trilha set entrada = '{}' where ref = 't1'")).rowCount, 0);
    assert.equal((await as('diego', "update public.trilha set entrada = '{\"x\":1}' where ref = 't1'")).rowCount, 1);
    await db.query("update public.trilha set em = now() - interval '10 minutes' where ref = 't1'");
    assert.equal((await as('diego', "update public.trilha set entrada = '{\"x\":2}' where ref = 't1'")).rowCount, 0);
  });
  it('o banco guarda cada versão com quem gravou, e só a gestão lê', async () => {
    const { rows } = await db.query("select operacao, user_id from public.historico_bruto where registro_id = 'nc-1' order by id");
    assert.deepEqual(rows.map((r) => [r.operacao, r.user_id]), [['INSERT', id.marina], ['UPDATE', id.diego]]);
    assert.equal((await as('diego', 'select * from public.historico_bruto')).rowCount, 0);
    assert.ok((await as('marina', 'select * from public.historico_bruto')).rowCount > 0);
    const { rows: [r] } = await db.query("select atualizado_por from public.registros where id = 'nc-1'");
    assert.equal(r.atualizado_por, id.diego);
  });
});

describe('anexos (Storage)', () => {
  it('cada empresa só usa a própria pasta; leitor não envia', async () => {
    await as('diego', "insert into storage.objects (bucket_id, name) values ('evidencias', $1)", [`${id.empresa}/ncs/nc-1/foto.png`]);
    await denied(as('diego', "insert into storage.objects (bucket_id, name) values ('evidencias', $1)", [`${id.empresa2}/ncs/x/foto.png`]));
    await denied(as('visitante', "insert into storage.objects (bucket_id, name) values ('evidencias', $1)", [`${id.empresa}/ncs/nc-1/b.png`]));
    assert.equal((await as('outro', 'select * from storage.objects')).rowCount, 0);
  });
});
