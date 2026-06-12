import { test, expect, Page, BrowserContext } from "@playwright/test";
import { seedAuthenticatedState, seedCleanState, collectErrors } from "./_helpers";

const API = "http://127.0.0.1:8011";

// Дойти до /checkout по реальному флоу (онбординг→точка→товар→корзина→вход).
async function reachCheckout(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/onboarding/, { timeout: 4000 });
  await page.getByRole("button", { name: "Дальше" }).click(); await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Дальше" }).click(); await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Начать" }).click();
  await page.waitForURL(/\/outlets/, { timeout: 4000 });
  await page.getByText("Bay Avenue").first().click();
  await page.waitForURL(/\/home/, { timeout: 4000 });
  const fp = page.locator('a[href^="/product/"]').first();
  await fp.waitFor({ state: "visible", timeout: 8000 });
  await fp.click();
  await page.waitForURL(/\/product\//, { timeout: 4000 });
  await page.locator('button.btn-primary:has-text("AED")').first().click({ force: true });
  await page.waitForTimeout(800);
  await page.goto("/cart", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Оформить/ }).click();
  await page.waitForURL(/\/auth\/phone/, { timeout: 4000 });
  for (const d of "501234567") await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByRole("button", { name: /Получить код/ }).click();
  await page.waitForURL(/\/(auth\/otp|auth\/name|checkout|home)/, { timeout: 6000 });
  if (page.url().includes("/auth/otp")) {
    const otp = page.locator("input[autocomplete='one-time-code']");
    if (await otp.count()) await otp.fill("1836");
    await page.waitForURL(/\/(auth\/name|checkout|home)/, { timeout: 5000 });
  }
  if (page.url().includes("/auth/name")) {
    await page.getByPlaceholder("Как тебя зовут?").fill("Мак");
    await page.getByRole("button", { name: /Зовите меня так/ }).click();
    await page.waitForURL(/\/(checkout|home)/, { timeout: 5000 });
  }
  if (!page.url().includes("/checkout")) {
    await page.goto("/cart", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Оформить/ }).click();
    await page.waitForURL(/\/checkout/, { timeout: 5000 });
  }
  // дождаться, пока контент checkout отрисуется (кнопка оплаты), а не только смены URL
  await page.getByRole("button", { name: /Перейти к оплате/ }).waitFor({ state: "visible", timeout: 8000 });
}

async function placeOrder(page: Page): Promise<number> {
  const name = page.getByPlaceholder("Как тебя зовут?");
  if (await name.count()) await name.fill("Мак");
  await page.locator('input[placeholder="O 12345"]').fill("F 88888");
  await page.getByRole("button", { name: /Перейти к оплате/ }).click();
  await page.waitForURL(/\/payment/, { timeout: 5000 });
  await page.getByRole("button", { name: /Оплатить через Stripe/ }).click();
  await page.waitForURL(/\/orders\/\d+/, { timeout: 8000 });
  return Number(page.url().match(/\/orders\/(\d+)/)![1]);
}

// ============================================================
// 1. ВАЛИДАЦИЯ ПОЛЕЙ
// ============================================================
test.describe("Валидация полей", () => {
  test("телефон: «Получить код» блокируется пока невалидно + согласие", async ({ page, context }) => {
    await seedAuthenticatedState(context); // онбординг+точка, без токена → /auth/phone доступен
    await page.goto("/auth/phone", { waitUntil: "networkidle" });
    const btn = page.getByRole("button", { name: /Получить код/ });
    await expect(btn, "пустой телефон → disabled").toBeDisabled();
    for (const d of "50123") await page.getByRole("button", { name: d, exact: true }).click();
    await expect(btn, "5 цифр < 9 → disabled").toBeDisabled();
    for (const d of "4567") await page.getByRole("button", { name: d, exact: true }).click();
    await expect(btn, "9 цифр + согласие → enabled").toBeEnabled();
    await page.locator('input[type="checkbox"]').uncheck();
    await expect(btn, "снято согласие → disabled").toBeDisabled();
  });

  test("checkout: обязательные поля + номер машины в ВЕРХНИЙ регистр", async ({ page, context }) => {
    await seedCleanState(context);
    await reachCheckout(page);
    const pay = page.getByRole("button", { name: /Перейти к оплате/ });
    const name = page.getByPlaceholder("Как тебя зовут?");
    const plate = page.locator('input[placeholder="O 12345"]');
    await name.fill("");
    await expect(pay, "пустое имя → оплата заблокирована").toBeDisabled();
    await plate.fill("");
    await plate.pressSequentially("f 88");
    await expect(plate, "номер приводится к верхнему регистру").toHaveValue("F 88");
    await name.fill("Мак");
    await expect(pay, "имя+номер → оплата доступна").toBeEnabled();
  });
});

// ============================================================
// 2. i18n RU/AR + RTL
// ============================================================
test.describe("Локализация RU/AR и RTL", () => {
  test("переключение на арабский: dir=rtl + арабские названия напитков", async ({ page, context }) => {
    await seedAuthenticatedState(context);
    await page.goto("/profile", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /العربية/ }).click();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.documentElement.dir), "dir должен стать rtl").toBe("rtl");
    // каталог перефетчится на арабском
    await page.goto("/home", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const body = await page.locator("body").innerText();
    expect(/[؀-ۿ]/.test(body), "на /home должны появиться арабские символы").toBeTruthy();
    // вернуть русский
    await page.goto("/profile", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Русский/ }).click();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.documentElement.dir)).toBe("ltr");
  });
});

// ============================================================
// 3. СЕТЕВАЯ УСТОЙЧИВОСТЬ / ОФФЛАЙН
// ============================================================
test.describe("Сетевая устойчивость", () => {
  test("home при недоступном API показывает ошибку + «Повторить» (не белый экран)", async ({ page, context }) => {
    await seedAuthenticatedState(context);
    // блокируем запросы каталога
    await context.route("**/api/drinks**", (r) => r.abort());
    await context.route("**/api/categories**", (r) => r.abort());
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Сервер недоступен|Не удалось|Повторить/).first(),
      "должно быть дружелюбное состояние ошибки").toBeVisible({ timeout: 6000 });
  });

  test("офлайн: уже загруженная страница не падает при потере сети", async ({ page, context }) => {
    // ПРИМЕЧАНИЕ: глобального оффлайн-баннера/Service Worker в Juicy нет (фича F6 не реализована),
    // поэтому жёсткая навигация офлайн даёт пустой экран. Проверяем реалистичное: уже
    // загруженная страница переживает потерю сети без краша.
    await seedAuthenticatedState(context);
    await page.goto("/home", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    await context.setOffline(true);
    await page.waitForTimeout(600);
    expect(await page.locator("nav").count(), "уже загруженная навигация на месте").toBeGreaterThan(0);
    expect(await page.locator("body").innerText(), "контент не пропал").toMatch(/Напитки|Главная|Меню|Профиль/);
    await context.setOffline(false);
  });
});

// ============================================================
// 4. БРАУЗЕРНЫЙ WebSocket (апдейт статуса приходит по WS, не polling)
// ============================================================
test.describe("Realtime WebSocket в браузере", () => {
  test("страница заказа обновляет статус по WS быстрее polling (60с)", async ({ page, context }) => {
    await seedCleanState(context);
    await reachCheckout(page);
    const orderId = await placeOrder(page);
    // менеджер берёт заказ в работу через API
    const mlogin = await page.request.post(`${API}/api/staff/login`,
      { data: { email: "manager@juicy.ae", password: "manager123" } });
    const mtok = (await mlogin.json()).token;
    const t0 = Date.now();
    const take = await page.request.post(`${API}/api/admin/orders/${orderId}/take`,
      { headers: { Authorization: `Bearer ${mtok}` } });
    expect(take.ok()).toBeTruthy();
    // страница заказа должна показать «Начали готовить» (in_progress) в пределах ~6с → это WS, не polling(60с)
    await expect(page.getByText(/Начали готовить|Готовим/).first()).toBeVisible({ timeout: 8000 });
    expect(Date.now() - t0, "обновление пришло быстрее polling-интервала").toBeLessThan(15000);
  });
});

// ============================================================
// 5. АДАПТИВ (планшет/десктоп) — нет горизонтального переполнения
// ============================================================
test.describe("Адаптив", () => {
  for (const vp of [{ name: "планшет", w: 768, h: 1024 }, { name: "десктоп", w: 1280, h: 800 }]) {
    test(`${vp.name} ${vp.w}px: ключевые экраны без горизонтального скролла`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      await seedAuthenticatedState(ctx);
      const page = await ctx.newPage();
      for (const path of ["/home", "/menu", "/product/orange-fresh", "/profile"]) {
        await page.goto(path, { waitUntil: "networkidle" });
        await page.waitForTimeout(700);
        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path}: горизонтальное переполнение ${overflow}px`).toBeLessThanOrEqual(2);
      }
      await ctx.close();
    });
  }
});

// ============================================================
// 6. ДОСТУПНОСТЬ (базовые проверки без axe)
// ============================================================
test.describe("Доступность (база)", () => {
  test("изображения с alt, кнопки с доступным именем, html lang/dir", async ({ page, context }) => {
    await seedAuthenticatedState(context);
    await page.goto("/home", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    // 1. lang выставлен
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(["ru", "ar"], "html lang задан").toContain(lang);
    // 2. <img> имеют alt (или role/aria)
    const imgsNoAlt = await page.evaluate(() =>
      Array.from(document.querySelectorAll("img"))
        .filter((i) => !i.hasAttribute("alt") && !i.getAttribute("aria-label") && i.getAttribute("role") !== "presentation").length);
    expect(imgsNoAlt, "у всех img есть alt/aria").toBe(0);
    // 3. кнопки имеют доступное имя (текст/aria-label)
    const namelessBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button"))
        .filter((b) => !(b.textContent || "").trim() && !b.getAttribute("aria-label") && !b.querySelector("svg,img")).length);
    expect(namelessBtns, "у кнопок есть имя или иконка").toBe(0);
  });

  test("тач-цели в нижней навигации достаточного размера (≥40px)", async ({ page, context }) => {
    await seedAuthenticatedState(context);
    await page.goto("/home", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const navLinks = page.locator("nav a, nav button");
    const n = Math.min(await navLinks.count(), 6);
    for (let i = 0; i < n; i++) {
      const box = await navLinks.nth(i).boundingBox();
      if (box) expect(Math.min(box.width, box.height), "тач-цель ≥ 40px").toBeGreaterThanOrEqual(40);
    }
  });
});
