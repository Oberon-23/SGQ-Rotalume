/* Estado global do SGQ, salvo no navegador (localStorage). */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DB } from './types';
import { DB_VERSION, seed } from './seed';

const KEY = 'sgq-rotalume';

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db.version === DB_VERSION && Array.isArray(db.ncs)) return db;
    }
  } catch { /* armazenamento indisponível ou corrompido: usa os exemplos */ }
  return seed();
}

interface Store {
  db: DB;
  /** Altera uma cópia do banco e salva. */
  update: (fn: (draft: DB) => void) => void;
  reset: () => void;
  saved: boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(load);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); setSaved(true); } catch { setSaved(false); }
  }, [db]);

  const update = useCallback((fn: (draft: DB) => void) => {
    setDb((cur) => { const next = structuredClone(cur); fn(next); return next; });
  }, []);
  const reset = useCallback(() => setDb(seed()), []);

  const value = useMemo(() => ({ db, update, reset, saved }), [db, update, reset, saved]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fora do StoreProvider');
  return s;
}

/** Próximo código sequencial, ex.: NC-2026-075. */
export function nextCode(existing: string[], prefix: string) {
  const year = new Date().getFullYear();
  const nums = existing.map((c) => c.match(new RegExp(`^${prefix}-${year}-(\\d+)$`))).filter(Boolean).map((m) => +m![1]);
  return `${prefix}-${year}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(prefix === 'NC' ? 3 : 2, '0')}`;
}
