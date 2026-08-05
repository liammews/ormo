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

test("navigation clamps, skips disabled items, and follows filtering", async ({
  page,
}) => {
  const demo = page.locator('[data-autocomplete-demo="default"]');
  const input = demo.getByRole("combobox", { name: "Location" });
  await input.fill("p");
  await input.press("ArrowUp");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    /autocomplete-location-item-3/,
  );
  await input.press("ArrowUp");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    /autocomplete-location-item-3/,
  );
  await input.press("ArrowDown");
  await expect(input).toHaveAttribute(
    "aria-activedescendant",
    /autocomplete-location-item-3/,
  );
  await input.fill("lon");
  await expect(input).not.toHaveAttribute("aria-activedescendant", /.+/);
  await input.press("ArrowDown");
  await expect(demo.getByRole("option", { name: "London" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("pointer selection retains input focus and outside, Tab, and Escape dismiss", async ({
  page,
}) => {
  const demo = page.locator('[data-autocomplete-demo="default"]');
  const input = demo.getByRole("combobox", { name: "Location" });
  const paris = demo.getByRole("option", { name: "Paris" });
  await input.fill("par");
  await paris.hover();
  await expect(paris).toHaveAttribute("aria-selected", "true");
  await paris.click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Paris");
  await input.fill("p");
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  await expect(demo.getByRole("listbox")).toBeHidden();
  await input.fill("p");
  await input.press("Tab");
  await expect(demo.getByRole("listbox")).toBeHidden();
  await input.focus();
  await input.fill("p");
  await input.press("Escape");
  await expect(demo.getByRole("listbox")).toBeHidden();
});

test.describe("touch", () => {
  test.use({ hasTouch: true });

  test("selects an already active item", async ({ page }) => {
    const demo = page.locator('[data-autocomplete-demo="default"]');
    const input = demo.getByRole("combobox", { name: "Location" });
    const paris = demo.getByRole("option", { name: "Paris" });
    await input.fill("par");
    await input.press("ArrowDown");
    await expect(paris).toHaveAttribute("aria-selected", "true");
    await paris.tap();
    await expect(input).toHaveValue("Paris");
    await expect(input).toBeFocused();
  });
});

test("exposes expanded, controlled, grouped, and busy ARIA state", async ({
  page,
}) => {
  const demo = page.locator('[data-autocomplete-demo="default"]');
  const input = demo.getByRole("combobox", { name: "Location" });
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(input).toHaveAttribute(
    "aria-controls",
    /autocomplete-location-content/,
  );
  await input.fill("lon");
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await expect(
    demo.getByRole("group", { name: "United Kingdom" }),
  ).toBeVisible();
  const asyncDemo = page.locator('[data-autocomplete-demo="async"]');
  await asyncDemo.getByRole("combobox", { name: "Airport" }).fill("lon");
  await expect(asyncDemo.getByRole("listbox")).toHaveAttribute(
    "aria-busy",
    "true",
  );
});

test("sizes the popup to the complete control with and without Clear", async ({
  page,
}) => {
  const demo = page.locator('[data-autocomplete-demo="default"]');
  const root = demo.locator("ormo-autocomplete");
  const input = demo.getByRole("combobox", { name: "Location" });
  const listbox = demo.getByRole("listbox");

  await input.fill("p");
  const withClear = await demo.evaluate((fixture) => ({
    control: fixture
      .querySelector<HTMLElement>(".autocomplete-actions")!
      .getBoundingClientRect().width,
    popup: fixture
      .querySelector<HTMLElement>("[data-ormo-autocomplete-content]")!
      .getBoundingClientRect().width,
  }));
  expect(withClear.popup).toBeCloseTo(withClear.control, 0);

  await input.fill("");
  await root.evaluate((element) => {
    element.dataset.minLength = "0";
  });
  await input.press("ArrowDown");
  await expect(listbox).toBeVisible();
  const withoutClear = await demo.evaluate((fixture) => ({
    input: fixture
      .querySelector<HTMLElement>("[data-ormo-autocomplete-input]")!
      .getBoundingClientRect().width,
    popup: fixture
      .querySelector<HTMLElement>("[data-ormo-autocomplete-content]")!
      .getBoundingClientRect().width,
  }));
  expect(withoutClear.popup).toBeCloseTo(withoutClear.input, 0);
});

test("supports long scrolling results and keeps the active item visible", async ({
  page,
}) => {
  const demo = page.locator('[data-autocomplete-demo="default"]');
  const input = demo.getByRole("combobox", { name: "Location" });
  const listbox = demo.getByRole("listbox");
  await demo.locator("[data-ormo-autocomplete-content]").evaluate((content) => {
    for (let index = 0; index < 30; index += 1) {
      const item = document.createElement("div");
      item.role = "option";
      item.tabIndex = -1;
      item.dataset.ormoAutocompleteItem = "";
      item.dataset.value = `Result ${index + 1}`;
      item.dataset.textValue = `Result ${index + 1}`;
      item.textContent = `Result ${index + 1}`;
      content.append(item);
    }
  });
  await input.fill("result");
  await expect(listbox).toBeVisible();
  await expect
    .poll(() =>
      listbox.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    )
    .toBe(true);
  for (let index = 0; index < 30; index += 1) await input.press("ArrowDown");
  const last = demo.getByRole("option", { name: "Result 30" });
  await expect(last).toHaveAttribute("aria-selected", "true");
  await expect
    .poll(() =>
      last.evaluate((element) => {
        const item = element.getBoundingClientRect();
        const content = element.parentElement!.getBoundingClientRect();
        return item.top >= content.top && item.bottom <= content.bottom;
      }),
    )
    .toBe(true);
});

test("positions every requested Floating UI side and alignment", async ({
  page,
}) => {
  const demo = page.locator('[data-autocomplete-demo="default"]');
  const root = demo.locator("ormo-autocomplete");
  const input = demo.getByRole("combobox", { name: "Location" });
  const content = demo.locator("[data-ormo-autocomplete-content]");
  await root.evaluate((element) => {
    element.dataset.positioning = "floating";
    Object.assign((element as HTMLElement).style, {
      position: "fixed",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: "200px",
    });
  });
  await input.fill("p");
  await root.evaluate((element) =>
    (element as HTMLElement & { hide(): void }).hide(),
  );

  for (const side of ["top", "right", "bottom", "left"]) {
    for (const align of ["start", "center", "end"]) {
      await content.evaluate(
        (element, placement) => {
          (element as HTMLElement).dataset.side = placement.side;
          (element as HTMLElement).dataset.align = placement.align;
        },
        { side, align },
      );
      await root.evaluate((element) =>
        (element as HTMLElement & { show(): void }).show(),
      );
      await expect(content).toHaveAttribute("data-resolved-side", side);
      await expect(content).toHaveAttribute("data-resolved-align", align);
      await root.evaluate((element) =>
        (element as HTMLElement & { hide(): void }).hide(),
      );
    }
  }
});

test("updates floating position after page scroll and viewport resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 480, height: 480 });
  const demo = page.locator('[data-autocomplete-demo="default"]');
  const root = demo.locator("ormo-autocomplete");
  const input = demo.getByRole("combobox", { name: "Location" });
  const content = demo.getByRole("listbox");
  await demo.evaluate((element) => {
    (element as HTMLElement).style.marginTop = "900px";
    element.querySelector<HTMLElement>(
      "ormo-autocomplete",
    )!.dataset.positioning = "floating";
  });
  await input.scrollIntoViewIfNeeded();
  await input.fill("p");
  const gap = () =>
    demo.evaluate((fixture) => {
      const field = fixture
        .querySelector<HTMLElement>("[data-ormo-autocomplete-input]")!
        .getBoundingClientRect();
      const popup = fixture
        .querySelector<HTMLElement>("[data-ormo-autocomplete-content]")!
        .getBoundingClientRect();
      return Math.min(
        Math.abs(popup.top - field.bottom),
        Math.abs(field.top - popup.bottom),
      );
    });
  await expect.poll(gap).toBeLessThan(12);
  await page.evaluate(() => scrollBy(0, -80));
  await expect.poll(gap).toBeLessThan(12);
  await page.setViewportSize({ width: 320, height: 420 });
  await expect.poll(gap).toBeLessThan(12);
  await expect
    .poll(() =>
      content.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return box.left >= 0 && box.right <= innerWidth;
      }),
    )
    .toBe(true);
  await expect(root).toHaveAttribute("data-open", "");
});

test("aligns floating start placement in RTL", async ({ page }) => {
  await page.evaluate(() => {
    document.documentElement.dir = "rtl";
  });
  const demo = page.locator('[data-autocomplete-demo="default"]');
  const root = demo.locator("ormo-autocomplete");
  const input = demo.getByRole("combobox", { name: "Location" });
  const content = demo.getByRole("listbox");
  await root.evaluate((element) => {
    element.dataset.positioning = "floating";
  });
  await input.fill("p");
  await expect(content).toHaveAttribute("data-resolved-align", "start");
  const edges = await demo.evaluate((fixture) => ({
    input: fixture
      .querySelector<HTMLElement>("[data-ormo-autocomplete-input]")!
      .getBoundingClientRect().right,
    popup: fixture
      .querySelector<HTMLElement>("[data-ormo-autocomplete-content]")!
      .getBoundingClientRect().right,
  }));
  expect(edges.popup).toBeCloseTo(edges.input, 0);
});

test.describe("forced colours", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
  });

  test("keeps input, results, focus, and selection perceivable", async ({
    page,
  }) => {
    const demo = page.locator('[data-autocomplete-demo="default"]');
    const input = demo.getByRole("combobox", { name: "Location" });
    const listbox = demo.getByRole("listbox");
    await input.fill("par");
    await input.press("ArrowDown");
    await expect(input).toBeFocused();
    await expect(listbox).toBeVisible();
    await expect(demo.getByRole("option", { name: "Paris" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expectNoAxeViolations(page, {
      include: '[data-autocomplete-demo="default"]',
      label: "forced-colours autocomplete",
    });
  });
});

test("remains usable at 200% zoom in a narrow viewport", async ({ page }) => {
  // A 320 px viewport at 200% zoom exposes 160 CSS px for reflow.
  await page.setViewportSize({ width: 160, height: 320 });
  const demo = page.locator('[data-autocomplete-demo="default"]');
  const input = demo.getByRole("combobox", { name: "Location" });
  const listbox = demo.getByRole("listbox");
  await input.fill("p");
  await expect(listbox).toBeVisible();
  await expect
    .poll(() =>
      listbox.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return box.left >= 0 && box.right <= innerWidth;
      }),
    )
    .toBe(true);
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(input).toHaveValue("Paris");
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
