import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/docs/components/tooltip/");
});

test("opens on focus, exposes aria-describedby, and dismisses with Escape", async ({
  page,
}) => {
  const demo = page.locator('[data-tooltip-demo="default"]');
  const trigger = demo.getByRole("button", { name: "Bold" });
  const tooltip = page.getByRole("tooltip", { name: "Bold" });

  await trigger.focus();
  await expect(tooltip).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-describedby", /.+/);
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(tooltip).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).not.toHaveAttribute("aria-describedby");
});

test("opens on hover after delay and stays open over content", async ({
  page,
}) => {
  const demo = page.locator('[data-tooltip-demo="default"]');
  const trigger = demo.getByRole("button", { name: "Bold" });
  const tooltip = page.getByRole("tooltip", { name: "Bold" });

  await trigger.hover();
  await expect(tooltip).toBeVisible({ timeout: 2000 });

  await tooltip.hover();
  await expect(tooltip).toBeVisible();

  await page.mouse.move(0, 0);
  await expect(tooltip).toBeHidden();
});

test("supports detached triggers", async ({ page }) => {
  const demo = page.locator('[data-tooltip-demo="detached"]');
  const save = demo.getByRole("button", { name: "Save", exact: true });
  const draft = demo.getByRole("button", { name: "Save draft" });
  const tooltip = page.getByRole("tooltip", { name: "Save document" });

  await expect(save).toHaveAttribute("data-ormo-tooltip-for", "save-tooltip");

  await save.focus();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tooltip).toBeHidden();

  await draft.focus();
  await expect(tooltip).toBeVisible();
});

test("positions with Floating UI and preserves requested side", async ({
  page,
}) => {
  const demo = page.locator('[data-tooltip-demo="floating"]');
  const trigger = demo.getByRole("button", { name: "Floating UI" });
  const content = demo.locator("[data-ormo-tooltip-content]");

  await trigger.focus();
  await expect(content).toBeVisible();
  await expect(content).toHaveAttribute("data-side", "bottom");
  await expect(content).toHaveAttribute("data-align", "start");
  await expect(content).toHaveAttribute(
    "data-ormo-tooltip-positioning",
    "floating",
  );
  await expect(content).toHaveAttribute("data-resolved-side", /.+/);

  await page.keyboard.press("Escape");
  await expect(content).toBeHidden();
  await expect(content).not.toHaveAttribute("data-ormo-tooltip-positioning");
});

test("has no critical accessibility violations on the docs page", async ({
  page,
}) => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(
    results.violations.filter((violation) => violation.impact === "critical"),
  ).toEqual([]);
});
