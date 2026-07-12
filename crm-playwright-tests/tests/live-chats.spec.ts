import { test, expect } from '@playwright/test';
import { LiveChatsPage } from '../pages/crm.pages';
import { seedLiveChatSession } from '../helpers/api';

test.describe('Live Chats @live-chats (NST inbox, not workspace)', () => {
  test('LC-01 smoke: live chats page loads', async ({ page }) => {
    const chats = new LiveChatsPage(page);
    await chats.open();
    await expect(page.getByText(/preview pending chats|accept to start/i)).toBeVisible();
  });

  test('LC-02 tabs: new / assigned / closed filters', async ({ page }) => {
    const chats = new LiveChatsPage(page);
    await chats.open();
    for (const label of [/new/i, /assigned/i, /closed/i]) {
      await expect(page.getByRole('button', { name: label }).or(page.getByText(label)).first()).toBeVisible();
    }
  });

  test('LC-03 integration: seeded NST handoff chat appears in New tab', async ({ page }) => {
    const tag = `PW-LC-${Date.now()}`;
    const { visitorName } = await seedLiveChatSession(tag);

    const chats = new LiveChatsPage(page);
    await chats.open();
    await page.getByRole('button', { name: /^new/i }).first().click();
    await chats.clearDateFilter();
    await chats.search(tag);

    await expect(page.getByText(visitorName, { exact: false })).toBeVisible({ timeout: 60_000 });
  });
});
