import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Empty } from './ui';

/** Barra de progresso de 0 a 100. */
export const Bar = ({ pct, tone = 'accent', label }: { pct: number; tone?: 'accent' | 'ok' | 'warn' | 'bad'; label?: string }) => (
  <span className="bar" role="img" aria-label={label ?? `${Math.round(pct)}%`}><span className={`bar-fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></span>
);

export const Crumb = ({ to, children }: { to: string; children: ReactNode }) => <Link className="crumb" to={to}><ArrowLeft size={14} />{children}</Link>;

export const Missing = ({ to, back, children }: { to: string; back: string; children: ReactNode }) => (
  <div className="page"><Crumb to={to}>{back}</Crumb><Empty>{children}</Empty></div>
);

/** Título de página de detalhe com o código em destaque. */
export const CodeTitle = ({ code, children }: { code: string; children: ReactNode }) => (
  <h1><span className="mono" style={{ fontSize: 18, color: 'var(--muted)', marginRight: 10 }}>{code}</span>{children}</h1>
);
