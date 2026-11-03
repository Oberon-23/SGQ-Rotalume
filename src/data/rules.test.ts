import { describe, expect, it } from 'vitest';
import { seed } from './seed';
import { blockers, kpiOk, riskLevel, addDays, today } from './utils';
import { appendLog, describe as describeChange, diffDB } from './changes';
import { can, USERS } from './access';
import { migrate } from './source';
import { reviewInputs } from './review';
import type { DB } from './types';

const fresh = (): DB => seed();
const user = (id: string) => USERS.find((u) => u.id === id)!;

describe('PDCA da não conformidade', () => {
  it('não deixa sair do registro sem descrição e contenção', () => {
    const nc = fresh().ncs.find((n) => n.code === 'NC-2026-072')!; // registro, sem contenção
    expect(blockers(nc)).toContain('Registre a ação de contenção imediata.');
  });
  it('exige 3 porquês, causa raiz e 6M na análise', () => {
    const nc = fresh().ncs.find((n) => n.code === 'NC-2026-069')!; // análise com 2 porquês
    const b = blockers(nc);
    expect(b).toContain('Responda pelo menos 3 porquês.');
    expect(b).toContain('Defina a causa raiz.');
    expect(b).toContain('Classifique a causa em um dos 6M.');
  });
  it('tolera porquês nulos gravados por versões antigas', () => {
    const nc = { ...fresh().ncs[0], stage: 'analise' as const, whys: ['a', null as unknown as string, 'b'] };
    expect(() => blockers(nc)).not.toThrow();
  });
  it('não verifica eficácia com ação pendente', () => {
    const nc = fresh().ncs.find((n) => n.code === 'NC-2026-071')!; // plano com ação aberta
    expect(blockers(nc)).toContain('Conclua todas as ações antes de verificar a eficácia.');
  });
  it('libera o encerramento só com eficácia confirmada e evidência', () => {
    const nc = fresh().ncs.find((n) => n.code === 'NC-2026-070')!;
    expect(blockers(nc).length).toBeGreaterThan(0);
    nc.verification = { effective: true, evidence: '60 dias sem instrumento vencido', date: today() };
    expect(blockers(nc)).toEqual([]);
  });
});

describe('indicadores e riscos', () => {
  it('respeita o sentido da meta', () => {
    const k = fresh().kpis.find((x) => x.id === 'copq')!; // menor é melhor, meta 50
    expect(kpiOk(k, 49)).toBe(true);
    expect(kpiOk(k, 51)).toBe(false);
  });
  it('classifica a matriz 5×5 nas faixas certas', () => {
    expect(riskLevel(2, 2).tone).toBe('low');
    expect(riskLevel(3, 3).tone).toBe('mid');
    expect(riskLevel(4, 4).tone).toBe('high');
    expect(riskLevel(4, 5).tone).toBe('crit');
    expect(riskLevel(5, 5).score).toBe(25);
  });
});

describe('detecção de alterações e trilha de auditoria', () => {
  it('encontra criação, alteração e exclusão', () => {
    const a = fresh();
    const b = structuredClone(a);
    b.ncs[0].severity = 'Crítica';
    b.docs = b.docs.filter((d) => d.code !== 'FR-014');
    b.risks.push({ ...b.risks[0], id: 'r-99', code: 'R-99' });
    const ch = diffDB(a, b);
    expect(ch.map((c) => `${c.entity}:${c.action}`).sort()).toEqual(['docs:delete', 'ncs:update', 'risks:create']);
  });
  it('descreve o campo alterado com valor anterior e novo', () => {
    const a = fresh();
    const b = structuredClone(a);
    b.ncs[0].processId = 'p07';
    b.ncs[0].verification.evidence = 'nova evidência';
    const fields = describeChange(diffDB(a, b)[0], b);
    expect(fields).toContainEqual({ field: 'Processo', from: 'Usinagem CNC (Linha 1)', to: 'Montagem (Linha 2)' });
    expect(fields.map((f) => f.field)).toContain('Evidência de eficácia');
  });
  it('junta digitação seguida no mesmo campo numa linha só', () => {
    let db = fresh();
    const u = user('marina');
    const t0 = new Date('2026-11-03T10:00:00Z');
    for (const [i, text] of ['A', 'Ab', 'Abc'].entries()) {
      const next = structuredClone(db);
      next.ncs[0].rootCause = text;
      next.log = appendLog(db.log, diffDB(db, next), u, next, new Date(t0.getTime() + i * 1000));
      db = next;
    }
    const mine = db.log.filter((e) => e.entityId === db.ncs[0].id && e.user === u.name && e.at.startsWith('2026-11-03T10'));
    expect(mine).toHaveLength(1);
    expect(mine[0].fields[0].to).toBe('Abc');
    expect(mine[0].fields[0].from).toContain('calendário'); // valor original preservado
  });
  it('abre linha nova depois da janela de alguns minutos', () => {
    const a = fresh();
    const u = user('marina');
    const b = structuredClone(a); b.ncs[0].owner = 'X';
    const log1 = appendLog(a.log, diffDB(a, b), u, b, new Date('2026-11-03T10:00:00Z'));
    const c = structuredClone(b); c.ncs[0].owner = 'Y';
    const log2 = appendLog(log1, diffDB(b, c), u, c, new Date('2026-11-03T10:30:00Z'));
    expect(log2.length).toBe(log1.length + 1);
  });
});

describe('permissões por perfil', () => {
  const db = fresh();
  const nc = (code: string) => db.ncs.find((n) => n.code === code)!;
  it('gestora pode tudo e leitor nada', () => {
    expect(can(user('marina'), db, 'delete', 'ncs', nc('NC-2026-069'))).toBe(true);
    expect(can(user('visitante'), db, 'create', 'ncs')).toBe(false);
    expect(can(user('visitante'), db, 'edit', 'ncs', nc('NC-2026-073'))).toBe(false);
  });
  it('dono de processo edita o que é dele e não exclui', () => {
    const diego = user('diego');
    expect(can(diego, db, 'edit', 'ncs', nc('NC-2026-073'))).toBe(true);  // responsável
    expect(can(diego, db, 'edit', 'ncs', nc('NC-2026-069'))).toBe(false); // montagem, de outra pessoa
    expect(can(diego, db, 'delete', 'ncs', nc('NC-2026-073'))).toBe(false);
    expect(can(diego, db, 'edit', 'processes', db.processes.find((p) => p.id === 'p06'))).toBe(true);
    expect(can(diego, db, 'edit', 'processes', db.processes.find((p) => p.id === 'p07'))).toBe(false);
  });
  it('auditor não audita processo do qual é dono (ISO 9.2.2)', () => {
    const rafael = user('rafael');
    const audit = (processId: string) => ({ ...db.audits[0], processId });
    expect(can(rafael, db, 'edit', 'audits', audit('p08'))).toBe(true);
    expect(can(rafael, db, 'edit', 'audits', audit('p04'))).toBe(false); // engenharia de processos é dele
    expect(can(user('diego'), db, 'create', 'audits')).toBe(false);
  });
  it('só a gestão conduz a análise crítica e mexe nos dados', () => {
    expect(can(user('diego'), db, 'create', 'reviews')).toBe(false);
    expect(can(user('rafael'), db, 'edit', 'data')).toBe(false);
  });
});

describe('migração de dados salvos', () => {
  it('leva um banco v1 para v2 sem perder o que existia', () => {
    const v1 = fresh() as Partial<DB>;
    v1.version = 1; delete v1.risks; delete v1.reviews; delete v1.log;
    v1.ncs![0].whys = ['a', null as unknown as string, 'c'];
    const db = migrate(JSON.parse(JSON.stringify(v1)))!;
    expect(db.version).toBe(2);
    expect(db.ncs).toHaveLength(12);
    expect(db.risks.length).toBeGreaterThan(0);
    expect(db.log).toEqual([]);
    expect(db.ncs[0].whys).toEqual(['a', '', 'c']);
  });
  it('recusa arquivo que não é do SGQ ou de versão futura', () => {
    expect(migrate({ x: 1 })).toBeNull();
    expect(migrate(null)).toBeNull();
    expect(migrate({ ...fresh(), version: 99 })).toBeNull();
  });
});

describe('análise crítica', () => {
  it('monta as entradas da 9.3.2 a partir dos módulos', () => {
    const db = fresh();
    const inputs = reviewInputs(db, addDays(today(), -365), today());
    expect(inputs.map((s) => s.clause)).toEqual(['9.3.2 a', '9.3.2 c1', '9.3.2 c2', '9.3.2 c3', '9.3.2 c4', '9.3.2 c5', '9.3.2 c6', '9.3.2 c7', '9.3.2 d', '9.3.2 e', '9.3.2 f']);
    const c4 = inputs.find((s) => s.clause === '9.3.2 c4')!.items.join(' ');
    expect(c4).toContain('12 não conformidade(s) aberta(s)');
    const a = inputs.find((s) => s.clause === '9.3.2 a')!.items[0];
    expect(a).toBe('2 de 4 decisões anteriores concluídas.');
  });
});
