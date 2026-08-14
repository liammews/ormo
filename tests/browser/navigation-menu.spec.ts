import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/navigation-menu");
});

test("opens one dropdown and closes with Escape", async ({ page }) => {
  const overview = page.getByRole("button", { name: "Overview" });
  await overview.click();
  await expect(overview).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: /^Introduction/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(overview).toHaveAttribute("aria-expanded", "false");
  await expect(overview).toBeFocused();
});

test("switches to a clicked trigger after hover opens another item", async ({
  page,
}) => {
  const overview = page.getByRole("button", { name: "Overview" });
  const features = page.getByRole("button", { name: "Features" });

  await overview.hover();
  await expect(overview).toHaveAttribute("aria-expanded", "true");
  await features.click();

  await expect(overview).toHaveAttribute("aria-expanded", "false");
  await expect(features).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: /^Dev Toolbar/ })).toBeVisible();
});

test("uses arrow keys between top-level controls and Tab inside content", async ({
  page,
}) => {
  const overview = page.getByRole("button", { name: "Overview" });
  const features = page.getByRole("button", { name: "Features" });
  await overview.focus();
  await page.keyboard.press("ArrowRight");
  await expect(features).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("link", { name: /^Dev Toolbar/ })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: /^Accessibility/ }),
  ).toBeFocused();
});

test("direct links retain native link semantics", async ({ page }) => {
  const about = page.getByRole("link", { name: "About" });
  await expect(about).toHaveAttribute("href", "/docs/");
});

test("positions dropdowns with Floating UI", async ({ page }) => {
  const overview = page.getByRole("button", { name: "Overview" });
  const content = page.locator("[data-ormo-navigation-menu-content]").first();

  await overview.click();
  await expect(content).toHaveAttribute(
    "data-ormo-navigation-menu-positioning",
    "floating",
  );
  await expect(content).toHaveAttribute("data-resolved-side", /.+/);
  await expect(content).toHaveCSS("position", "fixed");
});

test("positions an item that is open from initial SSR state", async ({
  page,
}) => {
  const initial = page.locator(
    "[data-initial-navigation-menu] [data-ormo-navigation-menu-content]",
  );
  await expect(initial).toHaveAttribute(
    "data-ormo-navigation-menu-positioning",
    "floating",
  );
  await expect(initial).toHaveAttribute("data-resolved-side", /.+/);
});

test("reacts to positioning changes and restores authored styles", async ({
  page,
}) => {
  const root = page.locator("[data-navigation-menu-demo] ormo-navigation-menu");
  const overview = page.getByRole("button", { name: "Overview" });
  const content = root.locator("[data-ormo-navigation-menu-content]").first();
  await content.evaluate((element) => {
    element.style.margin = "3px";
  });
  await overview.click();
  await content.evaluate((element) => {
    element.dataset.align = "end";
  });

  await root.evaluate((element) => element.removeAttribute("data-positioning"));
  await expect(content).not.toHaveAttribute(
    "data-ormo-navigation-menu-positioning",
  );
  await expect(content).toHaveCSS("margin", "3px");
});

test("uses CSS Anchor Positioning without the floating mode", async ({
  page,
}) => {
  const root = page.locator("[data-navigation-menu-demo] ormo-navigation-menu");
  const overview = page.getByRole("button", { name: "Overview" });
  const content = page.locator("[data-ormo-navigation-menu-content]").first();
  await root.evaluate((element) => element.removeAttribute("data-positioning"));

  await overview.click();

  await expect(content).not.toHaveAttribute(
    "data-ormo-navigation-menu-positioning",
  );
  await expect
    .poll(() =>
      content.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("position-anchor"),
      ),
    )
    .toMatch(/^--ormo-navigation-menu-/);
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await expectNoAxeViolations(page, {
    include: "[data-navigation-menu-demo]",
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("retains the navigation landmark and direct links", async ({ page }) => {
    await page.goto("/test-fixtures/browser/navigation-menu");
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/docs/",
    );
  });
});
