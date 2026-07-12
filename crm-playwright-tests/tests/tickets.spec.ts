import { test, expect } from '@playwright/test';
import { TicketsPage } from '../pages/crm.pages';
import { apiLogin, getTickets } from '../helpers/api';

test.describe('Tickets module @tickets', () => {
  test('TK-01 smoke: tickets page loads', async ({ page }) => {
    const tickets = new TicketsPage(page);
    await tickets.open();
    await expect(page.getByText(/support dashboard|import from mailbox/i).first()).toBeVisible();
  });

  test('TK-02 filters: assigned to me / shared / resolved tabs', async ({ page }) => {
    const tickets = new TicketsPage(page);
    await tickets.open();
    for (const label of [/assigned to me/i, /shared with me/i, /resolved/i]) {
      await expect(
        page.getByRole('tab', { name: label })
          .or(page.getByRole('button', { name: label }))
          .or(page.getByText(label))
          .first()
      ).toBeVisible();
    }
  });

  test('TK-03 API: tickets list returns data shape', async () => {
    const token = await apiLogin(
      process.env.ADMIN_EMAIL || process.env.AGENT_EMAIL!,
      process.env.ADMIN_PASSWORD || process.env.AGENT_PASSWORD!
    );
    const data = await getTickets(token, 3);
    expect(data).toHaveProperty('tickets');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.tickets)).toBeTruthy();
  });
});
