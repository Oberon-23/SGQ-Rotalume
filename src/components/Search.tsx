import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, X } from 'lucide-react';
import { useStore } from '../data/store';
import type { DB, Entity } from '../data/types';
import { ENTITY_LABEL, ENTITY_PATH } from '../data/changes';

interface Hit { entity: Entity; id: string; title: string; sub: string; text: string; code: string }

/** Sem acento e em minúsculas, para "inspecao" achar "Inspeção". */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function buildIndex(db: DB): Hit[] {
  const pname = (id: string) => db.processes.find((p) => p.id === id)?.name ?? '';
  const H = (entity: Entity, id: string, code: string, title: string, sub: string, ...extra: string[]): Hit =>
    ({ entity, id, code, title, sub, text: norm([code, title, sub, ...extra].join(' ')) });
  return [
    ...db.ncs.map((n) => H('ncs', n.id, n.code, n.title, `${pname(n.processId)} · ${n.owner}`, n.description, n.rootCause, n.containment, ...n.actions.map((a) => a.what))),
    ...db.processes.map((p) => H('processes', p.id, p.code, p.name, `Dono: ${p.owner}`, p.objective, ...Object.values(p.sipoc).flat())),
    ...db.risks.map((r) => H('risks', r.id, r.code, r.title, `${pname(r.processId)} · ${r.owner}`, r.cause, r.consequence, r.action)),
    ...db.audits.map((a) => H('audits', a.id, a.code, `Auditoria em ${pname(a.processId)}`, `${a.auditor} · ${a.scope}`, ...a.items.map((i) => i.evidence))),
    ...db.docs.map((d) => H('docs', d.id, d.code, d.title, `${d.type} · ${d.owner}`, d.summary)),
    ...db.kpis.map((k) => H('kpis', k.id, '', k.name, `${pname(k.processId)} · ${k.owner}`, k.formula)),
    ...db.reviews.map((r) => H('reviews', r.id, r.code, 'Análise crítica pela direção', r.participants, r.conclusion, ...r.decisions.map((d) => d.text))),
  ];
}

/** Ordena: código exato, código que começa com o termo, título, depois o resto. */
export function search(index: Hit[], q: string, limit = 30): Hit[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const score = (h: Hit) => {
    const c = norm(h.code), t = norm(h.title), w = words.join(' ');
    if (c === w) return 0;
    if (c && c.startsWith(w)) return 1;
    if (words.every((x) => t.includes(x))) return 2;
    return 3;
  };
  return index.filter((h) => words.every((w) => h.text.includes(w))).map((h) => [score(h), h] as const)
    .sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, h]) => h);
}

export default function SearchPalette({ onClose }: { onClose: () => void }) {
  const { db } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const index = useMemo(() => buildIndex(db), [db]);
  // agrupa por módulo, mantendo os módulos na ordem do melhor resultado de cada um
  const hits = useMemo(() => {
    const found = search(index, q);
    const order: Entity[] = [];
    found.forEach((h) => { if (!order.includes(h.entity)) order.push(h.entity); });
    return order.flatMap((e) => found.filter((h) => h.entity === e));
  }, [index, q]);
  useEffect(() => { input.current?.focus(); document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);
  useEffect(() => { list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const go = (h?: Hit) => { if (!h) return; onClose(); nav(`${ENTITY_PATH[h.entity]}/${h.id}`); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') go(hits[sel]);
  };
  let lastEntity: Entity | null = null;
  return (
    <div className="overlay search-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Buscar no sistema">
        <div className="pal-input">
          <SearchIcon size={18} aria-hidden="true" />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={onKey} placeholder="Buscar NC, processo, risco, documento, pessoa…"
            role="combobox" aria-expanded={hits.length > 0} aria-controls="search-results" aria-activedescendant={hits[sel] ? `hit-${sel}` : undefined} aria-label="Buscar" />
          <button className="btn ghost small" onClick={onClose} aria-label="Fechar busca"><X /></button>
        </div>
        {q.trim() === '' ? (
          <div className="pal-empty"><p>Digite um código (NC-2026-069, PR-004, R-01), um assunto (parafuso, torque, calibração) ou o nome de uma pessoa.</p><p className="muted"><kbd>↑</kbd> <kbd>↓</kbd> para navegar, <kbd>Enter</kbd> para abrir, <kbd>Esc</kbd> para fechar.</p></div>
        ) : hits.length === 0 ? (
          <div className="pal-empty"><p>Nada encontrado para "{q}".</p></div>
        ) : (
          <ul id="search-results" ref={list} role="listbox" className="pal-list">
            {hits.map((h, i) => {
              const head = h.entity !== lastEntity ? ENTITY_LABEL[h.entity] : null;
              lastEntity = h.entity;
              return (
                <li key={h.entity + h.id} role="presentation">
                  {head && <div className="pal-group" role="presentation">{head}</div>}
                  <div id={`hit-${i}`} role="option" aria-selected={i === sel} className="pal-hit" onMouseEnter={() => setSel(i)} onMouseDown={(e) => { e.preventDefault(); go(h); }}>
                    <b>{h.code && <span className="mono">{h.code}</span>}{h.title}</b>
                    <span>{h.sub}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
