import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { open } from './helpers';

/** Todas as telas: listas, um detalhe de cada módulo, relatórios e página inexistente. */
const ROUTES = ['/', '/minhas-pendencias', '/quadro', '/nao-conformidades', '/nao-conformidades/nc-2026-069', '/nao-conformidades/nc-2026-063',
  '/reclamacoes', '/reclamacoes/rc-2026-01', '/reclamacoes/rc-2026-05', '/objetivos', '/processos', '/processos/p06', '/riscos', '/riscos/r-01',
  '/indicadores', '/indicadores/oee', '/documentos', '/documentos/pr-001', '/documentos/it-l2-003', '/treinamentos', '/treinamentos/tr-2026-01',
  '/fornecedores', '/fornecedores/f-01', '/auditorias', '/auditorias/aud-2026-01', '/analise-critica', '/analise-critica/acd-2026-01', '/dados', '/sobre'];
const PRINTS = ['/imprimir/nc/nc-2026-058', '/imprimir/auditoria/aud-2026-01', '/imprimir/analise/acd-2026-01'];

/** Junta erros de JavaScript, do console e bloqueios da política de segurança (CSP). */
function watch(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('localhost')) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  return errors;
}

test.describe('todas as telas', () => {
  for (const path of [...ROUTES, ...PRINTS]) {
    test(`abre sem erro: ${path}`, async ({ page }) => {
      const errors = watch(page);
      await open(page, path);
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.getByText(/não encontrad[ao]/i)).toHaveCount(0);
      // nada vaza para os lados no celular nem no computador
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, 'rolagem horizontal na página').toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
    });
  }

  test('endereço inexistente mostra a página de não encontrado', async ({ page }) => {
    await open(page, '/nao-existe');
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
  });

  test('registro inexistente avisa em vez de quebrar', async ({ page }) => {
    const errors = watch(page);
    for (const p of ['/reclamacoes/x', '/fornecedores/x', '/treinamentos/x', '/documentos/x', '/nao-conformidades/x', '/riscos/x']) {
      await page.goto(p).catch(() => {});
      await open(page, p);
      await expect(page.getByText(/não encontrad[ao]/i).first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});

test('nenhum link interno quebrado', async ({ page }) => {
  test.slow();
  await open(page, '/');
  const seen = new Set<string>();
  const queue = ['/', '/quadro', '/reclamacoes', '/fornecedores', '/treinamentos', '/documentos', '/nao-conformidades', '/riscos', '/auditorias', '/analise-critica', '/objetivos', '/processos', '/indicadores'];
  const broken: string[] = [];
  while (queue.length && seen.size < 120) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    await page.goto(url);
    await page.locator('h1').first().waitFor();
    if (await page.getByText(/não encontrad[ao]/i).count()) broken.push(url);
    const hrefs = await page.$$eval('main a[href^="/"], .main a[href^="/"]', (as) => as.map((a) => a.getAttribute('href')!));
    hrefs.filter((h) => !h.startsWith('/imprimir') && !seen.has(h)).forEach((h) => queue.push(h));
  }
  expect(broken).toEqual([]);
  expect(seen.size).toBeGreaterThan(40);
});

test('a política de segurança libera o script do tema (hash confere)', async () => {
  const { createHash } = await import('node:crypto');
  const html = readFileSync('dist/index.html', 'utf8');
  const vercel = readFileSync('vercel.json', 'utf8');
  for (const [, body] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    const h = createHash('sha256').update(body).digest('base64');
    expect(vercel, 'atualize o hash do script no vercel.json').toContain(`sha256-${h}`);
  }
});

test('busca geral acha os módulos novos', async ({ page }) => {
  await open(page, '/');
  await page.keyboard.press('Control+k');
  const box = page.getByRole('combobox', { name: 'Buscar' });
  for (const [q, hit] of [['RC-2026-01', 'Tratores Pampa'], ['parafusos', 'Fixa Parafusos'], ['torquímetro', 'TR-2026-01'], ['OBJ-02', 'OEE']] as const) {
    await box.fill(q);
    await expect(page.locator('.pal-list')).toContainText(hit);
  }
  await box.fill('fixa');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/fornecedores\/f-02/);
});

test('alterações sobrevivem a recarregar e entram no histórico', async ({ page }) => {
  await open(page, '/fornecedores/f-05');
  await page.getByRole('button', { name: 'Condicional', exact: true }).click();
  await page.reload();
  await expect(page.locator('.meta-row')).toContainText('Condicional');
  await expect(page.locator('section', { hasText: 'Histórico de alterações' })).toContainText('Marina Lopes');
});

test('dados salvos pela versão anterior (v2) são atualizados sem perda', async ({ page }) => {
  await open(page, '/');
  const id = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('sgq-rotalume') ?? 'null') ?? null;
    if (!db) throw new Error('sem dados');
    db.version = 2; delete db.suppliers; delete db.trainings; delete db.complaints; delete db.objectives;
    db.ncs[0].title = 'Título que o usuário editou';
    localStorage.setItem('sgq-rotalume', JSON.stringify(db));
    return db.ncs[0].id as string;
  });
  await page.goto(`/nao-conformidades/${id}`);
  await expect(page.getByText('Título que o usuário editou')).toBeVisible();
  await page.goto('/fornecedores');
  await expect(page.locator('tbody tr')).toHaveCount(6);
});

test('backup: baixar, restaurar exemplos e importar de volta', async ({ page }) => {
  await open(page, '/reclamacoes/rc-2026-05');
  await page.getByRole('button', { name: 'Improcedente', exact: true }).click();
  await page.goto('/dados');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar backup' }).click()]);
  const path = await dl.path();
  await page.getByRole('button', { name: 'Restaurar dados de exemplo' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Restaurar' }).click();
  await page.goto('/reclamacoes/rc-2026-05');
  await expect(page.locator('.meta-row')).toContainText('A definir');
  await page.goto('/dados');
  await page.getByLabel('Arquivo de backup').setInputFiles(path!);
  await page.getByRole('dialog').getByRole('button', { name: 'Substituir dados' }).click();
  await page.goto('/reclamacoes/rc-2026-05');
  await expect(page.locator('.meta-row')).toContainText('Improcedente');
});

test('arquivo que não é backup é recusado', async ({ page }) => {
  await open(page, '/dados');
  await page.getByLabel('Arquivo de backup').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"oi":1}') });
  await expect(page.getByText('não é um backup válido')).toBeVisible();
});

test('planilhas CSV dos módulos baixam com cabeçalho', async ({ page }) => {
  await open(page, '/dados');
  for (const [btn, head] of [['Reclamações', 'Cliente'], ['Fornecedores (IQF)', 'IQF'], ['Treinamentos', 'Participante'], ['Não conformidades', 'Causa raiz']] as const) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: btn, exact: true }).click()]);
    expect(readFileSync((await dl.path())!, 'utf8')).toContain(head);
  }
});

test('tema escuro fica salvo', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('button', { name: 'Escuro' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
