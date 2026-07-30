import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/button/");
});

test("keeps a focusable disabled button in tab order without activating", async ({
  page,
}) => {
  const demo = page.locator('[data-button-demo="focusable-disabled"]');
  const button = demo.getByRole("button", { name: "Submitting…" });

  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(button).toHaveAttribute("data-ormo-button-disabled", "");
  await expect(button).toHaveJSProperty("disabled", false);
  await expect(button).toHaveAttribute("data-focusable-when-disabled", "");

  const clicked = await button.evaluate((element) => {
    let activated = false;
    element.addEventListener("click", () => {
      activated = true;
    });
    (element as HTMLButtonElement).click();
    return activated;
  });

  expect(clicked).toBe(false);
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();
});

test("blocks implicit and direct submit while focusable and disabled", async ({
  page,
}) => {
  const form = page.locator('[data-button-demo="submit-guard"] form');
  const input = form.locator("input");
  const button = form.getByRole("button", { name: "Save profile" });

  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(button).toHaveAttribute("data-ormo-button-disabled", "");
  await expect(button).toHaveAttribute("type", "submit");

  await form.evaluate((element) => {
    const host = element as HTMLFormElement & { __submitCount: number };
    host.__submitCount = 0;
    element.addEventListener("submit", (event) => {
      event.preventDefault();
      host.__submitCount += 1;
    });
  });

  await input.focus();
  await page.keyboard.press("Enter");

  await expect
    .poll(() =>
      form.evaluate(
        (element) =>
          (element as HTMLFormElement & { __submitCount?: number })
            .__submitCount ?? 0,
      ),
    )
    .toBe(0);

  await button.click({ force: true });

  await expect
    .poll(() =>
      form.evaluate(
        (element) =>
          (element as HTMLFormElement & { __submitCount?: number })
            .__submitCount ?? 0,
      ),
    )
    .toBe(0);
});

test("activates a non-native button with Enter and Space", async ({ page }) => {
  const demo = page.locator('[data-button-demo="non-native"]');
  const button = demo.getByRole("button", { name: "Add item" });

  await button.evaluate((element) => {
    const host = element as HTMLElement & { __clicks: number };
    host.__clicks = 0;
    element.addEventListener("click", () => {
      host.__clicks += 1;
    });
  });

  await button.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      button.evaluate(
        (element) => (element as HTMLElement & { __clicks: number }).__clicks,
      ),
    )
    .toBe(1);

  await page.keyboard.press(" ");
  await expect
    .poll(() =>
      button.evaluate(
        (element) => (element as HTMLElement & { __clicks: number }).__clicks,
      ),
    )
    .toBe(2);
});

test("preserves keyboard activation through stopped propagation and honors cancellation", async ({
  page,
}) => {
  const button = page
    .locator('[data-button-demo="non-native"]')
    .getByRole("button", { name: "Add item" });

  await button.evaluate((element) => {
    const host = element as HTMLElement & { __clicks: number };
    host.__clicks = 0;
    element.addEventListener("click", () => {
      host.__clicks += 1;
    });
    element.addEventListener("keydown", (event) => event.stopPropagation());
    element.addEventListener("keyup", (event) => event.stopPropagation());
  });

  await button.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press(" ");
  await expect
    .poll(() =>
      button.evaluate(
        (element) => (element as HTMLElement & { __clicks: number }).__clicks,
      ),
    )
    .toBe(2);

  await page.reload();
  const canceledButton = page
    .locator('[data-button-demo="non-native"]')
    .getByRole("button", { name: "Add item" });
  await canceledButton.evaluate((element) => {
    const host = element as HTMLElement & { __clicks: number };
    host.__clicks = 0;
    element.addEventListener("click", () => {
      host.__clicks += 1;
    });
    element.addEventListener("keydown", (event) => event.preventDefault());
  });
  await canceledButton.focus();
  await page.keyboard.press("Enter");

  expect(
    await canceledButton.evaluate(
      (element) => (element as HTMLElement & { __clicks: number }).__clicks,
    ),
  ).toBe(0);
});

test("exposes pending busy state without failing axe", async ({ page }) => {
  const demo = page.locator('[data-button-demo="pending"]');
  const button = demo.getByRole("button", { name: "Saving…" });

  await expect(button).toHaveAttribute("data-pending", "");
  await expect(button).toHaveAttribute("aria-busy", "true");
  await expect(button).toHaveAttribute("aria-disabled", "true");

  await expectNoAxeViolations(page, {
    include: '[data-browser-fixture="button"]',
  });
});

test("axe detects unnamed native and non-native buttons", async ({ page }) => {
  await page.locator("main").evaluate((main) => {
    const fixture = document.createElement("div");
    fixture.setAttribute("data-button-axe-fixture", "");
    fixture.innerHTML = `
      <button data-unnamed-native></button>
      <div role="button" tabindex="0" data-unnamed-non-native></div>
    `;
    main.append(fixture);
  });

  const results = await new AxeBuilder({ page })
    .include("[data-button-axe-fixture]")
    .withRules(["button-name", "aria-command-name"])
    .analyze();

  expect(results.violations.map(({ id }) => id)).toEqual(
    expect.arrayContaining(["button-name", "aria-command-name"]),
  );
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps focusable-disabled controls safely disabled", async ({
    page,
  }) => {
    const focusableButton = page
      .locator('[data-button-demo="focusable-disabled"]')
      .getByRole("button", { name: "Submitting…" });
    const submitButton = page
      .locator('[data-button-demo="submit-guard"]')
      .getByRole("button", { name: "Save profile" });

    await expect(focusableButton).toBeDisabled();
    await expect(submitButton).toBeDisabled();
    await focusableButton.focus();
    await expect(focusableButton).not.toBeFocused();
  });
});
