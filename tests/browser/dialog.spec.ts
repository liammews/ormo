import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/docs/components/dialog/");
});

test("opens modally, contains focus, closes, and restores focus", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "Edit profile" });
  const dialog = page.getByRole("dialog", { name: "Edit profile" });
  const input = dialog.getByRole("textbox", { name: "Display name" });
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  const save = dialog.getByRole("button", { name: "Save changes" });

  await trigger.click();

  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog).toHaveAttribute("aria-labelledby", /-title$/);
  await expect(dialog).toHaveAttribute("aria-describedby", /-description$/);

  await input.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(save).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(input).toBeFocused();

  await cancel.click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("dismisses from Escape and the backdrop with distinct reasons", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "Edit profile" });
  const root = page.locator("ormo-dialog").first();
  const reasons = await root.evaluate((element) => {
    const values: string[] = [];
    element.addEventListener("ormo:dialog-open-change", (event) => {
      const detail = (event as CustomEvent<{ open: boolean; reason: string }>)
        .detail;
      if (!detail.open) values.push(detail.reason);
    });
    (element as HTMLElement & { testReasons: string[] }).testReasons = values;
    return values;
  });
  expect(reasons).toEqual([]);

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
  const trigger = page.getByRole("button", {
    name: "Review keyboard shortcuts",
  });
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });

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
  const menu = page.getByRole("button", { name: "Open from account menu" });
  const dialog = page.getByRole("dialog", { name: "Profile details" });

  await expect(toolbar).toHaveAttribute(
    "data-ormo-dialog-for",
    "profile-dialog",
  );
  await expect(toolbar).toHaveAttribute(
    "aria-controls",
    "profile-dialog-content",
  );
  await expect(menu).toHaveAttribute("aria-controls", "profile-dialog-content");

  await menu.click();
  await expect(dialog).toBeVisible();
  await expect(toolbar).toHaveAttribute("data-state", "open");
  await expect(menu).toHaveAttribute("data-state", "open");

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(menu).toBeFocused();
  await expect(toolbar).toHaveAttribute("data-state", "closed");
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  let results = await new AxeBuilder({ page })
    .include("[data-dialog-demo]")
    .analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole("button", { name: "Edit profile" }).click();
  results = await new AxeBuilder({ page })
    .include("[data-dialog-demo]")
    .analyze();
  expect(results.violations).toEqual([]);
});

test("fits within a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole("button", { name: "Edit profile" }).click();

  const box = await page
    .getByRole("dialog", { name: "Edit profile" })
    .boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.width).toBeLessThanOrEqual(320);
  expect(box!.height).toBeLessThanOrEqual(640);
});

test("locks background scrolling until the dialog closes", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Edit profile" });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const initialScroll = await page.evaluate(() => window.scrollY);
  await expect(page.locator("html")).toHaveAttribute(
    "data-ormo-scroll-locked",
    "",
  );
  await expect(page.locator("html")).toHaveCSS("overflow", "hidden");

  await page.mouse.move(4, 4);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.scrollY)).toBe(initialScroll);

  await page.keyboard.press("Escape");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-ormo-scroll-locked",
    "",
  );
  await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden");
});
