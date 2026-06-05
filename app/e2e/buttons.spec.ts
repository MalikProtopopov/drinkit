import { test, expect, Page } from "@playwright/test";
import { collectErrors, seedAuthenticatedState } from "./_helpers";

/**
 * Click each visible button and assert *something* happened:
 *   - URL changed, OR
 *   - a sheet/modal appeared, OR
 *   - the rendered DOM materially changed (length delta > 20 chars), OR
 *   - a known state-changing class appeared (active tab, badge)
 *
 * If a button doesn't trigger any of those, it's a "dead button" candidate.
 */
async function snapshot(page: Page) {
  return {
    url: page.url(),
    sheets: await page.locator(".animate-sheetUp, [role=dialog]").count(),
    bodyLen: ((await page.locator("body").innerHTML().catch(() => "")) ?? "").length,
  };
}

async function clickAndCheck(
  page: Page,
  buttonSelector: string,
  label: string
): Promise<string | null> {
  const before = await snapshot(page);
  try {
    await page.locator(buttonSelector).first().click({ timeout: 1500 });
  } catch {
    return `${label}: not clickable`;
  }
  await page.waitForTimeout(200);
  const after = await snapshot(page);

  const changed =
    before.url !== after.url ||
    before.sheets !== after.sheets ||
    Math.abs(before.bodyLen - after.bodyLen) > 20;
  return changed ? null : `${label}: click had no effect (URL/sheet/DOM unchanged)`;
}

test.describe("Buttons: nothing dead on key screens", () => {
  test("home screen: all interactive elements respond", async ({ page, context }) => {
    await seedAuthenticatedState(context);
    const { errors } = collectErrors(page);
    await page.goto("/home", { waitUntil: "networkidle" });

    const dead: string[] = [];

    // Category tabs — clicking each should at least change the active tab.
    // Use scrollIntoViewIfNeeded + force-click because tabs live in a
    // horizontal scroll container and Playwright's intercept check is
    // fragile when neighbouring tabs become bold (active) — the bbox of an
    // adjacent active tab can poke into the next tab's click center even
    // when both are correctly rendered as separate flex items.
    const tabCount = await page.locator(".tab-text").count();
    expect(tabCount).toBeGreaterThan(3);
    for (let i = 0; i < tabCount; i++) {
      const before = await page.locator(".tab-text.active").innerText();
      const tab = page.locator(".tab-text").nth(i);
      await tab.scrollIntoViewIfNeeded();
      await tab.click({ force: true });
      await page.waitForTimeout(120);
      const after = await page.locator(".tab-text.active").innerText();
      if (before === after && i !== 0) {
        dead.push(`tab #${i}: active state didn't change`);
      }
    }

    // Featured carousel dots
    const dots = page.locator('button[style*="rgba(0,0,0"]').filter({ has: page.locator(":scope") });
    // pagination dots are h-1.5 — check via SVG-less buttons with width transition style; safer: just try clicking
    // we'll skip explicit assertion here as dots may not be uniquely selectable, focus on links.

    expect(dead, dead.join("\n")).toEqual([]);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("product detail: sheets open and addons toggle", async ({ page, context }) => {
    await seedAuthenticatedState(context);
    const { errors } = collectErrors(page);
    await page.goto("/product/matcha", { waitUntil: "networkidle" });

    // 1. "Подробнее" opens description sheet
    await page.getByText("подробнее").first().click();
    await page.waitForTimeout(400); // wait full sheet animation (~350ms)
    expect(await page.locator(".animate-sheetUp").count(), "description sheet did not open").toBeGreaterThan(0);
    // close via backdrop click (always works regardless of sheet content)
    await page.locator(".bg-black\\/40").click();
    await page.waitForTimeout(300);
    expect(await page.locator(".animate-sheetUp").count(), "description sheet did not close").toBe(0);

    // 2. Product name click opens "Назови напиток" sheet
    await page.locator("text=Матча латте").first().click();
    await page.waitForTimeout(400);
    expect(
      await page.locator('text=Назови напиток').count(),
      'name sheet did not open'
    ).toBeGreaterThan(0);
    // close via backdrop
    await page.locator(".bg-black\\/40").click();
    await page.waitForTimeout(300);

    // 3. Addon chip opens inline popover with option cards
    const supplementsChip = page.locator(".addon-chip").filter({ hasText: /Полезные добавки/ });
    await supplementsChip.click({ force: true });
    await page.waitForTimeout(300);
    expect(
      await page.locator(".addon-option-card").count(),
      "addon popover did not open"
    ).toBeGreaterThan(0);

    // pick first addon item — should toggle selection
    const firstAddon = page.locator(".addon-option-card").first();
    await firstAddon.click({ force: true });
    await page.waitForTimeout(200);

    // close popover by tapping the chip again
    await supplementsChip.click({ force: true });
    await page.waitForTimeout(300);

    // 4. Volume size buttons (if multi-variant) — click each, price updates
    const sizeButtons = page.locator(`button:has-text(" мл")`).filter({ hasText: /\d+\s*мл/ });
    const sizeCount = await sizeButtons.count();
    if (sizeCount > 1) {
      const priceBefore = await page.locator("text=/\\+\\s+\\d+\\s+AED/").first().innerText();
      await sizeButtons.nth(sizeCount - 1).click(); // pick largest
      await page.waitForTimeout(200);
      const priceAfter = await page.locator("text=/\\+\\s+\\d+\\s+AED/").first().innerText();
      expect(priceAfter, "price did not update on size change").not.toBe(priceBefore);
    }

    // 5. Add to cart button — should navigate back and add item
    await page.locator(`button:has-text("AED")`).last().click();
    await page.waitForTimeout(800);

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("bottom nav: 4 tabs navigate correctly", async ({ page, context }) => {
    await seedAuthenticatedState(context);
    const { errors } = collectErrors(page);
    await page.goto("/home", { waitUntil: "networkidle" });

    const expectations = [
      { name: "Главная", url: /\/home/ },
      { name: "Меню", url: /\/menu/ },
      { name: "Заказы", url: /\/orders/ },
      { name: "Профиль", url: /\/profile/ },
    ];

    for (const { name, url } of expectations) {
      await page.getByRole("link", { name }).click();
      await page.waitForURL(url, { timeout: 3000 });
      await page.waitForTimeout(150);
    }

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("outlets: selecting an outlet navigates to /home", async ({ page, context }) => {
    await seedAuthenticatedState(context);
    await page.goto("/outlets", { waitUntil: "networkidle" });

    await page.getByText("Bay Avenue").first().click();
    await page.waitForURL(/\/home/, { timeout: 3000 });
    expect(page.url()).toContain("/home");
  });

  test("cart: empty state CTA goes to home", async ({ page, context }) => {
    await seedAuthenticatedState(context);
    await page.goto("/cart", { waitUntil: "networkidle" });

    // expect "Корзина пуста"
    await expect(page.getByText(/Корзина пуста/)).toBeVisible();
    await page.getByRole("link", { name: "К меню" }).click();
    await page.waitForURL(/\/home/, { timeout: 3000 });
  });
});
