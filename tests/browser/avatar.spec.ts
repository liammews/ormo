import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/avatar/");
});

test("shows fallback when the image fails to load", async ({ page }) => {
  const broken = page.locator("#broken-avatar");

  await expect(broken).toHaveAttribute("data-status", "error");
  await expect(broken.locator("[data-ormo-avatar-fallback]")).toBeVisible();
  await expect(broken.locator("[data-ormo-avatar-image]")).toBeHidden();
  await expect(broken).toHaveAttribute("role", "img");
  await expect(broken).toHaveAttribute("aria-label", "Ada Lovelace");
});

test("shows a successfully loaded image and hides its fallback", async ({
  page,
}) => {
  const loaded = page.locator("#loaded-avatar");

  await expect(loaded).toHaveAttribute("data-status", "loaded");
  await expect(loaded.locator("[data-ormo-avatar-image]")).toBeVisible();
  await expect(loaded.locator("[data-ormo-avatar-fallback]")).toBeHidden();
});

test("keeps interactive wrappers named and focusable", async ({ page }) => {
  const button = page.getByRole("button", {
    name: "View Ada Lovelace's profile",
  });
  const link = page.getByRole("link", { name: "Ada Lovelace's profile" });

  await button.focus();
  await expect(button).toBeFocused();

  await link.focus();
  await expect(link).toBeFocused();
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await expectNoAxeViolations(page, { include: "main" });
});
