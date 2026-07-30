import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) => {
  await page.goto("/test-fixtures/browser/tabs/");
});

test("selects panels from tabs", async ({ page }) => {
  const demo = page.locator('[data-tabs-demo="default"]');
  const overview = demo.getByRole("tab", { name: "Overview" });
  const projects = demo.getByRole("tab", { name: "Projects" });
  const overviewPanel = demo.locator(
    '[data-ormo-tabs-panel][data-value="overview"]',
  );
  const projectsPanel = demo.locator(
    '[data-ormo-tabs-panel][data-value="projects"]',
  );

  await expect(overview).toHaveAttribute("aria-selected", "true");
  await expect(overviewPanel).toBeVisible();

  await projects.click();
  await expect(projects).toHaveAttribute("aria-selected", "true");
  await expect(projectsPanel).toBeVisible();
  await expect(overview).toHaveAttribute("aria-selected", "false");
  await expect(overviewPanel).toBeHidden();
});

test("supports vertical orientation keyboard navigation", async ({ page }) => {
  const demo = page.locator('[data-tabs-demo="vertical"]');
  const overview = demo.getByRole("tab", { name: "Overview" });
  const team = demo.getByRole("tab", { name: "Team" });

  await overview.focus();
  await page.keyboard.press("ArrowDown");
  await expect(team).toBeFocused();
  await expect(overview).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Enter");
  await expect(team).toHaveAttribute("aria-selected", "true");
  await expect(
    demo.locator('[data-ormo-tabs-panel][data-value="team"]'),
  ).toBeVisible();
});

test("activates tabs on focus when configured", async ({ page }) => {
  const demo = page.locator('[data-tabs-demo="activate-on-focus"]');
  const overview = demo.getByRole("tab", { name: "Overview" });
  const api = demo.getByRole("tab", { name: "API" });

  await overview.focus();
  await page.keyboard.press("ArrowRight");
  await expect(api).toBeFocused();
  await expect(api).toHaveAttribute("aria-selected", "true");
  await expect(
    demo.locator('[data-ormo-tabs-panel][data-value="api"]'),
  ).toBeVisible();
});

test("skips disabled tabs", async ({ page }) => {
  const demo = page.locator('[data-tabs-demo="disabled"]');
  const overview = demo.getByRole("tab", { name: "Overview" });
  const projects = demo.getByRole("tab", { name: "Projects" });
  const billing = demo.getByRole("tab", { name: "Billing" });

  await expect(projects).toBeDisabled();
  await overview.focus();
  await page.keyboard.press("ArrowRight");
  await expect(billing).toBeFocused();
});

test("supports controlled value assignment", async ({ page }) => {
  const demo = page.locator('[data-tabs-demo="controlled"]');
  const projects = demo.getByRole("tab", { name: "Projects" });

  await page.locator("[data-tabs-select='projects']").click();
  await expect(projects).toHaveAttribute("aria-selected", "true");
  await expect(
    demo.locator('[data-ormo-tabs-panel][data-value="projects"]'),
  ).toBeVisible();
});

test("reflects defaultValue selection in server HTML", async ({ page }) => {
  await page.goto("/test-fixtures/browser/tabs/");

  const demo = page.locator('[data-tabs-demo="default"]');
  const overview = demo.getByRole("tab", { name: "Overview" });
  const overviewPanel = demo.locator(
    '[data-ormo-tabs-panel][data-value="overview"]',
  );
  const projectsPanel = demo.locator(
    '[data-ormo-tabs-panel][data-value="projects"]',
  );

  await expect(overview).toHaveAttribute("aria-selected", "true");
  await expect(overviewPanel).toBeVisible();
  await expect(overviewPanel).toHaveAttribute("data-state", "active");
  await expect(projectsPanel).toBeHidden();
  await expect(projectsPanel).toHaveAttribute("data-state", "inactive");
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  for (const demo of [
    "default",
    "vertical",
    "activate-on-focus",
    "disabled",
    "controlled",
  ]) {
    await expectNoAxeViolations(page, {
      include: `[data-tabs-demo="${demo}"]`,
      label: demo,
    });
  }
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("reflects defaultValue selection in server HTML", async ({ page }) => {
    await page.goto("/test-fixtures/browser/tabs/");

    const demo = page.locator('[data-tabs-demo="default"]');
    const overview = demo.getByRole("tab", { name: "Overview" });
    const overviewPanel = demo.locator(
      '[data-ormo-tabs-panel][data-value="overview"]',
    );
    const projectsPanel = demo.locator(
      '[data-ormo-tabs-panel][data-value="projects"]',
    );

    await expect(overview).toHaveAttribute("aria-selected", "true");
    await expect(overviewPanel).toBeVisible();
    await expect(overviewPanel).toHaveAttribute("data-state", "active");
    await expect(projectsPanel).toBeHidden();
    await expect(projectsPanel).toHaveAttribute("data-state", "inactive");
  });
});
