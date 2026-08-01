import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/separator/");
});

test("exposes semantic horizontal and vertical separators", async ({
  page,
}) => {
  const demo = page.locator("[data-separator-demo]");
  const horizontal = demo.getByRole("separator");
  const vertical = page.locator("[data-vertical-separator]");

  await expect(horizontal).toHaveAttribute("aria-orientation", "horizontal");
  await expect(horizontal).toHaveAttribute("data-orientation", "horizontal");
  await expect(vertical).toHaveAttribute("role", "separator");
  await expect(vertical).toHaveAttribute("aria-orientation", "vertical");
  await expect(vertical).toHaveAttribute("data-orientation", "vertical");
});

test("removes decorative separators from the accessibility tree", async ({
  page,
}) => {
  const demo = page.locator("[data-separator-demo]");
  const decorative = demo.locator('[data-orientation="vertical"]');

  await expect(decorative).toHaveAttribute("role", "none");
  await expect(decorative).not.toHaveAttribute("aria-orientation", /.+/);
  await expect(demo.getByRole("separator")).toHaveCount(1);
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await expectNoAxeViolations(page, {
    include: "[data-separator-demo], [data-separator-orientation-demo]",
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("retains separator semantics and orientation", async ({ page }) => {
    await page.goto("/test-fixtures/browser/separator/");

    await expect(page.getByRole("separator")).toHaveCount(2);
    await expect(page.locator("[data-vertical-separator]")).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
  });
});
