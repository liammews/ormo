import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/dialog/");
});

test("opens modally, contains focus, closes, and restores focus", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "View notifications" });
  const dialog = page.getByRole("dialog", { name: "Notifications" }).first();
  const close = dialog.getByRole("button", { name: "Close" });

  await trigger.click();

  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog).toHaveAttribute("aria-labelledby", /-title$/);
  await expect(dialog).toHaveAttribute("aria-describedby", /-description$/);

  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();

  await close.click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("dismisses from Escape and the backdrop with distinct reasons", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "View notifications" });
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
    name: "View persistent notification",
  });
  const dialog = page.getByRole("dialog", { name: "Notifications" }).last();

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
  await expectNoAxeViolations(page, {
    include: "[data-dialog-demo]",
    label: "closed dialog demos",
  });

  await page.getByRole("button", { name: "View notifications" }).click();
  const openDialog = page
    .getByRole("dialog", { name: "Notifications" })
    .first();
  await expect(openDialog).not.toHaveAttribute("data-starting-style");
  await openDialog.evaluate(async (element) => {
    await Promise.allSettled(
      element.getAnimations().map((animation) => animation.finished),
    );
  });
  await expectNoAxeViolations(page, {
    include: "[data-dialog-demo]",
    label: "open dialog demo",
  });
});

test("fits within a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole("button", { name: "View notifications" }).click();

  const box = await page
    .getByRole("dialog", { name: "Notifications" })
    .first()
    .boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.width).toBeLessThanOrEqual(320);
  expect(box!.height).toBeLessThanOrEqual(640);
});

test("locks background scrolling until the dialog closes", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "View notifications" });
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
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(initialScroll);

  await page.keyboard.press("Escape");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-ormo-scroll-locked",
    "",
  );
  await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden");
});

test("allows close, outside, and Escape dismissal requests to be cancelled", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "View notifications" });
  const root = page.locator("ormo-dialog").first();
  const dialog = page.getByRole("dialog", { name: "Notifications" }).first();
  await root.evaluate((element) => {
    const reasons: string[] = [];
    element.addEventListener("ormo:dialog-before-close", (event) => {
      reasons.push((event as CustomEvent<{ reason: string }>).detail.reason);
      event.preventDefault();
    });
    (element as HTMLElement & { testReasons: string[] }).testReasons = reasons;
  });

  await trigger.click();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeVisible();

  await page.mouse.click(4, 4);
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  await expect
    .poll(() =>
      root.evaluate(
        (element) =>
          (element as HTMLElement & { testReasons: string[] }).testReasons,
      ),
    )
    .toEqual(["close", "outside", "escape"]);
});

test("remains modal when closed and reopened in the same task", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "View notifications" });
  const root = page.locator("ormo-dialog").first();
  const dialog = page.getByRole("dialog", { name: "Notifications" }).first();

  await trigger.click();
  await root.evaluate((element) => {
    const dialogRoot = element as HTMLElement & {
      close(): void;
      showModal(): void;
    };
    dialogRoot.close();
    dialogRoot.showModal();
  });
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
  const trigger = page.getByRole("button", { name: "View notifications" });
  const root = page.locator("ormo-dialog").first();

  await trigger.click();
  await root.evaluate((element) => {
    element.remove();
    document.body.append(element);
  });

  const content = root.locator("dialog");
  await expect(content).toBeHidden();
  await expect(root).toHaveAttribute("data-state", "closed");
  await expect(root).not.toHaveAttribute("data-open", "");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-ormo-scroll-locked",
    "",
  );
  expect(await content.evaluate((element) => element.matches(":modal"))).toBe(
    false,
  );
});

test("normalizes state and restores focus when open Content is removed", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "View notifications" });
  const root = page.locator("ormo-dialog").first();

  await trigger.click();
  await root.locator("dialog").evaluate((element) => element.remove());

  await expect(root).toHaveAttribute("data-state", "closed");
  await expect(root).not.toHaveAttribute("data-open", "");
  await expect(trigger).toBeFocused();
  await expect(trigger).not.toHaveAttribute("aria-controls");
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-ormo-scroll-locked",
    "",
  );
});

test("reconciles generated and authored accessible relationships", async ({
  page,
}) => {
  const root = page.locator("ormo-dialog").first();
  const content = root.locator("dialog");
  const title = content.locator("[data-ormo-dialog-title]");
  const description = content.locator("[data-ormo-dialog-description]");

  await title.evaluate((element) => {
    element.id = "runtime-dialog-title";
  });
  await description.evaluate((element) => {
    element.id = "runtime-dialog-description";
  });
  await expect(content).toHaveAttribute(
    "aria-labelledby",
    "runtime-dialog-title",
  );
  await expect(content).toHaveAttribute(
    "aria-describedby",
    "runtime-dialog-description",
  );

  await content.evaluate((element) => {
    element.setAttribute("aria-label", "Runtime preferences");
  });
  await expect(content).not.toHaveAttribute("aria-labelledby");
  await page.getByRole("button", { name: "View notifications" }).click();
  await expect(
    page.getByRole("dialog", { name: "Runtime preferences" }),
  ).toBeVisible();

  await content.evaluate((element) => {
    element.removeAttribute("aria-label");
  });
  await expect(content).toHaveAttribute(
    "aria-labelledby",
    "runtime-dialog-title",
  );
});

test("supports a native dialog form and reports its return value", async ({
  page,
}) => {
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.innerHTML = `
      <ormo-dialog id="form-dialog">
        <button type="button" data-ormo-dialog-trigger>Open form fixture</button>
        <dialog data-ormo-dialog-content>
          <h2 data-ormo-dialog-title>Form fixture</h2>
          <form method="dialog">
            <button type="submit" value="saved" data-ormo-dialog-close>Save fixture</button>
          </form>
        </dialog>
      </ormo-dialog>
    `;
    const root = fixture.querySelector("ormo-dialog");
    root?.addEventListener("ormo:dialog-open-change", (event) => {
      const detail = (
        event as CustomEvent<{
          open: boolean;
          reason: string;
          returnValue: string;
        }>
      ).detail;
      if (!detail.open) {
        root.setAttribute("data-close-reason", detail.reason);
        root.setAttribute("data-return-value", detail.returnValue);
      }
    });
    document.body.append(fixture);
  });

  const trigger = page.getByRole("button", { name: "Open form fixture" });
  await trigger.click();
  await page.getByRole("button", { name: "Save fixture" }).click();

  const root = page.locator("#form-dialog");
  await expect(page.getByRole("dialog", { name: "Form fixture" })).toBeHidden();
  await expect(root).toHaveAttribute("data-close-reason", "programmatic");
  await expect(root).toHaveAttribute("data-return-value", "saved");
  await expect(trigger).toBeFocused();
});

test("supports nested dialogs while keeping the parent open", async ({
  page,
}) => {
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.innerHTML = `
      <ormo-dialog id="parent-dialog">
        <button type="button" data-ormo-dialog-trigger>Open parent fixture</button>
        <dialog data-ormo-dialog-content>
          <h2 data-ormo-dialog-title>Parent fixture</h2>
          <ormo-dialog id="child-dialog">
            <button type="button" data-ormo-dialog-trigger>Open child fixture</button>
            <dialog data-ormo-dialog-content>
              <h2 data-ormo-dialog-title>Child fixture</h2>
              <button type="button" data-ormo-dialog-close>Close child fixture</button>
            </dialog>
          </ormo-dialog>
          <button type="button" data-ormo-dialog-close>Close parent fixture</button>
        </dialog>
      </ormo-dialog>
    `;
    document.body.append(fixture);
  });

  await page.getByRole("button", { name: "Open parent fixture" }).click();
  const parent = page.getByRole("dialog", { name: "Parent fixture" });
  const childTrigger = parent.getByRole("button", {
    name: "Open child fixture",
  });
  await childTrigger.click();

  const child = page.getByRole("dialog", { name: "Child fixture" });
  await expect(parent).toBeVisible();
  await expect(child).toBeVisible();

  await child.getByRole("button", { name: "Close child fixture" }).click();
  await expect(child).toBeHidden();
  await expect(parent).toBeVisible();
  await expect(childTrigger).toBeFocused();
});

test("restores focus to an explicit final destination", async ({ page }) => {
  await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.innerHTML = `
      <ormo-dialog>
        <button type="button" data-ormo-dialog-trigger>Open final focus fixture</button>
        <dialog data-final-focus="#dialog-final-focus" data-ormo-dialog-content>
          <h2 data-ormo-dialog-title>Final focus fixture</h2>
          <button type="button" data-ormo-dialog-close>Finish fixture</button>
        </dialog>
      </ormo-dialog>
      <h2 id="dialog-final-focus" tabindex="-1">Next task</h2>
    `;
    document.body.append(fixture);
  });

  await page.getByRole("button", { name: "Open final focus fixture" }).click();
  await page.getByRole("button", { name: "Finish fixture" }).click();

  await expect(page.getByRole("heading", { name: "Next task" })).toBeFocused();
});
