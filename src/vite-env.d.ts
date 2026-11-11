/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Endereço do projeto no Supabase. Sem ele, o sistema roda só no modo demonstração. */
  readonly VITE_SUPABASE_URL?: string;
  /** Chave pública (anon) do Supabase. É pública por natureza: quem protege os dados são as regras do banco. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
