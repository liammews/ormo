import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/field/");
});

test("wires the default field label, description, and validation", async ({
  page,
}) => {
  const demo = page.locator("[data-field-demo]");
  const field = demo.locator("ormo-field").first();
  const input = demo.getByRole("textbox", { name: "Email address" });
  const description = demo.locator("[data-ormo-field-description]");

  await expect(field).not.toHaveAttribute("name");
  await expect(input).toHaveAttribute("required", "");
  await expect(input).toHaveAttribute("name", "email");
  await expect(description).toBeVisible();

  await input.focus();
  await input.blur();

  await expect(field).toHaveAttribute("data-invalid", "");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(field.getByRole("alert")).toHaveText(
    "Enter your email address.",
  );
});

test("preserves live native control state", async ({ page }) => {
  const demo = page.locator("[data-field-demo]");
  const field = demo.locator("ormo-field");
  const input = demo.getByRole("textbox", { name: "Email address" });

  await input.evaluate((element: HTMLInputElement) => {
    element.disabled = true;
    element.required = false;
    element.readOnly = true;
    element.name = "live-email";
  });

  await expect(field).toHaveAttribute("data-disabled", "");
  await expect(input).toBeDisabled();
  await expect(input).not.toHaveAttribute("required");
  await expect(input).toHaveAttribute("readonly", "");
  await expect(input).toHaveAttribute("name", "live-email");

  await field.evaluate(
    (element: HTMLElement & { invalid: boolean }) => (element.invalid = true),
  );
  await field.evaluate(
    (element: HTMLElement & { invalid: boolean }) => (element.invalid = false),
  );

  await expect(input).toBeDisabled();
  await expect(input).toHaveAttribute("readonly", "");
  await expect(input).toHaveAttribute("name", "live-email");
});

test("submits native form data after field validation", async ({ page }) => {
  const demo = page.locator("[data-field-demo]");
  const input = demo.getByRole("textbox", { name: "Email address" });

  await demo.evaluate((element) => {
    const form = element as HTMLFormElement;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      form.dataset.submittedValue = String(new FormData(form).get("email"));
    });
  });

  await input.fill("person@example.com");
  await demo.getByRole("button", { name: "Submit field" }).click();

  await expect(demo).toHaveAttribute(
    "data-submitted-value",
    "person@example.com",
  );
});

test("contains asynchronous validator failures and blocks submission", async ({
  page,
}) => {
  const demo = page.locator("[data-field-demo]");
  const field = demo.locator("ormo-field");
  const input = demo.getByRole("textbox", { name: "Email address" });

  await field.evaluate(
    (
      element: HTMLElement & {
        validator: () => Promise<never>;
      },
    ) => {
      element.addEventListener("ormo:field-validation-error", () => {
        element.dataset.validationError = "";
      });
      element.validator = async () => {
        throw new Error("Validation service unavailable");
      };
    },
  );
  await demo.evaluate((element) => {
    const form = element as HTMLFormElement;
    form.addEventListener("submit", () => {
      form.dataset.submitted = "";
    });
  });

  await input.fill("person@example.com");
  await demo.getByRole("button", { name: "Submit field" }).click();

  await expect(field).toHaveAttribute("data-validation-error", "");
  await expect(field).toHaveAttribute("data-invalid", "");
  await expect(field).not.toHaveAttribute("data-validating");
  await expect(demo).not.toHaveAttribute("data-submitted");
  await expect(input).toBeFocused();
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
  for (const selector of [
    "[data-field-demo]",
    "[data-field-error-demo]",
    "[data-field-disabled-demo]",
  ]) {
    await expectNoAxeViolations(page, { include: selector, label: selector });
  }
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("retains native naming, editing, validation, and form data", async ({
    page,
  }) => {
    await page.goto("/test-fixtures/browser/field/");
    const demo = page.locator("[data-field-demo]");
    const input = demo.getByRole("textbox", { name: "Email address" });

    await expect(input).toHaveAttribute("required", "");
    await expect(input).toHaveAttribute("name", "email");
    await input.fill("person@example.com");

    expect(
      await demo.evaluate((form: HTMLFormElement) => ({
        valid: form.checkValidity(),
        value: new FormData(form).get("email"),
      })),
    ).toEqual({ valid: true, value: "person@example.com" });
  });
});
