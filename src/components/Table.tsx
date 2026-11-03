import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

export type SortValue = string | number | boolean | undefined | null;
export type Columns<T> = Record<string, (row: T) => SortValue>;

/**
 * Ordenação por coluna e paginação para as listas.
 * `cols` diz como extrair o valor de ordenação de cada coluna.
 * `resetKey` volta para a página 1 quando os filtros mudam.
 */
export function useTable<T>(rows: T[], cols: Columns<T>, opts: { pageSize?: number; initial?: [string, 'asc' | 'desc'] } = {}) {
  const size = opts.pageSize ?? 10;
  const [sort, setSort] = useState<[string, 'asc' | 'desc'] | null>(opts.initial ?? null);
  const [page, setPage] = useState(1);
  const sorted = useMemo(() => {
    if (!sort || !cols[sort[0]]) return rows;
    const get = cols[sort[0]], dir = sort[1] === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x === y) return 0;
      if (x === undefined || x === null || x === '') return 1; // vazios sempre no fim
      if (y === undefined || y === null || y === '') return -1;
      return (typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, 'pt-BR', { numeric: true }) : x > y ? 1 : -1) * dir;
    });
  }, [rows, cols, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const cur = Math.min(page, pages);
  const view = sorted.slice((cur - 1) * size, cur * size);
  const toggle = (key: string) => { setSort((s) => (s?.[0] === key ? (s[1] === 'asc' ? [key, 'desc'] : null) : [key, 'asc'])); setPage(1); };
  return { view, sorted, sort, toggle, page: cur, pages, setPage, total: sorted.length, size };
}

type T = ReturnType<typeof useTable<unknown>>;

/** Cabeçalho clicável. Clique alterna crescente → decrescente → sem ordenação. */
export function SortTh({ t, k, children, style }: { t: Pick<T, 'sort' | 'toggle'>; k: string; children: ReactNode; style?: React.CSSProperties }) {
  const on = t.sort?.[0] === k ? t.sort[1] : null;
  const Icon = on === 'asc' ? ArrowUp : on === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <th aria-sort={on === 'asc' ? 'ascending' : on === 'desc' ? 'descending' : 'none'} style={style}>
      <button type="button" className={`sort-th${on ? ' on' : ''}`} onClick={() => t.toggle(k)}>{children}<Icon size={13} aria-hidden="true" /></button>
    </th>
  );
}

/** Rodapé com contagem e navegação entre páginas. Some quando cabe tudo numa página. */
export function Pager({ t, noun = 'registros' }: { t: Pick<T, 'page' | 'pages' | 'setPage' | 'total' | 'size'>; noun?: string }) {
  if (t.total <= t.size) return <div className="pager"><span>{t.total} {noun}</span></div>;
  const from = (t.page - 1) * t.size + 1, to = Math.min(t.page * t.size, t.total);
  return (
    <div className="pager">
      <span>{from}–{to} de {t.total} {noun}</span>
      <span className="pager-nav">
        <button className="btn small ghost" disabled={t.page <= 1} onClick={() => t.setPage(t.page - 1)} aria-label="Página anterior"><ChevronLeft /></button>
        <span>Página {t.page} de {t.pages}</span>
        <button className="btn small ghost" disabled={t.page >= t.pages} onClick={() => t.setPage(t.page + 1)} aria-label="Próxima página"><ChevronRight /></button>
      </span>
    </div>
  );
}
