import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) =>
  page.goto("/test-fixtures/browser/toggle/"),
);
test("changes pressed state with native activation", async ({ page }) => {
  const toggle = page.getByRole("button", { name: "Bold text" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});
test("has no detectable accessibility violations", async ({ page }) => {
  await expectNoAxeViolations(page, {
    include: "[data-toggle-demo]",
    label: "toggle",
  });
});

test("supports controlled cancellation and dynamic disabled state", async ({
  page,
}) => {
  const toggle = page.getByRole("button", { name: "Bold text" });
  await toggle.evaluate((button) => {
    button.setAttribute("data-controlled", "");
    button.addEventListener("ormo:pressed-change", (event) =>
      event.preventDefault(),
    );
    (button as HTMLButtonElement).disabled = true;
  });
  await expect(toggle).toBeDisabled();
  await expect(toggle).toHaveAttribute("data-disabled", "");
  await toggle.evaluate(
    (button) => ((button as HTMLButtonElement).disabled = false),
  );
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
});
