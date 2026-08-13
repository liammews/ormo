import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/tooltip/");
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

test("skips delay when moving directly between toolbar triggers", async ({
  page,
}) => {
  const demo = page.locator('[data-tooltip-demo="toolbar"]');
  const bold = demo.getByRole("button", { name: "Bold" });
  const italic = demo.getByRole("button", { name: "Italic" });
  const boldTooltip = demo.getByRole("tooltip", { name: /Bold/ });
  const italicTooltip = demo.getByRole("tooltip", { name: /Italic/ });

  await bold.hover();
  await expect(boldTooltip).toBeVisible({ timeout: 2000 });

  await italic.hover();
  await expect(italicTooltip).toBeVisible({ timeout: 500 });
  await expect(boldTooltip).toBeHidden();
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

test("has no accessibility violations when closed or open", async ({
  page,
}) => {
  const demo = page.locator('[data-tooltip-demo="default"]');

  await expectNoAxeViolations(page, {
    include: '[data-tooltip-demo="default"]',
    label: "closed tooltip",
  });

  await demo.getByRole("button").focus();
  const tooltip = demo.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  await tooltip.evaluate(async (element) => {
    await Promise.allSettled(
      element.getAnimations().map((animation) => animation.finished),
    );
  });
  await expectNoAxeViolations(page, {
    include: '[data-tooltip-demo="default"]',
    label: "open tooltip",
  });
});
