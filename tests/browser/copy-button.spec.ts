import { expect, test } from "@playwright/test";

test("copies code when the Clipboard API is restricted", async ({ page }) => {
  await page.goto("/docs/components/button/");

  const button = page.locator("[data-copy-button]").first();

  await button.click();

  await expect(button).toHaveAttribute("data-state", "copied");
  await expect(button).toHaveAccessibleName("Code copied");
  await expect(button).toBeFocused();
});
