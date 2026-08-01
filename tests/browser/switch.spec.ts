import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/switch/");
});

test("toggles with pointer and Space and synchronises the thumb", async ({
  page,
}) => {
  const demo = page.locator("[data-switch-demo]");
  const control = demo.getByRole("switch", { name: "Notifications" });
  const root = control.locator("..");
  await expect(control).toBeChecked();
  await control.click();
  await expect(control).not.toBeChecked();
  await expect(root).toHaveAttribute("data-state", "unchecked");
  await control.press("Space");
  await expect(control).toBeChecked();
  await expect(root.locator("[data-ormo-switch-thumb]")).toHaveAttribute(
    "data-state",
    "checked",
  );
});

test("keeps readonly focusable and disabled unavailable", async ({ page }) => {
  const demo = page.locator("[data-switch-demo]");
  const readOnly = demo.getByRole("switch", { name: "Usage analytics" });
  const disabled = demo.getByRole("switch", { name: "Legacy integration" });
  await readOnly.focus();
  await expect(readOnly).toBeFocused();
  await readOnly.press("Space");
  await expect(readOnly).not.toBeChecked();
  await expect(disabled).toBeDisabled();
});

test("uses native required validity and form submission", async ({ page }) => {
  const form = page.locator("[data-switch-form]");
  const control = form.getByRole("switch", { name: "Automatic backups" });
  await form.getByRole("button", { name: "Save settings" }).click();
  await expect(control).toBeFocused();
  await control.check();
  await form.getByRole("button", { name: "Save settings" }).click();
  await expect(form.locator("[data-switch-result]")).toHaveText(
    "Automatic backups are on.",
  );
});

test("emits cancellable and reasoned events", async ({ page }) => {
  const control = page.getByRole("switch", { name: "Notifications" });
  const root = control.locator("..");
  await root.evaluate((element) => {
    element.addEventListener(
      "ormo:switch-before-checked-change",
      (event) => event.preventDefault(),
      { once: true },
    );
    element.addEventListener("ormo:switch-checked-change", (event) => {
      element.setAttribute(
        "data-change-reason",
        (event as CustomEvent<{ reason: string }>).detail.reason,
      );
    });
  });
  await control.click();
  await expect(control).toBeChecked();
  await root.evaluate((element) => {
    (element as HTMLElement & { checked: boolean }).checked = false;
  });
  await expect(root).toHaveAttribute("data-change-reason", "programmatic");
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await expectNoAxeViolations(page, {
    include: "[data-switch-demo]",
    label: "switch demo",
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the native switch usable and submittable", async ({ page }) => {
    const form = page.locator("[data-switch-form]");
    const control = form.getByRole("switch", { name: "Automatic backups" });
    await control.check();
    await expect(control).toBeChecked();
    const value = await form.evaluate((element: HTMLFormElement) =>
      new FormData(element).get("backups"),
    );
    expect(value).toBe("enabled");
  });
});
