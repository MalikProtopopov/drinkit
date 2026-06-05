// Разовый скрипт скриншотов прототипа Juicy для ТЗ.
// Запуск: node scripts/shots.mjs  (dev-сервер должен слушать :3300)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3300";
const OUT = "/Users/mak/drinkit/docs/screens";
mkdirSync(OUT, { recursive: true });

// --- засев состояния клиента (авторизован, точка выбрана, товар в корзине, есть заказ) ---
const cartItem = {
  lineId: "shot-line-1",
  productId: "fresh-pineapple",
  variantCode: "M",
  quantity: 1,
  customName: "",
  addons: [{ groupSlug: "supplements", addonId: "ginger", quantity: 1 }],
  productName: "Фреш ананас-имбирь",
  productBg: "#F9EAB8",
  unitPriceAed: 32,
};
const seededOrder = {
  id: "ord-shot1",
  number: 1247,
  createdAt: Date.now(),
  outletId: "bay-avenue",
  items: [cartItem],
  subtotalAed: 32,
  vatAed: 1.6,
  totalAed: 33.6,
  status: "READY",
  paymentMethod: "applepay",
  carEmirate: "Dubai",
  carPlate: "O 12345",
  scheduledFor: "Как можно скорее",
  customerName: "Тест",
  arrived: false,
};
function seedScript(withCart, withOrder) {
  const state = {
    state: {
      onboardingSeen: true,
      selectedOutletId: "bay-avenue",
      user: {
        phone: "+971501234567",
        name: "Тест",
        defaultCarPlate: "O 12345",
        defaultEmirate: "Dubai",
        preferredLocale: "ru",
      },
      cart: withCart ? [cartItem] : [],
      orders: withOrder ? [seededOrder] : [],
      nextOrderNumber: 1248,
    },
    version: 0,
  };
  return `try{localStorage.setItem("juicy-mvp", ${JSON.stringify(JSON.stringify(state))});localStorage.setItem("admin-role","super_admin");}catch(e){}`;
}

async function shoot(page, route, slug) {
  try {
    await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
  } catch {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 30000 });
  }
  await page.waitForTimeout(1800); // дать видео/арту/анимациям отрисоваться
  await page.screenshot({ path: `${OUT}/${slug}.png` });
  console.log("✓", slug, route);
}

const clientRoutes = [
  ["/", "splash"],
  ["/onboarding", "onboarding"],
  ["/outlets", "outlets"],
  ["/auth/phone", "auth-phone"],
  ["/auth/otp", "auth-otp"],
  ["/auth/name", "auth-name"],
  ["/home", "home"],
  ["/menu", "menu"],
  ["/product/fresh-pineapple", "product"],
  ["/product/latte", "product-coffee"],
  ["/product/shot-immunity", "product-shot"],
  ["/cart", "cart"],
  ["/checkout", "checkout"],
  ["/payment", "payment"],
  ["/orders", "orders"],
  ["/orders/ord-shot1", "order-detail"],
  ["/profile", "profile"],
];

const adminRoutes = [
  ["/admin", "admin-dashboard"],
  ["/admin/orders", "admin-orders"],
  ["/admin/orders/ord-1", "admin-order-detail"],
  ["/admin/catalog/products", "admin-products"],
  ["/admin/catalog/products/cappuccino", "admin-product-editor"],
  ["/admin/catalog/addons", "admin-addons"],
  ["/admin/catalog/groups", "admin-groups"],
  ["/admin/outlets", "admin-outlets"],
  ["/admin/outlets/bay-avenue", "admin-outlet-detail"],
  ["/admin/staff", "admin-staff"],
];

const browser = await chromium.launch();

// --- КЛИЕНТ: мобильный вьюпорт, засеянное состояние ---
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await mobile.addInitScript(seedScript(true, true));
const mp = await mobile.newPage();
for (const [route, slug] of clientRoutes) await shoot(mp, route, slug);

// доп.состояние: пустая корзина
const mobileEmpty = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await mobileEmpty.addInitScript(seedScript(false, false));
const mpe = await mobileEmpty.newPage();
await shoot(mpe, "/cart", "cart--empty");

// --- АДМИНКА: десктопный вьюпорт ---
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await desktop.addInitScript(seedScript(true, true));
const dp = await desktop.newPage();
for (const [route, slug] of adminRoutes) await shoot(dp, route, slug);

await browser.close();
console.log("DONE shots");
