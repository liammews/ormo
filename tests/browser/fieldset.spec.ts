import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/docs/components/fieldset/");
});

test("renders a native labelled group with native controls", async ({
  page,
}) => {
  const demo = page.locator("[data-fieldset-demo]");
  const group = demo.getByRole("group", {
    name: "Preferred contact method",
  });

  await expect(group).toHaveAttribute("data-ormo-fieldset-root", "");
  await expect(group.locator("legend[data-ormo-fieldset-legend]")).toHaveText(
    "Preferred contact method",
  );
  await expect(demo.getByRole("radio", { name: /Email/ })).toBeChecked();
});

test("uses native disabled cascading and the first legend exception", async ({
  page,
}) => {
  await page.evaluate(() => {
    const fieldset = document.createElement("fieldset");
    fieldset.dataset.fieldsetDisabledFixture = "";
    fieldset.disabled = true;
    fieldset.innerHTML = `
      <legend><label><input type="checkbox"> Edit options</label></legend>
      <label><input type="text"> Instructions</label>
    `;
    document.body.append(fieldset);
  });

  const fixture = page.locator("[data-fieldset-disabled-fixture]");
  await expect(
    fixture.getByRole("checkbox", { name: "Edit options" }),
  ).toBeEnabled();
  await expect(
    fixture.getByRole("textbox", { name: "Instructions" }),
  ).toBeDisabled();
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  const results = await new AxeBuilder({ page })
    .include("[data-fieldset-demo]")
    .analyze();
  expect(results.violations).toEqual([]);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("retains native grouping and checked state", async ({ page }) => {
    await page.goto("/docs/components/fieldset/");

    const demo = page.locator("[data-fieldset-demo]");
    await expect(
      demo.getByRole("group", { name: "Preferred contact method" }),
    ).toBeVisible();
    await expect(demo.getByRole("radio", { name: /Email/ })).toBeChecked();
  });
});
