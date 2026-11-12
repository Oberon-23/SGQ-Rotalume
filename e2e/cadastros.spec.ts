import { expect, test } from '@playwright/test';
import { open } from './helpers';

test('cadastra reclamação, fornecedor, treinamento e objetivo', async ({ page }) => {
  await open(page, '/reclamacoes');
  await page.getByRole('button', { name: 'Nova reclamação' }).click();
  let dlg = page.getByRole('dialog');
  await dlg.getByLabel('Cliente *').fill('Máquinas Delta');
  await dlg.getByLabel('Produto ou pedido *').fill('Eixo ET-55');
  await dlg.getByLabel('O que o cliente relatou *').fill('Rebarba na ponta do eixo.');
  await dlg.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.locator('h1')).toContainText('Máquinas Delta');
  await expect(page).toHaveURL(/reclamacoes\/rc-\d{4}-06/);

  await page.goto('/fornecedores');
  await page.getByRole('button', { name: 'Novo fornecedor' }).click();
  dlg = page.getByRole('dialog');
  await dlg.getByLabel('Razão social *').fill('Usinagem Beta');
  await dlg.getByLabel('O que fornece *').fill('Buchas de bronze');
  await dlg.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(page.locator('h1')).toContainText('Usinagem Beta');
  await page.getByRole('button', { name: 'Lançar avaliação' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar avaliação' }).click();
  await expect(page.locator('.meta-row')).toContainText('A · 90');

  await page.goto('/treinamentos');
  await page.getByRole('button', { name: 'Novo treinamento' }).click();
  dlg = page.getByRole('dialog');
  await dlg.getByLabel('Tema *').fill('5S na usinagem');
  await dlg.getByLabel('Instrutor *').fill('Rafael Duarte');
  await dlg.getByLabel('Participantes * (um por linha)').fill('Igor Lima\nLeandro Costa');
  await dlg.getByRole('button', { name: 'Programar' }).click();
  await expect(page.locator('h1')).toContainText('5S na usinagem');
  await expect(page.locator('.list li')).toHaveCount(2);

  await page.goto('/objetivos');
  await page.getByRole('button', { name: 'Novo objetivo' }).click();
  dlg = page.getByRole('dialog');
  await dlg.getByLabel('Objetivo *').fill('Melhorar o FPY');
  await dlg.getByLabel('Medido pelo indicador').selectOption('fpy');
  await dlg.getByLabel('Responsável *').fill('Marina Lopes');
  await dlg.getByRole('button', { name: 'Criar' }).click();
  await expect(page.locator('.obj-grid')).toContainText('Melhorar o FPY');
});

test('revisão de documento passa por três pessoas diferentes', async ({ page }) => {
  await open(page, '/documentos/pr-003');
  await page.getByRole('button', { name: 'Abrir nova revisão' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('O que muda *').fill('Novo checklist de auditoria.');
  await dlg.getByLabel('Elabora').fill('Marina Lopes');
  await dlg.getByLabel('Revisão técnica').fill('Rafael Duarte');
  await dlg.getByLabel('Aprovação final').fill('Marina Lopes');
  await expect(dlg.getByText('Quem elabora não pode revisar nem aprovar')).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Abrir revisão' })).toBeDisabled();
  await dlg.getByLabel('Aprovação final').fill('Eduardo Campos');
  await dlg.getByRole('button', { name: 'Abrir revisão' }).click();
  await page.getByRole('button', { name: 'Enviar para revisão técnica' }).click();
  // Rafael faz a revisão técnica e devolve, depois aprova
  await page.getByLabel('Ver o sistema como').selectOption('rafael');
  await page.getByRole('button', { name: 'Devolver para ajuste' }).isDisabled();
  await expect(page.getByRole('button', { name: 'Devolver para ajuste' })).toBeDisabled();
  await page.getByLabel(/Comentário/).fill('Falta a cláusula 9.2.2.');
  await page.getByRole('button', { name: 'Devolver para ajuste' }).click();
  await expect(page.locator('.appr-steps li.now')).toContainText('Elaboração');
  await page.getByLabel('Ver o sistema como').selectOption('marina');
  await page.getByRole('button', { name: 'Enviar para revisão técnica' }).click();
  await page.getByLabel('Ver o sistema como').selectOption('rafael');
  await page.getByRole('button', { name: 'Aprovar revisão técnica' }).click();
  await expect(page.locator('.approval')).toContainText('Aguardando Eduardo Campos');
  await page.getByLabel('Ver o sistema como').selectOption('marina');
  await page.getByRole('button', { name: 'Aprovar e publicar' }).click();
  await expect(page.locator('.approval')).toHaveCount(0);
  await expect(page.locator('table').first()).toContainText('Revisado por Rafael Duarte');
  await page.goto('/minhas-pendencias');
});

test('pendências mostram reclamações, aprovações e treinamentos da pessoa', async ({ page }) => {
  await open(page, '/minhas-pendencias');
  await expect(page.locator('#conteudo')).toContainText('IT-L2-003');
  await expect(page.locator('#conteudo')).toContainText('TR-2026-04');
});
