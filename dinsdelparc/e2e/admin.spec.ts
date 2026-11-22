import { expect, test, type Page } from '@playwright/test';
import { E2E_USERS } from './global-setup';

async function login(page: Page, who: keyof typeof E2E_USERS) {
  await page.goto('/login');
  await page.getByLabel('Correu electrònic').fill(E2E_USERS[who].email);
  await page.getByLabel('Contrasenya').fill(E2E_USERS[who].password);
  await page.getByRole('button', { name: 'Inicia sessió' }).click();
}

test('anonymous visitors are redirected to the login page', async ({ page }) => {
  await page.goto('/users');
  await expect(page).toHaveURL(/\/login/);
});

test('a standard user cannot access the admin panel', async ({ page }) => {
  await login(page, 'visitor');
  await expect(page.getByText('El teu compte no té accés al panell d’administració.')).toBeVisible();
});

test('superadmin manages content, operations and users end to end', async ({ page, request }) => {
  await login(page, 'admin');
  const main = page.locator('#main');
  await expect(main.getByRole('heading', { name: 'Tauler' })).toBeVisible();
  await expect(main.getByText('Usuaris registrats')).toBeVisible();

  // Create a draft attraction
  const slug = `e2e-${Date.now()}`;
  await page.goto('/content/attractions/new');
  await main.getByLabel('Parc *').selectOption({ label: 'Ferrari Land' });
  await main.getByLabel('Nom *').fill('Atracció E2E');
  await main.getByLabel('Identificador (URL) *').fill(slug);
  await main.getByLabel('Tipologia *').selectOption('family');
  await main.getByLabel('Descripció (ca)').fill('Registre creat per les proves automatitzades.');
  await main.getByRole('button', { name: 'Desa' }).click();
  await expect(main.getByRole('status')).toContainText('Desat correctament');

  // Verify + publish it
  await main.getByLabel('Font (URL)').fill('https://example.org/font-verificada');
  await main.getByLabel('Origen de la dada *').selectOption('verified');
  await main.getByLabel('Publicat').check();
  await main.getByRole('button', { name: 'Desa' }).click();
  await expect(main.getByRole('status')).toContainText('Desat correctament');

  // The public API now returns it as verified
  const anon = process.env.E2E_ANON_KEY!;
  const api = `${process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'}/rest/v1/attractions?slug=eq.${slug}&select=name,data_origin,is_published,verified_at`;
  await expect
    .poll(async () => (await (await request.get(api, { headers: { apikey: anon } })).json()) as unknown[])
    .toEqual([expect.objectContaining({ name: 'Atracció E2E', data_origin: 'verified', is_published: true, verified_at: expect.any(String) })]);

  // Operational status
  await page.goto('/operations');
  const row = main.getByRole('row').filter({ hasText: 'Atracció E2E' });
  await row.getByLabel('Canvia l’estat').selectOption('temporarily_closed');
  await row.getByRole('button', { name: 'Desa' }).first().click();
  await expect(main.getByRole('status')).toContainText('Desat correctament');
  await expect(main.getByRole('row').filter({ hasText: 'Atracció E2E' })).toContainText('Tancada temporalment');

  // Users: grant verified_user to the visitor
  await page.goto('/users?q=e2e_visitor');
  await main.getByRole('row').filter({ hasText: '@e2e_visitor' }).getByRole('link', { name: 'Edita' }).click();
  await main.getByRole('row').filter({ hasText: 'Usuari verificat' }).getByRole('button', { name: 'Atorga' }).click();
  await expect(main.getByRole('status')).toContainText('Desat correctament');

  // Everything above is in the audit log
  await page.goto('/audit');
  await expect(main.getByText('set_status').first()).toBeVisible();
  await expect(main.getByText('grant_role').first()).toBeVisible();

  // Clean up the test attraction
  await page.goto('/content/attractions');
  await main.getByRole('row').filter({ hasText: 'Atracció E2E' }).getByRole('link', { name: 'Edita' }).click();
  page.once('dialog', (d) => d.accept());
  await main.getByRole('button', { name: 'Elimina' }).click();
  await expect(main.getByRole('status')).toContainText('Eliminat');
});
