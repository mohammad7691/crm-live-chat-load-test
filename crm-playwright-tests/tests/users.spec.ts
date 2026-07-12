import { test, expect } from '@playwright/test';
import { UsersPage } from '../pages/crm.pages';
import { loadTestUsers } from '../helpers/api';

test.describe('Users module @settings/users', () => {
  test('U-01 smoke: users page loads', async ({ page }) => {
    const users = new UsersPage(page);
    await users.open();
    await users.expectLoaded();
  });

  test('U-02 functional: QA automation users are listed', async ({ page }) => {
    const users = new UsersPage(page);
    const fixtures = loadTestUsers();
    await users.open();
    await page.waitForTimeout(3000);
    for (const u of Object.values(fixtures.users)) {
      await expect(page.getByText((u as { email: string }).email, { exact: false }).first()).toBeVisible({ timeout: 45_000 });
    }
  });

  test('U-03 filter tabs visible (all/active/inactive)', async ({ page }) => {
    const users = new UsersPage(page);
    await users.open();
    for (const label of [/^all$/i, /active/i, /inactive/i]) {
      await expect(
        page.getByRole('tab', { name: label })
          .or(page.getByRole('button', { name: label }))
          .or(page.getByText(label))
          .first()
      ).toBeVisible();
    }
  });
});
