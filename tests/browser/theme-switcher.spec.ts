import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const themeButton = (page: Page) => page.locator("[data-theme-switcher]");

test("cycles through system, light, and dark with animated icons", async ({
  page,
}) => {
  await page.goto("/docs/");
  await page.evaluate(() => localStorage.removeItem("ormo-docs-theme"));
  await page.reload();

  const button = themeButton(page);
  const root = page.locator("html");
  const systemIcon = button.locator('[data-theme-icon="system"]');
  const lightIcon = button.locator('[data-theme-icon="light"]');
  const darkIcon = button.locator('[data-theme-icon="dark"]');

  await expect(button).toHaveAttribute("data-ormo-button", "");
  await expect(button).toHaveAccessibleName(
    "Theme: System. Switch to light theme.",
  );
  await expect(button).toHaveCSS("width", "32px");
  await expect(button).toHaveCSS("height", "32px");
  await expect(root).toHaveAttribute("data-theme", "system");
  await expect(systemIcon).toHaveCSS("opacity", "1");

  await button.click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(button).toHaveAccessibleName(
    "Theme: Light. Switch to dark theme.",
  );
  await expect(systemIcon).toHaveCSS("opacity", "0");
  await expect(systemIcon).toHaveCSS("filter", "blur(4px)");
  await expect(systemIcon).toHaveCSS(
    "transform",
    "matrix(0.6, 0, 0, 0.6, 0, 0)",
  );
  await expect(lightIcon).toHaveCSS("opacity", "1");
  await expect(lightIcon).toHaveCSS("filter", "blur(0px)");
  await expect(lightIcon).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");

  await button.click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(button).toHaveAccessibleName(
    "Theme: Dark. Switch to system theme.",
  );
  await expect(lightIcon).toHaveCSS("opacity", "0");
  await expect(darkIcon).toHaveCSS("opacity", "1");

  await button.click();
  await expect(root).toHaveAttribute("data-theme", "system");
  await expect(darkIcon).toHaveCSS("opacity", "0");
  await expect(systemIcon).toHaveCSS("opacity", "1");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("ormo-docs-theme")))
    .toBe("system");
});

test("restores the saved theme before the page becomes interactive", async ({
  page,
}) => {
  await page.goto("/docs/");
  await page.evaluate(() => localStorage.setItem("ormo-docs-theme", "dark"));
  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(themeButton(page)).toHaveAccessibleName(
    "Theme: Dark. Switch to system theme.",
  );
  await expect(themeButton(page).locator('[data-theme-icon="dark"]')).toHaveCSS(
    "opacity",
    "1",
  );
});

test("system follows the OS while an explicit theme overrides it", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/docs/");
  await page.evaluate(() => localStorage.removeItem("ormo-docs-theme"));
  await page.reload();

  const root = page.locator("html");
  const canvasColor = () =>
    page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    );
  const lightCanvas = await canvasColor();

  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(canvasColor).not.toBe(lightCanvas);

  await themeButton(page).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect.poll(canvasColor).toBe(lightCanvas);
});

test("updates highlighted code when switching from dark to light", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/docs/components/button/");
  await page.evaluate(() => localStorage.setItem("ormo-docs-theme", "dark"));
  await page.reload();

  const highlightedToken = page.locator(".shiki span[style]").first();
  const tokenColor = () =>
    highlightedToken.evaluate((element) => getComputedStyle(element).color);
  const syntaxColorCount = () =>
    page
      .locator(".shiki span[style]")
      .evaluateAll(
        (elements) =>
          new Set(elements.map((element) => getComputedStyle(element).color))
            .size,
      );
  const darkTokenColor = await tokenColor();

  await expect.poll(syntaxColorCount).toBeGreaterThan(1);

  await themeButton(page).click();
  await themeButton(page).click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(tokenColor).not.toBe(darkTokenColor);
  await expect.poll(syntaxColorCount).toBeGreaterThan(1);
});
