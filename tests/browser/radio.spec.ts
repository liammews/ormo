import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/radio/");
});

test("uses one native tab stop and arrow-key selection", async ({ page }) => {
  const demo = page.locator("[data-radio-demo]");
  const email = demo.getByRole("radio", { name: "Email" });
  const sms = demo.getByRole("radio", { name: "Text message" });

  await email.focus();
  await expect(email).toBeFocused();
  await page.keyboard.press("ArrowDown");

  await expect(sms).toBeFocused();
  await expect(sms).toBeChecked();
  await expect(email).not.toBeChecked();

  await page.keyboard.press("Tab");
  await expect(
    page
      .locator("[data-radio-native-demo]")
      .getByRole("radio", { name: "Monthly" }),
  ).toBeFocused();
});

test("shows the custom indicator for the selected member", async ({ page }) => {
  const demo = page.locator("[data-radio-demo]");
  const email = demo.getByRole("radio", { name: "Email" });
  const sms = demo.getByRole("radio", { name: "Text message" });
  const emailIndicator = email
    .locator("..")
    .locator("[data-ormo-radio-indicator]");
  const smsIndicator = sms.locator("..").locator("[data-ormo-radio-indicator]");

  await expect(email).toBeChecked();
  await expect(emailIndicator).toHaveCSS("opacity", "1");
  await expect(smsIndicator).toHaveCSS("opacity", "0");

  await sms.check();

  await expect(emailIndicator).toHaveCSS("opacity", "0");
  await expect(smsIndicator).toHaveCSS("opacity", "1");
});

test("submits one selected native value", async ({ page }) => {
  const demo = page.locator("[data-radio-demo]");
  const group = demo.locator("ormo-radio-group");

  await demo.getByRole("radio", { name: "Text message" }).check();

  const entries = await group.evaluate((element) => {
    const form = document.createElement("form");
    element.before(form);
    form.append(element);
    return Array.from(new FormData(form).entries());
  });

  expect(entries).toEqual([["notifications", "sms"]]);
});

test("identifies member and programmatic value changes", async ({ page }) => {
  const demo = page.locator("[data-radio-demo]");
  const group = demo.locator("ormo-radio-group");
  const sms = demo.getByRole("radio", { name: "Text message" });

  await group.evaluate((element) => {
    element.addEventListener("ormo:value-change", (event) => {
      const detail = (
        event as CustomEvent<{
          value: string | null;
          reason: string;
        }>
      ).detail;
      element.setAttribute("data-observed-value", detail.value ?? "null");
      element.setAttribute("data-observed-reason", detail.reason);
    });
  });

  await sms.check();
  await expect(group).toHaveAttribute("data-observed-value", "sms");
  await expect(group).toHaveAttribute("data-observed-reason", "member");

  await group.evaluate((element) => {
    (element as HTMLElement & { value: string | null }).value = "none";
  });
  await expect(group).toHaveAttribute("data-observed-value", "none");
  await expect(group).toHaveAttribute("data-observed-reason", "programmatic");

  await group.evaluate((element) => {
    (element as HTMLElement & { value: string | null }).value = null;
  });
  await expect(group).toHaveAttribute("data-observed-value", "null");
});

test("restores the server-rendered default on form reset", async ({ page }) => {
  const demo = page.locator("[data-radio-demo]");
  const group = demo.locator("ormo-radio-group");
  const email = demo.getByRole("radio", { name: "Email" });
  const sms = demo.getByRole("radio", { name: "Text message" });

  await group.evaluate((element) => {
    const form = document.createElement("form");
    element.before(form);
    form.append(element);
    (element as HTMLElement & { value: string | null }).value = "sms";
  });
  await expect(sms).toBeChecked();

  await group.evaluate((element) => element.closest("form")?.reset());

  await expect(email).toBeChecked();
  await expect(sms).not.toBeChecked();
});

test("integrates required validity with Field", async ({ page }) => {
  const demo = page.locator("[data-radio-field-demo]");
  const field = demo.locator("ormo-field");
  const group = demo.locator("ormo-radio-group");
  const error = demo.locator("[data-ormo-field-error]");

  await expect(group).toHaveAttribute("aria-required", "true");
  await expect(group).toHaveAttribute(
    "aria-describedby",
    /ormo-field-\d+-description-1/,
  );

  await demo.getByRole("button", { name: "Continue" }).click();

  await expect(field).toHaveAttribute("data-invalid", "");
  await expect(group).toHaveAttribute("aria-invalid", "true");
  await expect(error).toBeVisible();

  const express = demo.getByRole("radio", { name: /Express/ });
  await express.focus();
  await page.keyboard.press("Space");
  await expect(express).toBeChecked();

  await expect(field).not.toHaveAttribute("data-invalid", "");
  await expect(error).toBeHidden();
});

test("runs Field validation once for a radio value change", async ({
  page,
}) => {
  const demo = page.locator("[data-radio-field-demo]");
  const field = demo.locator("ormo-field");
  const express = demo.getByRole("radio", { name: /Express/ });

  await field.evaluate((element) => {
    const root = element as HTMLElement & {
      validationMode: "onChange";
      validator: () => null;
    };
    root.validationMode = "onChange";
    root.validator = () => {
      const count = Number(root.dataset.validationCalls ?? "0");
      root.dataset.validationCalls = String(count + 1);
      return null;
    };
  });

  await express.check();
  await expect(field).toHaveAttribute("data-validation-calls", "1");
});

test("disabled groups do not submit a value", async ({ page }) => {
  const group = page.locator("[data-radio-disabled-demo] ormo-radio-group");

  await expect(
    page
      .locator("[data-radio-disabled-demo]")
      .getByRole("radio", { name: "Pro" }),
  ).toBeDisabled();

  const entries = await group.evaluate((element) => {
    const form = document.createElement("form");
    element.before(form);
    form.append(element);
    return Array.from(new FormData(form).entries());
  });

  expect(entries).toEqual([]);
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  for (const selector of [
    "[data-radio-demo]",
    "[data-radio-native-demo]",
    "[data-radio-field-demo]",
    "[data-radio-disabled-demo]",
  ]) {
    const results = await new AxeBuilder({ page }).include(selector).analyze();
    expect(results.violations, selector).toEqual([]);
  }
});

test("reflows the demos at 320 CSS pixels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("retains native grouping, keyboard, and form behaviour", async ({
    page,
  }) => {
    const demo = page.locator("[data-radio-demo]");
    const group = demo.locator("ormo-radio-group");
    const email = demo.getByRole("radio", { name: "Email" });
    const sms = demo.getByRole("radio", { name: "Text message" });

    await expect(email).toBeChecked();
    await expect(email).toHaveAttribute("name", "notifications");

    await email.focus();
    await page.keyboard.press("ArrowDown");
    await expect(sms).toBeChecked();

    const entries = await group.evaluate((element) => {
      const form = document.createElement("form");
      element.before(form);
      form.append(element);
      return Array.from(new FormData(form).entries());
    });
    expect(entries).toEqual([["notifications", "sms"]]);
  });
});
