import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test("steps with buttons and disables them at boundaries", async ({ page }) => {
  await page.goto("/test-fixtures/browser/number-field/");
  const input = page.getByRole("spinbutton", { name: "Tickets" });
  const increment = page.getByRole("button", { name: "Increase tickets" });
  const decrement = page.getByRole("button", { name: "Decrease tickets" });
  await expect(input).toHaveValue("2");
  await increment.click();
  await expect(input).toHaveValue("3");
  for (let index = 0; index < 7; index += 1) await increment.click();
  await expect(input).toHaveValue("10");
  await expect(increment).toBeDisabled();
  await decrement.click();
  await expect(input).toHaveValue("9");
});

test("uses native and modifier keyboard steps", async ({ page }) => {
  await page.goto("/test-fixtures/browser/number-field/");
  const input = page.getByRole("spinbutton", { name: "Tickets" });
  await input.focus();
  await page.keyboard.press("ArrowUp");
  await expect(input).toHaveValue("3");
  await page.keyboard.press("Shift+ArrowDown");
  await expect(input).toHaveValue("0");
  await page.keyboard.press("End");
  await expect(input).toHaveValue("10");
  await page.keyboard.press("Home");
  await expect(input).toHaveValue("0");
});

test("submits and resets through the native input", async ({ page }) => {
  await page.goto("/test-fixtures/browser/number-field/");
  const input = page.getByRole("spinbutton", { name: "Tickets" });
  await input.fill("6");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.locator("#number-field-output")).toHaveText("6");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(input).toHaveValue("2");
});

test("retains out-of-range native validation", async ({ page }) => {
  await page.goto("/test-fixtures/browser/number-field/");
  const input = page.getByRole("spinbutton", { name: "Tickets" });
  await input.fill("11");
  expect(
    await input.evaluate(
      (element) => (element as HTMLInputElement).validity.rangeOverflow,
    ),
  ).toBe(true);
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/test-fixtures/browser/number-field/");
  await expectNoAxeViolations(page);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps native editing, validation, and form data", async ({ page }) => {
    await page.goto("/test-fixtures/browser/number-field/");
    const input = page.getByRole("spinbutton", { name: "Tickets" });
    await input.fill("4");
    await expect(input).toHaveAttribute("name", "tickets");
    await expect(input).toHaveAttribute("min", "0");
    await expect(input).toHaveAttribute("max", "10");
    expect(
      await input.evaluate(
        (element) => (element as HTMLInputElement).valueAsNumber,
      ),
    ).toBe(4);
  });
});
