import { test, expect } from "@playwright/test";
import { collectErrors, seedCleanState } from "./_helpers";

// Полный путь заказа против РЕАЛЬНОГО каталога (соки), generic-селекторы:
// первый товар на /home, первый чип-добавка, обработка отключённого OTP, числовой id заказа.
test.describe("Golden path: full order from splash to ready", () => {
  test("user can complete a full order", async ({ page, context }) => {
    await seedCleanState(context);
    const { errors } = collectErrors(page);

    // 1. Splash → onboarding
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/onboarding/, { timeout: 4000 });

    // 2. Три слайда онбординга
    await page.getByRole("button", { name: "Дальше" }).click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Дальше" }).click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Начать" }).click();
    await page.waitForURL(/\/outlets/, { timeout: 4000 });

    // 3. Выбор точки
    await page.getByText("Bay Avenue").first().click();
    await page.waitForURL(/\/home/, { timeout: 4000 });

    // 4. Открыть ПЕРВЫЙ реальный товар (generic)
    const firstProduct = page.locator('a[href^="/product/"]').first();
    await expect(firstProduct).toBeVisible({ timeout: 8000 });
    const href = await firstProduct.getAttribute("href");
    await firstProduct.click();
    await page.waitForURL(new RegExp(href!.replace(/[/]/g, "\\/")), { timeout: 4000 });

    // 5. Размер (если есть варианты — у соков обычно нет)
    const sizeButtons = page.locator("button").filter({ hasText: /\d+\s*мл/ });
    if ((await sizeButtons.count()) > 1) {
      await sizeButtons.last().click();
      await page.waitForTimeout(200);
    }

    // 6. Первая категория добавок → первая опция (если есть)
    const chip = page.getByRole("button", { name: /Травы и специи/ });
    if ((await chip.count()) > 0) {
      await chip.click({ force: true });
      await page.waitForTimeout(300);
      const opt = page.locator(".animate-popoverUp button").first();
      if ((await opt.count()) > 0) {
        await opt.click({ force: true });
        await page.waitForTimeout(200);
        await chip.click({ force: true }); // закрыть
        await page.waitForTimeout(300);
      }
    }

    // 7. В корзину
    await page.locator('button.btn-primary:has-text("AED")').first().click({ force: true });
    await page.waitForTimeout(900);

    // 8. Корзина не пуста (есть кнопка «Оформить»)
    await page.goto("/cart", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /Оформить/ })).toBeVisible({ timeout: 5000 });

    // 9. «Оформить» (не авторизован) → /auth/phone
    await page.getByRole("button", { name: /Оформить/ }).click();
    await page.waitForURL(/\/auth\/phone/, { timeout: 4000 });

    // 10. Телефон через numpad
    for (const d of "501234567") {
      await page.getByRole("button", { name: d, exact: true }).click();
    }
    await page.getByRole("button", { name: /Получить код/ }).click();

    // 11. После «Получить код» исход зависит от OTP и существования пользователя:
    //     /auth/otp (OTP вкл) | /auth/name (новый) | /checkout|/home (существующий, OTP выкл)
    await page.waitForURL(/\/(auth\/otp|auth\/name|checkout|home)/, { timeout: 6000 });
    if (page.url().includes("/auth/otp")) {
      const otp = page.locator("input[autocomplete='one-time-code']");
      if ((await otp.count()) > 0) await otp.fill("1836");
      await page.waitForURL(/\/(auth\/name|checkout|home)/, { timeout: 5000 });
    }
    if (page.url().includes("/auth/name")) {
      await page.getByPlaceholder("Как тебя зовут?").fill("Мак");
      await page.getByRole("button", { name: /Зовите меня так/ }).click();
      await page.waitForURL(/\/(checkout|home)/, { timeout: 5000 });
    }

    // 13. Гарантированно дойти до /checkout
    if (!page.url().includes("/checkout")) {
      await page.goto("/cart", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /Оформить/ }).click();
      await page.waitForURL(/\/checkout/, { timeout: 5000 });
    }

    // 14. Имя + номер машины → к оплате
    const coName = page.getByPlaceholder("Как тебя зовут?");
    if ((await coName.count()) > 0) await coName.fill("Мак");
    await page.locator('input[placeholder="O 12345"]').fill("F 88888");
    await page.getByRole("button", { name: /Перейти к оплате/ }).click();
    await page.waitForURL(/\/payment/, { timeout: 5000 });

    // 15. Оплата (mock Stripe) → /orders/<число>
    await page.getByRole("button", { name: /Оплатить через Stripe/ }).click();
    await page.waitForURL(/\/orders\/\d+/, { timeout: 8000 });

    // 16. Страница заказа отрисована (есть номер/статус)
    await expect(page.getByText(/Заказ|оплач|Готов|Принят|статус/i).first()).toBeVisible({ timeout: 8000 });

    expect(errors, "Errors during full flow:\n" + errors.join("\n")).toEqual([]);
  });
});
