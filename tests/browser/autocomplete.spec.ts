import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/autocomplete/");
});

test("filters, selects, submits freeform text, and clears", async ({
  page,
}) => {
  const demo = page.locator('[data-autocomplete-demo="default"]');
  const root = demo.locator("ormo-autocomplete");
  const input = demo.getByRole("combobox", { name: "Location" });
  const clear = demo.getByRole("button", { name: "Clear location" });
  const listbox = demo.getByRole("listbox");

  await expect(root).toHaveAttribute("data-enhanced", "");
  await expect(clear).toBeHidden();
  await input.fill("par");
  await expect(listbox).toBeVisible();
  await expect(demo.getByRole("option", { name: "Paris" })).toBeVisible();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(input).toHaveValue("Paris");
  await expect(root).toHaveJSProperty("value", "Paris");
  await expect(clear).toBeVisible();
  await clear.click();
  await expect(input).toHaveValue("");
  await expect(clear).toBeHidden();
});

test("dismissal retains unmatched freeform text", async ({ page }) => {
  const demo = page.locator('[data-autocomplete-demo="default"]');
  const input = demo.getByRole("combobox", { name: "Location" });
  await input.fill("My own place");
  await input.press("Escape");
  await expect(input).toHaveValue("My own place");
  await expect(demo.getByRole("listbox")).toBeHidden();
});

test("disabling while open closes and prevents pointer selection", async ({
  page,
}) => {
  const demo = page.locator('[data-autocomplete-demo="default"]');
  const root = demo.locator("ormo-autocomplete");
  const input = demo.getByRole("combobox", { name: "Location" });
  await input.fill("par");
  await expect(demo.getByRole("listbox")).toBeVisible();
  await root.evaluate((element) => {
    (element as HTMLElement & { disabled: boolean }).disabled = true;
  });
  await expect(demo.getByRole("listbox")).toBeHidden();
  await expect(input).toBeDisabled();
  await demo
    .locator('[data-ormo-autocomplete-item][data-value="Paris"]')
    .evaluate((item) => {
      (item as HTMLElement).click();
    });
  await expect(input).toHaveValue("par");
});

test("readonly blocks opening, selection, and clearing", async ({ page }) => {
  const demo = page.locator('[data-autocomplete-demo="default"]');
  const root = demo.locator("ormo-autocomplete");
  const input = demo.getByRole("combobox", { name: "Location" });
  await input.fill("par");
  await root.evaluate((element) => {
    (element as HTMLElement & { readOnly: boolean }).readOnly = true;
  });
  await expect(demo.getByRole("listbox")).toBeHidden();
  await expect(input).toHaveAttribute("readonly", "");
  await demo
    .locator('[data-ormo-autocomplete-item][data-value="Paris"]')
    .evaluate((item) => {
      (item as HTMLElement).click();
    });
  await expect(input).toHaveValue("par");
});

test("async replacement clears a detached active option", async ({ page }) => {
  const demo = page.locator('[data-autocomplete-demo="default"]');
  const input = demo.getByRole("combobox", { name: "Location" });
  await input.fill("o");
  await input.press("ArrowDown");
  await expect(input).toHaveAttribute("aria-activedescendant", /.+/);
  await demo
    .locator("[data-ormo-autocomplete-item][data-highlighted]")
    .evaluate((item) => item.remove());
  await expect(input).not.toHaveAttribute("aria-activedescendant", /.+/);
  await input.press("Enter");
  await expect(input).toHaveValue("o");
});

test("IME composition is processed only after commit", async ({ page }) => {
  const demo = page.locator('[data-autocomplete-demo="default"]');
  const root = demo.locator("ormo-autocomplete");
  const result = await root.evaluate((element) => {
    const input = element.querySelector<HTMLInputElement>(
      "[data-ormo-autocomplete-input]",
    )!;
    let changes = 0;
    element.addEventListener("ormo:autocomplete-value-change", () => {
      changes += 1;
    });
    input.dispatchEvent(new CompositionEvent("compositionstart"));
    input.value = "東京";
    input.dispatchEvent(
      new InputEvent("input", { bubbles: true, isComposing: true }),
    );
    const during = {
      changes,
      expanded: input.getAttribute("aria-expanded"),
    };
    input.dispatchEvent(new CompositionEvent("compositionend"));
    return {
      during,
      changes,
      value: input.value,
    };
  });
  expect(result).toEqual({
    during: { changes: 0, expanded: "false" },
    changes: 1,
    value: "東京",
  });
  await expect(demo.getByRole("listbox")).toBeVisible();
  await expect(
    demo.getByRole("combobox", { name: "Location" }),
  ).toHaveAttribute("aria-expanded", "true");
});

test("loads externally managed suggestions and exposes identifiers", async ({
  page,
}) => {
  const demo = page.locator('[data-autocomplete-demo="async"]');
  const input = demo.getByRole("combobox", { name: "Airport" });
  const root = demo.locator("ormo-autocomplete");
  const selected = root.evaluate(
    (element) =>
      new Promise((resolve) => {
        element.addEventListener(
          "ormo:autocomplete-select",
          (event) => resolve((event as CustomEvent).detail),
          { once: true },
        );
      }),
  );
  await input.fill("lon");
  await expect(demo.getByText("Loading airports…")).toBeVisible();
  await expect(
    demo.getByRole("option", { name: "London Heathrow" }),
  ).toBeVisible();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(input).toHaveValue("London Heathrow");
  await expect(selected).resolves.toEqual({
    value: "London Heathrow",
    identifier: "LHR",
  });
});

test("submits unmatched text through the native input", async ({ page }) => {
  const demo = page.locator('[data-autocomplete-demo="form"]');
  const input = demo.getByRole("combobox", { name: "Company" });
  const submit = demo.getByRole("button", { name: "Continue" });
  const error = demo.getByText("Enter a company.");
  await submit.click();
  await expect(input).toBeFocused();
  await expect(error).toBeVisible();
  await input.fill("Independent Studio");
  await input.press("Enter");
  await expect(demo.locator("[data-autocomplete-result]")).toHaveText(
    "Submitted: Independent Studio",
  );
});

test("has no accessibility violations in local, empty, and loading states", async ({
  page,
}) => {
  const local = page.locator('[data-autocomplete-demo="default"]');
  const input = local.getByRole("combobox", { name: "Location" });
  await expectNoAxeViolations(page, {
    include: '[data-autocomplete-demo="default"]',
    label: "closed autocomplete",
  });
  await input.fill("zzz");
  await expect(local.getByText("No suggestions found.")).toBeVisible();
  await expectNoAxeViolations(page, {
    include: '[data-autocomplete-demo="default"]',
    label: "empty autocomplete",
  });
  const asyncDemo = page.locator('[data-autocomplete-demo="async"]');
  await asyncDemo.getByRole("combobox", { name: "Airport" }).fill("lon");
  await expect(asyncDemo.getByText("Loading airports…")).toBeVisible();
  await expectNoAxeViolations(page, {
    include: '[data-autocomplete-demo="async"]',
    label: "loading autocomplete",
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("keeps the native text input usable", async ({ page }) => {
    const demo = page.locator('[data-autocomplete-demo="default"]');
    const input = demo.getByRole("combobox", { name: "Location" });
    await expect(input).toBeVisible();
    await expect(demo.getByRole("listbox")).toBeHidden();
    await input.fill("Freeform place");
    await expect(input).toHaveValue("Freeform place");
  });
});
