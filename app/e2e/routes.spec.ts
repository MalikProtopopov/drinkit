import { test, expect } from "@playwright/test";
import { STATIC_ROUTES, PRODUCT_SLUGS, collectErrors, seedAuthenticatedState } from "./_helpers";

test.describe("Routes: smoke", () => {
  for (const route of STATIC_ROUTES) {
    test(`opens ${route} without console errors`, async ({ page, context }) => {
      await seedAuthenticatedState(context);
      const { errors } = collectErrors(page);

      const response = await page.goto(route, { waitUntil: "networkidle" });
      expect(response, `no response for ${route}`).toBeTruthy();
      expect(response!.status(), `bad status for ${route}`).toBeLessThan(400);

      // Give the page a moment to hydrate
      await page.waitForTimeout(300);

      expect(errors, `console errors on ${route}:\n${errors.join("\n")}`).toEqual([]);
    });
  }

  for (const slug of PRODUCT_SLUGS) {
    test(`opens /product/${slug} without console errors`, async ({ page, context }) => {
      await seedAuthenticatedState(context);
      const { errors } = collectErrors(page);

      const response = await page.goto(`/product/${slug}`, { waitUntil: "networkidle" });
      expect(response!.status()).toBe(200);
      await page.waitForTimeout(300);

      expect(errors, `console errors on /product/${slug}:\n${errors.join("\n")}`).toEqual([]);
    });
  }
});
