import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/breadcrumbs/");
});

test("exposes a labelled breadcrumb landmark with the current page", async ({
  page,
}) => {
  const demo = page.locator('[data-breadcrumbs-demo="default"]');
  const nav = demo.getByRole("navigation", { name: "Breadcrumb" });
  await expect(nav).toBeVisible();

  const list = nav.locator("ol");
  await expect(list).toBeVisible();

  const current = nav.locator('[aria-current="page"]');
  await expect(current).toHaveText("Components");
  await expect(current).toHaveAttribute("data-ormo-breadcrumbs-page", "");
});

test("keeps separators out of the accessibility tree", async ({ page }) => {
  const demo = page.locator('[data-breadcrumbs-demo="default"]');
  const nav = demo.getByRole("navigation", { name: "Breadcrumb" });
  const separators = demo.locator("[data-ormo-breadcrumbs-separator]");

  await expect(separators.first()).toHaveAttribute("aria-hidden", "true");
  await expect(separators.first()).toHaveAttribute("role", "presentation");
  await expect(nav).toMatchAriaSnapshot(`
    - navigation "Breadcrumb":
      - list:
        - listitem:
          - link "Home":
            - /url: /books
        - listitem:
          - link "Docs":
            - /url: /books/sciencefiction
        - listitem: Components
  `);
});

test("annotates microdata when enabled", async ({ page }) => {
  const demo = page.locator('[data-breadcrumbs-demo="microdata"]');
  const nav = demo.locator("[data-ormo-breadcrumbs-root][data-microdata]");
  await expect(nav).toHaveCount(1);

  const list = nav.locator("[data-ormo-breadcrumbs-list]");
  await expect(list).toHaveAttribute(
    "itemtype",
    "https://schema.org/BreadcrumbList",
  );
  await expect(
    list.locator('meta[itemprop="position"][content="1"]'),
  ).toHaveCount(1);
  await expect(
    list.locator('meta[itemprop="position"][content="3"]'),
  ).toHaveCount(1);
});

test("has no accessibility violations in demos", async ({ page }) => {
  for (const demo of ["default", "current-link", "microdata", "labelled-by"]) {
    const results = await new AxeBuilder({ page })
      .include(`[data-breadcrumbs-demo="${demo}"]`)
      .analyze();
    expect(results.violations, demo).toEqual([]);
  }
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still renders the trail and microdata from SSR", async ({ page }) => {
    await page.goto("/test-fixtures/browser/breadcrumbs/");

    const demo = page.locator('[data-breadcrumbs-demo="default"]');
    const nav = demo.getByRole("navigation", { name: "Breadcrumb" });
    await expect(nav).toBeVisible();
    await expect(nav.locator('[aria-current="page"]')).toHaveText("Components");

    const microdata = page.locator('[data-breadcrumbs-demo="microdata"]');
    await expect(
      microdata.locator("[data-ormo-breadcrumbs-list]"),
    ).toHaveAttribute("itemtype", "https://schema.org/BreadcrumbList");
  });
});
