import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/docs/components/popover/");
});

test("opens, focuses content, closes, and restores focus without trapping Tab", async ({
  page,
}) => {
  const demo = page.locator('[data-popover-demo="form"]');
  const trigger = demo.getByRole("button", { name: "Share" });
  const dialog = demo.getByRole("dialog", { name: "Share link" });
  const input = dialog.getByRole("textbox", { name: "Email" });
  const outside = demo.getByLabel("Outside the popover");

  await trigger.click();

  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();
  await expect(dialog).not.toHaveAttribute("aria-modal", "true");
  await expect(dialog).toHaveAttribute("aria-labelledby", /-title$/);

  // Non-modal: focus can leave the popover into the page.
  await outside.focus();
  await expect(outside).toBeFocused();
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("dismisses from Escape and outside with distinct reasons", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "Filters" }).first();
  const root = page.locator("ormo-popover").first();

  await root.evaluate((element) => {
    const values: string[] = [];
    element.addEventListener("ormo:popover-open-change", (event) => {
      const detail = (event as CustomEvent<{ open: boolean; reason: string }>)
        .detail;
      if (!detail.open) values.push(detail.reason);
    });
    (element as HTMLElement & { testReasons: string[] }).testReasons = values;
  });

  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.mouse.click(4, 4);
  await expect(trigger).toBeFocused();

  await expect
    .poll(() =>
      root.evaluate(
        (element) =>
          (element as HTMLElement & { testReasons: string[] }).testReasons,
      ),
    )
    .toEqual(["escape", "outside"]);
});

test("can disable pointer dismissal while retaining Escape", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "Review notes" });
  const dialog = page.getByRole("dialog", { name: "Review notes" });

  await trigger.click();
  await page.mouse.click(4, 4);
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("supports detached triggers and restores the exact invoker", async ({
  page,
}) => {
  const toolbar = page.getByRole("button", { name: "Open from toolbar" });
  const menu = page.getByRole("button", { name: "Open from menu" });
  const dialog = page.getByRole("dialog", { name: "Account" });

  await expect(toolbar).toHaveAttribute(
    "data-ormo-popover-for",
    "account-popover",
  );

  await toolbar.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toolbar).toBeFocused();

  await menu.click();
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(menu).toBeFocused();
});

test("has no critical accessibility violations on the docs page", async ({
  page,
}) => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(
    results.violations.filter((violation) => violation.impact === "critical"),
  ).toEqual([]);
});
