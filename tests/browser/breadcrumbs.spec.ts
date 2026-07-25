import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/docs/components/breadcrumbs/");
});

test("exposes a labelled breadcrumb landmark with the current page", async ({
  page,
}) => {
  const nav = page.getByRole("navigation", { name: "Breadcrumb" }).first();
  await expect(nav).toBeVisible();

  const list = nav.locator("ol").first();
  await expect(list).toBeVisible();

  const current = nav.locator('[aria-current="page"]').first();
  await expect(current).toHaveText("Award Winners");
  await expect(current).toHaveAttribute("data-ormo-breadcrumbs-page", "");
});

test("keeps separators out of the accessibility tree", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: "Breadcrumb" }).first();
  const separators = nav.locator("[data-ormo-breadcrumbs-separator]");

  await expect(separators.first()).toHaveAttribute("aria-hidden", "true");
  await expect(separators.first()).toHaveAttribute("role", "presentation");
});

test("annotates microdata when enabled", async ({ page }) => {
  const microdataNav = page.locator(
    '[data-ormo-breadcrumbs-root][data-microdata]',
  );
  await expect(microdataNav).toHaveCount(1);

  const list = microdataNav.locator("[data-ormo-breadcrumbs-list]");
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

test("has no accessibility violations on the docs page", async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .include("main")
    .analyze();

  expect(results.violations).toEqual([]);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("still renders the trail and microdata from SSR", async ({ page }) => {
    await page.goto("/docs/components/breadcrumbs/");

    const nav = page.getByRole("navigation", { name: "Breadcrumb" }).first();
    await expect(nav).toBeVisible();
    await expect(nav.locator('[aria-current="page"]').first()).toHaveText(
      "Award Winners",
    );

    const microdataNav = page.locator(
      '[data-ormo-breadcrumbs-root][data-microdata]',
    );
    await expect(microdataNav.locator("[data-ormo-breadcrumbs-list]")).toHaveAttribute(
      "itemtype",
      "https://schema.org/BreadcrumbList",
    );
  });
});
