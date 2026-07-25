import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/docs/components/checkbox/");
});

test("toggles a standalone checkbox with Space", async ({ page }) => {
  const demo = page.locator("[data-checkbox-demo]");
  const checkbox = demo.getByRole("checkbox", {
    name: "Accept the terms and conditions",
  });

  await checkbox.focus();
  await expect(checkbox).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();
});

test("wires group name, default value, and aggregate state", async ({
  page,
}) => {
  const demo = page.locator("[data-checkbox-group-demo]");
  const group = demo.locator("ormo-checkbox-group");
  const https = demo.getByRole("checkbox", { name: "HTTPS" });

  await expect(group).toHaveAttribute("data-state", "partial");
  await expect(https).toBeChecked();
  await expect(https).toHaveAttribute("name", "protocols");
});

test("parent select-all checks and clears members", async ({ page }) => {
  const demo = page.locator("[data-checkbox-parent-demo]");
  const parent = demo.getByRole("checkbox", { name: "Select all" });
  const fuji = demo.getByRole("checkbox", { name: "Fuji" });
  const gala = demo.getByRole("checkbox", { name: "Gala" });

  await parent.click();
  await expect(fuji).toBeChecked();
  await expect(gala).toBeChecked();

  await parent.click();
  await expect(fuji).not.toBeChecked();
  await expect(gala).not.toBeChecked();
});

test("keeps authored names and updates inherited names", async ({ page }) => {
  const group = page.locator("[data-checkbox-group-demo] ormo-checkbox-group");
  const members = group.locator(
    "[data-ormo-checkbox]:not([data-ormo-checkbox-parent])",
  );

  await group.evaluate((element) => {
    const root = element as HTMLElement & { name: string };
    const checkboxes = root.querySelectorAll<HTMLInputElement>(
      "[data-ormo-checkbox]:not([data-ormo-checkbox-parent])",
    );
    checkboxes[1]!.name = "authored-name";
    checkboxes[1]!.setAttribute("data-item-name-authored", "");
    root.name = "transport";
  });

  await expect(members.nth(0)).toHaveAttribute("name", "transport");
  await expect(members.nth(1)).toHaveAttribute("name", "authored-name");
  await expect(members.nth(2)).toHaveAttribute("name", "transport");

  await group.evaluate((element) => {
    (element as HTMLElement & { name: string }).name = "";
  });

  await expect(members.nth(0)).not.toHaveAttribute("name");
  await expect(members.nth(1)).toHaveAttribute("name", "authored-name");
  await expect(members.nth(2)).not.toHaveAttribute("name");
});

test("updates managed label relationships when label ids change", async ({
  page,
}) => {
  const group = page.locator("[data-checkbox-group-demo] ormo-checkbox-group");
  const label = group.locator("[data-ormo-checkbox-group-label]");

  await label.evaluate((element) => {
    element.id = "updated-protocols-label";
  });

  await expect(group).toHaveAttribute(
    "aria-labelledby",
    "updated-protocols-label",
  );
});

test("reconciles group state and validity after form reset", async ({
  page,
}) => {
  await page.evaluate(() => {
    const form = document.createElement("form");
    form.dataset.checkboxResetFixture = "";
    form.innerHTML = `
      <ormo-checkbox-group
        role="group"
        aria-label="Reset options"
        data-name="options"
        data-required
        data-required-message="Pick one"
      >
        <label>
          <input
            type="checkbox"
            data-ormo-checkbox
            data-ormo-checkbox-parent
          >
          Select all
        </label>
        <label>
          <input
            type="checkbox"
            data-ormo-checkbox
            name="options"
            value="a"
            checked
          >
          Option A
        </label>
      </ormo-checkbox-group>
    `;
    document.body.append(form);
  });

  const form = page.locator("[data-checkbox-reset-fixture]");
  const group = form.locator("ormo-checkbox-group");
  const parent = form.getByRole("checkbox", { name: "Select all" });
  const member = form.getByRole("checkbox", { name: "Option A" });

  await expect(group).toHaveAttribute("data-state", "all");
  await expect(parent).toBeChecked();
  await member.uncheck();
  await expect(group).toHaveAttribute("data-state", "none");
  await expect
    .poll(() =>
      form.evaluate((element: HTMLFormElement) => element.checkValidity()),
    )
    .toBe(false);

  await form.evaluate((element: HTMLFormElement) => element.reset());

  await expect(member).toBeChecked();
  await expect(group).toHaveAttribute("data-state", "all");
  await expect(parent).toBeChecked();
  await expect
    .poll(() =>
      form.evaluate((element: HTMLFormElement) => element.checkValidity()),
    )
    .toBe(true);

  await member.uncheck();
  await member.evaluate((element: HTMLInputElement) => {
    element.setCustomValidity("Server error.");
    element.setCustomValidity("");
  });
  const submitCount = await form.evaluate((element: HTMLFormElement) => {
    let count = 0;
    element.addEventListener("submit", (event) => {
      event.preventDefault();
      count += 1;
    });
    element.requestSubmit();
    return count;
  });

  expect(submitCount).toBe(0);
  await expect
    .poll(() =>
      form.evaluate((element: HTMLFormElement) => element.checkValidity()),
    )
    .toBe(false);
});

test("tracks a form owner established after the group connects", async ({
  page,
}) => {
  await page.evaluate(() => {
    const form = document.createElement("form");
    form.id = "pending-options-form";
    form.dataset.checkboxExternalResetFixture = "";
    document.body.append(form);

    const group = document.createElement("ormo-checkbox-group");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "External reset options");
    group.setAttribute("data-name", "external-options");
    group.setAttribute("data-required", "");
    group.setAttribute("data-required-message", "Pick one");
    group.innerHTML = `
      <input
        type="checkbox"
        aria-label="Select all external options"
        data-ormo-checkbox
        data-ormo-checkbox-parent
        form="external-options-form"
      >
      <label>
        <input
          type="checkbox"
          data-ormo-checkbox
          form="external-options-form"
          name="external-options"
          value="a"
          checked
        >
        External option A
      </label>
    `;
    document.body.append(group);
    form.id = "external-options-form";
  });

  const form = page.locator("[data-checkbox-external-reset-fixture]");
  const group = page.getByRole("group", { name: "External reset options" });
  const member = page.getByRole("checkbox", { name: "External option A" });

  await member.uncheck();
  await expect(group).toHaveAttribute("data-state", "none");
  await expect
    .poll(() =>
      form.evaluate((element: HTMLFormElement) => element.checkValidity()),
    )
    .toBe(false);

  await form.evaluate((element: HTMLFormElement) => element.reset());

  await expect(member).toBeChecked();
  await expect(group).toHaveAttribute("data-state", "all");
  await expect
    .poll(() =>
      form.evaluate((element: HTMLFormElement) => element.checkValidity()),
    )
    .toBe(true);
});

test("applies indeterminate after load", async ({ page }) => {
  const demo = page.locator("[data-checkbox-indeterminate-demo]");
  const checkbox = demo.getByRole("checkbox", { name: "Some selected" });

  await expect
    .poll(async () =>
      checkbox.evaluate((node) => (node as HTMLInputElement).indeterminate),
    )
    .toBe(true);
});

test("reports a required Field group without recursive validation", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));

  const demo = page.locator("[data-checkbox-field-demo]");
  const group = demo.locator("ormo-checkbox-group");
  await demo.getByRole("button", { name: "Save" }).click();

  await expect(group).toHaveAttribute("data-invalid", "");
  await expect(demo.locator("[data-ormo-field-error]")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  for (const selector of [
    "[data-checkbox-demo]",
    "[data-checkbox-indicator-demo]",
    "[data-checkbox-indeterminate-demo]",
    "[data-checkbox-group-demo]",
    "[data-checkbox-parent-demo]",
    "[data-checkbox-field-demo]",
    "[data-checkbox-disabled-demo]",
  ]) {
    const results = await new AxeBuilder({ page }).include(selector).analyze();
    expect(results.violations, selector).toEqual([]);
  }
});
