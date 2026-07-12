import { Page, expect } from '@playwright/test';

export const routes = {
  users: '/settings/users',
  teams: '/settings/teams',
  rolesPermissions: '/settings/roles-permissions',
  ticketDistribution: '/settings/ticket-distribution',
  liveChats: '/live-chats',
  tickets: '/tickets',
  conversations: '/conversations',
  login: '/login',
} as const;

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(routes.login, { waitUntil: 'networkidle' });
  }

  async login(email: string, password: string) {
    await this.goto();
    await this.page.locator('input[name="email"]').fill(email);
    await this.page.locator('input[name="password"]').fill(password);
    await this.page.getByRole('button', { name: /access crm dashboard/i }).click();
    await this.page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 });
  }
}

export class UsersPage {
  constructor(private page: Page) {}

  async open() {
    await this.page.goto(routes.users, { waitUntil: 'networkidle' });
    await expect(this.page.getByRole('heading', { name: /^users$/i })).toBeVisible();
  }

  async expectLoaded() {
    await expect(this.page.getByRole('button', { name: /add user/i })).toBeVisible();
    await expect(this.page.getByText(/manage user accounts/i)).toBeVisible();
  }

  async search(text: string) {
    const search = this.page.getByPlaceholder(/search/i).first();
    if (await search.isVisible().catch(() => false)) await search.fill(text);
  }

  async expectUserVisible(email: string) {
    await expect(this.page.getByText(email, { exact: false })).toBeVisible({ timeout: 30_000 });
  }
}

export class TeamsPage {
  constructor(private page: Page) {}

  async open() {
    await this.page.goto(routes.teams, { waitUntil: 'networkidle' });
    await expect(this.page.getByRole('heading', { name: /^teams$/i })).toBeVisible();
  }

  async expectLoaded() {
    await expect(this.page.getByRole('button', { name: /new team/i })).toBeVisible();
  }
}

export class RolesPermissionsPage {
  constructor(private page: Page) {}

  async open() {
    await this.page.goto(routes.rolesPermissions, { waitUntil: 'networkidle' });
  }

  async expectLoaded() {
    await expect(this.page.getByRole('heading', { name: /roles|permissions/i })).toBeVisible();
  }
}

export class TicketDistributionPage {
  constructor(private page: Page) {}

  async open() {
    await this.page.goto(routes.ticketDistribution, { waitUntil: 'networkidle' });
    await expect(this.page.getByRole('heading', { name: /ticket distribution/i })).toBeVisible();
  }

  async expectLoaded() {
    await expect(this.page.getByText(/assignment rules|auto-assign/i).first()).toBeVisible();
  }
}

export class LiveChatsPage {
  constructor(private page: Page) {}

  async open() {
    await this.page.goto(routes.liveChats, { waitUntil: 'networkidle' });
    await expect(this.page.getByRole('heading', { name: /live chats/i })).toBeVisible();
  }

  async selectSite(name: string) {
    const siteBtn = this.page.getByRole('button', { name: /filter by widget site/i });
    if (await siteBtn.isVisible().catch(() => false)) {
      await siteBtn.click();
      const option = this.page.getByRole('menuitem', { name: new RegExp(name, 'i') })
        .or(this.page.getByRole('option', { name: new RegExp(name, 'i') }))
        .or(this.page.getByText(new RegExp(`^${name}$`, 'i')));
      if (await option.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await option.first().click();
      }
    }
  }

  async clearDateFilter() {
    for (const label of [/filter from date/i, /filter to date/i]) {
      const input = this.page.getByRole('textbox', { name: label });
      if (await input.isVisible().catch(() => false)) {
        await input.fill('');
      }
    }
  }

  async search(query: string) {
    const box = this.page.getByRole('searchbox', { name: /search conversations/i });
    if (await box.isVisible().catch(() => false)) {
      await box.fill(query);
    }
  }

  async openTab(name: RegExp) {
    await this.page.getByRole('tab', { name }).click();
  }
}

export class TicketsPage {
  constructor(private page: Page) {}

  async open() {
    await this.page.goto(routes.tickets, { waitUntil: 'networkidle' });
    await expect(this.page.getByRole('heading', { name: /all tickets/i })).toBeVisible();
  }
}

export class ConversationsPage {
  constructor(private page: Page) {}

  async open() {
    await this.page.goto(routes.conversations, { waitUntil: 'networkidle' });
    await expect(this.page.getByRole('heading', { name: /conversations/i })).toBeVisible();
  }
}
