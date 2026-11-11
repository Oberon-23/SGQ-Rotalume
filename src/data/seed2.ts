/*
 * Dados de exemplo dos módulos de fornecedores, treinamentos, reclamações e objetivos.
 * Mesma ideia do seed.ts: datas relativas a hoje, para o exemplo nunca ficar velho.
 */
import type { Complaint, Doc, Objective, Supplier, Training } from './types';
import { addDays, lastMonths } from './utils';

export function seedSuppliers(): Supplier[] {
  const months = lastMonths(6);
  const S = (code: string, name: string, item: string, critical: boolean, status: Supplier['status'], q: number[], d: number[], s: number[], notes: Record<number, string> = {}): Supplier => ({
    id: code.toLowerCase(), code, name, item, critical, owner: 'Bianca Rocha', status,
    evals: months.map((month, i) => ({ month, quality: q[i], delivery: d[i], service: s[i], note: notes[i] ?? '' })),
  });
  return [
    S('F-01', 'Aços Vale Forte', 'Barras de aço SAE 1045', true, 'qualificado', [97, 98, 96, 97, 99, 98], [90, 88, 92, 85, 91, 93], [90, 90, 85, 90, 95, 90]),
    S('F-02', 'Fixa Parafusos', 'Parafusos M8 (fornecedor único)', true, 'condicional', [88, 72, 65, 70, 62, 74], [85, 80, 82, 78, 75, 80], [80, 70, 60, 65, 60, 75],
      { 1: 'Lote com rosca irregular (NC-2026-065).', 2: 'Reincidência de rosca irregular (NC-2026-067).', 4: 'Plano de ação do fornecedor ainda sem evidência.' }),
    S('F-03', 'Tintas Lumen', 'Tinta poliuretano e catalisador', true, 'qualificado', [95, 93, 96, 94, 95, 97], [95, 96, 90, 94, 98, 96], [90, 85, 90, 90, 90, 95]),
    S('F-04', 'Rolamentos Prisma', 'Rolamentos 6205', true, 'qualificado', [100, 99, 100, 98, 100, 99], [80, 84, 78, 86, 88, 90], [85, 85, 80, 85, 90, 90]),
    S('F-05', 'EmbalaSul', 'Caixas e berços de papelão', false, 'qualificado', [92, 90, 91, 88, 90, 92], [70, 64, 60, 58, 66, 62], [75, 70, 70, 65, 70, 70], { 3: 'Duas entregas com mais de 5 dias de atraso.' }),
    S('F-06', 'Metrolab Calibrações', 'Calibração de instrumentos (RBC)', true, 'qualificado', [100, 100, 98, 100, 100, 100], [92, 95, 90, 96, 94, 97], [95, 95, 90, 95, 95, 95]),
  ];
}

export function seedTrainings(T: string): Training[] {
  return [
    {
      id: 'tr-2026-01', code: 'TR-2026-01', title: 'Aperto com torquímetro e sequência de aperto', processId: 'p07', docId: 'it-l2-003', instructor: 'Rafael Duarte',
      date: addDays(T, -64), hours: 4, owner: 'Patrícia Nunes', evalBy: addDays(T, -34),
      participants: [{ name: 'Ana Souza', status: 'eficaz' }, { name: 'Bruno Teixeira', status: 'eficaz' }, { name: 'Carla Mendes', status: 'eficaz' }, { name: 'Davi Rocha', status: 'ineficaz' }, { name: 'Elisa Prado', status: 'eficaz' }],
      notes: 'Treinamento da ação corretiva da NC-2026-060. Davi refaz a prática no posto com acompanhamento do líder.',
    },
    {
      id: 'tr-2026-02', code: 'TR-2026-02', title: 'Integração do turno C na montagem', processId: 'p07', docId: 'it-l2-003', instructor: 'Patrícia Nunes',
      date: addDays(T, -18), hours: 8, owner: 'Patrícia Nunes', evalBy: addDays(T, 12),
      participants: [{ name: 'Felipe Araújo', status: 'concluido' }, { name: 'Gabriela Lins', status: 'concluido' }, { name: 'Hugo Martins', status: 'pendente' }],
      notes: 'Ação do risco R-05 (rotatividade no turno C). Eficácia avaliada por observação no posto após 30 dias.',
    },
    {
      id: 'tr-2026-03', code: 'TR-2026-03', title: 'Formação de auditores internos ISO 9001:2015', processId: 'p02', docId: 'pr-003', instructor: 'Marina Lopes',
      date: addDays(T, -130), hours: 16, owner: 'Marina Lopes', evalBy: addDays(T, -70),
      participants: [{ name: 'Rafael Duarte', status: 'eficaz' }, { name: 'Camila Prado', status: 'eficaz' }, { name: 'Lucas Ferraz', status: 'eficaz' }],
      notes: 'Eficácia confirmada pela condução acompanhada de uma auditoria interna.',
    },
    {
      id: 'tr-2026-04', code: 'TR-2026-04', title: 'Leitura de instrumentos e etiqueta de calibração', processId: 'p12', docId: 'pr-004', instructor: 'Marina Lopes',
      date: addDays(T, -36), hours: 2, owner: 'Marina Lopes', evalBy: addDays(T, -6),
      participants: [{ name: 'Diego Moraes', status: 'concluido' }, { name: 'Igor Lima', status: 'concluido' }, { name: 'Joana Freitas', status: 'concluido' }, { name: 'Kauê Santos', status: 'eficaz' }],
      notes: 'Ação da NC-2026-070.',
    },
    {
      id: 'tr-2026-05', code: 'TR-2026-05', title: 'Setup e troca de ferramenta da CNC', processId: 'p06', docId: 'it-l1-001', instructor: 'Rafael Duarte',
      date: addDays(T, 12), hours: 4, owner: 'Diego Moraes', evalBy: addDays(T, 42),
      participants: [{ name: 'Igor Lima', status: 'pendente' }, { name: 'Leandro Costa', status: 'pendente' }],
      notes: 'Reciclagem anual dos preparadores.',
    },
  ];
}

export function seedComplaints(T: string): Complaint[] {
  const C = (code: string, customer: string, product: string, description: string, quantity: number, ago: number, status: Complaint['status'], valid: boolean | null, response: string, extra: Partial<Complaint> = {}): Complaint => ({
    id: code.toLowerCase(), code, customer, product, description, quantity, receivedAt: addDays(T, -ago), dueAt: addDays(T, -ago + 10), owner: 'Fernanda Lima', status, valid, response, ...extra,
  });
  return [
    C('RC-2026-01', 'Tratores Pampa', 'Eixo traseiro ET-40', 'Lote com diâmetro do eixo acima do especificado; peças não montam no rolamento.', 120, 160, 'encerrada', true,
      'Lote substituído em 48 horas. Causa: desgaste da ferramenta sem controle de vida útil. Ação corretiva na NC-2026-063.', { ncId: 'nc-2026-063', satisfaction: 4 }),
    C('RC-2026-02', 'AgroMec Implementos', 'Conjunto CJ-12 pintado', 'Bolhas na pintura em 8 conjuntos do último lote.', 8, 75, 'respondida', true,
      'Conjuntos repintados. Desumidificador instalado e registro de umidade a cada 2 horas (FR-014).', { ncId: 'nc-2026-062', satisfaction: 3 }),
    C('RC-2026-03', 'AgroMec Implementos', 'Embalagem do conjunto CJ-12', 'Caixas amassadas na entrega.', 30, 40, 'encerrada', false,
      'Improcedente: fotos do recebimento mostram dano no transporte contratado pelo cliente. Orientação enviada à transportadora deles.', { satisfaction: 4 }),
    C('RC-2026-04', 'Tratores Pampa', 'Pedido 4471', 'Entrega 3 dias depois da data confirmada.', 0, 6, 'analise', null, '', { dueAt: addDays(T, 4) }),
    C('RC-2026-05', 'Hidráulica Norte', 'Conjunto CJ-20', 'Parafuso da tampa solto em 2 conjuntos na montagem do cliente.', 2, 12, 'recebida', null, ''),
  ];
}

export function seedObjectives(T: string): Objective[] {
  const end = `${T.slice(0, 4)}-12-31`;
  return [
    { id: 'obj-01', code: 'OBJ-01', title: 'Reduzir o custo da má qualidade', kpiId: 'copq', target: 42, deadline: end, owner: 'Marina Lopes', plan: 'Atacar as três maiores causas de refugo (Pareto mensal) e controlar a vida útil das ferramentas em todas as máquinas (O-01).' },
    { id: 'obj-02', code: 'OBJ-02', title: 'Elevar o OEE da fábrica', kpiId: 'oee', target: 80, deadline: end, owner: 'Rafael Duarte', plan: 'SMED no setup da CNC e preventiva quinzenal (R-02).' },
    { id: 'obj-03', code: 'OBJ-03', title: 'Reduzir reclamações de clientes', kpiId: 'ppm', target: 200, deadline: end, owner: 'Fernanda Lima', plan: 'Checklist de análise crítica do pedido (R-06) e resposta a toda reclamação em até 10 dias.' },
    { id: 'obj-04', code: 'OBJ-04', title: 'Encerrar as ações corretivas no prazo', kpiId: 'prazo', target: 95, deadline: end, owner: 'Marina Lopes', plan: 'Pendências semanais por responsável e escalonamento das ações vencidas na reunião de produção.' },
  ];
}

/** Uma revisão em aprovação, para a demonstração já mostrar o fluxo andando. */
export function seedApproval(docs: Doc[], T: string) {
  const d = docs.find((x) => x.id === 'it-l2-003');
  if (!d) return;
  d.approval = {
    step: 'aprovacao', change: 'Ajuste do torque da tampa para 28 N·m e foto do torquímetro calibrado.', author: 'Rafael Duarte', reviewer: 'Patrícia Nunes', approver: 'Marina Lopes',
    events: [
      { at: `${addDays(T, -2)}T16:10:00`, user: 'Patrícia Nunes', kind: 'aprovou', text: 'Conferido no posto com o líder do turno C.' },
      { at: `${addDays(T, -5)}T10:02:00`, user: 'Rafael Duarte', kind: 'enviou', text: 'Enviado para revisão técnica.' },
      { at: `${addDays(T, -6)}T08:40:00`, user: 'Rafael Duarte', kind: 'iniciou', text: 'Revisão aberta a partir da NC-2026-060.' },
    ],
  };
}
