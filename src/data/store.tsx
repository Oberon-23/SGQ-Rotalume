/*
 * Estado global do SGQ.
 *
 * Fluxo de toda alteração: tela chama `update` → o store aplica a mudança numa cópia →
 * `diffDB` descobre o que mudou → a trilha de auditoria ganha as linhas → `source.persist`
 * grava. As telas não sabem onde os dados ficam.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DB, Entity } from './types';
import { seed } from './seed';
import { appendLog, diffDB, type Change } from './changes';
import { migrate, source } from './source';
import { can, USERS, type Act, type User } from './access';

const USER_KEY = 'sgq-user';

interface Store {
  db: DB;
  /** Altera uma cópia do banco, registra na trilha e salva. */
  update: (fn: (draft: DB) => void) => void;
  reset: () => void;
  replace: (db: DB) => void;
  saved: boolean;
  sourceName: string;
  toast: { id: number; msg: string } | null;
  notify: (msg: string) => void;
  user: User;
  setUser: (id: string) => void;
  /** Atalho para as regras de permissão com o usuário atual. */
  can: (act: Act, entity: Entity | 'data', rec?: object) => boolean;
}

const Ctx = createContext<Store | null>(null);

/** Confere (e atualiza, se for de versão anterior) um arquivo de backup importado. */
export const importDB = (x: unknown) => migrate(x);

function loadUser(): User {
  try { const id = localStorage.getItem(USER_KEY); return USERS.find((u) => u.id === id) ?? USERS[0]; } catch { return USERS[0]; }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => source.load() ?? seed());
  const [saved, setSaved] = useState(true);
  const [toast, setToast] = useState<Store['toast']>(null);
  const [user, setUserState] = useState<User>(loadUser);
  const userRef = useRef(user);
  userRef.current = user;
  const pending = useRef<Change[] | null>(null);

  useEffect(() => {
    try { source.persist(db, pending.current ?? []); setSaved(true); } catch { setSaved(false); }
    pending.current = null;
  }, [db]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const update = useCallback((fn: (draft: DB) => void) => {
    setDb((cur) => {
      const next = structuredClone(cur);
      fn(next);
      const changes = diffDB(cur, next);
      if (!changes.length) return cur;
      next.log = appendLog(cur.log, changes, userRef.current, next);
      pending.current = changes;
      return next;
    });
  }, []);
  const reset = useCallback(() => { source.clear(); setDb(seed()); }, []);
  const replace = useCallback((d: DB) => setDb(d), []);
  const notify = useCallback((msg: string) => setToast({ id: Date.now(), msg }), []);
  const setUser = useCallback((id: string) => {
    const u = USERS.find((x) => x.id === id) ?? USERS[0];
    setUserState(u);
    try { localStorage.setItem(USER_KEY, u.id); } catch { /* sem armazenamento */ }
  }, []);
  const canFn = useCallback((act: Act, entity: Entity | 'data', rec?: object) => can(user, db, act, entity, rec), [user, db]);

  const value = useMemo(() => ({ db, update, reset, replace, saved, sourceName: source.name, toast, notify, user, setUser, can: canFn }),
    [db, update, reset, replace, saved, toast, notify, user, setUser, canFn]);
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
