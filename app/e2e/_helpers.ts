import type { Page, BrowserContext } from "@playwright/test";

export const STATIC_ROUTES = [
  "/",
  "/onboarding",
  "/outlets",
  "/auth/phone",
  "/auth/otp",
  "/auth/name",
  "/home",
  "/menu",
  "/cart",
  "/checkout",
  "/payment",
  "/orders",
  "/profile",
];

export const PRODUCT_SLUGS = [
  "fresh-orange",
  "fresh-pineapple",
  "fresh-beet",
  "smoothie-berry",
  "smoothie-mango",
  "smoothie-green",
  "detox-celery",
  "shot-immunity",
  "cappuccino",
  "latte",
  "mocha",
  "matcha",
  "chai",
  "hot-chocolate",
  "lemonade-classic",
  "lemonade-berry",
  "croissant",
  "sandwich",
];

/**
 * Subscribe to console errors and uncaught page errors.
 * Filters out known harmless warnings.
 */
export function collectErrors(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Skip noisy Next.js dev hydration / hot-reload artefacts that aren't user-facing bugs
      if (text.includes("Failed to load resource")) return;
      if (text.includes("[Fast Refresh]")) return;
      errors.push(`CONSOLE: ${text}`);
    }
  });
  return { errors };
}

/**
 * Seed localStorage so we land directly into authorised, with-outlet state.
 * Avoids needing to walk through onboarding/auth for every test.
 */
export async function seedAuthenticatedState(context: BrowserContext) {
  // `addInitScript` runs on every page load, so guard with sessionStorage
  // to seed once and preserve in-test mutations across navigations.
  await context.addInitScript(() => {
    try {
      if (sessionStorage.getItem("__seeded")) return;
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
          cart: [],
          orders: [],
          nextOrderNumber: 1247,
        },
        version: 0,
      };
      localStorage.setItem("juicy-mvp", JSON.stringify(state));
      sessionStorage.setItem("__seeded", "1");
    } catch {
      /* localStorage unavailable on about:blank — script will run again on real page */
    }
  });
}

/** Reset persisted state to a clean slate (only on the very first page load) */
export async function seedCleanState(context: BrowserContext) {
  await context.addInitScript(() => {
    try {
      if (sessionStorage.getItem("__cleared")) return;
      localStorage.clear();
      sessionStorage.setItem("__cleared", "1");
    } catch {
      /* localStorage unavailable on about:blank */
    }
  });
}
