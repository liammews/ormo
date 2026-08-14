import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

const path = "/test-fixtures/browser/preview-card/";

test("opens after pointer interest and remains open over the preview", async ({
  page,
}) => {
  await page.goto(path);
  const demo = page.locator(".preview-card-demo");
  const trigger = demo.locator("[data-ormo-preview-card-trigger]");
  const content = demo.locator("[data-ormo-preview-card-content]");
  await trigger.hover();
  await expect(content).toBeVisible();
  await content.hover();
  await page.waitForTimeout(350);
  await expect(content).toBeVisible();
});

test("opens visually on focus and closes with Escape", async ({ page }) => {
  await page.goto(path);
  const demo = page.locator(".preview-card-demo");
  const trigger = demo.locator("[data-ormo-preview-card-trigger]");
  const content = demo.locator("[data-ormo-preview-card-content]");
  await trigger.focus();
  await expect(content).toBeVisible();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(content).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("keeps preview content out of the accessibility tree", async ({
  page,
}) => {
  await page.goto(path);
  const demo = page.locator(".preview-card-demo");
  const trigger = demo.locator("[data-ormo-preview-card-trigger]");
  const content = demo.locator("[data-ormo-preview-card-content]");
  await expect(content).toHaveAttribute("aria-hidden", "true");
  await expect(trigger).not.toHaveAttribute("aria-describedby", /.+/);
  await trigger.hover();
  await expectNoAxeViolations(page);
});

test("keeps consumer layout styles hidden while closed", async ({ page }) => {
  await page.goto(path);
  const content = page
    .locator(".preview-card-demo [data-ormo-preview-card-content]")
    .first();
  await content.evaluate((element) => {
    element.style.display = "grid";
  });
  await expect(content).toBeHidden();
});

test("enhances an initially open preview without stale state", async ({
  page,
}) => {
  await page.goto(path);
  const root = page.locator("[data-initial-preview]");
  const content = root.locator("[data-ormo-preview-card-content]");
  await expect(content).toBeVisible();
  await expect(root).toHaveAttribute("data-state", "open");
  await expect(
    root.locator("[data-ormo-preview-card-trigger]"),
  ).toHaveAttribute("data-state", "open");
});

test("reacts to Floating UI placement changes and cleans up", async ({
  page,
}) => {
  await page.goto(path);
  const root = page.locator("[data-floating-preview]");
  const trigger = root.locator("[data-ormo-preview-card-trigger]");
  const content = root.locator("[data-ormo-preview-card-content]");
  await trigger.focus();
  await expect(content).toHaveAttribute("data-resolved-side", /.+/);
  const initialTop = await content.evaluate((element) => element.style.top);
  await content.evaluate((element) => {
    element.dataset.align = "end";
    element.style.setProperty("--ormo-preview-card-side-offset", "16px");
  });
  await expect
    .poll(() => content.evaluate((element) => element.style.top))
    .not.toBe(initialTop);
  const initialWidth = await content.evaluate((element) =>
    element.style.getPropertyValue("--ormo-preview-card-trigger-width"),
  );
  await trigger.evaluate((element) => {
    element.style.display = "inline-block";
    element.style.width = "200px";
  });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await expect
    .poll(() =>
      content.evaluate((element) =>
        element.style.getPropertyValue("--ormo-preview-card-trigger-width"),
      ),
    )
    .not.toBe(initialWidth);
  await page.keyboard.press("Escape");
  await expect(content).not.toHaveAttribute("data-resolved-side", /.+/);
  await expect(content).not.toHaveAttribute(
    "data-ormo-preview-card-positioning",
    /.+/,
  );
  await expect
    .poll(() =>
      content.evaluate((element) =>
        element.style.getPropertyValue("--ormo-preview-card-trigger-width"),
      ),
    )
    .toBe("");
});

test("does not open a visual preview from touch focus", async ({ page }) => {
  await page.goto(path);
  const root = page.locator(".preview-card-demo [data-ormo-preview-card-root]");
  const trigger = root.locator("[data-ormo-preview-card-trigger]");
  const content = root.locator("[data-ormo-preview-card-content]");
  await trigger.dispatchEvent("pointerdown", { pointerType: "touch" });
  await trigger.focus();
  await expect(content).toBeHidden();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("keeps the destination link available", async ({ page }) => {
    await page.goto(path);
    const trigger = page.locator(
      ".preview-card-demo [data-ormo-preview-card-trigger]",
    );
    await expect(trigger).toHaveAttribute("href", "https://astro.build");
    await expect(trigger).toBeVisible();
  });

  test("keeps default-open content closed without enhancement", async ({
    page,
  }) => {
    await page.goto(path);
    const content = page.locator(
      "[data-initial-preview] [data-ormo-preview-card-content]",
    );
    await expect(content).toBeHidden();
  });
});
