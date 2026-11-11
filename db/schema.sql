-- =====================================================================
-- SGQ Rotalume · banco de dados no Supabase (Postgres)
--
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo
-- inteiro e clique em "Run". Pode rodar de novo sem perder dados.
--
-- O que ele cria:
--   empresas         uma linha por empresa (já cria a Rotalume)
--   perfis           cada pessoa logada: empresa, nome e papel
--   registros        todos os registros do SGQ (NCs, documentos, riscos...)
--   trilha           trilha de auditoria legível (quem mudou o quê)
--   historico_bruto  cópia de cada versão gravada pelo próprio banco (à prova de edição)
--   evidencias       pasta de arquivos anexados (Storage), separada por empresa
--
-- As permissões são as mesmas do modo demonstração (src/data/access.ts),
-- só que aplicadas pelo banco (Row Level Security): nem chamando a API
-- direto alguém consegue ver outra empresa ou editar o que não pode.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- tabelas ----------
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criada_em timestamptz not null default now()
);

create table if not exists public.perfis (
  user_id uuid primary key references auth.users (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  papel text not null default 'leitor' check (papel in ('gestor', 'dono', 'auditor', 'leitor')),
  criado_em timestamptz not null default now()
);

create table if not exists public.registros (
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  entidade text not null check (entidade in ('processes', 'ncs', 'audits', 'docs', 'kpis', 'risks', 'reviews', 'suppliers', 'trainings', 'complaints', 'objectives')),
  id text not null,
  dados jsonb not null,
  ordem bigint generated always as identity,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  primary key (empresa_id, entidade, id),
  check (dados ->> 'id' = id)
);

create table if not exists public.trilha (
  ref text primary key,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  user_id uuid not null default auth.uid(),
  em timestamptz not null default now(),
  entrada jsonb not null
);
create index if not exists trilha_empresa_em on public.trilha (empresa_id, em desc);

create table if not exists public.historico_bruto (
  id bigint generated always as identity primary key,
  empresa_id uuid not null,
  entidade text not null,
  registro_id text not null,
  operacao text not null,
  antes jsonb,
  depois jsonb,
  user_id uuid,
  em timestamptz not null default now()
);

-- ---------- quem é a pessoa logada ----------
create or replace function public.minha_empresa() returns uuid
language sql stable security definer set search_path = public
as $$ select empresa_id from public.perfis where user_id = auth.uid() $$;

create or replace function public.meu_papel() returns text
language sql stable security definer set search_path = public
as $$ select papel from public.perfis where user_id = auth.uid() $$;

create or replace function public.meu_nome() returns text
language sql stable security definer set search_path = public
as $$ select nome from public.perfis where user_id = auth.uid() $$;

/** Dono do processo, para as regras de "é meu". */
create or replace function public.dono_do_processo(emp uuid, processo text) returns text
language sql stable security definer set search_path = public
as $$ select dados ->> 'owner' from public.registros where empresa_id = emp and entidade = 'processes' and id = processo $$;

-- ---------- a mesma regra de src/data/access.ts ----------
create or replace function public.pode(acao text, ent text, dados jsonb) returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  papel text := public.meu_papel();
  eu text := public.meu_nome();
  emp uuid := public.minha_empresa();
  processo text := case when ent = 'processes' then dados ->> 'id' else dados ->> 'processId' end;
  dono_proc text := public.dono_do_processo(emp, processo);
  meu boolean := coalesce(dados ->> 'owner' = eu, false) or coalesce(dono_proc = eu, false);
begin
  if papel is null or emp is null then return false; end if;
  if papel = 'gestor' then return true; end if;
  if papel = 'leitor' then return false; end if;
  if acao = 'delete' then return false; end if;

  -- quem está com uma etapa ou uma tarefa pode registrar o andamento dela
  if acao = 'edit' then
    if ent = 'ncs' and exists (select 1 from jsonb_array_elements(coalesce(dados -> 'actions', '[]')) a where a ->> 'who' = eu) then return true; end if;
    if ent = 'reviews' and exists (select 1 from jsonb_array_elements(coalesce(dados -> 'decisions', '[]')) d where d ->> 'owner' = eu) then return true; end if;
    if ent = 'docs' and eu in (dados #>> '{approval,author}', dados #>> '{approval,reviewer}', dados #>> '{approval,approver}') then return true; end if;
  end if;

  case ent
    when 'reviews', 'objectives' then return false;
    when 'processes' then return acao = 'edit' and meu;
    when 'ncs', 'risks', 'complaints' then return acao = 'create' or meu;
    when 'audits' then return papel = 'auditor' and dono_proc is distinct from eu; -- auditor não audita o próprio processo
    when 'docs', 'kpis', 'trainings' then return case when acao = 'create' then papel = 'dono' else meu end;
    when 'suppliers' then return acao = 'edit' and coalesce(dados ->> 'owner' = eu, false);
    else return false;
  end case;
end $$;

-- ---------- histórico bruto gravado pelo banco ----------
create or replace function public.registrar_historico() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.historico_bruto (empresa_id, entidade, registro_id, operacao, antes, depois, user_id)
  values (coalesce(new.empresa_id, old.empresa_id), coalesce(new.entidade, old.entidade), coalesce(new.id, old.id), tg_op,
          case when tg_op <> 'INSERT' then old.dados end, case when tg_op <> 'DELETE' then new.dados end, auth.uid());
  if tg_op = 'UPDATE' then new.atualizado_em := now(); new.atualizado_por := auth.uid(); end if;
  return coalesce(new, old);
end $$;
drop trigger if exists registros_historico on public.registros;
create trigger registros_historico before insert or update or delete on public.registros
  for each row execute function public.registrar_historico();

-- ---------- primeira pessoa vira gestora; as outras entram como leitoras ----------
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public
as $$
declare emp uuid;
begin
  select id into emp from public.empresas order by criada_em limit 1;
  if emp is null then insert into public.empresas (nome) values ('Rotalume Indústria') returning id into emp; end if;
  insert into public.perfis (user_id, empresa_id, nome, papel)
  values (new.id, emp, coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
          case when exists (select 1 from public.perfis where empresa_id = emp) then 'leitor' else 'gestor' end)
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.novo_usuario();

insert into public.empresas (nome) select 'Rotalume Indústria' where not exists (select 1 from public.empresas);

-- ---------- regras de acesso (Row Level Security) ----------
alter table public.empresas enable row level security;
alter table public.perfis enable row level security;
alter table public.registros enable row level security;
alter table public.trilha enable row level security;
alter table public.historico_bruto enable row level security;

drop policy if exists empresa_ver on public.empresas;
create policy empresa_ver on public.empresas for select to authenticated using (id = public.minha_empresa());

drop policy if exists perfis_ver on public.perfis;
create policy perfis_ver on public.perfis for select to authenticated using (empresa_id = public.minha_empresa());
drop policy if exists perfis_gestor on public.perfis;
-- só a gestão muda papéis, e nunca o próprio (para a empresa não ficar sem gestor por engano)
create policy perfis_gestor on public.perfis for update to authenticated
  using (empresa_id = public.minha_empresa() and public.meu_papel() = 'gestor' and user_id <> auth.uid())
  with check (empresa_id = public.minha_empresa());

drop policy if exists registros_ver on public.registros;
create policy registros_ver on public.registros for select to authenticated using (empresa_id = public.minha_empresa());
drop policy if exists registros_criar on public.registros;
create policy registros_criar on public.registros for insert to authenticated
  with check (empresa_id = public.minha_empresa() and public.pode('create', entidade, dados));
drop policy if exists registros_editar on public.registros;
create policy registros_editar on public.registros for update to authenticated
  using (empresa_id = public.minha_empresa() and public.pode('edit', entidade, dados))
  with check (empresa_id = public.minha_empresa());
drop policy if exists registros_excluir on public.registros;
create policy registros_excluir on public.registros for delete to authenticated
  using (empresa_id = public.minha_empresa() and public.meu_papel() = 'gestor');

drop policy if exists trilha_ver on public.trilha;
create policy trilha_ver on public.trilha for select to authenticated using (empresa_id = public.minha_empresa());
drop policy if exists trilha_criar on public.trilha;
create policy trilha_criar on public.trilha for insert to authenticated
  with check (empresa_id = public.minha_empresa() and user_id = auth.uid() and public.meu_papel() <> 'leitor');
drop policy if exists trilha_juntar on public.trilha;
-- edições seguidas no mesmo campo viram uma linha só, mas só pela mesma pessoa e por 5 minutos
create policy trilha_juntar on public.trilha for update to authenticated
  using (user_id = auth.uid() and em > now() - interval '5 minutes')
  with check (user_id = auth.uid() and empresa_id = public.minha_empresa());

drop policy if exists historico_ver on public.historico_bruto;
create policy historico_ver on public.historico_bruto for select to authenticated
  using (empresa_id = public.minha_empresa() and public.meu_papel() = 'gestor');

grant usage on schema public to authenticated;
grant select on public.empresas, public.perfis, public.registros, public.trilha, public.historico_bruto to authenticated;
grant insert, update, delete on public.registros to authenticated;
grant insert, update on public.trilha to authenticated;
grant update (papel, nome) on public.perfis to authenticated;
revoke all on public.registros, public.trilha, public.perfis, public.empresas, public.historico_bruto from anon;

-- ---------- tempo real: quem está com a tela aberta vê as mudanças dos outros ----------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'registros') then
    alter publication supabase_realtime add table public.registros;
  end if;
end $$;

-- ---------- anexos de evidência (Storage), uma pasta por empresa ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('evidencias', 'evidencias', false, 5242880)
on conflict (id) do nothing;

drop policy if exists evidencias_ver on storage.objects;
create policy evidencias_ver on storage.objects for select to authenticated
  using (bucket_id = 'evidencias' and (storage.foldername(name))[1] = public.minha_empresa()::text);
drop policy if exists evidencias_enviar on storage.objects;
create policy evidencias_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias' and (storage.foldername(name))[1] = public.minha_empresa()::text and public.meu_papel() <> 'leitor');
drop policy if exists evidencias_apagar on storage.objects;
create policy evidencias_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and (storage.foldername(name))[1] = public.minha_empresa()::text and public.meu_papel() <> 'leitor');
