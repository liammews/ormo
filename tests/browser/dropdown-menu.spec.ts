import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test("Dropdown Menu demo has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/test-fixtures/browser/dropdown-menu/");
  await expectNoAxeViolations(page);
});

test("opens from the keyboard, navigates items, and restores trigger focus", async ({
  page,
}) => {
  await page.goto("/test-fixtures/browser/dropdown-menu/");
  const trigger = page.getByRole("button", { name: "Actions", exact: true });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menu", { name: "Page actions" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Duplicate" })).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("updates checkbox and radio item state", async ({ page }) => {
  await page.goto("/test-fixtures/browser/dropdown-menu/");
  const trigger = page.getByRole("button", { name: "Actions", exact: true });
  await trigger.click();
  const checkbox = page.locator("[data-ormo-dropdown-menu-checkbox-item]");
  await expect(checkbox).toHaveAttribute("aria-checked", "true");
  await checkbox.click();
  await expect(checkbox).toHaveAttribute("aria-checked", "false");

  await trigger.click();
  const compact = page.locator(
    '[data-ormo-dropdown-menu-radio-item][data-value="compact"]',
  );
  await compact.click();
  await expect(compact).toHaveAttribute("aria-checked", "true");
});

test("opens and closes a submenu with directional keys", async ({ page }) => {
  await page.goto("/test-fixtures/browser/dropdown-menu/");
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  const subTrigger = page.getByRole("menuitem", { name: "More tools" });
  await subTrigger.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("menu", { name: "More tools" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Export" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(subTrigger).toBeFocused();
});

test("closes the complete menu chain after submenu selection", async ({
  page,
}) => {
  await page.goto("/test-fixtures/browser/dropdown-menu/");
  const trigger = page.getByRole("button", { name: "Actions", exact: true });
  await trigger.click();
  const subTrigger = page.getByRole("menuitem", { name: "More tools" });
  await subTrigger.focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("menuitem", { name: "Export" }).click();
  await expect(page.getByRole("menu", { name: "Page actions" })).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("uses the opposite submenu key in RTL", async ({ page }) => {
  await page.goto("/test-fixtures/browser/dropdown-menu/");
  await page
    .locator("#page-actions")
    .evaluate((root) => root.setAttribute("dir", "rtl"));
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  const subTrigger = page.getByRole("menuitem", { name: "More tools" });
  await subTrigger.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("menu", { name: "More tools" })).toBeVisible();
});

test("keeps the menu open when selection is prevented", async ({ page }) => {
  await page.goto("/test-fixtures/browser/dropdown-menu/");
  await page.locator("#page-actions").evaluate((root) => {
    root.addEventListener("ormo:dropdown-menu-before-select", (event) =>
      event.preventDefault(),
    );
  });
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  await expect(page.getByRole("menu", { name: "Page actions" })).toBeVisible();
});

test("dismisses on an outside pointer interaction", async ({ page }) => {
  await page.goto("/test-fixtures/browser/dropdown-menu/");
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await expect(page.getByRole("menu", { name: "Page actions" })).toBeHidden();
});

test("reacts to Floating UI placement and restores managed styles", async ({
  page,
}) => {
  await page.goto("/test-fixtures/browser/dropdown-menu/");
  await page.getByRole("button", { name: "Floating actions" }).click();
  const content = page.locator("#floating-menu-content");
  await expect(content).toHaveAttribute(
    "data-ormo-dropdown-menu-positioning",
    "floating",
  );
  await expect(content).toHaveCSS("position", "fixed");
  await content.evaluate((element) => {
    element.setAttribute("data-side", "top");
    element.setAttribute("data-side-offset", "12");
  });
  await expect(content).toHaveAttribute("data-resolved-side", /top|bottom/);
  const handle = await content.elementHandle();
  await page.locator("#floating-menu").evaluate((root) => root.remove());
  expect(
    await handle!.evaluate((element) => ({
      position: element.style.position,
      positioning: element.getAttribute("data-ormo-dropdown-menu-positioning"),
      resolvedSide: element.getAttribute("data-resolved-side"),
    })),
  ).toEqual({ position: "", positioning: null, resolvedSide: null });
});
