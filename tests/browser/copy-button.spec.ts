import { expect, test } from "@playwright/test";

test("reports when the Clipboard API is restricted", async ({ page }) => {
  await page.goto("/docs/components/button/");

  const button = page.locator("[data-copy-button]").first();

  await button.click();

  await expect(button).toHaveAttribute("data-state", "error");
  await expect(button).toHaveAccessibleName("Unable to copy code");
  await expect(button).toBeFocused();
});
