import type { Page } from '@playwright/test';

/** Abre o sistema já com o tour visto e, se pedido, com outro perfil. */
export async function open(page: Page, path = '/', user = 'marina') {
  await page.addInitScript(([u]) => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.clear();
      localStorage.setItem('sgq-tour', '1');
      localStorage.setItem('sgq-user', u);
      sessionStorage.setItem('e2e-init', '1');
    }
  }, [user]);
  await page.goto(path);
}
