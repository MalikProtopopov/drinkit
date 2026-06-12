import { test, expect, Page } from "@playwright/test";
import { collectErrors } from "./_helpers";

// Админка под реальным API (локальный стек). Логин dev-доступами, проклик экранов и ключевых кнопок.
async function login(page: Page) {
  await page.goto("/admin/login", { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill("admin@juicy.ae");
  await page.locator('input[type="password"]').fill("admin123");
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL(/\/admin(\/|$)(?!login)/, { timeout: 8000 });
  await page.waitForLoadState("networkidle");
  // гарантируем, что staff-токен записан до дальнейшей навигации (иначе гард редиректит на login)
  await page.waitForFunction(() => !!localStorage.getItem("juicy-staff-token"), null, { timeout: 5000 });
}

test.describe("Admin: рендер и кнопки на реальных данных", () => {
  test("login → dashboard", async ({ page }) => {
    const { errors } = collectErrors(page);
    await login(page);
    // дашборд: какие-то метрики/цифры
    await expect(page.locator("body")).toContainText(/Выручка|Заказ|Дашборд|Метрик|AED|период|сегодня/i);
    expect(errors, errors.join("\n")).toEqual([]);
  });

  const SCREENS: { path: string; expect: RegExp }[] = [
    { path: "/admin/orders", expect: /Заказ|Фильтр|Взять|Все|Новые|пусто/i },
    { path: "/admin/customers", expect: /Клиент|Телефон|Имя|пусто/i },
    { path: "/admin/payments", expect: /Платеж|Сумма|Stripe|пусто/i },
    { path: "/admin/coupons", expect: /Купон|Скидк|пусто/i },
    { path: "/admin/staff", expect: /Персонал|Менеджер|email|Добавить|пусто/i },
    { path: "/admin/catalog/categories", expect: /Категори|Добавить|Фреши|Смузи/i },
    { path: "/admin/catalog/products", expect: /Напит|Апельсин|Добавить|статус/i },
    { path: "/admin/catalog/addons", expect: /Добавк|Имбирь|Мята|Добавить/i },
    { path: "/admin/catalog/groups", expect: /Категори|Единиц|Добавить|выбор/i },
    { path: "/admin/outlets", expect: /Точк|меню|наличи/i },
  ];

  for (const s of SCREENS) {
    test(`экран ${s.path} рендерится с реальными данными`, async ({ page }) => {
      const { errors } = collectErrors(page);
      await login(page);
      await page.goto(s.path, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      await expect(page.locator("body"), `нет ожидаемого контента на ${s.path}`).toContainText(s.expect, { timeout: 6000 });
      // нет «пустого экрана»: есть интерактивные элементы
      expect(await page.locator("button, a").count(), `нет кнопок/ссылок на ${s.path}`).toBeGreaterThan(0);
      expect(errors, `console errors на ${s.path}:\n` + errors.join("\n")).toEqual([]);
    });
  }

  test("orders: фильтры кликаются", async ({ page }) => {
    const { errors } = collectErrors(page);
    await login(page);
    await page.goto("/admin/orders", { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    // кликаем по фильтр-кнопкам (если есть) — не должны ронять страницу
    const filters = page.locator('button:has-text("Новые"), button:has-text("Все"), button:has-text("Активные"), button:has-text("Готов")');
    const n = Math.min(await filters.count(), 4);
    for (let i = 0; i < n; i++) { await filters.nth(i).click().catch(() => {}); await page.waitForTimeout(250); }
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
