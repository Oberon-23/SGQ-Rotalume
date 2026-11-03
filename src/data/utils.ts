/* Datas, formatação e pequenas regras de negócio compartilhadas. */
import type { KPI, NCStage, NonConformity, Doc, Audit } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toISO(new Date());
export const addDays = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return toISO(d); };
export const addMonths = (iso: string, n: number) => { const d = new Date(iso + 'T12:00:00'); d.setMonth(d.getMonth() + n); return toISO(d); };
export const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000);
export const fmtDate = (iso?: string) => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const monthLabel = (key: string) => { const [y, m] = key.split('-'); return `${MES[+m - 1]}/${y.slice(2)}`; };
/** Últimos n meses fechados (sem o mês atual), do mais antigo para o mais recente. */
export const lastMonths = (n: number) => { const out: string[] = []; const d = new Date(); d.setDate(1); for (let i = n; i >= 1; i--) { const x = new Date(d); x.setMonth(d.getMonth() - i); out.push(monthKey(x)); } return out; };

export const uid = (prefix = '') => prefix + Math.random().toString(36).slice(2, 9);
export const nf = (v: number, d = 0) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
export const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

/* ---------- não conformidades ---------- */
export const STAGES: { id: NCStage; label: string; pdca: string }[] = [
  { id: 'registro', label: 'Registro e contenção', pdca: 'P' },
  { id: 'analise', label: 'Análise de causa', pdca: 'P' },
  { id: 'plano', label: 'Plano de ação', pdca: 'D' },
  { id: 'verificacao', label: 'Verificação de eficácia', pdca: 'C' },
  { id: 'encerrada', label: 'Encerrada', pdca: 'A' },
];
export const stageIndex = (s: NCStage) => STAGES.findIndex((x) => x.id === s);
export const stageLabel = (s: NCStage) => STAGES[stageIndex(s)].label;
export const isOpen = (nc: NonConformity) => nc.stage !== 'encerrada';
export const isLate = (nc: NonConformity) => isOpen(nc) && nc.dueAt < today();
export const lateActions = (nc: NonConformity) => (isOpen(nc) ? nc.actions.filter((a) => !a.done && a.when < today()) : []);

/** O que falta para avançar de etapa. Lista vazia = pode avançar. */
export function blockers(nc: NonConformity): string[] {
  const b: string[] = [];
  switch (nc.stage) {
    case 'registro':
      if (!nc.description.trim()) b.push('Descreva a não conformidade.');
      if (!nc.containment.trim()) b.push('Registre a ação de contenção imediata.');
      break;
    case 'analise':
      if (nc.whys.filter((w) => (w ?? '').trim()).length < 3) b.push('Responda pelo menos 3 porquês.');
      if (!nc.rootCause.trim()) b.push('Defina a causa raiz.');
      if (!nc.category) b.push('Classifique a causa em um dos 6M.');
      break;
    case 'plano':
      if (!nc.actions.length) b.push('Inclua pelo menos uma ação no plano 5W2H.');
      if (nc.actions.some((a) => !a.what.trim() || !a.who.trim() || !a.when)) b.push('Toda ação precisa de O quê, Quem e Quando.');
      if (nc.actions.some((a) => !a.done)) b.push('Conclua todas as ações antes de verificar a eficácia.');
      break;
    case 'verificacao':
      if (nc.verification.effective !== true) b.push('Confirme que a ação foi eficaz (se não foi, volte para a análise de causa).');
      if (!nc.verification.evidence.trim()) b.push('Registre a evidência de eficácia.');
      break;
  }
  return b;
}

/* ---------- indicadores ---------- */
export const kpiOk = (k: KPI, v: number) => (k.higherIsBetter ? v >= k.target : v <= k.target);
export const lastValue = (k: KPI): KPI['values'][number] | undefined => k.values[k.values.length - 1];
export const fmtKpi = (k: KPI, v: number) => `${nf(v, k.decimals)}${k.unit === '%' ? '%' : k.unit ? ' ' + k.unit : ''}`;

/* ---------- documentos e auditorias ---------- */
export const docOverdue = (d: Doc) => d.status !== 'obsoleto' && d.nextReview < today();
export const docDueSoon = (d: Doc) => d.status !== 'obsoleto' && !docOverdue(d) && daysBetween(today(), d.nextReview) <= 30;
export const auditFindings = (a: Audit) => ({
  nc: a.items.filter((i) => i.result === 'NC').length,
  obs: a.items.filter((i) => i.result === 'OBS').length,
  om: a.items.filter((i) => i.result === 'OM').length,
  pending: a.items.filter((i) => i.result === null).length,
});

/* ---------- riscos e oportunidades ---------- */
export const PROB_LABEL = ['', 'Rara', 'Improvável', 'Possível', 'Provável', 'Quase certa'];
export const IMPACT_LABEL = ['', 'Insignificante', 'Menor', 'Moderado', 'Maior', 'Muito grave'];
export const BENEFIT_LABEL = ['', 'Mínimo', 'Pequeno', 'Moderado', 'Grande', 'Muito grande'];
export const RISK_TREATMENTS = ['Mitigar', 'Evitar', 'Transferir', 'Aceitar'];
export const OPP_TREATMENTS = ['Explorar', 'Ampliar', 'Compartilhar', 'Aceitar'];
export type RiskTone = 'low' | 'mid' | 'high' | 'crit';
/** Nível pela matriz 5×5: até 4 baixo, até 9 moderado, até 16 alto, acima disso crítico. */
export function riskLevel(probability: number, impact: number, kind: 'risco' | 'oportunidade' = 'risco') {
  const score = probability * impact;
  const tone: RiskTone = score <= 4 ? 'low' : score <= 9 ? 'mid' : score <= 16 ? 'high' : 'crit';
  const names = kind === 'risco' ? { low: 'Baixo', mid: 'Moderado', high: 'Alto', crit: 'Crítico' } : { low: 'Prioridade baixa', mid: 'Prioridade média', high: 'Prioridade alta', crit: 'Prioridade máxima' };
  return { score, tone, label: names[tone] };
}
