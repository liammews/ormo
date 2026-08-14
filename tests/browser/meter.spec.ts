import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/meter/");
});

test("exposes native meter range and value semantics", async ({ page }) => {
  const meter = page.getByRole("meter", { name: "Storage used" });

  await expect(meter).toHaveAttribute("data-ormo-meter", "");
  await expect(meter).toHaveAttribute("aria-valuetext", "72 gigabytes used");
  await expect
    .poll(() =>
      meter.evaluate((element: HTMLMeterElement) => ({
        high: element.high,
        low: element.low,
        max: element.max,
        min: element.min,
        optimum: element.optimum,
        value: element.value,
      })),
    )
    .toEqual({ high: 80, low: 25, max: 100, min: 0, optimum: 40, value: 72 });
});

test("uses native browser normalisation without a component runtime", async ({
  page,
}) => {
  const meter = page.getByRole("meter", { name: "Storage used" });

  await meter.evaluate((element: HTMLMeterElement) => {
    element.value = 140;
    element.low = -20;
    element.high = 120;
  });

  await expect
    .poll(() =>
      meter.evaluate((element: HTMLMeterElement) => ({
        high: element.high,
        low: element.low,
        value: element.value,
      })),
    )
    .toEqual({ high: 100, low: 0, value: 100 });
});

test("supports dynamic value, threshold, and value-text updates", async ({
  page,
}) => {
  const meter = page.getByRole("meter", { name: "Signal strength" });

  await page.getByRole("button", { name: "Improve signal" }).click();

  await expect(meter).toHaveAttribute("aria-valuetext", "Strong");
  await expect
    .poll(() =>
      meter.evaluate((element: HTMLMeterElement) => ({
        high: element.high,
        low: element.low,
        optimum: element.optimum,
        value: element.value,
      })),
    )
    .toEqual({ high: 3, low: 1, optimum: 5, value: 4 });
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await expectNoAxeViolations(page, {
    include: '[data-browser-fixture="meter"]',
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("retains native meter semantics", async ({ page }) => {
    const meter = page.getByRole("meter", { name: "Storage used" });

    await expect(meter).toHaveAttribute("value", "72");
    await expect(meter).toHaveAttribute("min", "0");
    await expect(meter).toHaveAttribute("max", "100");
    await expect(meter).toHaveAttribute("low", "25");
    await expect(meter).toHaveAttribute("high", "80");
    await expect(meter).toHaveAttribute("optimum", "40");
  });
});
