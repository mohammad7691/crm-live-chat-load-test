import { test as setup } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { LoginPage } from '../pages/crm.pages';
import { apiLogin, loadTestUsers } from '../helpers/api';

const authDir = path.join(__dirname, '../playwright/.auth');

setup('authenticate admin', async ({ page }) => {
  const email = process.env.ADMIN_EMAIL || process.env.AGENT_EMAIL;
  const password = process.env.ADMIN_PASSWORD || process.env.AGENT_PASSWORD;
  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env');

  const login = new LoginPage(page);
  await login.login(email, password);
  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: path.join(authDir, 'admin.json') });
});

setup('authenticate qa agent a', async ({ page }) => {
  const users = loadTestUsers();
  const creds = users.credentials?.qaAgentA;
  if (!creds?.email || !creds?.password) {
    setup.skip(true, 'qaAgentA credentials missing — run npm run users:create');
    return;
  }
  const login = new LoginPage(page);
  await login.login(creds.email, creds.password);
  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: path.join(authDir, 'agent-a.json') });
});
