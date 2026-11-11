import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileText, ShieldAlert, TriangleAlert, X } from 'lucide-react';
import { useStore } from '../data/store';

export const TOUR_KEY = 'sgq-tour';
export const tourSeen = () => { try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return true; } };
export const markTourSeen = () => { try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* sem armazenamento */ } };

type Step = {
  title: string;
  body: ReactNode;
  /** Seletor CSS do trecho da tela que fica em destaque. Sem ele, o passo aparece centralizado. */
  target?: string;
  /** Página que deve estar aberta neste passo. */
  go?: string;
};

const PAD = 8;
const W = 380;

/** Tour guiado: destaca cada parte do sistema, com Voltar, Próximo e Pular. */
export default function Tour({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { markTourSeen(); onClose(); }, [onClose]);

  const Try = ({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) => (
    <li><Link to={to} onClick={close}>{icon}<span>{children}</span><ArrowRight size={15} /></Link></li>
  );

  const { mode } = useStore();
  const all: Step[] = [
    {
      title: 'Bem-vindo ao SGQ Rotalume',
      go: '/',
      body: <>
        <p>Um sistema de gestão da qualidade alinhado à <b>ISO 9001:2015</b>, para a Rotalume, uma fábrica <b>fictícia</b> de eixos e conjuntos.</p>
        <p>Este tour leva cerca de 1 minuto e mostra cada parte. Você pode clicar em <b>Pular</b> a qualquer momento.</p>
        <p className="muted">Não precisa de cadastro. O que você alterar fica salvo só neste navegador.</p>
      </>,
    },
    {
      title: 'Veja como cada perfil enxerga',
      target: '.demo-user',
      body: <>
        <p>Aqui você troca de pessoa. <b>Marina</b> (gestora) pode tudo, <b>Diego</b> edita só o processo dele, <b>Rafael</b> audita e o <b>Visitante</b> só lê.</p>
        <p>Toda alteração entra no histórico com quem fez, quando e o valor anterior.</p>
      </>,
    },
    {
      title: 'O menu segue o ciclo da qualidade',
      target: '.nav',
      body: <>
        <p><b>Hoje</b>: o que precisa de ação. <b>Planejamento</b>: objetivos, processos, riscos e indicadores. <b>Apoio</b>: documentos, treinamentos e fornecedores. <b>Verificação</b>: auditorias e análise crítica.</p>
        <p>O número vermelho mostra o que está vencido.</p>
      </>,
    },
    {
      title: 'Não conformidades com PDCA',
      go: '/nao-conformidades/nc-2026-069',
      target: '.stepper',
      body: <>
        <p>Cada não conformidade passa por etapas: descrição, contenção, causa, ação e verificação de eficácia.</p>
        <p>O sistema <b>não deixa avançar</b> sem 3 porquês e causa raiz. Fotos e laudos entram como evidência anexada.</p>
      </>,
    },
    {
      title: 'Quadro de ações (Kanban)',
      go: '/quadro',
      target: '.board',
      body: <p>Todas as ações das NCs e as decisões da direção num quadro só: <b>A fazer, Em andamento e Concluído</b>. Arraste os cartões ou use as setas. O quadro avisa quando alguém pega trabalho demais ao mesmo tempo.</p>,
    },
    {
      title: 'Reclamações de clientes',
      go: '/reclamacoes',
      target: '.tiles',
      body: <p>Prazo de resposta de 10 dias, procedência e nota de satisfação do cliente. Reclamação procedente abre uma <b>não conformidade</b> com um clique.</p>,
    },
    {
      title: 'Objetivos da qualidade',
      go: '/objetivos',
      target: '.obj-grid',
      body: <p>Cada objetivo é medido por um indicador do sistema. O progresso vai da linha de base até a meta e o status muda sozinho quando o mês fecha.</p>,
    },
    {
      title: 'Matriz de riscos',
      go: '/riscos',
      target: '.matrix',
      body: <p>Probabilidade por impacto. <b>Clique numa célula</b> para filtrar a lista de riscos e oportunidades.</p>,
    },
    {
      title: 'Aprovação de documentos',
      go: '/documentos/it-l2-003',
      target: '.approval',
      body: <p>Toda revisão passa por <b>elaboração, revisão técnica e aprovação</b>, cada etapa com seu responsável. Quem elabora não aprova a própria revisão. Como Marina, você pode aprovar esta agora.</p>,
    },
    {
      title: 'Fornecedores (IQF)',
      go: '/fornecedores',
      target: '.tiles',
      body: <p>Avaliação mensal: 50% qualidade, 30% entrega e 20% atendimento. Fornecedor crítico na classe C gera alerta no painel.</p>,
    },
    {
      title: 'Treinamentos e competências',
      go: '/treinamentos',
      target: '.cmatrix',
      body: <p>Quem foi treinado em quê e se o treinamento funcionou. A eficácia é avaliada no posto até 30 dias depois.</p>,
    },
    {
      title: 'Auditorias e análise crítica',
      go: '/auditorias',
      target: '.page-head',
      body: <p>Programa de auditorias com checklist da ISO 9001 e achados ligados às NCs. A <b>análise crítica</b> monta a pauta da direção com os dados de todos os módulos.</p>,
    },
    {
      title: 'Ache tudo rápido',
      go: '/',
      target: '.search-btn',
      body: <p><b>Busca</b> em todos os módulos por código, assunto ou pessoa. Atalho: <kbd>Ctrl</kbd> + <kbd>K</kbd> ou <kbd>/</kbd>.</p>,
    },
    {
      title: 'Avisos de prazo',
      target: '.bell',
      body: <p>O sino mostra prazos vencidos ou nos próximos 7 dias. <b>Minhas pendências</b>, no menu, lista só o que está com você.</p>,
    },
    {
      title: 'Seus dados, sob seu controle',
      go: '/dados',
      target: '[data-tour="/dados"]',
      body: <p>Em <b>Dados e backup</b> você exporta, importa e restaura os dados de exemplo a qualquer hora.</p>,
    },
    {
      title: 'Agora é com você',
      go: '/',
      body: <>
        <p>Três caminhos rápidos:</p>
        <ul className="tour-try">
          <Try to="/nao-conformidades/nc-2026-069" icon={<TriangleAlert size={18} />}>Complete a análise de causa da <b>NC-2026-069</b>.</Try>
          <Try to="/riscos" icon={<ShieldAlert size={18} />}>Filtre pela <b>matriz de riscos</b>.</Try>
          <Try to="/imprimir/nc/nc-2026-058" icon={<FileText size={18} />}>Gere a <b>RNC em PDF</b> de uma NC encerrada.</Try>
        </ul>
        <p className="muted">O tour fica no botão <b>?</b> no topo da página.</p>
      </>,
    },
  ];

  // com conta, o perfil vem do login: o passo de trocar de perfil não se aplica
  const steps = mode === 'banco' ? all.filter((x) => x.target !== '.demo-user') : all;
  const step = steps[i];
  const last = i === steps.length - 1;

  // Abre a página do passo e espera o elemento aparecer para destacá-lo.
  useEffect(() => {
    if (step.go) navigate(step.go);
    setRect(null);
    if (!step.target) return;
    let tries = 0;
    let timer = 0;
    const find = () => {
      const el = document.querySelector<HTMLElement>(step.target!);
      const r = el?.getBoundingClientRect();
      if (el && r && r.width > 0 && r.height > 0) {
        el.scrollIntoView({ block: 'center', inline: 'center' });
        setRect(el.getBoundingClientRect());
      } else if (tries++ < 20) timer = window.setTimeout(find, 100);
    };
    timer = window.setTimeout(find, step.go ? 60 : 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // Mantém o destaque colado no elemento ao redimensionar ou rolar.
  useEffect(() => {
    if (!step.target) return;
    const update = () => {
      const el = document.querySelector<HTMLElement>(step.target!);
      const r = el?.getBoundingClientRect();
      if (el && r && r.width > 0) setRect(r);
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, steps.length - 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, steps.length]);

  useLayoutEffect(() => { nextRef.current?.focus({ preventScroll: true }); }, [i]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const narrow = vw < 700;
  let pop: CSSProperties;
  if (!rect || narrow) {
    pop = narrow ? { left: 12, right: 12, bottom: 12, width: 'auto' } : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  } else {
    const w = Math.min(W, vw - 24);
    let left = rect.right + PAD + 14;
    let top = rect.top;
    if (left + w > vw - 12) { left = rect.left; top = rect.bottom + PAD + 12; }
    if (top + 240 > vh) top = Math.max(12, rect.top - PAD - 12 - 240);
    left = Math.min(Math.max(12, left), vw - w - 12);
    top = Math.min(Math.max(12, top), vh - 252);
    pop = { left, top, width: w };
  }

  return (
    <div className="tour-layer">
      <div className="tour-block" onMouseDown={(e) => e.preventDefault()} />
      {rect && <div className="tour-spot" style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />}
      {!rect && <div className="tour-dim" />}
      <div className="tour-pop" role="dialog" aria-modal="true" aria-label={step.title} style={pop}>
        <div className="tour-top">
          <span className="tour-count">Passo {i + 1} de {steps.length}</span>
          <button className="btn ghost small" onClick={close} aria-label="Pular tour"><X /></button>
        </div>
        <h2>{step.title}</h2>
        <div className="prose tour-body">{step.body}</div>
        <div className="tour-f">
          <span className="tour-bar" aria-hidden="true"><span style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></span>
          <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {i > 0 ? <button className="btn" onClick={() => setI(i - 1)}><ArrowLeft />Voltar</button> : <button className="btn ghost" onClick={close}>Pular</button>}
            <button ref={nextRef} className="btn primary" onClick={() => (last ? close() : setI(i + 1))}>{last ? 'Começar' : <>Próximo<ArrowRight /></>}</button>
          </span>
        </div>
      </div>
    </div>
  );
}
