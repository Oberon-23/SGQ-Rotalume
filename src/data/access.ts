/*
 * Perfis de demonstração e regras de permissão.
 *
 * Nesta versão as regras rodam no navegador, para quem visita o portfólio poder trocar de perfil.
 * Em produção, as mesmas regras viram políticas no banco (Row Level Security no Postgres/Supabase),
 * e a interface continua usando esta função só para esconder o que o usuário não pode fazer.
 */
import type { DB, Entity, Role } from './types';

export interface User { id: string; name: string; role: Role; title: string }

export const USERS: User[] = [
  { id: 'marina', name: 'Marina Lopes', role: 'gestor', title: 'Gestora da qualidade' },
  { id: 'diego', name: 'Diego Moraes', role: 'dono', title: 'Dono do processo Usinagem CNC' },
  { id: 'rafael', name: 'Rafael Duarte', role: 'auditor', title: 'Auditor interno e engenheiro de processos' },
  { id: 'visitante', name: 'Visitante', role: 'leitor', title: 'Somente leitura' },
];

export const ROLE_LABEL: Record<Role, string> = { gestor: 'Gestão da qualidade', dono: 'Dono de processo', auditor: 'Auditor interno', leitor: 'Leitor' };

export const ROLE_HELP: Record<Role, string> = {
  gestor: 'Pode criar, editar e excluir tudo, programar auditorias e conduzir a análise crítica.',
  dono: 'Registra não conformidades, riscos e reclamações e edita o que é dele: os próprios processos, NCs, documentos, indicadores, treinamentos e riscos. Não exclui.',
  auditor: 'Programa e conduz auditorias (exceto em processos dos quais é dono), abre NCs a partir das constatações e edita o que é dele.',
  leitor: 'Vê tudo e exporta planilhas, mas não altera nada.',
};

export type Act = 'create' | 'edit' | 'delete';

/** Dono do processo ligado ao registro, quando houver. */
const processOwner = (db: DB, processId?: string) => db.processes.find((p) => p.id === processId)?.owner;

/**
 * Pode o usuário fazer a ação neste tipo de registro?
 * `rec` é o registro em questão (para editar e excluir); na criação pode ser omitido.
 */
export function can(user: User, db: DB, act: Act, entity: Entity | 'data', record?: object): boolean {
  const rec = record as Record<string, unknown> | undefined;
  if (user.role === 'gestor') return true;
  if (user.role === 'leitor') return false;
  if (act === 'delete' || entity === 'data' || entity === 'reviews' || entity === 'objectives') return false;

  const me = user.name;
  const procId = (entity === 'processes' ? rec?.id : rec?.processId) as string | undefined;
  const isMine = !!rec && (rec.owner === me || processOwner(db, procId) === me);

  switch (entity) {
    case 'processes':
      return act === 'edit' && isMine;
    case 'ncs':
    case 'risks':
      return act === 'create' ? true : isMine;
    case 'audits':
      if (user.role !== 'auditor') return false;
      if (!rec) return true;
      return processOwner(db, rec.processId as string) !== me; // independência: não audita o próprio processo
    case 'docs':
    case 'kpis':
    case 'trainings':
      return act === 'create' ? user.role === 'dono' : isMine;
    case 'complaints':
      return act === 'create' ? true : isMine;
    case 'suppliers':
      return act === 'edit' && rec?.owner === me;
  }
  return false;
}

export const DENIED = 'Seu perfil não pode alterar este registro. Troque de perfil no topo da página para testar.';
