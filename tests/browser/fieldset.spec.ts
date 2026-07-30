import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/fieldset/");
});

test("renders a native labelled group with two fields", async ({ page }) => {
  const demo = page.locator("[data-fieldset-demo]");
  const group = demo.getByRole("group", {
    name: "Personal details",
  });

  await expect(group).toHaveAttribute("data-ormo-fieldset-root", "");
  await expect(group.locator("legend[data-ormo-fieldset-legend]")).toHaveText(
    "Personal details",
  );
  await expect(demo.getByRole("textbox", { name: "First name" })).toBeVisible();
  await expect(demo.getByRole("textbox", { name: "Last name" })).toBeVisible();
});

test("retains the native fieldset DOM and form APIs", async ({ page }) => {
  const group = page
    .locator("[data-fieldset-demo]")
    .getByRole("group", { name: "Personal details" });

  await expect
    .poll(() =>
      group.evaluate((element: HTMLFieldSetElement) => ({
        elementCount: element.elements.length,
        formId: element.form?.id,
        legendFormId: element.querySelector("legend")?.form?.id,
        name: element.name,
        type: element.type,
        willValidate: element.willValidate,
      })),
    )
    .toEqual({
      elementCount: 2,
      formId: "personal-details-form",
      legendFormId: "personal-details-form",
      name: "personal-details",
      type: "fieldset",
      willValidate: false,
    });
});

test("uses native disabled cascading for every field", async ({ page }) => {
  const demo = page.locator("[data-fieldset-disabled-demo]");
  const fieldset = demo.locator("[data-disabled-fieldset]");
  const address = demo.getByRole("textbox", { name: "Address line" });
  const town = demo.getByRole("textbox", { name: "Town or city" });

  await expect(fieldset).toHaveAttribute("disabled", "");
  await expect(
    demo.getByRole("group", { name: "Delivery address" }),
  ).toBeVisible();
  await expect(address).toBeDisabled();
  await expect(town).toBeDisabled();
});

test("associates an out-of-form fieldset and its controls explicitly", async ({
  page,
}) => {
  const demo = page.locator("[data-fieldset-form-demo]");
  const fieldset = demo.locator("[data-associated-fieldset]");
  const email = demo.getByRole("textbox", { name: "Email address" });
  const phone = demo.getByRole("textbox", { name: "Phone number" });

  await email.fill("person@example.com");
  await phone.fill("+44 20 7946 0958");

  await expect
    .poll(() =>
      fieldset.evaluate((element: HTMLFieldSetElement) => ({
        fieldsetFormId: element.form?.id,
        controlFormIds: Array.from(
          element.querySelectorAll<HTMLInputElement>("input"),
        ).map((control) => control.form?.id),
        formData: Array.from(new FormData(element.form ?? undefined)),
      })),
    )
    .toEqual({
      fieldsetFormId: "contact-details-form",
      controlFormIds: ["contact-details-form", "contact-details-form"],
      formData: [
        ["email", "person@example.com"],
        ["phone", "+44 20 7946 0958"],
      ],
    });

  await demo.getByRole("button", { name: "Save contact details" }).click();
  await expect(demo.locator("[data-fieldset-form-status]")).toHaveText(
    "Saved person@example.com",
  );

  await phone.evaluate((control: HTMLInputElement) =>
    control.removeAttribute("form"),
  );
  await expect
    .poll(() =>
      phone.evaluate((control: HTMLInputElement) => control.form?.id ?? null),
    )
    .toBeNull();
  await expect(fieldset).toHaveAttribute("form", "contact-details-form");
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await expectNoAxeViolations(page, {
    include:
      "[data-fieldset-demo], [data-fieldset-disabled-demo], [data-fieldset-form-demo]",
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("retains native grouping and labelled fields", async ({ page }) => {
    await page.goto("/test-fixtures/browser/fieldset/");

    const demo = page.locator("[data-fieldset-demo]");
    await expect(
      demo.getByRole("group", { name: "Personal details" }),
    ).toBeVisible();
    await expect(
      demo.getByRole("textbox", { name: "First name" }),
    ).toBeVisible();
    await expect(
      demo.getByRole("textbox", { name: "Last name" }),
    ).toBeVisible();

    const disabledDemo = page.locator("[data-fieldset-disabled-demo]");
    await expect(
      disabledDemo.getByRole("group", { name: "Delivery address" }),
    ).toBeVisible();
    await expect(
      disabledDemo.getByRole("textbox", { name: "Address line" }),
    ).toBeDisabled();
    await expect(
      disabledDemo.getByRole("textbox", { name: "Town or city" }),
    ).toBeDisabled();

    const associatedDemo = page.locator("[data-fieldset-form-demo]");
    await expect(
      associatedDemo.getByRole("textbox", { name: "Email address" }),
    ).toHaveAttribute("form", "contact-details-form");
  });
});
