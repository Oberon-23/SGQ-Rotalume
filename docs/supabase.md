# Ligar o banco de dados (Supabase)

O SGQ funciona de dois jeitos:

| | Demonstração | Com conta (banco) |
|---|---|---|
| Onde ficam os dados | No navegador de quem usa | No Postgres do Supabase |
| Quem vê | Só a própria pessoa | Toda a equipe da empresa |
| Perfil | Troca livre no topo da página | Vem do login; a gestora define o papel de cada um |
| Quem garante as permissões | A interface | O banco (Row Level Security) |
| Anexos | No navegador, até 400 KB | No Storage, até 5 MB, em pasta privada da empresa |
| Mudanças dos colegas | — | Aparecem na hora (tempo real) |

A demonstração continua sendo a porta de entrada do portfólio. O botão **Entrar** aparece no topo só quando o banco está configurado.

## Passo a passo (uma vez só)

1. **Criar o projeto.** Em [supabase.com](https://supabase.com), clique em *New project* (ou use um projeto que você já tem). Região: São Paulo.
2. **Criar as tabelas e as regras.** No projeto, abra **SQL Editor → New query**, cole todo o arquivo [`db/schema.sql`](../db/schema.sql) e clique em **Run**. Pode rodar de novo depois sem perder dados.
3. **Pegar o endereço e a chave pública.** Em **Project Settings → API**, copie o *Project URL* e a chave **anon public**. Nunca use a chave `service_role` no site.
4. **Colocar na Vercel.** No projeto `sqgrotalume`, abra **Settings → Environment Variables** e crie:
   - `VITE_SUPABASE_URL` = o Project URL
   - `VITE_SUPABASE_ANON_KEY` = a chave anon public

   Depois, em **Deployments**, clique nos três pontinhos do último deploy e em **Redeploy** (as variáveis entram no build).
5. **Endereço de retorno dos e-mails.** No Supabase, em **Authentication → URL Configuration**, ponha `https://sqgrotalume.vercel.app` em *Site URL* e `https://sqgrotalume.vercel.app/entrar` em *Redirect URLs*.
6. **Primeira conta.** Abra o site, clique em **Entrar → Criar conta**. A primeira pessoa vira **gestora da qualidade**. Confirme o e-mail, entre e clique em **Carregar dados de exemplo** (ou comece do zero).
7. **Equipe.** Quem criar conta depois entra como **leitor**. A gestora muda o papel em **Sistema → Pessoas e acesso**.

## Por que a chave pública pode ficar no site

A chave *anon* só identifica o projeto. Quem decide o que cada pessoa vê e altera são as regras do banco em `db/schema.sql`: sem login não se lê nada, cada empresa só enxerga os próprios registros, e cada papel só altera o que o modo demonstração já permitia. Essas regras são testadas num Postgres de verdade a cada envio (`db/test/rls.test.mjs`, job "Regras de acesso do banco" no CI).

## O que fica no banco

| Tabela | Conteúdo |
|---|---|
| `empresas` | Uma linha por empresa |
| `perfis` | Pessoa logada: empresa, nome e papel |
| `registros` | Todos os registros do SGQ, um por linha, em JSON |
| `trilha` | Trilha de auditoria legível. Ninguém apaga; só o autor junta edições seguidas nos primeiros 5 minutos |
| `historico_bruto` | Cada versão gravada, escrita pelo próprio banco (gatilho). A gestão consulta; ninguém altera |
| Storage `evidencias` | Anexos, numa pasta privada por empresa, com links temporários de 1 hora |
