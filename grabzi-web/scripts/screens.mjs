// grabzi-web/scripts/screens.mjs — mobile screenshots for the GRABZI ТЗ
// run from grabzi-web: CUST_TOKEN=.. STAFF_TOKEN=.. ORDER_ID=.. node scripts/screens.mjs
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const BASE = 'http://localhost:3001';
const OUT = resolve(process.cwd(), '../docs/screens/grabzi');
mkdirSync(OUT, { recursive: true });
const CUST = process.env.CUST_TOKEN || '';
const STAFF = process.env.STAFF_TOKEN || '';
const ORDER = process.env.ORDER_ID || '2';

// Zustand persisted draft (key grabzi-draft): { state:{locationId, items}, version:1 }
const DRAFT = JSON.stringify({ state: { locationId: 1, items: { '1': 2, '2': 1 } }, version: 1 });

const shots = [
  { slug: 'home', path: '/' },
  { slug: 'locations', path: '/locations' },
  { slug: 'menu', path: '/menu' },
  { slug: 'product', path: '/product/classic-ice-v60' },
  { slug: 'order--empty', path: '/order' },
  { slug: 'order--loaded', path: '/order', draft: true },
  { slug: 'orders--signed-out', path: '/orders' },
  { slug: 'orders--list', path: '/orders', cust: true },
  { slug: 'order-status', path: `/orders/${ORDER}`, cust: true },
  { slug: 'info', path: '/info' },
  { slug: 'admin-login', path: '/admin/login' },
  { slug: 'admin-kitchen', path: '/admin/kitchen', staff: true },
];

const browser = await chromium.launch({ channel: 'chrome' });

async function seed(page, s) {
  // set storage on the origin before loading the target route
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate(({ cust, staff, draft, C, S, D }) => {
    try {
      if (cust) localStorage.setItem('grabzi_token', C);
      if (staff) localStorage.setItem('grabzi_staff_token', S);
      if (draft) localStorage.setItem('grabzi-draft', D);
    } catch {}
  }, { cust: !!s.cust, staff: !!s.staff, draft: !!s.draft, C: CUST, S: STAFF, D: DRAFT });
}

async function shoot(s, { offline = false, failApi = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  if (s.cust || s.staff || s.draft) await seed(page, s);
  if (failApi) await page.route('**/api/**', r => r.abort());
  try {
    await page.goto(BASE + s.path, { waitUntil: 'networkidle', timeout: 30000 });
  } catch { await page.goto(BASE + s.path, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}); }
  if (offline) await ctx.setOffline(true);
  await page.waitForTimeout(1500);
  const name = offline ? `${s.slug}--offline` : failApi ? `${s.slug}--error` : s.slug;
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log('shot', name);
  await ctx.close();
}

for (const s of shots) await shoot(s);
// error states (abort API → "Try again" cards)
for (const slug of ['locations', 'menu', 'orders--list']) {
  const s = shots.find(x => x.slug === slug);
  if (s) await shoot(s, { failApi: true });
}
// offline banner
await shoot({ slug: 'home', path: '/' }, { offline: true });

await browser.close();
console.log('done ->', OUT);
