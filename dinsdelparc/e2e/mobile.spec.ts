import { expect, test, type Page } from '@playwright/test';
import { E2E_USERS } from './global-setup';

async function skipOnboarding(page: Page) {
  await page.goto('/');
  const skip = page.getByRole('button', { name: 'Omet' });
  await skip.or(page.getByText('Estat dels parcs')).first().waitFor();
  if (await skip.isVisible()) await skip.click();
  await expect(page.getByText('Estat dels parcs')).toBeVisible();
}

test('browses parks and attractions with honest data labels', async ({ page }) => {
  await skipOnboarding(page);
  await expect(page.getByText('Estat dels parcs')).toBeVisible();
  await expect(page.getByText('PortAventura Park').first()).toBeVisible();
  await expect(page.getByText('Horari no verificat per avui').first()).toBeVisible();

  await page.goto('/parks');
  await page.getByRole('button', { name: 'PortAventura Park' }).click();
  await expect(page.getByText('Mediterrània').first()).toBeVisible();
  await expect(page.getByText('No hi ha horaris verificats publicats', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: /^Dragon Khan/ }).click();
  await expect(page.getByText('Encara no hi ha dades de seguretat verificades', { exact: false })).toBeVisible();
  await expect(page.getByText('Pendent de verificació').filter({ visible: true }).first()).toBeVisible();
});

test('a signed-in visitor reports a wait time, posts and plans a visit', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await skipOnboarding(page);
  await page.goto('/auth/sign-in');
  await page.getByRole('textbox', { name: 'Correu electrònic' }).fill(E2E_USERS.visitor.email);
  await page.getByRole('textbox', { name: 'Contrasenya' }).fill(E2E_USERS.visitor.password);
  await page.getByRole('button', { name: 'Inicia sessió' }).click();
  await expect(page.getByRole('textbox', { name: 'Contrasenya' })).toBeHidden();
  await page.goto('/profile');
  await expect(page.getByText('@e2e_visitor').first()).toBeVisible();

  // Wait time report on Stampida
  await page.goto('/search');
  await page.getByLabel('Cerca').fill('stampida');
  await page.getByRole('button', { name: /^Stampida/ }).click();
  await page.getByRole('button', { name: 'Comunica el temps d’espera' }).click();
  await page.getByRole('button', { name: '20 min' }).click();
  await page.getByRole('textbox', { name: 'Temps d’espera', exact: true }).fill('25');
  await page.getByRole('button', { name: 'Envia' }).click();
  await expect(page.getByText('25 min').first()).toBeVisible();

  // New post
  const body = `Prova automatitzada ${Date.now()}`;
  await page.goto('/post/new');
  await page.getByRole('button', { name: 'Curiositats' }).click();
  await page.getByLabel('Què vols compartir?').fill(body);
  await page.getByRole('button', { name: 'Publica' }).click();
  await expect(page.getByText(body)).toBeVisible();
  await page.getByLabel('Escriu un comentari…').fill('Primer comentari');
  await page.getByRole('button', { name: 'Envia' }).click();
  await expect(page.getByText('Primer comentari')).toBeVisible();

  // Visit plan
  await page.goto('/planner/new');
  await page.getByLabel('Nom del pla').fill('Pla E2E');
  await page.getByLabel('Data de visita').fill('2027-07-15');
  await page.getByRole('button', { name: 'PortAventura Park' }).click();
  await page.getByRole('button', { name: 'Desa' }).click();
  await expect(page.getByText('Pla E2E').first()).toBeVisible();
  await page.getByRole('button', { name: 'Afegeix activitats' }).click();
  await page.getByRole('button', { name: /^Dragon Khan/ }).click();
  await page.getByRole('button', { name: 'Fet' }).click();
  await expect(page.getByText('Dragon Khan').first()).toBeVisible();
  await page.getByRole('checkbox', { name: 'Marca com a feta' }).first().click();
  await expect(page.getByText('1 de 1 completades')).toBeVisible();
});
