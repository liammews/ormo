import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

function parseRgb(value: string): [number, number, number] {
  const channels = value
    .match(/\d+(?:\.\d+)?/g)
    ?.slice(0, 3)
    .map(Number);

  if (!channels || channels.length !== 3) {
    throw new Error(`Expected an rgb color, received: ${value}`);
  }

  return channels as [number, number, number];
}

function contrastRatio(
  foreground: [number, number, number],
  background: [number, number, number],
): number {
  const luminance = ([red, green, blue]: [number, number, number]): number => {
    const linearize = (channel: number): number => {
      const value = channel / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    };
    const r = linearize(red);
    const g = linearize(green);
    const b = linearize(blue);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/input/");
});

test("renders native input semantics and accessible relationships", async ({
  page,
}) => {
  const input = page.getByRole("textbox", { name: "Email address" });

  await expect(input).toHaveAttribute("data-ormo-input", "");
  await expect(input).toHaveAttribute("type", "email");
  await expect(input).toHaveAttribute("name", "email");
  await expect(input).toHaveAttribute("autocomplete", "email");
  await expect(input).toHaveAttribute("aria-describedby", "email-hint");
  await expect(page.locator("#email-hint")).toContainText(
    "contact you about your account",
  );
});

test("retains native value, event, validation, and form APIs", async ({
  page,
}) => {
  const form = page.locator("[data-input-form]");
  const input = form.getByRole("textbox", { name: "Email address" });

  await input.evaluate((element) => {
    const control = element as HTMLInputElement & { inputEvents: number };
    control.inputEvents = 0;
    control.addEventListener("input", () => {
      control.inputEvents += 1;
    });
  });

  await input.fill("invalid");
  await expect
    .poll(() =>
      input.evaluate((element: HTMLInputElement) => element.validity.valid),
    )
    .toBe(false);

  await input.fill("person@example.com");
  await expect(input).toHaveValue("person@example.com");
  await expect
    .poll(() =>
      input.evaluate(
        (element) =>
          (element as HTMLInputElement & { inputEvents: number }).inputEvents,
      ),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      input.evaluate((element: HTMLInputElement) => element.validity.valid),
    )
    .toBe(true);
  await expect
    .poll(() =>
      form.evaluate((element: HTMLFormElement) =>
        Array.from(new FormData(element)),
      ),
    )
    .toEqual([["email", "person@example.com"]]);
});

test("preserves native readonly and disabled behavior", async ({ page }) => {
  const demo = page.locator("[data-input-state-demo]");
  const readonly = demo.getByRole("textbox", { name: "Read-only reference" });
  const disabled = demo.getByRole("textbox", { name: "Disabled account" });

  await expect(readonly).toHaveAttribute("readonly", "");
  await expect(readonly).toBeEditable({ editable: false });
  await expect(readonly).toHaveValue("ORMO-2603");

  await expect(disabled).toBeDisabled();
  await expect(disabled).toHaveValue("Unavailable");
});

test("composes with Field relationships in server-rendered HTML", async ({
  page,
}) => {
  const demo = page.locator("[data-input-field-demo]");
  const input = demo.getByRole("textbox", { name: "Recovery email" });

  await expect(input).toHaveAttribute("id", "recovery-email-field-control");
  await expect(input).toHaveAttribute("data-ormo-field-control", "");
  await expect(input).toHaveAttribute("data-ormo-field-inherited-invalid", "");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(input).toHaveAttribute(
    "aria-describedby",
    "recovery-email-error",
  );
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  const results = await new AxeBuilder({ page })
    .include('[data-browser-fixture="input"]')
    .analyze();

  expect(results.violations).toEqual([]);
});

test("meets placeholder, control boundary, and focus contrast in both themes", async ({
  page,
}) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.reload();

    const input = page.getByRole("textbox", { name: "Email address" });
    const colors = await input.evaluate((element) => {
      const inputStyle = getComputedStyle(element);
      const placeholderStyle = getComputedStyle(element, "::placeholder");

      return {
        background: inputStyle.backgroundColor,
        border: inputStyle.borderColor,
        placeholder: placeholderStyle.color,
      };
    });
    await input.focus();
    const focusColor = await input.evaluate(
      (element) => getComputedStyle(element).outlineColor,
    );

    const background = parseRgb(colors.background);
    expect(
      contrastRatio(parseRgb(colors.placeholder), background),
      `${colorScheme} placeholder contrast`,
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(parseRgb(colors.border), background),
      `${colorScheme} control boundary contrast`,
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(parseRgb(focusColor), background),
      `${colorScheme} focus contrast`,
    ).toBeGreaterThanOrEqual(3);
  }
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("retains native form and Field relationships", async ({ page }) => {
    await page.goto("/test-fixtures/browser/input/");

    const standalone = page.getByRole("textbox", { name: "Email address" });
    const fieldInput = page.getByRole("textbox", { name: "Recovery email" });

    await expect(standalone).toHaveAttribute("name", "email");
    await expect(fieldInput).toHaveAttribute(
      "id",
      "recovery-email-field-control",
    );
    await expect(fieldInput).toHaveAttribute("aria-invalid", "true");
  });
});
