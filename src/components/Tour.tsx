import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bell, ClipboardList, FileText, Search, ShieldAlert, TriangleAlert, UserRound } from 'lucide-react';
import { Modal } from './ui';

export const TOUR_KEY = 'sgq-tour';
export const tourSeen = () => { try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return true; } };
export const markTourSeen = () => { try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* sem armazenamento */ } };

/** Apresentação curta na primeira visita: o que é, como testar e onde achar as coisas. */
export default function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const close = () => { markTourSeen(); onClose(); };
  const Try = ({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) => (
    <li><Link to={to} onClick={close}>{icon}<span>{children}</span><ArrowRight size={15} /></Link></li>
  );
  const steps: { title: string; body: ReactNode }[] = [
    {
      title: 'Bem-vindo ao SGQ Rotalume',
      body: <>
        <p>Um sistema de gestão da qualidade alinhado à <b>ISO 9001:2015</b>, para a Rotalume Indústria, uma fábrica <b>fictícia</b> de eixos e conjuntos.</p>
        <p>Ele trata não conformidades com PDCA, mapeia processos, avalia riscos, conduz auditorias, controla documentos, acompanha indicadores e monta a análise crítica da direção.</p>
        <p className="muted">Não precisa de cadastro. O que você alterar fica salvo só neste navegador e pode ser desfeito em <b>Dados e backup</b>.</p>
      </>,
    },
    {
      title: 'Veja como cada perfil enxerga o sistema',
      body: <>
        <p><UserRound size={16} style={{ verticalAlign: '-3px' }} /> No topo da página você troca de pessoa:</p>
        <ul className="tour-roles">
          <li><b>Marina</b>, gestora da qualidade: pode tudo.</li>
          <li><b>Diego</b>, dono do processo de usinagem: edita só o que é dele.</li>
          <li><b>Rafael</b>, auditor: conduz auditorias, mas não do próprio processo.</li>
          <li><b>Visitante</b>: só leitura.</li>
        </ul>
        <p>Toda alteração entra no <b>histórico</b> com quem fez, quando e o valor anterior.</p>
      </>,
    },
    {
      title: 'Experimente em 1 minuto',
      body: <>
        <p>Três caminhos rápidos:</p>
        <ul className="tour-try">
          <Try to="/nao-conformidades/nc-2026-069" icon={<TriangleAlert size={18} />}>Complete a análise de causa da <b>NC-2026-069</b>. O sistema não deixa avançar sem 3 porquês e causa raiz.</Try>
          <Try to="/riscos" icon={<ShieldAlert size={18} />}>Clique numa célula da <b>matriz de riscos</b> para filtrar.</Try>
          <Try to="/imprimir/nc/nc-2026-058" icon={<FileText size={18} />}>Gere a <b>RNC em PDF</b> de uma não conformidade encerrada.</Try>
        </ul>
      </>,
    },
    {
      title: 'Ache tudo rápido',
      body: <>
        <ul className="tour-roles">
          <li><ClipboardList size={16} style={{ verticalAlign: '-3px' }} /> <b>Minhas pendências</b>: o que está com você, do prazo mais curto ao mais longo.</li>
          <li><Bell size={16} style={{ verticalAlign: '-3px' }} /> <b>Sino</b>: prazos vencidos ou nos próximos 7 dias.</li>
          <li><Search size={16} style={{ verticalAlign: '-3px' }} /> <b>Busca</b> (<kbd>Ctrl</kbd> + <kbd>K</kbd>): códigos, assuntos ou pessoas, em todos os módulos.</li>
        </ul>
        <p className="muted">Esta apresentação fica no botão <b>?</b> no topo da página.</p>
      </>,
    },
  ];
  const last = i === steps.length - 1;
  return (
    <Modal title={steps[i].title} onClose={close}
      footer={<div className="tour-f">
        <span className="tour-dots" aria-label={`Passo ${i + 1} de ${steps.length}`}>{steps.map((_, k) => <span key={k} className={k === i ? 'on' : ''} />)}</span>
        <span style={{ display: 'flex', gap: 8 }}>
          {i > 0 ? <button className="btn" onClick={() => setI(i - 1)}><ArrowLeft />Voltar</button> : <button className="btn ghost" onClick={close}>Pular</button>}
          <button className="btn primary" onClick={() => (last ? close() : setI(i + 1))}>{last ? 'Começar' : <>Próximo<ArrowRight /></>}</button>
        </span>
      </div>}>
      <div className="prose tour-body">{steps[i].body}</div>
    </Modal>
  );
}
