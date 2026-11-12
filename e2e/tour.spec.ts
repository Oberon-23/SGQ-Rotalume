import { expect, test } from '@playwright/test';

test('o tour abre na primeira visita, percorre os módulos e pode ser pulado', async ({ page }) => {
  await page.goto('/');
  const pop = page.getByRole('dialog');
  await expect(pop).toContainText('Bem-vindo ao SGQ Rotalume');
  await page.getByRole('button', { name: /Próximo/ }).click();
  await expect(pop).toContainText('Veja como cada perfil enxerga');
  await expect(page.locator('.tour-spot')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(pop).toContainText('O menu segue o ciclo da qualidade');
  await page.getByRole('button', { name: 'Voltar' }).click();
  await expect(pop).toContainText('Veja como cada perfil enxerga');
  await page.getByRole('button', { name: 'Pular tour' }).click();
  await expect(page.locator('.tour-pop')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.tour-pop')).toHaveCount(0);
  await page.getByRole('button', { name: 'Apresentação do sistema' }).click();
  await expect(page.locator('.tour-pop')).toBeVisible();
});

test('o tour chega até o fim sem perder nenhum passo', async ({ page }) => {
  await page.goto('/');
  const next = page.locator('.tour-pop .btn.primary');
  for (let i = 0; i < 30 && (await next.textContent())?.includes('Próximo'); i++) await next.click();
  await expect(page.locator('.tour-pop h2')).toHaveText('Agora é com você');
  await next.click();
  await expect(page.locator('.tour-pop')).toHaveCount(0);
});

test('na primeira visita por um link direto, a página pedida abre sem o tour', async ({ page }) => {
  // é assim que chegam os links "Ver no SGQ" do painel de qualidade
  await page.goto('/nao-conformidades');
  await expect(page.getByRole('heading', { level: 1, name: 'Não conformidades' })).toBeVisible();
  await expect(page).toHaveURL(/\/nao-conformidades$/);
  await expect(page.locator('.tour-pop')).toHaveCount(0);
  // o tour continua disponível no botão de ajuda
  await page.getByRole('button', { name: 'Apresentação do sistema' }).click();
  await expect(page.locator('.tour-pop')).toBeVisible();
});
