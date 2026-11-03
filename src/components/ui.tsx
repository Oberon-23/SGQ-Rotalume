import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Monitor, Moon, Sun, X } from 'lucide-react';
import type { KPI, NCStage, Severity } from '../data/types';
import { fmtKpi, kpiOk, monthLabel, nf, stageLabel } from '../data/utils';

export const SeverityPill = ({ s }: { s: Severity }) => <span className={`pill ${s === 'Crítica' ? 'bad' : s === 'Maior' ? 'warn' : ''}`}>{s}</span>;
export const StagePill = ({ s }: { s: NCStage }) => <span className={`pill dot ${s === 'encerrada' ? 'ok' : s === 'verificacao' ? 'info' : 'accent'}`}>{stageLabel(s)}</span>;
export const KpiPill = ({ k, v }: { k: KPI; v?: number }) =>
  v === undefined ? <span className="pill">Sem dado</span> : kpiOk(k, v) ? <span className="pill dot ok">Na meta</span> : <span className="pill dot bad">Fora da meta</span>;

export function Headline({ tone = 'ok', title, children }: { tone?: 'ok' | 'warn' | 'bad'; title: ReactNode; children?: ReactNode }) {
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'warn' ? Info : AlertTriangle;
  return (
    <div className={`headline ${tone}`}>
      <span className="ic"><Icon size={20} /></span>
      <div><h2>{title}</h2>{children && <p>{children}</p>}</div>
    </div>
  );
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus(); };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-h"><h2>{title}</h2><button className="btn ghost small" onClick={onClose} aria-label="Fechar"><X /></button></div>
        {children}
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;

/** Confirmação para ações destrutivas. Se `blocked` vier preenchido, explica por que não dá para excluir. */
export function Confirm({ title, children, confirmLabel = 'Excluir', onConfirm, onClose, blocked }: { title: string; children: ReactNode; confirmLabel?: string; onConfirm: () => void; onClose: () => void; blocked?: boolean }) {
  return (
    <Modal title={title} onClose={onClose}
      footer={blocked ? <button className="btn" onClick={onClose}>Entendi</button>
        : <><button className="btn" onClick={onClose}>Cancelar</button><button className="btn danger-solid" onClick={onConfirm}>{confirmLabel}</button></>}>
      <div className="prose" style={{ fontSize: 14.5 }}>{children}</div>
    </Modal>
  );
}

/** Lista editada como texto, um item por linha (usada no SIPOC). */
export function LinesField({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState(value.join('\n'));
  return (
    <label className="field"><span>{label}</span>
      <textarea className="input" rows={4} value={text} placeholder={placeholder}
        onChange={(e) => { setText(e.target.value); onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)); }} />
    </label>
  );
}

export function Toast({ msg }: { msg: string }) {
  return <div className="toast" role="status" aria-live="polite"><CheckCircle2 size={16} />{msg}</div>;
}

/** Linha com faixa de meta, para os indicadores. */
export function LineChart({ k, height = 220 }: { k: KPI; height?: number }) {
  const W = 640, H = height, L = 46, R = 12, T = 16, B = 28;
  const vals = k.values.map((v) => v.value);
  const lo = Math.min(...vals, k.target), hi = Math.max(...vals, k.target);
  const pad = (hi - lo) * 0.15 || 1;
  const y0 = lo - pad, y1 = hi + pad;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, vals.length - 1);
  const y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const ticks = Array.from({ length: 5 }, (_, i) => y0 + ((y1 - y0) * i) / 4);
  const path = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${k.name} nos últimos ${vals.length} meses, meta ${fmtKpi(k, k.target)}`}>
        {ticks.map((t) => (
          <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line-2)" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{nf(t, k.decimals > 0 || hi - lo < 10 ? 1 : 0)}</text></g>
        ))}
        <line x1={L} x2={W - R} y1={y(k.target)} y2={y(k.target)} stroke="var(--ink-2)" strokeDasharray="5 4" />
        <text x={W - R} y={y(k.target) - 6} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--ink-2)">Meta {fmtKpi(k, k.target)}</text>
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        {vals.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="4.2" fill={kpiOk(k, v) ? 'var(--accent)' : 'var(--bad)'} stroke="var(--surface)" strokeWidth="1.5">
            <title>{`${monthLabel(k.values[i].month)}: ${fmtKpi(k, v)}`}</title>
          </circle>
        ))}
        {k.values.map((v, i) => (i % 2 === (vals.length - 1) % 2 ? <text key={v.month} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{monthLabel(v.month)}</text> : null))}
      </svg>
    </div>
  );
}

export function Sparkline({ k }: { k: KPI }) {
  const vals = k.values.map((v) => v.value);
  if (vals.length < 2) return null;
  const lo = Math.min(...vals, k.target), hi = Math.max(...vals, k.target), span = hi - lo || 1;
  const x = (i: number) => (i * 108) / (vals.length - 1) + 1, y = (v: number) => 27 - ((v - lo) / span) * 24;
  return (
    <svg className="spark" viewBox="0 0 110 30" aria-hidden="true">
      <line x1="0" x2="110" y1={y(k.target)} y2={y(k.target)} stroke="var(--muted)" strokeDasharray="3 3" strokeWidth="1" />
      <path d={vals.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')} fill="none" stroke="var(--accent)" strokeWidth="1.8" />
      <circle cx={x(vals.length - 1)} cy={y(vals[vals.length - 1])} r="2.6" fill={kpiOk(k, vals[vals.length - 1]) ? 'var(--accent)' : 'var(--bad)'} />
    </svg>
  );
}

/* ---------- tema ---------- */
type Pref = 'system' | 'light' | 'dark';
const THEME_KEY = 'sgq-theme';
export function applySavedTheme() {
  try { const t = localStorage.getItem(THEME_KEY); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch { /* ignora */ }
}
export function ThemeToggle() {
  const [pref, setPref] = useState<Pref>(() => { try { return (localStorage.getItem(THEME_KEY) as Pref) || 'system'; } catch { return 'system'; } });
  useEffect(() => {
    if (pref === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', pref);
    try { localStorage.setItem(THEME_KEY, pref); } catch { /* ignora */ }
  }, [pref]);
  const opts: [Pref, string, ReactNode][] = [['system', 'Sistema', <Monitor key="m" />], ['light', 'Claro', <Sun key="s" />], ['dark', 'Escuro', <Moon key="d" />]];
  return (
    <div className="seg" role="group" aria-label="Tema">
      {opts.map(([v, label, icon]) => <button key={v} type="button" aria-pressed={pref === v} aria-label={label} title={label} onClick={() => setPref(v)}>{icon}</button>)}
    </div>
  );
}
