/**
 * UI route discovery — logs reachable in-scope module URLs.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
dotenv.config({ path: path.join(root, '..', '.env') });

const BASE = process.env.CRM_BASE_URL || 'https://app.crm.swagprinthub.com';
const ROUTES = [
  '/users',
  '/teams',
  '/roles',
  '/roles-and-permissions',
  '/permissions',
  '/tickets',
  '/conversations',
  '/live-chats',
  '/live-chats/workspace',
  '/ticket-distribution',
  '/distribution',
  '/distribution-rules',
  '/settings/ticket-distribution',
  '/settings/distribution',
  '/settings/users',
  '/settings/teams',
  '/settings/roles',
  '/admin/users',
  '/admin/teams',
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.locator('input[name="email"]').fill(process.env.ADMIN_EMAIL || process.env.AGENT_EMAIL);
  await page.locator('input[name="password"]').fill(process.env.ADMIN_PASSWORD || process.env.AGENT_PASSWORD);
  await page.getByRole('button', { name: /access crm dashboard/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60000 });

  for (const route of ROUTES) {
    const url = `${BASE}${route}`;
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
    const title = await page.title();
    const h1 = await page.locator('h1').first().textContent().catch(() => '');
    const has404 = (await page.locator('text=404').count()) > 0;
    const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 200);
    results.push({
      route,
      status: res?.status() ?? null,
      finalUrl: page.url(),
      title,
      heading: h1?.trim(),
      likely404: has404,
      snippet: bodyText.replace(/\s+/g, ' '),
    });
    console.log(route, res?.status(), page.url().replace(BASE, ''), h1?.trim() || title);
  }

  // Capture nav links for in-scope modules
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const navLinks = await page.locator('a[href]').evaluateAll((els) =>
    els.map((a) => ({ href: a.getAttribute('href'), text: (a.textContent || '').trim() })).filter((x) => x.href)
  );
  const scoped = navLinks.filter((l) =>
    /user|team|role|permission|ticket|conversation|live.?chat|distribution/i.test(`${l.href} ${l.text}`)
  );

  const outDir = path.join(root, 'exploration');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'ui-routes.json'), JSON.stringify({ base: BASE, routes: results, navLinks: scoped }, null, 2));
  console.log('\nSaved exploration/ui-routes.json');
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
