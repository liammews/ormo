import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/alert-dialog/");
});

test("opens modally, contains focus, closes with Escape, and restores focus", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "Delete project" }).first();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete this project?",
  });
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  const action = dialog.getByRole("button", { name: "Delete project" });

  await trigger.click();

  await expect(dialog).toBeVisible();
  await expect(cancel).toBeFocused();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog).toHaveAttribute("aria-labelledby", /-title$/);
  await expect(dialog).toHaveAttribute("aria-describedby", /-description$/);
  await expect(page.locator("html")).toHaveAttribute(
    "data-ormo-scroll-locked",
    "",
  );

  await page.keyboard.press("Tab");
  await expect(action).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(action).toBeFocused();

  await page.mouse.click(4, 4);
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-ormo-scroll-locked",
    "",
  );
});

test("runs an action, exposes its result, and restores focus", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "Delete project" }).first();

  await trigger.click();
  await page
    .getByRole("alertdialog", { name: "Delete this project?" })
    .getByRole("button", { name: "Delete project" })
    .click();

  await expect(
    page.getByText("Project deleted.", { exact: true }),
  ).toBeVisible();
  await expect(trigger).toBeFocused();
});

test("honours an authored initial focus target", async ({ page }) => {
  await page.getByRole("button", { name: "Show session warning" }).click();

  await expect(
    page.getByRole("button", { name: "I understand" }),
  ).toBeFocused();
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await expectNoAxeViolations(page, {
    include: "[data-alert-dialog-demo]",
    label: "closed alert dialog demos",
  });

  await page.getByRole("button", { name: "Delete project" }).first().click();
  await expect(
    page.getByRole("alertdialog", { name: "Delete this project?" }),
  ).not.toHaveAttribute("data-starting-style");
  await expectNoAxeViolations(page, {
    include: "[data-alert-dialog-demo]",
    label: "open alert dialog demo",
  });
});

test("fits within a narrow viewport", async ({ page }) => {
  const viewport = { width: 320, height: 640 };
  await page.setViewportSize(viewport);
  await page.getByRole("button", { name: "Delete project" }).first().click();

  const box = await page
    .getByRole("alertdialog", { name: "Delete this project?" })
    .boundingBox();

  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.width).toBeLessThanOrEqual(320);
  expect(box!.height).toBeLessThanOrEqual(640);
  expect(box!.x + box!.width / 2).toBeCloseTo(viewport.width / 2, 0);
  expect(box!.y + box!.height / 2).toBeCloseTo(viewport.height / 2, 0);
});

test("keeps a programmatic initial target out of the Tab sequence", async ({
  page,
}) => {
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.dataset.focusFixture = "";
    fixture.innerHTML = `
      <ormo-alert-dialog>
        <button type="button" data-ormo-alert-dialog-trigger>Open focus fixture</button>
        <dialog data-ormo-alert-dialog-content>
          <h2 tabindex="-1" autofocus data-ormo-alert-dialog-title>Focus fixture</h2>
          <p data-ormo-alert-dialog-description>Check the Tab sequence.</p>
          <button type="button" data-ormo-alert-dialog-cancel>Cancel fixture</button>
          <button type="button" data-ormo-alert-dialog-action>Confirm fixture</button>
          <button type="button" style="display: none">Hidden fixture control</button>
        </dialog>
      </ormo-alert-dialog>
    `;
    document.body.append(fixture);
  });

  await page.getByRole("button", { name: "Open focus fixture" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Focus fixture" });
  await expect(
    dialog.getByRole("heading", { name: "Focus fixture" }),
  ).toBeFocused();

  await dialog.getByRole("button", { name: "Confirm fixture" }).focus();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Cancel fixture" }),
  ).toBeFocused();
});

test("exposes transition lifecycle hooks and respects reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const trigger = page.getByRole("button", { name: "Delete project" }).first();
  const dialog = page.getByRole("alertdialog", {
    name: "Delete this project?",
  });
  const content = page.locator("[data-ormo-alert-dialog-content]").first();

  const startedWithHook = await trigger.evaluate((element) => {
    (element as HTMLElement).click();
    return document
      .querySelector("[data-ormo-alert-dialog-content]")
      ?.hasAttribute("data-starting-style");
  });
  expect(startedWithHook).toBe(true);
  await expect(content).not.toHaveAttribute("data-starting-style", "");
  await expect(dialog).toHaveCSS("transition-duration", "0s");

  const endedWithHook = await dialog
    .getByRole("button", { name: "Cancel" })
    .evaluate((element) => {
      (element as HTMLElement).click();
      return document
        .querySelector("[data-ormo-alert-dialog-content]")
        ?.hasAttribute("data-ending-style");
    });
  expect(endedWithHook).toBe(true);
  await expect(content).not.toHaveAttribute("data-ending-style", "");
});

test("restores focus to an explicit final destination", async ({ page }) => {
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.innerHTML = `
      <ormo-alert-dialog>
        <button type="button" data-ormo-alert-dialog-trigger>Open final focus fixture</button>
        <dialog data-final-focus="#final-focus-destination" data-ormo-alert-dialog-content>
          <h2 data-ormo-alert-dialog-title>Final focus fixture</h2>
          <p data-ormo-alert-dialog-description>Choose a response.</p>
          <button type="button" data-ormo-alert-dialog-action>Finish fixture</button>
        </dialog>
      </ormo-alert-dialog>
      <h2 id="final-focus-destination" tabindex="-1">Next task</h2>
    `;
    document.body.append(fixture);
  });

  await page.getByRole("button", { name: "Open final focus fixture" }).click();
  await page.getByRole("button", { name: "Finish fixture" }).click();

  await expect(page.getByRole("heading", { name: "Next task" })).toBeFocused();
});

test("keeps an async action open and exposes pending Button state", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Archive project" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Archive this project?",
  });
  const action = dialog.getByRole("button", { name: "Archive project" });

  await action.click();

  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-busy", "true");
  await expect(action).toHaveAttribute("data-pending", "");
  await expect(action).toHaveAttribute("aria-disabled", "true");

  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Project archived.", { exact: true }),
  ).toBeVisible();
});

test("supports a nested alert dialog while keeping its parent open", async ({
  page,
}) => {
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.innerHTML = `
      <ormo-alert-dialog>
        <button type="button" data-ormo-alert-dialog-trigger>Open parent fixture</button>
        <dialog data-ormo-alert-dialog-content>
          <h2 data-ormo-alert-dialog-title>Parent fixture</h2>
          <p data-ormo-alert-dialog-description>Parent alert.</p>
          <ormo-alert-dialog>
            <button type="button" data-ormo-alert-dialog-trigger>Open nested fixture</button>
            <dialog data-ormo-alert-dialog-content>
              <h2 data-ormo-alert-dialog-title>Nested fixture</h2>
              <p data-ormo-alert-dialog-description>Nested alert.</p>
              <button type="button" data-ormo-alert-dialog-cancel>Close nested fixture</button>
            </dialog>
          </ormo-alert-dialog>
          <button type="button" data-ormo-alert-dialog-cancel>Close parent fixture</button>
        </dialog>
      </ormo-alert-dialog>
    `;
    document.body.append(fixture);
  });

  await page.getByRole("button", { name: "Open parent fixture" }).click();
  const parent = page.getByRole("alertdialog", { name: "Parent fixture" });
  await parent.getByRole("button", { name: "Open nested fixture" }).click();
  const nested = page.getByRole("alertdialog", { name: "Nested fixture" });

  await expect(nested).toBeVisible();
  await expect(
    nested.getByRole("button", { name: "Close nested fixture" }),
  ).toBeFocused();

  await nested.getByRole("button", { name: "Close nested fixture" }).click();

  await expect(nested).toBeHidden();
  await expect(parent).toBeVisible();
  await expect(
    parent.getByRole("button", { name: "Open nested fixture" }),
  ).toBeFocused();
});

test("remains modal when closed and reopened in the same task", async ({
  page,
}) => {
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.innerHTML = `
      <ormo-alert-dialog id="reopen-alert">
        <button type="button" data-ormo-alert-dialog-trigger>Open reopen fixture</button>
        <dialog data-ormo-alert-dialog-content>
          <h2 data-ormo-alert-dialog-title>Reopen fixture</h2>
          <p data-ormo-alert-dialog-description>Check modal state.</p>
          <button type="button" data-ormo-alert-dialog-cancel>Cancel reopen fixture</button>
        </dialog>
      </ormo-alert-dialog>
    `;
    document.body.append(fixture);
  });

  await page.getByRole("button", { name: "Open reopen fixture" }).click();
  await page.evaluate(() => {
    const root = document.querySelector<
      HTMLElement & { close(): void; showModal(): void }
    >("#reopen-alert");
    root?.close();
    root?.showModal();
  });

  const root = page.locator("#reopen-alert");
  const dialog = page.getByRole("alertdialog", { name: "Reopen fixture" });
  await expect(dialog).toBeVisible();
  await expect(root).toHaveAttribute("data-state", "open");
  await expect(root).toHaveAttribute("data-open", "");
  await expect(page.locator("html")).toHaveAttribute(
    "data-ormo-scroll-locked",
    "",
  );
  expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(
    true,
  );
});

test("normalizes an open dialog when Root is moved", async ({ page }) => {
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.innerHTML = `
      <ormo-alert-dialog id="moved-alert">
        <button type="button" data-ormo-alert-dialog-trigger>Open moved fixture</button>
        <dialog data-ormo-alert-dialog-content>
          <h2 data-ormo-alert-dialog-title>Moved fixture</h2>
          <p data-ormo-alert-dialog-description>Check reconnect state.</p>
          <button type="button" data-ormo-alert-dialog-cancel>Cancel moved fixture</button>
        </dialog>
      </ormo-alert-dialog>
    `;
    document.body.append(fixture);
  });

  await page.getByRole("button", { name: "Open moved fixture" }).click();
  await page.evaluate(() => {
    const root = document.querySelector("#moved-alert");
    root?.remove();
    if (root) document.body.append(root);
  });

  const root = page.locator("#moved-alert");
  const dialog = root.locator("dialog");
  await expect(dialog).toBeHidden();
  await expect(root).toHaveAttribute("data-state", "closed");
  await expect(root).not.toHaveAttribute("data-open", "");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-ormo-scroll-locked",
    "",
  );
  expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(
    false,
  );
});

test("submit Action waits for validation and uncancelled submission", async ({
  page,
}) => {
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.innerHTML = `
      <ormo-alert-dialog id="submit-alert">
        <button type="button" data-ormo-alert-dialog-trigger>Open submit fixture</button>
        <dialog data-ormo-alert-dialog-content>
          <h2 data-ormo-alert-dialog-title>Submit fixture</h2>
          <p data-ormo-alert-dialog-description>Check form submission.</p>
          <form action="/test-submit" target="submit-target" data-submit-form>
            <input aria-label="Confirmation" required>
            <button type="button" data-ormo-alert-dialog-cancel>Cancel submit fixture</button>
            <button type="submit" value="save" data-ormo-alert-dialog-action>Save fixture</button>
          </form>
        </dialog>
      </ormo-alert-dialog>
      <iframe name="submit-target" hidden></iframe>
    `;
    const root = fixture.querySelector("ormo-alert-dialog");
    const form = fixture.querySelector<HTMLFormElement>("[data-submit-form]");
    root?.addEventListener("ormo:alert-dialog-open-change", (event) => {
      const detail = (event as CustomEvent<{ open: boolean; reason: string }>)
        .detail;
      if (!detail.open) root.dataset.closeReason = detail.reason;
    });
    form?.addEventListener("submit", (event) => {
      form.dataset.submitObserved = "true";
      if (form.dataset.prevent === "true") event.preventDefault();
      form.dataset.submitPrevented = String(event.defaultPrevented);
    });
    document.body.append(fixture);
  });

  const trigger = page.getByRole("button", { name: "Open submit fixture" });
  const dialog = page.getByRole("alertdialog", { name: "Submit fixture" });
  const input = dialog.getByRole("textbox", { name: "Confirmation" });
  const action = dialog.getByRole("button", { name: "Save fixture" });

  await trigger.click();
  await action.click();
  await expect(dialog).toBeVisible();

  await input.fill("confirmed");
  await dialog.locator("form").evaluate((form) => {
    form.dataset.prevent = "true";
  });
  await action.click();
  expect(
    await page.locator("#submit-alert").evaluate((root) => {
      const content = root.querySelector("dialog");
      const form = root.querySelector("form");
      return {
        open: content?.open,
        submitObserved: form?.dataset.submitObserved,
        submitPrevented: form?.dataset.submitPrevented,
        closeReason: root.dataset.closeReason,
      };
    }),
  ).toEqual({
    open: true,
    submitObserved: "true",
    submitPrevented: "true",
    closeReason: undefined,
  });

  await dialog.locator("form").evaluate((form) => {
    form.dataset.prevent = "false";
  });
  await action.click();
  await expect(dialog).toBeHidden();
  const root = page.locator("#submit-alert");
  await expect(root).toHaveAttribute("data-close-reason", "action");

  await root.evaluate((element) => {
    delete element.dataset.closeReason;
    const form = element.querySelector("form");
    if (!form) return;
    form.method = "dialog";
    form.removeAttribute("action");
    form.removeAttribute("target");
    form.dataset.prevent = "true";
  });
  await trigger.click();
  await action.click();
  await expect(dialog).toBeVisible();
  await expect(root).not.toHaveAttribute("data-close-reason", "action");

  await dialog.locator("form").evaluate((form) => {
    form.dataset.prevent = "false";
  });
  await action.click();
  await expect(dialog).toBeHidden();
  await expect(root).toHaveAttribute("data-close-reason", "action");
});

test("supports multiple detached triggers and restores focus to the invoker", async ({
  page,
}) => {
  const toolbarTrigger = page.getByRole("button", {
    name: "Delete from toolbar",
  });
  const menuTrigger = page.getByRole("button", { name: "Delete from menu" });
  const dialog = page.getByRole("alertdialog", {
    name: "Delete this saved view?",
  });

  await expect(toolbarTrigger).toHaveAttribute(
    "data-ormo-alert-dialog-for",
    "detached-delete-dialog",
  );
  await expect(toolbarTrigger).toHaveAttribute(
    "aria-controls",
    "detached-delete-dialog-content",
  );
  await expect(menuTrigger).toHaveAttribute(
    "aria-controls",
    "detached-delete-dialog-content",
  );

  await menuTrigger.click();

  await expect(dialog).toBeVisible();
  await expect(toolbarTrigger).toHaveAttribute("data-state", "open");
  await expect(menuTrigger).toHaveAttribute("data-state", "open");
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

  await expectNoAxeViolations(page, {
    include: "[data-alert-dialog-detached-demo]",
    label: "open detached alert dialog",
  });

  await page.keyboard.press("Escape");

  await expect(dialog).toBeHidden();
  await expect(menuTrigger).toBeFocused();
  await expect(toolbarTrigger).toHaveAttribute("data-state", "closed");
  await expect(menuTrigger).toHaveAttribute("data-state", "closed");
});
