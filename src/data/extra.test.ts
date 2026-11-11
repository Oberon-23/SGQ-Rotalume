import { describe, expect, it } from 'vitest';
import { seed } from './seed';
import { csv } from './csv';
import { fmtValue, diffDB, describe as describeChange } from './changes';
import { cards, moveCard, overWip, WIP_PER_PERSON } from './board';
import { advance, cancelRevision, objectiveState, qualitySummary, satisfaction, startRevision, supplierAlert, trainingEfficacy } from './quality';
import { migrate } from './source';

describe('planilhas CSV', () => {
  it('usa ponto e vírgula, vírgula decimal, BOM e escapa aspas e quebras', () => {
    const out = csv([['a;b', 'diz "oi"', 1.5, undefined], ['linha\nnova', 'ok', 2, 'x']]);
    expect(out.startsWith('﻿')).toBe(true);
    expect(out).toContain('"a;b";"diz ""oi""";1,5;');
    expect(out).toContain('\r\n"linha\nnova";ok;2;x');
  });
});

describe('trilha: textos dos campos novos', () => {
  it('descreve listas e situações dos módulos novos', () => {
    expect(fmtValue('suppliers', 'status', 'condicional')).toBe('Condicional');
    expect(fmtValue('complaints', 'status', 'analise')).toBe('Em análise');
    expect(fmtValue('complaints', 'valid', false)).toBe('Improcedente');
    expect(fmtValue('docs', 'approval.step', 'revisao')).toBe('Revisão técnica');
    expect(fmtValue('ncs', 'attachments', [{ name: 'foto.png' }])).toBe('foto.png');
    expect(fmtValue('suppliers', 'evals', [{}, {}])).toBe('2 meses avaliados');
    expect(fmtValue('trainings', 'participants', [{ status: 'eficaz' }, { status: 'pendente' }])).toBe('2 participantes, 1 eficaz(es)');
    expect(fmtValue('docs', 'approval.events', [{ user: 'Ana', text: 'ok' }])).toBe('Ana: ok');
    expect(fmtValue('ncs', 'attachments', [])).toBe('—');
  });
  it('mover cartão no Kanban gera linha legível na trilha', () => {
    const a = seed();
    const b = structuredClone(a);
    const c = cards(b).find((x) => x.kind === 'acao' && x.status === 'todo')!;
    moveCard(b, c.key, 'done');
    const ch = diffDB(a, b);
    expect(ch).toHaveLength(1);
    expect(describeChange(ch[0], b)[0].field).toBe('Plano de ação');
  });
  it('aprovar um documento registra a mudança de etapa', () => {
    const a = seed();
    const b = structuredClone(a);
    advance(b.docs.find((d) => d.id === 'it-l2-003')!, 'Marina Lopes', '');
    const fields = describeChange(diffDB(a, b)[0], b).map((f) => f.field);
    expect(fields).toContain('Revisão');
    expect(fields).toContain('Aprovação: etapa');
  });
});

describe('Kanban: limites e decisões', () => {
  it('avisa quem passa do limite de itens em andamento', () => {
    const db = seed();
    const mine = cards(db).filter((c) => c.status === 'todo').slice(0, WIP_PER_PERSON + 1);
    mine.forEach((c) => moveCard(db, c.key, 'doing'));
    db.ncs.forEach((n) => n.actions.forEach((a) => { if (a.status === 'doing') a.who = 'Ana'; }));
    db.reviews.forEach((r) => r.decisions.forEach((d) => { if (d.status === 'doing') d.owner = 'Ana'; }));
    expect(overWip(cards(db))).toContain('Ana');
  });
  it('move decisão da direção e ignora chave inexistente', () => {
    const db = seed();
    const d = cards(db).find((c) => c.kind === 'decisao' && c.status !== 'done')!;
    moveCard(db, d.key, 'done');
    expect(db.reviews[0].decisions.find((x) => x.id === d.id)!.done).toBe(true);
    expect(() => moveCard(db, 'acao:x:y', 'done')).not.toThrow();
  });
  it('NC encerrada não aparece no quadro', () => {
    const db = seed();
    expect(cards(db).some((c) => db.ncs.find((n) => n.id === c.parentId)?.stage === 'encerrada')).toBe(false);
  });
});

describe('módulos novos: casos de borda', () => {
  it('fornecedor condicional com dois meses A pode voltar; bloqueado não gera alerta', () => {
    const s = structuredClone(seed().suppliers.find((x) => x.code === 'F-02')!);
    s.evals.push({ month: '2099-01', quality: 95, delivery: 95, service: 95, note: '' }, { month: '2099-02', quality: 95, delivery: 95, service: 95, note: '' });
    expect(supplierAlert(s)).toMatch(/voltar a qualificado/);
    expect(supplierAlert({ ...s, status: 'bloqueado' })).toBeNull();
    expect(supplierAlert({ ...s, evals: [] })).toBeNull();
  });
  it('treinamento sem ninguém avaliado não tem eficácia; satisfação ignora sem nota', () => {
    const t = seed().trainings.find((x) => x.code === 'TR-2026-05')!;
    expect(trainingEfficacy(t)).toBeNull();
    expect(satisfaction([])).toBeNull();
  });
  it('objetivo com prazo vencido e sem indicador', () => {
    const o = { ...seed().objectives[1], deadline: '2000-01-01', target: 999 };
    expect(objectiveState(o, seed().kpis.find((k) => k.id === o.kpiId))).toBe('atrasado');
    expect(objectiveState({ ...o, deadline: '2999-01-01' }, undefined)).toBe('risco');
  });
  it('cancelar a revisão volta o documento a vigente', () => {
    const d = structuredClone(seed().docs.find((x) => x.id === 'pr-001')!);
    startRevision(d, { change: 'x', author: 'A', reviewer: 'B', approver: 'C' }, 'A');
    cancelRevision(d);
    expect(d.status).toBe('vigente');
    expect(d.approval).toBeUndefined();
  });
  it('resumo do painel conta o que pede atenção', () => {
    const s = qualitySummary(seed());
    expect(s.complaintsOpen).toBe(2);
    expect(s.docsInApproval).toBe(1);
    expect(s.trainingsToEval).toBeGreaterThan(0);
  });
});

describe('importação de dados', () => {
  it('recusa arquivos que não são do SGQ ou de versão mais nova', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate({ oi: 1 })).toBeNull();
    expect(migrate({ ...seed(), version: 99 })).toBeNull();
    const broken = { ...seed() } as Record<string, unknown>;
    delete broken.suppliers;
    expect(migrate(broken)).toBeNull();
  });
  it('banco atual passa sem alteração', () => {
    const db = seed();
    expect(migrate(JSON.parse(JSON.stringify(db)))!.suppliers).toHaveLength(db.suppliers.length);
  });
});
