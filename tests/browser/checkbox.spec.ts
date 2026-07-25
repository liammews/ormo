import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/docs/components/checkbox/");
});

test("toggles a standalone checkbox with Space", async ({ page }) => {
  const demo = page.locator("[data-checkbox-demo]");
  const checkbox = demo.getByRole("checkbox", {
    name: "Accept the terms and conditions",
  });

  await checkbox.focus();
  await expect(checkbox).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();
});

test("wires group name, default value, and aggregate state", async ({
  page,
}) => {
  const demo = page.locator("[data-checkbox-group-demo]");
  const group = demo.locator("ormo-checkbox-group");
  const https = demo.getByRole("checkbox", { name: "HTTPS" });

  await expect(group).toHaveAttribute("data-state", "partial");
  await expect(https).toBeChecked();
  await expect(https).toHaveAttribute("name", "protocols");
});

test("parent select-all checks and clears members", async ({ page }) => {
  const demo = page.locator("[data-checkbox-parent-demo]");
  const parent = demo.getByRole("checkbox", { name: "Select all" });
  const fuji = demo.getByRole("checkbox", { name: "Fuji" });
  const gala = demo.getByRole("checkbox", { name: "Gala" });

  await parent.click();
  await expect(fuji).toBeChecked();
  await expect(gala).toBeChecked();

  await parent.click();
  await expect(fuji).not.toBeChecked();
  await expect(gala).not.toBeChecked();
});

test("applies indeterminate after load", async ({ page }) => {
  const demo = page.locator("[data-checkbox-indeterminate-demo]");
  const checkbox = demo.getByRole("checkbox", { name: "Some selected" });

  await expect
    .poll(async () =>
      checkbox.evaluate((node) => (node as HTMLInputElement).indeterminate),
    )
    .toBe(true);
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  for (const selector of [
    "[data-checkbox-demo]",
    "[data-checkbox-indicator-demo]",
    "[data-checkbox-indeterminate-demo]",
    "[data-checkbox-group-demo]",
    "[data-checkbox-parent-demo]",
    "[data-checkbox-field-demo]",
    "[data-checkbox-disabled-demo]",
  ]) {
    const results = await new AxeBuilder({ page }).include(selector).analyze();
    expect(results.violations, selector).toEqual([]);
  }
});
