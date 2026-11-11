import { useCallback, useEffect, useState } from 'react';
import { MODE_KEY, asMini, cloudConfigured, myProfile, signOutCloud, supabase, watchRecords, type Profile } from '../data/cloud';
import { RemoteSource } from '../data/remote';
import { ROLE_LABEL, type User } from '../data/access';
import type { DB, Entity } from '../data/types';
import { useStore } from '../data/store';
import { ENTITIES } from '../data/changes';

export type CloudState =
  | { status: 'demo'; error?: string }
  | { status: 'loading' }
  | { status: 'ready'; profile: Profile; source: RemoteSource; db: DB; account: User };

/** Decide se o sistema abre na demonstração ou no banco (quando a pessoa já entrou antes). */
export function useCloud() {
  const wantsBank = () => { try { return cloudConfigured && localStorage.getItem(MODE_KEY) === 'banco'; } catch { return false; } };
  const [state, setState] = useState<CloudState>(() => (wantsBank() ? { status: 'loading' } : { status: 'demo' }));

  const start = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const profile = await myProfile();
      if (!profile) throw new Error('Entre com sua conta para usar o banco.');
      const source = new RemoteSource(asMini(await supabase()), profile.empresa_id);
      const db = await source.fetchAll();
      try { localStorage.setItem(MODE_KEY, 'banco'); } catch { /* sem armazenamento */ }
      setState({ status: 'ready', profile, source, db, account: { id: profile.user_id, name: profile.nome, role: profile.papel, title: ROLE_LABEL[profile.papel] } });
    } catch (e) {
      try { localStorage.removeItem(MODE_KEY); } catch { /* sem armazenamento */ }
      setState({ status: 'demo', error: (e as Error).message });
    }
  }, []);

  const leave = useCallback(async () => {
    if (state.status === 'ready') await state.source.flush();
    try { localStorage.removeItem(MODE_KEY); } catch { /* sem armazenamento */ }
    await signOutCloud().catch(() => {});
    setState({ status: 'demo' });
  }, [state]);

  useEffect(() => { if (state.status === 'loading') void start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // grava o que estiver pendente antes de fechar a aba
  useEffect(() => {
    if (state.status !== 'ready') return;
    const flush = () => { void state.source.flush(); };
    window.addEventListener('pagehide', flush);
    const vis = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', vis); };
  }, [state]);

  return { state, start, leave };
}

/** Mudanças feitas por outras pessoas aparecem na tela sem recarregar. */
export function RealtimeSync({ empresaId, me }: { empresaId: string; me: string }) {
  const { patch } = useStore();
  useEffect(() => {
    let stop: (() => void) | undefined;
    let alive = true;
    void watchRecords(empresaId, me, (ev) => {
      if (!(ENTITIES as string[]).includes(ev.entidade)) return;
      patch((d) => {
        const list = d[ev.entidade as Entity] as unknown as { id: string }[];
        const i = list.findIndex((x) => x.id === ev.id);
        if (ev.type === 'delete') { if (i >= 0) list.splice(i, 1); return; }
        if (!ev.dados) return;
        if (i >= 0) list[i] = ev.dados as { id: string }; else list.push(ev.dados as { id: string });
      });
    }).then((s) => { if (alive) stop = s; else s(); });
    return () => { alive = false; stop?.(); };
  }, [empresaId, me, patch]);
  return null;
}

export const Splash = ({ children = 'Carregando os dados do banco…' }: { children?: string }) => <div className="splash" role="status">{children}</div>;
