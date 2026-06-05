import { test, expect } from "@playwright/test";
import { STATIC_ROUTES, seedAuthenticatedState } from "./_helpers";

test.describe("Links: all <a href> on key screens point to valid routes", () => {
  for (const route of ["/home", "/menu", "/cart", "/orders", "/profile", "/outlets"]) {
    test(`all links on ${route} return 200`, async ({ page, context, request }) => {
      await seedAuthenticatedState(context);
      await page.goto(route, { waitUntil: "networkidle" });

      const hrefs = await page.locator('a[href^="/"]').evaluateAll((els) =>
        Array.from(
          new Set(
            els
              .map((a) => (a as HTMLAnchorElement).getAttribute("href"))
              .filter(Boolean) as string[]
          )
        )
      );

      const broken: { href: string; status: number }[] = [];
      for (const href of hrefs) {
        if (href.startsWith("//") || href.startsWith("http")) continue;
        const res = await request.get(href);
        if (res.status() >= 400) broken.push({ href, status: res.status() });
      }

      expect(broken, `broken links on ${route}:\n${JSON.stringify(broken, null, 2)}`).toEqual([]);
    });
  }
});
