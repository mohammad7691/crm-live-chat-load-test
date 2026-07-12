import { test, expect } from '@playwright/test';
import { TicketDistributionPage } from '../pages/crm.pages';
import { apiLogin, getDistributionRules } from '../helpers/api';

test.describe('Ticket Distribution @settings/ticket-distribution', () => {
  test('TD-01 smoke: ticket distribution page loads', async ({ page }) => {
    const dist = new TicketDistributionPage(page);
    await dist.open();
    await dist.expectLoaded();
  });

  test('TD-02 functional: folders panel and rules area', async ({ page }) => {
    const dist = new TicketDistributionPage(page);
    await dist.open();
    await expect(page.getByText(/folders/i).first()).toBeVisible();
    await expect(page.getByText(/rules are evaluated/i)).toBeVisible();
  });

  test('TD-03 API: distribution rules endpoint returns rules', async () => {
    const token = await apiLogin(
      process.env.ADMIN_EMAIL || process.env.AGENT_EMAIL!,
      process.env.ADMIN_PASSWORD || process.env.AGENT_PASSWORD!
    );
    const data = await getDistributionRules(token);
    expect(data).toHaveProperty('rules');
    expect(Array.isArray(data.rules)).toBeTruthy();
  });
});
