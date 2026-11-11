/*
 * Conexão com o Supabase: login, perfis, tempo real e anexos.
 * A biblioteca só é baixada quando alguém entra com conta; quem usa a demonstração não paga esse peso.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role } from './types';
import type { MiniClient } from './remote';

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
/** O banco só aparece se o projeto tiver as duas variáveis configuradas na Vercel. */
export const cloudConfigured = !!(URL_ && KEY);
export const MODE_KEY = 'sgq-modo';

let client: Promise<SupabaseClient> | null = null;
export function supabase() {
  if (!cloudConfigured) throw new Error('Supabase não configurado.');
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(URL_!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } }));
  return client;
}
export const asMini = (c: SupabaseClient) => c as unknown as MiniClient;

export interface Profile { user_id: string; empresa_id: string; nome: string; papel: Role }

const pt = (m?: string) => {
  if (!m) return 'Não foi possível entrar.';
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'Confirme o e-mail pelo link que enviamos antes de entrar.';
  if (/already registered/i.test(m)) return 'Esse e-mail já tem conta. Use "Entrar".';
  if (/Password should be/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit/i.test(m)) return 'Muitas tentativas. Espere um minuto e tente de novo.';
  return m;
};

export async function signIn(email: string, password: string) {
  const { error } = await (await supabase()).auth.signInWithPassword({ email, password });
  if (error) throw new Error(pt(error.message));
}
export async function signUp(email: string, password: string, nome: string) {
  const { data, error } = await (await supabase()).auth.signUp({ email, password, options: { data: { nome }, emailRedirectTo: `${location.origin}/entrar` } });
  if (error) throw new Error(pt(error.message));
  return { needsConfirmation: !data.session };
}
export async function resetPassword(email: string) {
  const { error } = await (await supabase()).auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/entrar` });
  if (error) throw new Error(pt(error.message));
}
export async function signOutCloud() { await (await supabase()).auth.signOut(); }
export async function currentUserId() { return (await (await supabase()).auth.getSession()).data.session?.user.id ?? null; }

export async function myProfile(): Promise<Profile | null> {
  const id = await currentUserId();
  if (!id) return null;
  const { data, error } = await (await supabase()).from('perfis').select('user_id,empresa_id,nome,papel').eq('user_id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Profile | null;
}
export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await (await supabase()).from('perfis').select('user_id,empresa_id,nome,papel').order('nome');
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}
export async function setRole(userId: string, papel: Role) {
  const { error, count } = await (await supabase()).from('perfis').update({ papel }, { count: 'exact' }).eq('user_id', userId);
  if (error) throw new Error(error.message);
  if (!count) throw new Error('O banco não deixou mudar esse papel.');
}

/** Avisa quando outra pessoa grava algo na empresa. */
export async function watchRecords(empresaId: string, me: string, onChange: (ev: { type: 'upsert' | 'delete'; entidade: string; id: string; dados?: Record<string, unknown> }) => void) {
  const c = await supabase();
  const ch = c.channel(`registros-${empresaId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'registros', filter: `empresa_id=eq.${empresaId}` }, (p) => {
      const row = (p.new && Object.keys(p.new).length ? p.new : p.old) as { entidade: string; id: string; dados?: Record<string, unknown>; atualizado_por?: string };
      if (p.eventType !== 'DELETE' && row.atualizado_por === me) return; // a mudança é minha: já está na tela
      onChange({ type: p.eventType === 'DELETE' ? 'delete' : 'upsert', entidade: row.entidade, id: row.id, dados: row.dados });
    })
    .subscribe();
  return () => { void c.removeChannel(ch); };
}

/* ---------- anexos no Storage ---------- */
const BUCKET = 'evidencias';
export async function uploadEvidence(path: string, file: File) {
  const { error } = await (await supabase()).storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw new Error(/row-level|policy/i.test(error.message) ? 'O banco recusou o envio: seu papel não permite.' : error.message);
}
export async function evidenceUrl(path: string, download?: string) {
  const { data, error } = await (await supabase()).storage.from(BUCKET).createSignedUrl(path, 3600, download ? { download } : undefined);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
export async function removeEvidence(path: string) { await (await supabase()).storage.from(BUCKET).remove([path]); }
