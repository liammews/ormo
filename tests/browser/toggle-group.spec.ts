import { expect, test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test.beforeEach(async ({ page }) =>
  page.goto("/test-fixtures/browser/toggle-group/"),
);
test("selects and navigates items", async ({ page }) => {
  const left = page.getByRole("button", { name: "Align left" });
  const centre = page.getByRole("button", { name: "Align centre" });
  await left.focus();
  await page.keyboard.press("ArrowRight");
  await expect(centre).toBeFocused();
  await page.keyboard.press("Space");
  await expect(centre).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  await expect(centre).toHaveAttribute("aria-pressed", "true");
});
test("has no detectable accessibility violations", async ({ page }) => {
  await expectNoAxeViolations(page, {
    include: "[data-toggle-group-demo]",
    label: "toggle group",
  });
});

test("submits and resets the selected value", async ({ page }) => {
  await page.getByRole("button", { name: "Align centre" }).click();
  const selected = await page
    .locator("[data-toggle-group-form]")
    .evaluate((form) =>
      Array.from(new FormData(form as HTMLFormElement).entries()),
    );
  expect(selected).toEqual([["alignment", "centre"]]);
  await page
    .locator("[data-toggle-group-form]")
    .evaluate((form) => (form as HTMLFormElement).reset());
  await expect(
    page.getByRole("button", { name: "Align left" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("matches Tabs RTL navigation and supports bounded vertical focus", async ({
  page,
}) => {
  const root = page.locator("ormo-toggle-group");
  const left = page.getByRole("button", { name: "Align left" });
  const centre = page.getByRole("button", { name: "Align centre" });
  const right = page.getByRole("button", { name: "Align right" });
  await root.evaluate((element) => {
    element.style.direction = "rtl";
    (element as typeof element & { loopFocus: boolean }).loopFocus = false;
  });
  await left.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(centre).toBeFocused();
  await right.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(right).toBeFocused();
  await root.evaluate((element) => {
    (element as typeof element & { orientation: string }).orientation =
      "vertical";
  });
  await left.focus();
  await page.keyboard.press("ArrowDown");
  await expect(centre).toBeFocused();
  await page.keyboard.press("End");
  await expect(right).toBeFocused();
});

test("normalises removed selection and dynamic disabled items", async ({
  page,
}) => {
  const root = page.locator("ormo-toggle-group");
  const left = page.getByRole("button", { name: "Align left" });
  const centre = page.getByRole("button", { name: "Align centre" });
  await centre.evaluate(
    (button) => ((button as HTMLButtonElement).disabled = true),
  );
  await left.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Align right" })).toBeFocused();
  await left.evaluate((button) => button.remove());
  await expect(root).toHaveAttribute("data-value", '["right"]');
});
