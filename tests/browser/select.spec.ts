import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/select/");
});

test("opens, navigates, selects, clears, and restores focus", async ({
  page,
}) => {
  const demo = page.locator('[data-select-demo="default"]');
  const select = demo.locator("ormo-select");
  const trigger = demo.getByRole("combobox", { name: "Country" });
  const listbox = demo.getByRole("listbox");
  const clear = demo.getByRole("button", { name: "Clear country" });

  await expect(select).toHaveAttribute("data-enhanced", "");
  await expect(trigger).toHaveText(/France/);
  await trigger.click();
  await expect(listbox).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(select).toHaveJSProperty("value", "gb");
  await expect(trigger).toHaveText(/United Kingdom/);
  await expect(listbox).toBeHidden();
  await expect(trigger).toBeFocused();

  await clear.click();
  await expect(select).toHaveJSProperty("value", "");
  await expect(trigger).toHaveText(/Choose a country/);
  await expect(clear).toBeDisabled();
});

test("skips disabled options and supports typeahead", async ({ page }) => {
  const demo = page.locator('[data-select-demo="default"]');
  const select = demo.locator("ormo-select");
  const trigger = demo.getByRole("combobox", { name: "Country" });

  await trigger.press("c");
  await expect(select).toHaveJSProperty("value", "ca");

  await trigger.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(select).toHaveJSProperty("value", "ca");
});

test("closes on Tab without interrupting normal focus navigation", async ({
  page,
}) => {
  const demo = page.locator('[data-select-demo="default"]');
  const trigger = demo.getByRole("combobox", { name: "Country" });
  const clear = demo.getByRole("button", { name: "Clear country" });
  const listbox = demo.getByRole("listbox");

  await trigger.click();
  await expect(listbox).toBeVisible();
  await trigger.press("Tab");

  await expect(listbox).toBeHidden();
  await expect(clear).toBeFocused();
});

test("participates in required form validation and submission", async ({
  page,
}) => {
  const demo = page.locator('[data-select-demo="form"]');
  const trigger = demo.getByRole("combobox", { name: "Delivery window" });
  const submit = demo.getByRole("button", { name: "Continue" });
  const result = demo.locator("[data-select-result]");
  const error = demo.getByText("Choose a delivery window.");

  await submit.click();
  await expect(trigger).toBeFocused();
  await expect(result).toHaveText("");
  await expect(error).toBeVisible();

  await trigger.press("ArrowDown");
  await trigger.press("Enter");
  await expect(error).toBeHidden();
  await submit.click();
  await expect(result).toHaveText("Selected: morning");
});

test("native mode remains an unenhanced operating-system select", async ({
  page,
}) => {
  const demo = page.locator('[data-select-demo="native"]');
  const select = demo.getByRole("combobox", { name: "Country" });

  await expect(select).toHaveValue("fr");
  await expect(demo.locator("ormo-select")).toHaveCount(0);
  await select.selectOption("gb");
  await expect(select).toHaveValue("gb");
});

test("has no automatically detectable WCAG A or AA violations", async ({
  page,
}) => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
