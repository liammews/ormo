import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/docs/components/button/");
});

test("keeps a focusable disabled button in tab order without activating", async ({
  page,
}) => {
  const button = page
    .locator("button.button-demo-control", { hasText: "Submitting…" })
    .first();

  await expect(button).toHaveAttribute("aria-disabled", "true");
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
  await button.focus();
  await expect(button).toBeFocused();
});

test("blocks implicit and direct submit while focusable and disabled", async ({
  page,
}) => {
  const form = page.locator('[data-button-demo="submit-guard"]');
  const input = form.locator("input");
  const button = form.getByRole("button", { name: "Save profile" });

  await expect(button).toHaveAttribute("aria-disabled", "true");
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
  const button = page.locator(
    '[data-ormo-button][data-native-button="false"]',
    {
      hasText: "Add item",
    },
  );

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

test("exposes pending busy state without failing axe", async ({ page }) => {
  const button = page
    .locator("button.button-demo-control", { hasText: "Saving…" })
    .first();

  await expect(button).toHaveAttribute("data-pending", "");
  await expect(button).toHaveAttribute("aria-busy", "true");
  await expect(button).toHaveAttribute("aria-disabled", "true");

  const results = await new AxeBuilder({ page }).include("main").analyze();

  expect(results.violations).toEqual([]);
});
