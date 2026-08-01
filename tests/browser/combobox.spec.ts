import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/combobox/");
});

test("filters, navigates, selects, and clears", async ({ page }) => {
  const demo = page.locator('[data-combobox-demo="default"]');
  const root = demo.locator("ormo-combobox");
  const input = demo.getByRole("combobox", { name: "Country" });
  const actions = demo.locator(".combobox-actions");
  const listbox = demo.getByRole("listbox");
  const clear = demo.getByRole("button", { name: "Clear country" });

  await expect(root).toHaveAttribute("data-enhanced", "");
  await expect(input).toHaveValue("");
  await expect(clear).toBeHidden();
  await input.fill("brit");
  await expect(actions).toHaveCSS("outline-style", "solid");
  await expect(listbox).toBeVisible();
  await expect(
    demo.getByRole("option", { name: "United Kingdom" }),
  ).toBeVisible();
  await expect(demo.getByRole("option", { name: "France" })).toBeHidden();
  const emptyWidths = await demo.evaluate((fixture) => ({
    control: fixture
      .querySelector<HTMLElement>(".combobox-actions")!
      .getBoundingClientRect().width,
    popup: fixture
      .querySelector<HTMLElement>("[data-ormo-combobox-content]")!
      .getBoundingClientRect().width,
  }));
  expect(emptyWidths.popup).toBeCloseTo(emptyWidths.control, 0);

  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(root).toHaveJSProperty("value", "gb");
  await expect(input).toHaveValue("United Kingdom");
  await expect(listbox).toBeHidden();
  await expect(input).toBeFocused();

  await demo.getByRole("button", { name: "Show countries" }).click();
  await expect(listbox).toBeVisible();
  const selectedWidths = await demo.evaluate((fixture) => ({
    control: fixture
      .querySelector<HTMLElement>(".combobox-actions")!
      .getBoundingClientRect().width,
    popup: fixture
      .querySelector<HTMLElement>("[data-ormo-combobox-content]")!
      .getBoundingClientRect().width,
  }));
  expect(selectedWidths.popup).toBeCloseTo(selectedWidths.control, 0);
  await demo.getByRole("option", { name: "United Kingdom" }).click();

  await clear.click();
  await expect(root).toHaveJSProperty("value", "");
  await expect(input).toHaveValue("");
  await expect(clear).toBeHidden();
});

test("filters by aliases and shows an empty result", async ({ page }) => {
  const demo = page.locator('[data-combobox-demo="default"]');
  const input = demo.getByRole("combobox", { name: "Country" });

  await input.fill("French Republic");
  await expect(demo.getByRole("option", { name: "France" })).toBeVisible();

  await input.fill("nowhere");
  await expect(demo.getByText("No countries found.")).toBeVisible();
  await expect(demo.locator("[data-ormo-combobox-item]")).toHaveCount(4);
  await expect(demo.getByRole("option", { name: "France" })).toBeHidden();
});

test("toggle preserves input focus and selected-item activation closes", async ({
  page,
}) => {
  const demo = page.locator('[data-combobox-demo="default"]');
  const input = demo.getByRole("combobox", { name: "Country" });
  const toggle = demo.getByRole("button", { name: "Show countries" });
  const listbox = demo.getByRole("listbox");

  await input.focus();
  await toggle.click();
  await expect(input).toBeFocused();
  await expect(listbox).toBeVisible();
  await demo.getByRole("option", { name: "France" }).click();
  await expect(listbox).toBeHidden();
});

test("Escape restores the committed label and Tab dismisses", async ({
  page,
}) => {
  const demo = page.locator('[data-combobox-demo="default"]');
  const input = demo.getByRole("combobox", { name: "Country" });
  const listbox = demo.getByRole("listbox");

  await input.fill("can");
  await input.press("Escape");
  await expect(input).toHaveValue("");
  await expect(listbox).toBeHidden();

  await input.fill("brit");
  await input.press("Tab");
  await expect(listbox).toBeHidden();
  await expect(input).toHaveValue("");
});

test("participates in required form validation and submission", async ({
  page,
}) => {
  const demo = page.locator('[data-combobox-demo="form"]');
  const input = demo.getByRole("combobox", { name: "Timezone" });
  const submit = demo.getByRole("button", { name: "Continue" });
  const error = demo.getByText("Choose a timezone.");
  const result = demo.locator("[data-combobox-result]");

  await submit.click();
  await expect(input).toBeFocused();
  await expect(error).toBeVisible();

  await input.fill("london");
  await expect(demo.getByRole("listbox")).toHaveAttribute(
    "data-ormo-combobox-positioning",
    "floating",
  );
  await expect(demo.getByRole("listbox")).toHaveAttribute(
    "data-resolved-side",
    /^(top|bottom|left|right)$/,
  );
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(error).toBeHidden();
  await submit.click();
  await expect(result).toHaveText("Selected: europe-london");
});

test("has no accessibility violations when closed, filtered, or empty", async ({
  page,
}) => {
  const demo = page.locator('[data-combobox-demo="default"]');
  const input = demo.getByRole("combobox", { name: "Country" });
  await expectNoAxeViolations(page, {
    include: '[data-combobox-demo="default"]',
    label: "closed combobox",
  });
  await input.fill("brit");
  await expectNoAxeViolations(page, {
    include: '[data-combobox-demo="default"]',
    label: "filtered combobox",
  });
  await input.fill("nowhere");
  await expectNoAxeViolations(page, {
    include: '[data-combobox-demo="default"]',
    label: "empty combobox",
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the server-rendered native fallback usable", async ({ page }) => {
    const demo = page.locator('[data-combobox-demo="default"]');
    const control = demo.locator("[data-ormo-combobox-control]");
    await expect(demo.locator("ormo-combobox")).not.toHaveAttribute(
      "data-enhanced",
      "",
    );
    await expect(control).toBeVisible();
    await expect(control).toHaveValue("");
    await control.selectOption("gb");
    await expect(control).toHaveValue("gb");
  });
});
