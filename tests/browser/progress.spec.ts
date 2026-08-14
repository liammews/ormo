import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/progress/");
});

test("exposes determinate native progress semantics and value text", async ({
  page,
}) => {
  const progress = page.getByRole("progressbar", { name: "File upload" });

  await expect(progress).toHaveAttribute("data-ormo-progress", "");
  await expect(progress).toHaveAttribute("value", "2");
  await expect(progress).toHaveAttribute("max", "5");
  await expect(progress).toHaveAttribute("aria-valuetext", "2 of 5 files");
  await expect
    .poll(() =>
      progress.evaluate((element: HTMLProgressElement) => ({
        max: element.max,
        position: element.position,
        value: element.value,
      })),
    )
    .toEqual({ max: 5, position: 0.4, value: 2 });
});

test("uses labelled indeterminate semantics without a numeric value", async ({
  page,
}) => {
  const progress = page.getByRole("progressbar", {
    name: "Preparing download",
  });

  await expect(progress).not.toHaveAttribute("value", /.+/);
  await expect
    .poll(() =>
      progress.evaluate((element: HTMLProgressElement) => element.position),
    )
    .toBe(-1);
});

test("supports dynamic determinate, indeterminate, and value-text updates", async ({
  page,
}) => {
  const progress = page.getByRole("progressbar", { name: "Data import" });

  await expect(progress).not.toHaveAttribute("value", /.+/);
  await page.getByRole("button", { name: "Set progress" }).click();
  await expect(progress).toHaveAttribute("value", "4");
  await expect(progress).toHaveAttribute("max", "10");
  await expect(progress).toHaveAttribute("aria-valuetext", "4 of 10 records");
  await expect
    .poll(() =>
      progress.evaluate((element: HTMLProgressElement) => element.position),
    )
    .toBe(0.4);

  await page.getByRole("button", { name: "Clear progress" }).click();
  await expect(progress).not.toHaveAttribute("value", /.+/);
  await expect(progress).not.toHaveAttribute("aria-valuetext", /.+/);
  await expect
    .poll(() =>
      progress.evaluate((element: HTMLProgressElement) => element.position),
    )
    .toBe(-1);
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await expectNoAxeViolations(page, {
    include: '[data-browser-fixture="progress"]',
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("retains native determinate and indeterminate semantics", async ({
    page,
  }) => {
    const determinate = page.getByRole("progressbar", { name: "File upload" });
    const indeterminate = page.getByRole("progressbar", {
      name: "Preparing download",
    });

    await expect(determinate).toHaveAttribute("value", "2");
    await expect(determinate).toHaveAttribute("max", "5");
    await expect(indeterminate).not.toHaveAttribute("value", /.+/);
  });
});
