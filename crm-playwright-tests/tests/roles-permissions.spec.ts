import { test, expect } from '@playwright/test';
import { RolesPermissionsPage } from '../pages/crm.pages';

test.describe('Roles & Permissions @settings/roles-permissions', () => {
  test('R-01 smoke: roles & permissions page loads', async ({ page }) => {
    const roles = new RolesPermissionsPage(page);
    await roles.open();
    await roles.expectLoaded();
  });

  test('R-02 functional: known roles visible', async ({ page }) => {
    const roles = new RolesPermissionsPage(page);
    await roles.open();
    for (const name of [/master admin/i, /agent/i, /admin/i]) {
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 30_000 });
    }
  });

  test('R-03 permissions section present', async ({ page }) => {
    const roles = new RolesPermissionsPage(page);
    await roles.open();
    await expect(page.getByText(/permission/i).first()).toBeVisible();
  });
});
