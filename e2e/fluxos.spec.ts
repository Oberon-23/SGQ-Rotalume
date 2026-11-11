import { expect, test } from '@playwright/test';
import { open } from './helpers';

test('NC não avança sem 3 porquês e causa raiz', async ({ page }) => {
  await open(page, '/nao-conformidades/nc-2026-069');
  await expect(page.getByText('Responda pelo menos 3 porquês.')).toBeVisible();
});

test('reclamação procedente vira NC e é respondida', async ({ page }) => {
  await open(page, '/reclamacoes/rc-2026-05');
  await page.getByRole('button', { name: 'Procedente', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir não conformidade' }).click();
  await page.getByRole('dialog').getByRole('combobox').selectOption('p07');
  await page.getByRole('button', { name: 'Abrir NC' }).click();
  const ncLink = page.locator('.flow a').first();
  await expect(ncLink).toContainText(/NC-\d{4}-\d{3}/);
  await page.getByLabel('Resposta ao cliente').fill('Conjuntos substituídos e aperto conferido com torquímetro calibrado.');
  await page.getByRole('button', { name: 'Registrar resposta enviada' }).click();
  await expect(page.locator('.meta-row')).toContainText('Respondida');
  await page.getByRole('button', { name: '4 de 5' }).click();
  await page.getByRole('button', { name: 'Encerrar reclamação' }).click();
  await expect(page.locator('.meta-row')).toContainText('Encerrada');
  await ncLink.click();
  await expect(page.locator('.meta-row')).toContainText('RC-2026-05');
});

test('aprovação de documento publica a nova revisão', async ({ page }) => {
  await open(page, '/documentos/it-l2-003');
  await expect(page.locator('.approval')).toContainText('Revisão 5 em andamento');
  await page.getByRole('button', { name: 'Aprovar e publicar' }).click();
  await expect(page.locator('.approval')).toHaveCount(0);
  await expect(page.locator('.meta-row')).toContainText('Revisão vigente 5');
  await expect(page.locator('table').first()).toContainText('aprovado por Marina Lopes');
});

test('quem não está com a etapa só acompanha a aprovação', async ({ page }) => {
  await open(page, '/documentos/it-l2-003', 'diego');
  await expect(page.locator('.approval')).toContainText('Aguardando Marina Lopes');
  await expect(page.getByRole('button', { name: 'Aprovar e publicar' })).toHaveCount(0);
});

test('visitante não cria nem edita', async ({ page }) => {
  await open(page, '/reclamacoes', 'visitante');
  await expect(page.getByRole('button', { name: 'Nova reclamação' })).toHaveCount(0);
  await page.goto('/fornecedores/f-02');
  await expect(page.getByRole('button', { name: 'Lançar avaliação' })).toHaveCount(0);
});

test('avaliação de fornecedor calcula o IQF', async ({ page }) => {
  await open(page, '/fornecedores/f-05');
  await page.getByRole('button', { name: 'Lançar avaliação' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel(/Qualidade/).fill('100');
  await dlg.getByLabel(/Entrega/).fill('50');
  await dlg.getByLabel(/Atendimento/).fill('0');
  await expect(dlg).toContainText('C · 65');
  await dlg.getByRole('button', { name: 'Salvar avaliação' }).click();
  await expect(page.getByRole('status')).toContainText('IQF');
});

test('anexa evidência na NC e mantém depois de recarregar', async ({ page }) => {
  await open(page, '/nao-conformidades/nc-2026-069');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.locator('input[type=file]').setInputFiles({ name: 'foto-do-posto.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.files')).toContainText('foto-do-posto.png');
  await page.reload();
  await expect(page.locator('.files')).toContainText('foto-do-posto.png');
});

test('quadro Kanban: mover com as setas e arrastando', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 }); // arrastar não pode depender de rolar a página
  await open(page, '/quadro');
  const todo = page.getByRole('region', { name: /^A fazer/ });
  const doing = page.getByRole('region', { name: /^Em andamento/ });
  const done = page.getByRole('region', { name: /^Concluído/ });
  const card = todo.locator('.kcard', { hasText: 'Auditar 10 setups' });
  await card.hover();
  await card.getByRole('button', { name: /para Em andamento/ }).click();
  await expect(doing.locator('.kcard', { hasText: 'Auditar 10 setups' })).toBeVisible();
  await doing.locator('.kcard', { hasText: 'Auditar 10 setups' }).dragTo(done.locator('.col-h'));
  await expect(done.locator('.kcard', { hasText: 'Auditar 10 setups' })).toBeVisible();
  await page.goto('/nao-conformidades/nc-2026-071');
  await expect(page.locator('.history, section').filter({ hasText: 'Plano de ação' }).first()).toBeVisible();
});

test('visitante vê o quadro mas não move cartões', async ({ page }) => {
  await open(page, '/quadro', 'visitante');
  await expect(page.locator('.kcard').first()).toBeVisible();
  await expect(page.locator('.kc-move')).toHaveCount(0);
});
