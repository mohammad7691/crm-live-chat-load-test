import { test, expect } from '@playwright/test';
import { TeamsPage } from '../pages/crm.pages';
import { loadTestUsers } from '../helpers/api';

test.describe('Teams module @settings/teams', () => {
  test('T-01 smoke: teams page loads', async ({ page }) => {
    const teams = new TeamsPage(page);
    await teams.open();
    await teams.expectLoaded();
  });

  test('T-02 functional: QA team visible in list', async ({ page }) => {
    const teams = new TeamsPage(page);
    const fixtures = loadTestUsers();
    await teams.open();
    await expect(page.getByText(fixtures.teamName, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
  });

  test('T-03 columns: team members / folders / smart lists', async ({ page }) => {
    const teams = new TeamsPage(page);
    await teams.open();
    await expect(page.getByRole('columnheader', { name: /^members$/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /^folders$/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /smart lists/i })).toBeVisible();
  });
});
