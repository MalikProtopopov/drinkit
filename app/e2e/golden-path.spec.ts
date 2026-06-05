import { test, expect } from "@playwright/test";
import { collectErrors, seedCleanState } from "./_helpers";

test.describe("Golden path: full order from splash to ready", () => {
  test("user can complete a full order", async ({ page, context }) => {
    await seedCleanState(context);
    const { errors } = collectErrors(page);

    // 1. Splash → onboarding redirect
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/onboarding/, { timeout: 3000 });

    // 2. Walk through 3 onboarding slides
    await page.getByRole("button", { name: "Дальше" }).click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Дальше" }).click();
    await page.waitForTimeout(200);
    await page.getByRole("button", { name: "Начать" }).click();
    await page.waitForURL(/\/outlets/, { timeout: 3000 });

    // 3. Pick an outlet
    await page.getByText("Bay Avenue").first().click();
    await page.waitForURL(/\/home/, { timeout: 3000 });

    // 4. Open a product (Матча латте in popular)
    await expect(page.getByText("Матча латте").first()).toBeVisible();
    await page.locator('a[href="/product/matcha"]').first().click();
    await page.waitForURL(/\/product\/matcha/, { timeout: 3000 });

    // 5. Pick the L variant
    const sizeButtons = page.locator(`button:has-text(" мл")`).filter({ hasText: /\d+\s*мл/ });
    const sizeCount = await sizeButtons.count();
    if (sizeCount > 1) {
      await sizeButtons.nth(sizeCount - 1).click();
      await page.waitForTimeout(200);
    }

    // 6. Open Полезные добавки popover, pick first option
    const supplementsChip = page.locator(".addon-chip").filter({ hasText: /Полезные добавки/ });
    await supplementsChip.click({ force: true });
    await page.waitForTimeout(300);
    const firstAddon = page.locator(".addon-option-card").first();
    await firstAddon.click({ force: true });
    await page.waitForTimeout(200);
    // close popover by tapping chip again
    await supplementsChip.click({ force: true });
    await page.waitForTimeout(300);

    // 7. Add to cart
    const addBtn = page.locator(`button.btn-primary:has-text("AED")`).first();
    await addBtn.click({ force: true });
    await page.waitForTimeout(900); // toast + redirect back

    // 8. Open cart
    await page.goto("/cart", { waitUntil: "networkidle" });
    await page.waitForURL(/\/cart/, { timeout: 3000 });
    await expect(page.getByText("Матча латте")).toBeVisible();

    // 9. Checkout button -> /auth/phone (not authorised)
    await page.getByRole("button", { name: /Оформить/ }).click();
    await page.waitForURL(/\/auth\/phone/, { timeout: 3000 });

    // 10. Enter phone via numpad
    for (const d of "501234567") {
      await page.getByRole("button", { name: d, exact: true }).click();
    }
    await page.getByRole("button", { name: /Получить код/ }).click();
    await page.waitForURL(/\/auth\/otp/, { timeout: 3000 });

    // 11. OTP — wait for auto-fill (1836) which we set in OtpPage, or type manually
    await page.waitForTimeout(2500);
    // Auto-fill happens via setTimeout. Should have navigated by now.
    // Fallback: type manually
    if (page.url().includes("/auth/otp")) {
      const otpInput = page.locator("input[autocomplete='one-time-code']");
      await otpInput.fill("1836");
      await page.waitForTimeout(600);
    }
    await page.waitForURL(/\/auth\/name/, { timeout: 5000 });

    // 12. Name
    await page.getByPlaceholder("Как тебя зовут?").fill("Мак");
    await page.getByRole("button", { name: /Зовите меня так/ }).click();
    await page.waitForURL(/\/home/, { timeout: 3000 });

    // 13. Cart still has the item — go to it
    await page.goto("/cart", { waitUntil: "networkidle" });
    await page.waitForURL(/\/cart/, { timeout: 3000 });

    // 14. Checkout again — now authorised, goes straight to /checkout
    await page.getByRole("button", { name: /Оформить/ }).click();
    await page.waitForURL(/\/checkout/, { timeout: 3000 });

    // 15. Fill car plate
    await page.locator('input[placeholder="O 12345"]').fill("F 88888");
    await page.getByRole("button", { name: /Перейти к оплате/ }).click();
    await page.waitForURL(/\/payment/, { timeout: 3000 });

    // 16. Pay (card mock)
    await page.getByText("Банковская карта").click();
    await page.waitForURL(/\/orders\/ord-/, { timeout: 5000 });

    // 17. Status starts at PAID; should auto-progress
    // Wait for "Готовим напиток" or "Готов" to appear (ACCEPTED → PREPARING)
    await expect(page.getByText(/Готовим|Готов/).first()).toBeVisible({ timeout: 12000 });

    expect(errors, "Errors during full flow:\n" + errors.join("\n")).toEqual([]);
  });
});
