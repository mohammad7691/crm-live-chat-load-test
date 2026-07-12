import { test, expect } from '@playwright/test';
import { ConversationsPage } from '../pages/crm.pages';
import { apiLogin, getConversations } from '../helpers/api';

test.describe('Conversations module @conversations', () => {
  test('CV-01 smoke: conversations page loads', async ({ page }) => {
    const conv = new ConversationsPage(page);
    await conv.open();
    await expect(page.getByText(/recent|open tickets first/i).first()).toBeVisible();
  });

  test('CV-02 layout: recent list and detail pane', async ({ page }) => {
    const conv = new ConversationsPage(page);
    await conv.open();
    await expect(page.getByText(/pick a ticket from the list/i)).toBeVisible();
  });

  test('CV-03 API: conversations list returns customers', async () => {
    const token = await apiLogin(
      process.env.ADMIN_EMAIL || process.env.AGENT_EMAIL!,
      process.env.ADMIN_PASSWORD || process.env.AGENT_PASSWORD!
    );
    const data = await getConversations(token, 3);
    expect(data).toHaveProperty('customers');
    expect(Array.isArray(data.customers)).toBeTruthy();
  });
});
