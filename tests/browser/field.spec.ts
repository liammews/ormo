import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/docs/components/field/");
});

test("wires the default field label, description, and validation", async ({
  page,
}) => {
  const demo = page.locator("[data-field-demo]");
  const field = demo.locator("ormo-field").first();
  const input = demo.getByRole("textbox", { name: "Email address" });
  const description = demo.locator("#field-default-demo-description");

  await expect(field).toHaveAttribute("name", "email");
  await expect(input).toHaveAttribute("required", "");
  await expect(input).toHaveAttribute("name", "email");
  await expect(description).toBeVisible();

  await input.focus();
  await input.blur();

  await expect(field).toHaveAttribute("data-invalid", "");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(field.getByRole("alert")).toHaveText("Enter your email address.");
});

test("exposes the intentional error demo to assistive tech", async ({
  page,
}) => {
  const demo = page.locator("[data-field-error-demo]");
  const input = demo.getByRole("textbox", { name: "Email address" });

  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(demo.getByRole("alert")).toBeVisible();
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  let results = await new AxeBuilder({ page })
    .include("[data-field-demo]")
    .analyze();
  expect(results.violations).toEqual([]);

  results = await new AxeBuilder({ page })
    .include("[data-field-error-demo]")
    .analyze();
  expect(results.violations).toEqual([]);

  results = await new AxeBuilder({ page })
    .include("[data-field-disabled-demo]")
    .analyze();
  expect(results.violations).toEqual([]);
});
