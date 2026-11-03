/*
 * Dados fictícios da Rotalume Indústria (mesma fábrica do painel de Qualidade).
 * As datas são calculadas a partir de hoje, para os prazos nunca ficarem velhos.
 */
import type { Action, Audit, AuditItem, DB, Doc, KPI, NonConformity, Process, SixM } from './types';
import { SIX_M } from './types';
import { addDays, addMonths, lastMonths, today } from './utils';

export const DB_VERSION = 1;

const emptyIshikawa = (): Record<SixM, string[]> => Object.fromEntries(SIX_M.map((m) => [m, []])) as unknown as Record<SixM, string[]>;

const P = (code: string, name: string, type: Process['type'], owner: string, objective: string,
  suppliers: string[], inputs: string[], steps: string[], outputs: string[], customers: string[]): Process =>
  ({ id: code.toLowerCase(), code, name, type, owner, objective, sipoc: { suppliers, inputs, steps, outputs, customers } });

function processes(): Process[] {
  return [
    P('P01', 'Planejamento estratégico e análise crítica', 'gestao', 'Eduardo Campos', 'Definir objetivos da qualidade e analisar criticamente o desempenho do sistema.',
      ['Diretoria', 'Todos os processos'], ['Indicadores', 'Resultados de auditorias', 'Contexto e partes interessadas'], ['Analisar contexto', 'Definir objetivos', 'Reunião de análise crítica', 'Desdobrar ações'], ['Objetivos da qualidade', 'Ata de análise crítica', 'Plano de ação'], ['Todos os processos', 'Diretoria']),
    P('P02', 'Gestão da qualidade', 'gestao', 'Marina Lopes', 'Manter o sistema de gestão da qualidade conforme a ISO 9001 e conduzir a melhoria contínua.',
      ['Todos os processos', 'Órgão certificador'], ['Não conformidades', 'Requisitos da ISO 9001', 'Documentos'], ['Controlar documentos', 'Tratar não conformidades', 'Programar auditorias', 'Consolidar indicadores'], ['Documentos vigentes', 'Ações corretivas', 'Relatórios de auditoria'], ['Todos os processos', 'Clientes']),
    P('P03', 'Comercial e atendimento ao cliente', 'principal', 'Fernanda Lima', 'Entender os requisitos do cliente e garantir o pedido certo, no prazo combinado.',
      ['Clientes', 'Engenharia de processos'], ['Pedido de cotação', 'Desenho e especificação'], ['Analisar requisitos', 'Emitir proposta', 'Confirmar pedido', 'Tratar reclamações'], ['Pedido confirmado', 'Resposta a reclamação'], ['Clientes', 'PCP']),
    P('P04', 'Engenharia de processos', 'principal', 'Rafael Duarte', 'Definir o processo de fabricação, as instruções de trabalho e os controles de cada característica.',
      ['Comercial', 'Clientes'], ['Desenho', 'Especificação', 'Capacidade das máquinas'], ['Definir roteiro', 'Elaborar plano de controle', 'Escrever instruções', 'Validar o processo'], ['Roteiro de fabricação', 'Plano de controle', 'Instruções de trabalho'], ['PCP', 'Produção', 'Qualidade']),
    P('P05', 'Planejamento e controle da produção (PCP)', 'principal', 'Camila Prado', 'Programar a produção para atender a demanda com o menor estoque e o maior uso da capacidade.',
      ['Comercial', 'Suprimentos'], ['Pedidos', 'Previsão de demanda', 'Estoque', 'Capacidade'], ['Planejar a capacidade', 'Programar ordens', 'Liberar materiais', 'Acompanhar a aderência'], ['Programa de produção', 'Ordens de produção'], ['Usinagem', 'Montagem', 'Pintura']),
    P('P06', 'Usinagem CNC (Linha 1)', 'principal', 'Diego Moraes', 'Usinar eixos dentro da especificação, com OEE acima de 75%.',
      ['PCP', 'Suprimentos', 'Manutenção'], ['Barras de aço', 'Ordem de produção', 'Programa CNC'], ['Setup', 'Usinar', 'Medir (CEP)', 'Liberar lote'], ['Eixos usinados', 'Registros de CEP'], ['Montagem']),
    P('P07', 'Montagem (Linha 2)', 'principal', 'Patrícia Nunes', 'Montar conjuntos com torque e componentes conforme a instrução de trabalho.',
      ['Usinagem', 'Suprimentos'], ['Eixos', 'Componentes', 'Instruções de trabalho'], ['Separar componentes', 'Montar', 'Apertar com torquímetro', 'Testar'], ['Conjuntos montados'], ['Pintura']),
    P('P08', 'Pintura (Linha 3)', 'principal', 'Lucas Ferraz', 'Pintar conjuntos com espessura de tinta e acabamento dentro da especificação.',
      ['Montagem', 'Suprimentos'], ['Conjuntos montados', 'Tinta', 'Controle de umidade'], ['Preparar superfície', 'Pintar', 'Curar', 'Inspecionar acabamento'], ['Conjuntos pintados'], ['Expedição', 'Clientes']),
    P('P09', 'Expedição', 'principal', 'Thiago Alves', 'Embalar e despachar os pedidos completos e no prazo.',
      ['Pintura', 'PCP'], ['Produto acabado', 'Pedido'], ['Conferir', 'Embalar', 'Emitir nota', 'Despachar'], ['Pedido despachado'], ['Clientes']),
    P('P10', 'Suprimentos', 'apoio', 'Bianca Rocha', 'Comprar e receber materiais conformes, no prazo e no custo planejado.',
      ['Fornecedores', 'PCP'], ['Necessidade de materiais', 'Especificação técnica'], ['Qualificar fornecedor', 'Comprar', 'Receber e inspecionar', 'Avaliar fornecedor'], ['Materiais liberados', 'Avaliação de fornecedores'], ['Produção', 'PCP']),
    P('P11', 'Manutenção', 'apoio', 'Juliana Reis', 'Manter as máquinas disponíveis com manutenção preventiva e resposta rápida a quebras.',
      ['Produção', 'Fornecedores de peças'], ['Plano de manutenção', 'Chamados de quebra'], ['Executar preventiva', 'Atender corretiva', 'Registrar paradas'], ['Máquinas disponíveis', 'Histórico de manutenção'], ['Produção']),
    P('P12', 'Metrologia e controle de qualidade', 'apoio', 'Marina Lopes', 'Garantir instrumentos calibrados e inspeções confiáveis.',
      ['Laboratório de calibração', 'Produção'], ['Instrumentos', 'Plano de controle'], ['Calibrar instrumentos', 'Inspecionar', 'Liberar ou segregar'], ['Certificados de calibração', 'Laudos de inspeção'], ['Produção', 'Clientes']),
    P('P13', 'Recursos humanos', 'apoio', 'Eduardo Campos', 'Garantir pessoas competentes e treinadas para cada função.',
      ['Gestores', 'Mercado'], ['Matriz de competências', 'Necessidade de treinamento'], ['Recrutar', 'Integrar', 'Treinar', 'Avaliar competência'], ['Pessoas treinadas', 'Registros de treinamento'], ['Todos os processos']),
  ];
}

const A = (what: string, why: string, where: string, who: string, when: string, how: string, howMuch: number, done: boolean): Action =>
  ({ id: Math.random().toString(36).slice(2, 9), what, why, where, who, when, how, howMuch, done });

function ncs(T: string): NonConformity[] {
  const base = (o: Partial<NonConformity> & Pick<NonConformity, 'code' | 'title' | 'processId' | 'origin' | 'severity' | 'stage' | 'owner' | 'openedAt' | 'dueAt'>): NonConformity => ({
    id: o.code.toLowerCase(), description: '', containment: '', whys: ['', '', '', '', ''], rootCause: '', category: '',
    ishikawa: emptyIshikawa(), actions: [], verification: { effective: null, evidence: '', date: '' }, ...o,
  });
  const ish = (o: Partial<Record<SixM, string[]>>) => ({ ...emptyIshikawa(), ...o });
  return [
    base({ code: 'NC-2026-058', title: 'Diâmetro do eixo fora de controle por desgaste de ferramenta', processId: 'p06', origin: 'Inspeção de processo', severity: 'Maior', stage: 'encerrada', owner: 'Diego Moraes',
      openedAt: addDays(T, -190), dueAt: addDays(T, -140), closedAt: addDays(T, -128),
      description: 'A carta X̄-R do diâmetro do eixo (25,000 ± 0,050 mm) mostrou 8 médias seguidas acima da linha central e 38 pontos fora do limite de controle. 3 peças ficaram fora da especificação.',
      containment: 'Lote segregado e 100% medido. 3 peças sucateadas. Ferramenta trocada no mesmo turno.',
      whys: ['O diâmetro aumentou de forma gradual.', 'A aresta da ferramenta estava desgastada.', 'A ferramenta passou da vida útil.', 'A troca era feita por calendário, não por número de peças.', 'A instrução de setup não definia vida útil por peças.'],
      rootCause: 'A troca de ferramenta era feita por calendário, sem controle da vida útil em número de peças.', category: 'Método',
      ishikawa: ish({ 'Método': ['Troca de ferramenta por calendário', 'Sem limite de peças por aresta'], 'Máquina': ['Ferramenta desgastada'], 'Medição': ['Desvio visto só na carta de controle'] }),
      actions: [A('Definir vida útil de 1.200 peças por aresta', 'Trocar antes do desgaste afetar o diâmetro', 'Usinagem CNC', 'Rafael Duarte', addDays(T, -170), 'Teste de desgaste e revisão da IT-L1-001', 0, true),
        A('Contador de peças no CNC com alerta de troca', 'Não depender da memória do operador', 'Usinagem CNC', 'Juliana Reis', addDays(T, -158), 'Parâmetro no comando da máquina', 1800, true),
        A('Treinar operadores na nova regra', 'Garantir que todos apliquem a troca', 'Usinagem CNC', 'Diego Moraes', addDays(T, -150), 'Treinamento no posto com registro', 0, true)],
      verification: { effective: true, evidence: '90 dias sem pontos fora de controle no diâmetro; Cpk voltou de 0,9 para 1,59.', date: addDays(T, -128) } }),
    base({ code: 'NC-2026-060', title: 'Variação de torque acima do normal no turno C', processId: 'p07', origin: 'Inspeção de processo', severity: 'Maior', stage: 'encerrada', owner: 'Patrícia Nunes',
      openedAt: addDays(T, -165), dueAt: addDays(T, -110), closedAt: addDays(T, -102),
      description: 'A amplitude do torque de aperto no turno C ficou o dobro dos turnos A e B durante seis meses.',
      containment: 'Torque reapertado e conferido em 100% dos conjuntos do turno C por duas semanas.',
      whys: ['Cada operador apertava de um jeito.', 'O turno C era formado por pessoas novas.', 'Não houve treinamento prático no torquímetro.', 'A integração não tinha etapa no posto.', 'A matriz de competências não exigia o treinamento.'],
      rootCause: 'Equipe nova sem treinamento prático no aperto com torquímetro.', category: 'Mão de obra',
      ishikawa: ish({ 'Mão de obra': ['Equipe nova', 'Sem treinamento prático'], 'Método': ['Instrução sem foto da sequência de aperto'] }),
      actions: [A('Treinamento prático de aperto para o turno C', 'Padronizar o aperto', 'Montagem', 'Patrícia Nunes', addDays(T, -130), 'Treinamento no posto com avaliação', 600, true),
        A('Incluir o treinamento na matriz de competências', 'Evitar que se repita com novos contratados', 'RH', 'Eduardo Campos', addDays(T, -120), 'Atualizar a matriz e a integração', 0, true)],
      verification: { effective: true, evidence: 'Amplitude do turno C igual à dos outros turnos por 3 meses seguidos.', date: addDays(T, -102) } }),
    base({ code: 'NC-2026-062', title: 'Bolhas e escorrimento na pintura nos meses de verão', processId: 'p08', origin: 'Inspeção de processo', severity: 'Menor', stage: 'encerrada', owner: 'Lucas Ferraz',
      openedAt: addDays(T, -240), dueAt: addDays(T, -180), closedAt: addDays(T, -175),
      description: 'Defeitos de bolha e escorrimento triplicaram entre janeiro e março.',
      containment: 'Retrabalho das peças com defeito e pausa na pintura quando a umidade passava de 75%.',
      whys: ['A tinta não secava direito.', 'A umidade da cabine passava de 75%.', 'A cabine não tinha controle de umidade.', 'O risco do verão não estava previsto.'],
      rootCause: 'Cabine de pintura sem controle de umidade.', category: 'Meio ambiente',
      ishikawa: ish({ 'Meio ambiente': ['Umidade alta no verão'], 'Máquina': ['Cabine sem desumidificador'] }),
      actions: [A('Instalar desumidificador na cabine', 'Manter a umidade abaixo de 65%', 'Pintura', 'Juliana Reis', addDays(T, -200), 'Compra e instalação', 14500, true),
        A('Registrar umidade a cada 2 horas', 'Agir antes do defeito', 'Pintura', 'Lucas Ferraz', addDays(T, -195), 'Formulário FR-014', 0, true)],
      verification: { effective: true, evidence: 'Taxa de bolha voltou ao nível normal (0,4 a cada 100 peças).', date: addDays(T, -175) } }),
    base({ code: 'NC-2026-063', title: 'Reclamação de cliente: eixo com diâmetro acima do especificado', processId: 'p06', origin: 'Reclamação de cliente', severity: 'Crítica', stage: 'encerrada', owner: 'Fernanda Lima',
      openedAt: addDays(T, -185), dueAt: addDays(T, -155), closedAt: addDays(T, -120),
      description: 'Cliente devolveu 40 eixos com diâmetro de 25,06 mm. Ligada à NC-2026-058.',
      containment: 'Estoque no cliente e na fábrica inspecionado; peças repostas em 48 horas.',
      whys: ['Peças fora saíram da fábrica.', 'A inspeção final era por amostragem.', 'O desvio aconteceu entre duas amostras.'],
      rootCause: 'Mesma causa da NC-2026-058 (vida útil da ferramenta) e inspeção final sem reforço quando o processo sai de controle.', category: 'Método',
      actions: [A('Inspeção 100% quando houver ponto fora de controle', 'Impedir que peças fora saiam', 'Metrologia', 'Marina Lopes', addDays(T, -160), 'Regra no plano de controle', 0, true)],
      verification: { effective: true, evidence: 'Nenhuma nova reclamação de dimensional em 4 meses.', date: addDays(T, -120) } }),
    base({ code: 'NC-2026-065', title: 'Lote de parafusos com rosca irregular bloqueado no recebimento', processId: 'p10', origin: 'Fornecedor', severity: 'Crítica', stage: 'plano', owner: 'Bianca Rocha',
      openedAt: addDays(T, -60), dueAt: addDays(T, -12),
      description: 'Lote de 5.000 parafusos M8 com rosca irregular em 6% da amostra.',
      containment: 'Lote bloqueado e devolvido ao fornecedor. Estoque de segurança liberado.',
      whys: ['A rosca veio irregular.', 'A máquina de rosca do fornecedor estava desregulada.', 'O fornecedor não faz inspeção final por lote.'],
      rootCause: 'Fornecedor sem inspeção final por lote.', category: 'Material',
      ishikawa: ish({ 'Material': ['Rosca irregular'], 'Método': ['Fornecedor sem inspeção por lote'] }),
      actions: [A('Exigir certificado de inspeção por lote', 'Garantir a qualidade antes do envio', 'Fornecedor', 'Bianca Rocha', addDays(T, -20), 'Cláusula no pedido de compra', 0, true),
        A('Auditoria no fornecedor', 'Confirmar a correção na origem', 'Fornecedor', 'Marina Lopes', addDays(T, -5), 'Visita com checklist', 900, false)] }),
    base({ code: 'NC-2026-067', title: 'Parafusos com rosca irregular no recebimento (reincidência)', processId: 'p10', origin: 'Fornecedor', severity: 'Menor', stage: 'verificacao', owner: 'Bianca Rocha',
      openedAt: addDays(T, -45), dueAt: addDays(T, 5),
      description: 'Segunda ocorrência do mesmo defeito, em 1% da amostra.',
      containment: 'Peças separadas na inspeção 100% do lote.',
      whys: ['Defeito repetido.', 'A ação da NC-2026-065 ainda não estava implantada.', 'O prazo do fornecedor era maior que o próximo lote.'],
      rootCause: 'Ação corretiva do fornecedor ainda não implantada quando o lote chegou.', category: 'Material',
      actions: [A('Inspeção 100% nos próximos 3 lotes', 'Proteger a montagem até a correção do fornecedor', 'Recebimento', 'Bianca Rocha', addDays(T, -10), 'Calibrador de rosca passa/não passa', 0, true)] }),
    base({ code: 'NC-2026-069', title: 'Instrução de aperto desatualizada no posto da montagem', processId: 'p07', origin: 'Auditoria interna', severity: 'Menor', stage: 'analise', owner: 'Patrícia Nunes',
      openedAt: addDays(T, -18), dueAt: addDays(T, 25), auditId: 'aud-2026-03',
      description: 'Na auditoria interna, a IT-L2-003 impressa no posto estava na revisão 3, mas a vigente é a revisão 4.',
      containment: 'Cópia obsoleta recolhida e revisão 4 afixada no posto.',
      whys: ['A cópia antiga ficou no posto.', 'Ninguém recolheu a versão anterior.', ''], ishikawa: ish({ 'Método': ['Recolhimento de cópias não definido'] }) }),
    base({ code: 'NC-2026-070', title: 'Micrômetro do posto L1 com calibração vencida', processId: 'p12', origin: 'Metrologia', severity: 'Maior', stage: 'verificacao', owner: 'Marina Lopes',
      openedAt: addDays(T, -30), dueAt: addDays(T, 10),
      description: 'Micrômetro MIC-017 usado no CEP do diâmetro estava com calibração vencida havia 12 dias.',
      containment: 'Instrumento retirado; medições dos 12 dias refeitas com instrumento calibrado. Nenhuma peça fora.',
      whys: ['A calibração venceu.', 'O alerta de vencimento não chegou ao posto.', 'O controle era uma planilha sem aviso.'],
      rootCause: 'Controle de calibração em planilha, sem alerta de vencimento.', category: 'Medição',
      ishikawa: ish({ 'Medição': ['Instrumento vencido'], 'Método': ['Planilha sem alerta'] }),
      actions: [A('Etiqueta de validade visível em cada instrumento', 'Operador conferir antes de medir', 'Metrologia', 'Marina Lopes', addDays(T, -15), 'Etiquetas coloridas por trimestre', 120, true),
        A('Aviso automático 15 dias antes do vencimento', 'Calibrar no prazo', 'Metrologia', 'Marina Lopes', addDays(T, -8), 'Alerta no sistema de calibração', 0, true)] }),
    base({ code: 'NC-2026-071', title: 'Dimensional fora de especificação acima do limite de alerta', processId: 'p06', origin: 'Inspeção de processo', severity: 'Maior', stage: 'plano', owner: 'Diego Moraes',
      openedAt: addDays(T, -25), dueAt: addDays(T, 20),
      description: 'Defeitos dimensionais acima de 1 a cada 100 peças no último mês.',
      containment: 'Inspeção reforçada no fim da linha.',
      whys: ['Peças com dimensional fora.', 'Variação aumentou depois do setup.', 'O setup não tem checklist de primeira peça.'],
      rootCause: 'Setup sem aprovação formal da primeira peça.', category: 'Método',
      ishikawa: ish({ 'Método': ['Sem aprovação de primeira peça'], 'Mão de obra': ['Setup feito por pessoas diferentes'] }),
      actions: [A('Criar checklist de setup com aprovação da primeira peça', 'Detectar desvio antes de produzir o lote', 'Usinagem CNC', 'Rafael Duarte', addDays(T, 7), 'Formulário FR-021', 0, false)] }),
    base({ code: 'NC-2026-072', title: 'Bolha acima do limite de alerta', processId: 'p08', origin: 'Inspeção de processo', severity: 'Menor', stage: 'registro', owner: 'Lucas Ferraz',
      openedAt: addDays(T, -6), dueAt: addDays(T, 24), description: 'Taxa de bolha subiu para 1,1 a cada 100 peças na última semana.' }),
    base({ code: 'NC-2026-073', title: 'Risco superficial acima do limite de alerta', processId: 'p06', origin: 'Inspeção de processo', severity: 'Menor', stage: 'analise', owner: 'Diego Moraes',
      openedAt: addDays(T, -10), dueAt: addDays(T, 20), description: 'Riscos na superfície do eixo detectados na inspeção visual.', containment: 'Peças com risco segregadas para retrabalho de polimento.',
      whys: ['Riscos na superfície.', 'Peças encostando umas nas outras no transporte.', ''] }),
    base({ code: 'NC-2026-074', title: 'Componente faltante acima do limite de alerta', processId: 'p07', origin: 'Inspeção de processo', severity: 'Maior', stage: 'registro', owner: 'Patrícia Nunes',
      openedAt: addDays(T, -3), dueAt: addDays(T, 27), description: 'Conjuntos sem arruela de pressão detectados no teste final.', containment: 'Teste final reforçado e conferência visual de 100% dos conjuntos.' }),
  ];
}

const CHECK: [string, string][] = [
  ['4.4', 'O processo está definido, com entradas, saídas, responsável e indicadores.'],
  ['5.2', 'A política da qualidade é conhecida pelas pessoas do processo.'],
  ['6.1', 'Os riscos e oportunidades do processo estão identificados.'],
  ['7.1.5', 'Os instrumentos de medição estão calibrados e identificados.'],
  ['7.2', 'As pessoas têm a competência registrada para a função.'],
  ['7.5', 'A informação documentada no posto é a versão vigente.'],
  ['8.5.1', 'A produção é feita sob condições controladas (plano de controle, IT).'],
  ['8.7', 'As saídas não conformes são identificadas e segregadas.'],
  ['9.1', 'Os indicadores do processo são acompanhados e analisados.'],
  ['10.2', 'As não conformidades são tratadas com ação corretiva.'],
];
export const auditChecklist = (): AuditItem[] => CHECK.map(([clause, requirement]) => ({ id: Math.random().toString(36).slice(2, 9), clause, requirement, result: null, evidence: '' }));

function audits(T: string): Audit[] {
  const done = (code: string, processId: string, auditor: string, date: string, scope: string, res: Record<string, [Exclude<AuditItem['result'], null>, string, string?]>): Audit => ({
    id: code.toLowerCase(), code, processId, auditor, date, done: true, scope,
    items: auditChecklist().map((i) => { const r = res[i.clause]; return r ? { ...i, result: r[0], evidence: r[1], ncId: r[2] } : { ...i, result: 'C', evidence: 'Verificado sem desvios.' }; }),
  });
  const planned = (code: string, processId: string, auditor: string, date: string, scope: string): Audit => ({ id: code.toLowerCase(), code, processId, auditor, date, done: false, scope, items: auditChecklist() });
  return [
    done('AUD-2026-01', 'p06', 'Marina Lopes', addDays(T, -150), 'Setup, usinagem e CEP do diâmetro do eixo.', {
      '7.1.5': ['OBS', 'Instrumentos calibrados, mas sem etiqueta de validade visível.'],
      '8.5.1': ['OM', 'Contador de peças por aresta poderia ser estendido para todas as máquinas.'] }),
    done('AUD-2026-02', 'p10', 'Rafael Duarte', addDays(T, -95), 'Recebimento, inspeção e avaliação de fornecedores.', {
      '6.1': ['OBS', 'Risco de fornecedor único de parafusos não está no mapa de riscos.'],
      '9.1': ['OM', 'Avaliação de fornecedores poderia ser mensal em vez de semestral.'] }),
    done('AUD-2026-03', 'p07', 'Marina Lopes', addDays(T, -18), 'Montagem, aperto com torquímetro e teste final.', {
      '7.5': ['NC', 'IT-L2-003 no posto estava na revisão 3; a vigente é a revisão 4.', 'nc-2026-069'],
      '7.2': ['C', 'Treinamento de aperto do turno C registrado na matriz.'] }),
    planned('AUD-2026-04', 'p08', 'Rafael Duarte', addDays(T, 12), 'Preparação de superfície, pintura e controle de umidade.'),
    planned('AUD-2026-05', 'p05', 'Marina Lopes', addDays(T, 35), 'Planejamento da produção e aderência ao programa.'),
    planned('AUD-2026-06', 'p12', 'Rafael Duarte', addDays(T, 60), 'Calibração de instrumentos e inspeção final.'),
  ];
}

function docs(T: string): Doc[] {
  const D = (code: string, title: string, type: Doc['type'], processId: string, owner: string, summary: string, version: number, reviewedAgo: number, status: Doc['status'] = 'vigente', changes: string[] = []): Doc => {
    const reviewedAt = addDays(T, -reviewedAgo);
    const history = Array.from({ length: version }, (_, i) => ({ version: i, date: addMonths(reviewedAt, -(version - 1 - i) * 10), author: owner, change: changes[i] || (i === 0 ? 'Emissão inicial.' : 'Revisão periódica sem alteração de conteúdo.') }));
    return { id: code.toLowerCase(), code, title, type, processId, owner, status, summary, version: version - 1, reviewedAt, nextReview: addMonths(reviewedAt, 12), history: history.reverse() };
  };
  return [
    D('MQ-001', 'Manual da qualidade', 'Manual', 'p02', 'Marina Lopes', 'Escopo do SGQ, política da qualidade, mapa de processos e interação entre eles.', 3, 120),
    D('PR-001', 'Controle de informação documentada', 'Procedimento', 'p02', 'Marina Lopes', 'Como criar, revisar, aprovar, distribuir e recolher documentos.', 2, 380, 'vigente', ['Emissão inicial.', 'Inclusão do recolhimento de cópias impressas.']),
    D('PR-002', 'Tratamento de não conformidades e ação corretiva', 'Procedimento', 'p02', 'Marina Lopes', 'Registro, contenção, análise de causa (5 Porquês e Ishikawa), plano 5W2H e verificação de eficácia.', 3, 90, 'vigente', ['Emissão inicial.', 'Inclusão do Ishikawa.', 'Prazo de 30 dias para NC maior.']),
    D('PR-003', 'Auditoria interna', 'Procedimento', 'p02', 'Marina Lopes', 'Programa anual, qualificação de auditores, checklist e relatório.', 2, 200),
    D('PR-004', 'Calibração de instrumentos', 'Procedimento', 'p12', 'Marina Lopes', 'Periodicidade, identificação e o que fazer com instrumento vencido.', 4, 25, 'vigente', ['Emissão inicial.', 'Revisão periódica.', 'Novo laboratório.', 'Etiqueta de validade e aviso 15 dias antes (NC-2026-070).']),
    D('PR-005', 'Recebimento e inspeção de materiais', 'Procedimento', 'p10', 'Bianca Rocha', 'Amostragem, critérios de aceitação e bloqueio de lotes.', 2, 340),
    D('PR-006', 'Planejamento e programação da produção', 'Procedimento', 'p05', 'Camila Prado', 'Como o PCP planeja capacidade, programa ordens e mede a aderência.', 1, 400),
    D('IT-L1-001', 'Setup e troca de ferramenta da CNC', 'Instrução de trabalho', 'p06', 'Rafael Duarte', 'Sequência de setup e troca de ferramenta a cada 1.200 peças por aresta.', 3, 150, 'vigente', ['Emissão inicial.', 'Revisão periódica.', 'Vida útil por peças (NC-2026-058).']),
    D('IT-L2-003', 'Aperto com torquímetro', 'Instrução de trabalho', 'p07', 'Rafael Duarte', 'Sequência e torque de aperto do conjunto, com fotos.', 5, 160, 'revisao', ['Emissão inicial.', 'Novo torque.', 'Revisão periódica.', 'Fotos da sequência (NC-2026-060).', 'Ajuste do torque da tampa.']),
    D('IT-L3-002', 'Preparação de superfície e pintura', 'Instrução de trabalho', 'p08', 'Lucas Ferraz', 'Limpeza, aplicação e cura, com limite de umidade de 65%.', 2, 230),
    D('FR-014', 'Registro de umidade da cabine de pintura', 'Formulário', 'p08', 'Lucas Ferraz', 'Registro a cada 2 horas da umidade e da temperatura.', 1, 230),
    D('FR-021', 'Checklist de setup e aprovação da primeira peça', 'Formulário', 'p06', 'Rafael Duarte', 'Itens de setup e assinatura de aprovação da primeira peça.', 1, 345, 'vigente'),
  ];
}

/** Série mensal reprodutível. */
function series(n: number, f: (i: number, r: () => number) => number, seed: number) {
  let a = seed;
  const r = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return Array.from({ length: n }, (_, i) => f(i, r));
}

function kpis(): KPI[] {
  const months = lastMonths(12);
  const K = (id: string, name: string, processId: string, owner: string, unit: string, target: number, higherIsBetter: boolean, decimals: number, formula: string, vals: number[]): KPI =>
    ({ id, name, processId, owner, unit, target, higherIsBetter, decimals, formula, values: months.map((m, i) => ({ month: m, value: +vals[i].toFixed(decimals) })) });
  return [
    K('oee', 'OEE geral da fábrica', 'p04', 'Rafael Duarte', '%', 75, true, 1, 'Disponibilidade × Performance × Qualidade',
      series(12, (i, r) => 76.5 + (i >= 5 && i <= 6 ? -3.2 : 0) + (r() - .5) * 2.4 + i * .08, 11)),
    K('fpy', 'Peças boas de primeira (FPY)', 'p12', 'Marina Lopes', '%', 98, true, 2, 'Peças aprovadas sem retrabalho ÷ peças produzidas',
      series(12, (i, r) => 97.9 + (i >= 5 && i <= 6 ? -0.5 : 0) + (r() - .5) * .5, 21)),
    K('copq', 'Custo da má qualidade', 'p02', 'Marina Lopes', 'R$ mil', 50, false, 1, 'Refugo + 30% do custo das peças retrabalhadas',
      series(12, (i, r) => 52 + (i >= 5 && i <= 6 ? 14 : 0) - i * .6 + (r() - .5) * 8, 31)),
    K('ppm', 'Reclamações de cliente (PPM)', 'p03', 'Fernanda Lima', 'ppm', 300, false, 0, 'Peças reclamadas ÷ peças entregues × 1.000.000',
      series(12, (i, r) => (i === 0 ? 900 : 220) + (r() - .5) * 140, 41)),
    K('prazo', 'Ações corretivas encerradas no prazo', 'p02', 'Marina Lopes', '%', 90, true, 0, 'Ações encerradas até o prazo ÷ ações encerradas',
      series(12, (i, r) => 58 + i * 1.6 + (r() - .5) * 12, 51)),
    K('eficacia', 'Eficácia das ações corretivas', 'p02', 'Marina Lopes', '%', 90, true, 0, 'Ações eficazes ÷ ações verificadas',
      series(12, (_i, r) => 92 + (r() - .5) * 10, 61)),
    K('calib', 'Instrumentos com calibração em dia', 'p12', 'Marina Lopes', '%', 100, true, 1, 'Instrumentos dentro da validade ÷ instrumentos em uso',
      series(12, (i, r) => (i === 10 ? 97.4 : 100 - (r() < .25 ? 1.3 : 0)), 71)),
    K('aderencia', 'Aderência ao programa de produção', 'p05', 'Camila Prado', '%', 92, true, 1, 'Ordens concluídas na data programada ÷ ordens programadas',
      series(12, (i, r) => 89 + i * .3 + (r() - .5) * 5, 81)),
  ];
}

export function seed(): DB {
  const T = today();
  return { version: DB_VERSION, seededAt: T, processes: processes(), ncs: ncs(T), audits: audits(T), docs: docs(T), kpis: kpis() };
}
