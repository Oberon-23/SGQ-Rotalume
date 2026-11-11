/*
 * Modo banco (Supabase) no navegador, com o servidor do Supabase simulado.
 * As regras de acesso de verdade são testadas no Postgres (db/test/rls.test.mjs);
 * aqui o foco é a tela: login, banco vazio, carregar exemplo, gravar, papéis e sair.
 */
import { expect, test, type Page, type Route } from '@playwright/test';

const SB = 'https://teste.supabase.co';
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

async function fakeSupabase(page: Page, papel = 'gestor') {
  const me = { id: '11111111-1111-4111-8111-111111111111', email: 'marina@teste.dev' };
  const state = { registros: [] as { entidade: string; id: string; dados: unknown }[], trilha: [] as unknown[], posts: 0 };
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: me.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.x`;
  const session = { access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { ...me, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { nome: 'Marina Lopes' } } };
  const perfil = { user_id: me.id, empresa_id: 'emp-1', nome: 'Marina Lopes', papel };
  const json = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route(`${SB}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    if (path.startsWith('/auth/v1/token')) {
      const body = req.postDataJSON() as { password?: string };
      return body.password === 'senha-certa' ? json(route, session) : json(route, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials', code: 'invalid_credentials' }, 400);
    }
    if (path === '/auth/v1/user') return json(route, session.user);
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (path === '/rest/v1/perfis') {
      if (req.method() === 'PATCH') return route.fulfill({ status: 204, headers: { 'content-range': '*/1', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range' } });
      return url.searchParams.get('user_id') ? json(route, [perfil]) : json(route, [perfil, { user_id: 'u2', empresa_id: 'emp-1', nome: 'Diego Moraes', papel: 'leitor' }]);
    }
    if (path === '/rest/v1/registros') {
      if (req.method() === 'GET') {
        const off = Number(url.searchParams.get('offset') ?? 0), lim = Number(url.searchParams.get('limit') ?? 1000);
        return json(route, state.registros.slice(off, off + lim));
      }
      if (req.method() === 'POST') {
        state.posts++;
        for (const r of req.postDataJSON() as { entidade: string; id: string; dados: unknown }[]) {
          const i = state.registros.findIndex((x) => x.entidade === r.entidade && x.id === r.id);
          if (i >= 0) state.registros[i] = r; else state.registros.push(r);
        }
        return route.fulfill({ status: 201, body: '' });
      }
      if (req.method() === 'DELETE') return route.fulfill({ status: 204 });
    }
    if (path === '/rest/v1/trilha') {
      if (req.method() === 'POST') { state.trilha.push(...(req.postDataJSON() as unknown[])); return route.fulfill({ status: 201, body: '' }); }
      return json(route, []);
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.addInitScript(() => { localStorage.setItem('sgq-tour', '1'); });
  return state;
}

async function login(page: Page, senha = 'senha-certa') {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('marina@teste.dev');
  await page.getByLabel('Senha').fill(senha);
  await page.locator('form').getByRole('button', { name: 'Entrar', exact: true }).click();
}

test('senha errada mostra o motivo em português', async ({ page }) => {
  await fakeSupabase(page);
  await login(page, 'errada');
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.');
});

test('gestora entra, carrega o exemplo no banco e as mudanças são gravadas', async ({ page }) => {
  const state = await fakeSupabase(page);
  await login(page);
  await expect(page.getByRole('heading', { name: 'Banco de dados conectado' })).toBeVisible();
  await page.getByRole('button', { name: 'Carregar dados de exemplo' }).click();
  await expect(page.getByRole('heading', { name: 'Painel do sistema da qualidade' })).toBeVisible();
  await expect.poll(() => state.registros.length).toBeGreaterThan(50);
  await expect.poll(() => state.trilha.length).toBeGreaterThan(50);
  // a barra do topo mostra a pessoa logada, sem troca de perfil
  await expect(page.locator('.who-am-i')).toContainText('Marina Lopes');
  await expect(page.getByLabel('Ver o sistema como')).toHaveCount(0);
  // uma alteração vai para o banco
  await page.goto('/reclamacoes/rc-2026-05');
  await page.getByRole('button', { name: 'Improcedente', exact: true }).click();
  await expect.poll(() => (state.registros.find((r) => r.id === 'rc-2026-05')?.dados as { valid?: boolean })?.valid).toBe(false);
  // e continua lá depois de recarregar (vem do banco, não do navegador)
  await page.reload();
  await expect(page.locator('.meta-row')).toContainText('Improcedente');
  // pessoas e acesso
  await page.goto('/pessoas');
  await expect(page.getByRole('combobox', { name: 'Papel de Diego Moraes' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Papel de Diego Moraes' }).selectOption('dono');
  await expect(page.getByRole('status')).toContainText('Diego Moraes agora é dono de processo');
  // sair volta para a demonstração
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page.getByLabel('Ver o sistema como')).toBeVisible();
});

test('leitor com banco vazio vê o aviso e não o botão de carregar', async ({ page }) => {
  await fakeSupabase(page, 'leitor');
  await login(page);
  await expect(page.getByText('A gestão da qualidade ainda não cadastrou nada')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Carregar dados de exemplo' })).toHaveCount(0);
});

test('na demonstração o botão Entrar leva ao login', async ({ page }) => {
  await fakeSupabase(page);
  await page.goto('/');
  await page.getByRole('link', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});
