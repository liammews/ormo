import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/password-field/");
});

test("reveals and masks the same native input without exposing its value", async ({
  page,
}) => {
  const root = page.locator("[data-ormo-password-field-root]");
  const input = root.locator("[data-ormo-password-field-input]");
  const toggle = root.locator("[data-ormo-password-field-toggle]");
  await input.evaluate((element) => {
    (element as HTMLInputElement & { ormoIdentity?: boolean }).ormoIdentity =
      true;
  });

  await input.fill("correct horse battery staple");
  await expect(input).toHaveAttribute("type", "password");
  await toggle.click();

  await expect
    .poll(() =>
      input.evaluate(
        (element) =>
          (element as HTMLInputElement & { ormoIdentity?: boolean })
            .ormoIdentity,
      ),
    )
    .toBe(true);
  await expect(input).toHaveAttribute("type", "text");
  await expect(input).toHaveValue("correct horse battery staple");
  await expect(input).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-label", "Hide password");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(root).not.toHaveAttribute("value", /.+/);
  await expect(input).not.toHaveAttribute("value", /.+/);
});

test("keeps keyboard focus on the toggle and masks before submit", async ({
  page,
}) => {
  const demo = page.locator("[data-password-field-demo]");
  const input = demo.locator("[data-ormo-password-field-input]");
  const toggle = demo.locator("[data-ormo-password-field-toggle]");

  await input.fill("keyboard password");
  await toggle.focus();
  await toggle.press("Space");
  await expect(toggle).toBeFocused();
  await expect(input).toHaveAttribute("type", "text");

  await input.press("Enter");
  await expect(input).toHaveAttribute("type", "password");
  await expect(demo.locator("[data-password-field-status]")).toHaveText(
    "Password submitted.",
  );
});

test("preserves native validation, form data, and autocomplete", async ({
  page,
}) => {
  const form = page.locator("[data-password-field-form]");
  const input = form.locator("[data-ormo-password-field-input]");

  await expect(input).toHaveAttribute("autocomplete", "current-password");
  await expect(input).toHaveAttribute("required", "");
  await input.fill("pasted password");

  await expect
    .poll(() =>
      form.evaluate((element: HTMLFormElement) => ({
        password: new FormData(element).get("password"),
        valid: element.checkValidity(),
      })),
    )
    .toEqual({ password: "pasted password", valid: true });
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await expectNoAxeViolations(page, { include: "[data-password-field-demo]" });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps a usable masked input and hides the inactive toggle", async ({
    page,
  }) => {
    await page.goto("/test-fixtures/browser/password-field/");
    const demo = page.locator("[data-password-field-demo]");
    const input = demo.locator("[data-ormo-password-field-input]");
    const toggle = demo.locator("[data-ormo-password-field-toggle]");

    await expect(input).toHaveAttribute("type", "password");
    await expect(toggle).toBeHidden();
    await input.fill("no script password");
    await expect(input).toHaveValue("no script password");
    await expect
      .poll(() =>
        demo
          .locator("form")
          .evaluate((form: HTMLFormElement) =>
            new FormData(form).get("password"),
          ),
      )
      .toBe("no script password");
  });
});
