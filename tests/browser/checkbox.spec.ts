import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/checkbox/");
});

test("toggles a standalone checkbox with Space", async ({ page }) => {
  const demo = page.locator("[data-checkbox-demo]");
  const checkbox = demo.locator("[data-ormo-checkbox]");
  const indicator = demo.locator("[data-ormo-checkbox-indicator]");

  await checkbox.focus();
  await expect(checkbox).not.toBeChecked();
  await expect(indicator).toHaveCSS("opacity", "0");
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();
  await expect(indicator).toHaveCSS("opacity", "1");
});

test("uses the custom indicator composition outside the native demo", async ({
  page,
}) => {
  for (const selector of [
    "[data-checkbox-demo]",
    "[data-checkbox-indeterminate-demo]",
    "[data-checkbox-group-demo]",
    "[data-checkbox-parent-demo]",
    "[data-checkbox-field-demo]",
    "[data-checkbox-disabled-demo]",
  ]) {
    const demo = page.locator(selector);
    const checkboxes = demo.getByRole("checkbox");
    const indicators = demo.locator("[data-ormo-checkbox-indicator]");

    await expect(indicators).toHaveCount(await checkboxes.count());
    for (const checkbox of await checkboxes.all()) {
      await expect(checkbox).toHaveClass(/\bcheckbox-custom\b/);
    }
  }
});

test("wires group name, default value, and aggregate state", async ({
  page,
}) => {
  const demo = page.locator("[data-checkbox-group-demo]");
  const group = demo.locator("ormo-checkbox-group");
  const https = demo.locator('[data-ormo-checkbox][value="https"]');

  await expect(group).toHaveAttribute("data-state", "partial");
  await expect(https).toBeChecked();
  await expect(https).toHaveAttribute("name", "protocols");

  const submittedValues = await group.evaluate((element) => {
    const form = document.createElement("form");
    element.before(form);
    form.append(element);
    return new FormData(form).getAll("protocols");
  });
  expect(submittedValues).toEqual(["https"]);
});

test("identifies member, parent, and programmatic value changes", async ({
  page,
}) => {
  const group = page.locator("[data-checkbox-group-demo] ormo-checkbox-group");
  const http = page.locator(
    '[data-checkbox-group-demo] [data-ormo-checkbox][value="http"]',
  );

  await group.evaluate((element) => {
    element.addEventListener("ormo:value-change", (event) => {
      element.setAttribute(
        "data-observed-reason",
        (event as CustomEvent<{ reason: string }>).detail.reason,
      );
    });
  });

  await http.check();
  await expect(group).toHaveAttribute("data-observed-reason", "member");

  await group.evaluate((element) => {
    (element as HTMLElement & { value: string[] }).value = ["ssh"];
  });
  await expect(group).toHaveAttribute("data-observed-reason", "programmatic");

  const parentGroup = page.locator(
    "[data-checkbox-parent-demo] ormo-checkbox-group",
  );
  await parentGroup.evaluate((element) => {
    element.addEventListener("ormo:value-change", (event) => {
      element.setAttribute(
        "data-observed-reason",
        (event as CustomEvent<{ reason: string }>).detail.reason,
      );
    });
  });
  await page
    .locator(
      "[data-checkbox-parent-demo] [data-ormo-checkbox][data-ormo-checkbox-parent]",
    )
    .click();
  await expect(parentGroup).toHaveAttribute("data-observed-reason", "parent");
});

test("parent select-all checks and clears members", async ({ page }) => {
  const demo = page.locator("[data-checkbox-parent-demo]");
  const parent = demo.locator(
    "[data-ormo-checkbox][data-ormo-checkbox-parent]",
  );
  const fuji = demo.locator('[data-ormo-checkbox][value="fuji"]');
  const gala = demo.locator('[data-ormo-checkbox][value="gala"]');

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

test("applies indeterminate once and follows native interaction", async ({
  page,
}) => {
  const demo = page.locator("[data-checkbox-indeterminate-demo]");
  const checkbox = demo.getByRole("checkbox", { name: "Some selected" });

  await expect
    .poll(async () =>
      checkbox.evaluate((node) => (node as HTMLInputElement).indeterminate),
    )
    .toBe(true);

  await expect(checkbox).not.toHaveAttribute(
    "data-ormo-checkbox-initial-indeterminate",
  );
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await expect
    .poll(async () =>
      checkbox.evaluate((node) => (node as HTMLInputElement).indeterminate),
    )
    .toBe(false);

  await page.evaluate(() => {
    document.dispatchEvent(new Event("astro:page-load"));
  });
  await expect
    .poll(async () =>
      checkbox.evaluate((node) => (node as HTMLInputElement).indeterminate),
    )
    .toBe(false);
});

test("runs Field validation once for a group value change", async ({
  page,
}) => {
  const demo = page.locator("[data-checkbox-field-demo]");
  const field = demo.locator("ormo-field");
  const http = demo.locator('[data-ormo-checkbox][value="http"]');

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

  await http.check();
  await expect(field).toHaveAttribute("data-validation-calls", "1");
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
    "[data-checkbox-native-demo]",
    "[data-checkbox-indeterminate-demo]",
    "[data-checkbox-group-demo]",
    "[data-checkbox-parent-demo]",
    "[data-checkbox-field-demo]",
    "[data-checkbox-disabled-demo]",
  ]) {
    await expectNoAxeViolations(page, { include: selector, label: selector });
  }
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("retains native checkbox and form behaviour", async ({ page }) => {
    const standalone = page.locator(
      "[data-checkbox-demo] [data-ormo-checkbox]",
    );
    await standalone.focus();
    await page.keyboard.press("Space");
    await expect(standalone).toBeChecked();

    const group = page.locator(
      "[data-checkbox-group-demo] ormo-checkbox-group",
    );
    await expect(group).toHaveAttribute("data-state", "partial");
    await expect(
      page.locator(
        '[data-checkbox-group-demo] [data-ormo-checkbox][value="https"]',
      ),
    ).toBeChecked();

    const submittedValues = await group.evaluate((element) => {
      const form = document.createElement("form");
      element.before(form);
      form.append(element);
      return new FormData(form).getAll("protocols");
    });
    expect(submittedValues).toEqual(["https"]);
  });
});
