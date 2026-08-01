import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/select/");
});

test("opens, navigates, selects, clears, and restores focus", async ({
  page,
}) => {
  const demo = page.locator('[data-select-demo="default"]');
  const select = demo.locator("ormo-select");
  const trigger = demo.getByRole("combobox", { name: "Country" });
  const actions = demo.locator(".select-actions");
  const listbox = demo.getByRole("listbox");
  const clear = demo.getByRole("button", { name: "Clear country" });

  await expect(select).toHaveAttribute("data-enhanced", "");
  await expect(trigger).toHaveText(/France/);
  await expect(
    demo.locator('[data-value="fr"] [data-ormo-select-item-indicator]'),
  ).toHaveCSS("visibility", "visible");
  await expect(
    demo.locator('[data-value="gb"] [data-ormo-select-item-indicator]'),
  ).toHaveCSS("visibility", "hidden");
  await trigger.focus();
  await expect(actions).toHaveCSS("outline-style", "solid");
  await trigger.press("Enter");
  await expect(listbox).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await expect(select).toHaveJSProperty("value", "gb");
  await expect(trigger).toHaveText(/United Kingdom/);
  await expect(
    demo.locator('[data-value="gb"] [data-ormo-select-item-indicator]'),
  ).toHaveCSS("visibility", "visible");
  await expect(listbox).toBeHidden();
  await expect(trigger).toBeFocused();

  await clear.click();
  await expect(select).toHaveJSProperty("value", "");
  await expect(trigger).toHaveText(/Choose a country/);
  await expect(clear).toBeHidden();
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

test("closes when the selected item is clicked", async ({ page }) => {
  const demo = page.locator('[data-select-demo="default"]');
  const trigger = demo.getByRole("combobox", { name: "Country" });
  const listbox = demo.getByRole("listbox");

  await trigger.click();
  await demo.getByRole("option", { name: "France" }).click();

  await expect(listbox).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("opens at the trigger width when no item is selected", async ({
  page,
}) => {
  const demo = page.locator('[data-select-demo="default"]');
  const trigger = demo.getByRole("combobox", { name: "Country" });
  const clear = demo.getByRole("button", { name: "Clear country" });

  await clear.click();
  await trigger.click();

  const widths = await demo.evaluate(
    (fixture) =>
      new Promise<{ content: number; trigger: number }>((resolve) => {
        requestAnimationFrame(() => {
          resolve({
            content: fixture
              .querySelector<HTMLElement>("[data-ormo-select-content]")!
              .getBoundingClientRect().width,
            trigger: fixture
              .querySelector<HTMLElement>("[data-ormo-select-trigger]")!
              .getBoundingClientRect().width,
          });
        });
      }),
  );

  expect(widths.content).toBeCloseTo(widths.trigger, 0);
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

test("dismisses with Escape without changing the value", async ({ page }) => {
  const demo = page.locator('[data-select-demo="default"]');
  const select = demo.locator("ormo-select");
  const trigger = demo.getByRole("combobox", { name: "Country" });
  const listbox = demo.getByRole("listbox");

  await trigger.click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");

  await expect(listbox).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(select).toHaveJSProperty("value", "fr");
});

test("light-dismisses when clicking outside", async ({ page }) => {
  const demo = page.locator('[data-select-demo="default"]');
  const trigger = demo.getByRole("combobox", { name: "Country" });
  const listbox = demo.getByRole("listbox");

  await trigger.click();
  await expect(listbox).toBeVisible();
  await page.locator("body").click({ position: { x: 1, y: 1 } });

  await expect(listbox).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("participates in required form validation and submission", async ({
  page,
}) => {
  const demo = page.locator('[data-select-demo="form"]');
  const trigger = demo.getByRole("combobox", { name: "Delivery window" });
  const submit = demo.getByRole("button", { name: "Continue" });
  const result = demo.locator("[data-select-result]");
  const error = demo.getByText("Choose a delivery window.");
  const field = demo.locator(".select-field");
  const initialWidth = await field.evaluate(
    (element) => element.getBoundingClientRect().width,
  );

  await submit.click();
  await expect(trigger).toBeFocused();
  await expect(result).toHaveText("");
  await expect(error).toBeVisible();

  await trigger.press("ArrowDown");
  await trigger.press("Enter");
  await expect
    .poll(() =>
      field.evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBe(initialWidth);
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

test("has no accessibility violations when closed or open", async ({
  page,
}) => {
  const demo = page.locator('[data-select-demo="default"]');

  await expectNoAxeViolations(page, {
    include: '[data-select-demo="default"]',
    label: "closed select",
  });

  await demo.getByRole("combobox").click();
  await expect(demo.getByRole("listbox")).toBeVisible();
  await expectNoAxeViolations(page, {
    include: '[data-select-demo="default"]',
    label: "open select",
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the server-rendered native fallback usable", async ({ page }) => {
    const demo = page.locator('[data-select-demo="default"]');
    const control = demo.locator("[data-ormo-select-control]");

    await expect(demo.locator("ormo-select")).not.toHaveAttribute(
      "data-enhanced",
      "",
    );
    await expect(control).toBeVisible();
    await expect(control).toHaveValue("fr");
    await control.selectOption("gb");
    await expect(control).toHaveValue("gb");
  });
});
