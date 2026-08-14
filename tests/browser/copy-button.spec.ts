import { expect, test } from "@playwright/test";

test("copies when the Clipboard API is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });

    Object.defineProperty(Document.prototype, "execCommand", {
      configurable: true,
      value(command: string) {
        if (command !== "copy") return false;
        const textArea = this.querySelector("textarea[readonly]");
        if (textArea instanceof HTMLTextAreaElement) {
          this.documentElement.dataset.copiedText = textArea.value;
          return true;
        }
        return false;
      },
    });
  });
  await page.goto("/docs/components/button/");

  const button = page.locator("[data-copy-button]").first();
  const code = await button
    .locator("xpath=ancestor::*[@data-code-block]//code")
    .textContent();

  await button.click();

  await expect(button).toHaveAttribute("data-state", "copied");
  await expect(button).toHaveAccessibleName("Code copied");
  await expect(page.locator("html")).toHaveAttribute("data-copied-text", code!);
});

test("reports when the Clipboard API is restricted", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error("Clipboard restricted")),
      },
    });
  });
  await page.goto("/docs/components/button/");

  const button = page.locator("[data-copy-button]").first();

  await button.click();

  await expect(button).toHaveAttribute("data-state", "error");
  await expect(button).toHaveAccessibleName("Unable to copy code");
  await expect(button).toBeFocused();
});
