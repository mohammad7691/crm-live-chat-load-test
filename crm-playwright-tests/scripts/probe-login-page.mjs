/** Quick login page probe — saves exploration/login-page.html */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '..', '.env') });
const BASE = process.env.CRM_BASE_URL || 'https://app.crm.swagprinthub.com';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
const html = await page.content();
const buttons = await page.locator('button').evaluateAll((els) =>
  els.map((b) => ({ text: b.textContent?.trim(), type: b.type, name: b.getAttribute('name') }))
);
const inputs = await page.locator('input').evaluateAll((els) =>
  els.map((i) => ({ type: i.type, name: i.name, id: i.id, placeholder: i.placeholder, aria: i.getAttribute('aria-label') }))
);
fs.mkdirSync(path.join(root, 'exploration'), { recursive: true });
fs.writeFileSync(path.join(root, 'exploration', 'login-page.html'), html);
fs.writeFileSync(path.join(root, 'exploration', 'login-controls.json'), JSON.stringify({ buttons, inputs, url: page.url() }, null, 2));
console.log(JSON.stringify({ buttons, inputs }, null, 2));
await browser.close();
