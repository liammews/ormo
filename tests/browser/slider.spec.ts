import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/slider/");
});

test("uses native keyboard input and updates range geometry", async ({
  page,
}) => {
  const root = page.locator("[data-single-slider] [data-ormo-slider-root]");
  const thumb = page.getByRole("slider", { name: "Volume" });

  await thumb.focus();
  await page.keyboard.press("ArrowRight");

  await expect(thumb).toHaveValue("40");
  await expect(root).toHaveAttribute("data-value", "[40]");
  await expect(root).toHaveCSS("--ormo-slider-start", "0%");
  await expect(root).toHaveCSS("--ormo-slider-end", "40%");
});

test("uses native pointer input", async ({ page }) => {
  const thumb = page.getByRole("slider", { name: "Volume" });
  const bounds = await thumb.boundingBox();
  expect(bounds).not.toBeNull();

  await page.mouse.click(
    bounds!.x + bounds!.width * 0.7,
    bounds!.y + bounds!.height / 2,
  );

  await expect(thumb).toHaveValue("70");
});

test("coordinates ordered range thumbs and submits repeated values", async ({
  page,
}) => {
  const form = page.locator("[data-range-form]");
  const minimum = page.getByRole("slider", { name: "Minimum price" });
  const maximum = page.getByRole("slider", { name: "Maximum price" });

  await minimum.focus();
  await page.keyboard.press("End");
  await expect(minimum).toHaveValue("80");
  await expect(minimum).toHaveAttribute("max", "100");
  await expect(maximum).toHaveAttribute("min", "0");
  await expect
    .poll(() =>
      form.evaluate((element: HTMLFormElement) =>
        new FormData(element).getAll("price"),
      ),
    )
    .toEqual(["80", "80"]);

  await page.getByRole("button", { name: "Reset price" }).click();
  await expect(minimum).toHaveValue("20");
  await expect(maximum).toHaveValue("80");
});

test("reports a controlled request without changing the rendered value", async ({
  page,
}) => {
  const root = page.locator("[data-controlled-slider] [data-ormo-slider-root]");
  const thumb = page.getByRole("slider", { name: "Controlled value" });

  await thumb.focus();
  await page.keyboard.press("ArrowRight");

  await expect(root).toHaveAttribute("data-requested-value", "[50]");
  await expect(root).toHaveAttribute("data-value", "[40]");
  await expect(thumb).toHaveValue("40");
});

test("retains native RTL and vertical arrow behaviour", async ({ page }) => {
  const rtl = page.getByRole("slider", { name: "RTL value" });
  await rtl.focus();
  await page.keyboard.press("ArrowRight");
  await expect(rtl).toHaveValue("20");

  const vertical = page.getByRole("slider", { name: "Vertical value" });
  await vertical.focus();
  await page.keyboard.press("ArrowUp");
  await expect(vertical).toHaveValue("40");
  await expect(vertical).toHaveAttribute("aria-orientation", "vertical");
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await expectNoAxeViolations(page, {
    include: '[data-browser-fixture="slider"]',
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps native range inputs operable and submittable", async ({
    page,
  }) => {
    const minimum = page.getByRole("slider", { name: "Minimum price" });
    const form = page.locator("[data-range-form]");

    await minimum.focus();
    await page.keyboard.press("ArrowRight");
    await expect(minimum).toHaveValue("25");
    await expect
      .poll(() =>
        form.evaluate((element: HTMLFormElement) =>
          new FormData(element).getAll("price"),
        ),
      )
      .toEqual(["25", "80"]);
  });
});
