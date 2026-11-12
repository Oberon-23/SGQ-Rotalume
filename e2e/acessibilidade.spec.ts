import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { open } from './helpers';

const PAGES = ['/', '/minhas-pendencias', '/quadro', '/nao-conformidades', '/nao-conformidades/nc-2026-069', '/reclamacoes', '/reclamacoes/rc-2026-04', '/objetivos', '/processos', '/riscos',
  '/indicadores', '/documentos', '/documentos/it-l2-003', '/imprimir/nc/nc-2026-058', '/treinamentos', '/treinamentos/tr-2026-02', '/fornecedores', '/fornecedores/f-02', '/auditorias', '/analise-critica', '/dados', '/sobre'];

for (const path of PAGES) {
  test(`sem problemas graves de acessibilidade em ${path}`, async ({ page }) => {
    await open(page, path);
    await page.locator('h1').first().waitFor();
    await page.waitForFunction(() => document.getAnimations().every((a) => a.effect?.getTiming().iterations === Infinity || a.playState !== 'running')); const r = await new AxeBuilder({ page } as unknown as ConstructorParameters<typeof AxeBuilder>[0]).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}

test('tour sem problemas graves de acessibilidade', async ({ page }) => {
  await page.goto('/');
  await page.locator('.tour-pop').waitFor();
  await page.waitForFunction(() => document.getAnimations().every((a) => a.effect?.getTiming().iterations === Infinity || a.playState !== 'running')); const r = await new AxeBuilder({ page } as unknown as ConstructorParameters<typeof AxeBuilder>[0]).include('.tour-pop').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
});

test.describe('tema escuro', () => {
  test.use({ colorScheme: 'dark' });
  for (const path of ['/', '/quadro', '/reclamacoes/rc-2026-05', '/fornecedores/f-02', '/treinamentos', '/documentos/it-l2-003', '/riscos']) {
    test(`contraste no escuro em ${path}`, async ({ page }) => {
      await open(page, path);
      await page.locator('h1').first().waitFor();
      await page.waitForFunction(() => document.getAnimations().every((a) => a.effect?.getTiming().iterations === Infinity || a.playState !== 'running')); const r = await new AxeBuilder({ page } as unknown as ConstructorParameters<typeof AxeBuilder>[0]).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  }
});
