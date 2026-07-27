import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/accordion/");
});

test("opens and closes panels from triggers", async ({ page }) => {
  const demo = page.locator('[data-accordion-demo="default"]');
  const about = demo.getByRole("button", { name: "What is Ormo?" });
  const price = demo.getByRole("button", { name: "How much does it cost?" });
  const aboutPanel = demo.locator(
    '[data-ormo-accordion-item][data-value="about"] [data-ormo-accordion-content]',
  );
  const pricePanel = demo.locator(
    '[data-ormo-accordion-item][data-value="price"] [data-ormo-accordion-content]',
  );

  await about.click();
  await expect(about).toHaveAttribute("aria-expanded", "true");
  await expect(aboutPanel).toBeVisible();
  await expect(aboutPanel).toContainText("unstyled components");

  await price.click();
  await expect(price).toHaveAttribute("aria-expanded", "true");
  await expect(pricePanel).toBeVisible();
  await expect(about).toHaveAttribute("aria-expanded", "false");
  await expect(aboutPanel).toBeHidden();
});

test("keeps multiple panels open when type is multiple", async ({ page }) => {
  const demo = page.locator('[data-accordion-demo="multiple"]');
  const shipping = demo.getByRole("button", { name: "Shipping" });
  const returns = demo.getByRole("button", { name: "Returns" });

  await shipping.click();
  await returns.click();

  await expect(shipping).toHaveAttribute("aria-expanded", "true");
  await expect(returns).toHaveAttribute("aria-expanded", "true");
  await expect(
    demo.locator(
      '[data-ormo-accordion-item][data-value="shipping"] [data-ormo-accordion-content]',
    ),
  ).toBeVisible();
  await expect(
    demo.locator(
      '[data-ormo-accordion-item][data-value="returns"] [data-ormo-accordion-content]',
    ),
  ).toBeVisible();
});

test("allows collapsing the open panel by default", async ({ page }) => {
  const demo = page.locator('[data-accordion-demo="default"]');
  const about = demo.getByRole("button", { name: "What is Ormo?" });
  const panel = demo.locator(
    '[data-ormo-accordion-item][data-value="about"] [data-ormo-accordion-content]',
  );

  await about.click();
  await expect(about).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();

  await about.click();
  await expect(about).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();
});

test("keeps one panel open when collapsible is false", async ({ page }) => {
  const demo = page.locator('[data-accordion-demo="require-open"]');
  const shipping = demo.getByRole("button", { name: "Shipping" });
  const returns = demo.getByRole("button", { name: "Returns" });
  const panel = demo.locator(
    '[data-ormo-accordion-item][data-value="shipping"] [data-ormo-accordion-content]',
  );

  await expect(shipping).toHaveAttribute("aria-expanded", "true");
  await expect(shipping).toHaveAttribute("aria-disabled", "true");
  await expect(panel).toBeVisible();

  // aria-disabled keeps the control focusable; force the click to assert no-op close.
  await shipping.click({ force: true });
  await expect(shipping).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();

  await returns.click();
  await expect(returns).toHaveAttribute("aria-expanded", "true");
  await expect(shipping).toHaveAttribute("aria-expanded", "false");
});

test("disables an individual item while leaving others interactive", async ({
  page,
}) => {
  const demo = page.locator('[data-accordion-demo="disabled"]');
  const shipping = demo.getByRole("button", { name: "Shipping information" });
  const returns = demo.getByRole("button", { name: "Returns unavailable" });
  const warranty = demo.getByRole("button", { name: "Warranty" });

  await expect(returns).toHaveJSProperty("disabled", true);
  await expect(shipping).toHaveJSProperty("disabled", false);
  await expect(warranty).toHaveJSProperty("disabled", false);

  await warranty.click();
  await expect(warranty).toHaveAttribute("aria-expanded", "true");
  await expect(shipping).toHaveAttribute("aria-expanded", "false");
});

test("emits a non-cancelable value change after updating state", async ({
  page,
}) => {
  const root = page.locator("ormo-accordion").first();
  const about = root.getByRole("button", { name: "What is Ormo?" });

  await root.evaluate((element) => {
    element.addEventListener("ormo:value-change", (event) => {
      event.preventDefault();
      const valueEvent = event as CustomEvent<{ value: unknown }>;
      const accordion = element as HTMLElement & { value: unknown };

      element.dataset.observedDetail = String(valueEvent.detail.value);
      element.dataset.observedValue = String(accordion.value);
      element.dataset.observedCancelable = String(event.cancelable);
      element.dataset.observedPrevented = String(event.defaultPrevented);
    });
  });

  await about.click();

  await expect(about).toHaveAttribute("aria-expanded", "true");
  await expect(root).toHaveAttribute("data-observed-detail", "about");
  await expect(root).toHaveAttribute("data-observed-value", "about");
  await expect(root).toHaveAttribute("data-observed-cancelable", "false");
  await expect(root).toHaveAttribute("data-observed-prevented", "false");
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  for (const demo of [
    "default",
    "initial",
    "multiple",
    "require-open",
    "disabled",
  ]) {
    const results = await new AxeBuilder({ page })
      .include(`[data-accordion-demo="${demo}"]`)
      .analyze();
    expect(results.violations, demo).toEqual([]);
  }
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("reflects defaultValue open state in server HTML", async ({ page }) => {
    await page.goto("/test-fixtures/browser/accordion/");

    const demo = page.locator('[data-accordion-demo="initial"]');
    const aboutTrigger = demo.getByRole("button", { name: "What is Ormo?" });
    const aboutPanel = demo.locator(
      '[data-ormo-accordion-item][data-value="about"] [data-ormo-accordion-content]',
    );
    const pricePanel = demo.locator(
      '[data-ormo-accordion-item][data-value="price"] [data-ormo-accordion-content]',
    );

    await expect(aboutTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(aboutPanel).toBeVisible();
    await expect(aboutPanel).toContainText(
      "Ormo is a headless component library for Astro.",
    );
    await expect(aboutPanel).toHaveAttribute("data-state", "open");
    await expect(pricePanel).toBeHidden();
    await expect(pricePanel).toHaveAttribute("hidden", "until-found");
    await expect(pricePanel).not.toHaveAttribute("inert", "");
    await expect(pricePanel).toHaveAttribute("data-state", "closed");
  });
});
