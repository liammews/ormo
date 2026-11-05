import { expect, test, type Locator, type Page } from "@playwright/test";

// A Tailwind-like consumer stylesheet. Every rule is in a cascade layer. The
// utility also tries to change behaviour-critical placement properties.
const layeredCss = `
@layer base, utilities;

@layer base {
  *, ::before, ::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    border: 0 solid;
  }
}

@layer utilities {
  .layered-surface {
    position: static;
    inset: 0;
    margin: 3px;
    border: 2px solid rgb(0, 128, 0);
    padding: 8px;
    overflow: hidden;
    color: rgb(0, 0, 255);
    background-color: rgb(255, 0, 0);
  }
}
`;

const sideOffset = 10;

type Opener = (demo: Locator, page: Page) => Promise<void>;

const primitives: Record<string, Opener> = {
  tooltip: async (demo) => {
    await demo.getByRole("button", { name: "Bold" }).focus();
  },
  popover: async (demo) => {
    await demo.getByRole("button", { name: "Filters" }).click();
  },
  select: async (demo) => {
    await demo.getByRole("combobox", { name: "Country" }).click();
  },
  "dropdown-menu": async (demo) => {
    await demo.getByRole("button", { name: "Actions" }).click();
  },
  "preview-card": async (demo) => {
    await demo.getByRole("link", { name: "Astro" }).focus();
  },
  combobox: async (demo) => {
    const input = demo.getByRole("combobox", { name: "Fruit" });
    await input.focus();
    await input.press("ArrowDown");
  },
  autocomplete: async (demo) => {
    await demo.getByRole("combobox", { name: "City" }).fill("L");
  },
};

for (const order of ["before", "after"] as const) {
  test.describe(`consumer layers declared ${order} runtime CSS`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/test-fixtures/browser/cascade-layers/");
      await page.evaluate(
        ({ css, prepend }) => {
          const style = document.createElement("style");
          style.textContent = css;
          if (prepend) document.head.prepend(style);
          else document.head.append(style);
        },
        { css: layeredCss, prepend: order === "before" },
      );
    });

    for (const [id, open] of Object.entries(primitives)) {
      test(`${id} content takes layered presentation and keeps placement`, async ({
        page,
      }) => {
        const demo = page.locator(`[data-cascade-demo="${id}"]`);
        const content = demo.locator(".layered-surface");

        await open(demo, page);
        await expect(content).toBeVisible();
        await expect(content).toHaveAttribute("data-side", "bottom");

        // Presentation: the layered consumer rule wins.
        await expect(content).toHaveCSS("background-color", "rgb(255, 0, 0)");
        await expect(content).toHaveCSS("color", "rgb(0, 0, 255)");
        await expect(content).toHaveCSS("padding-left", "8px");
        await expect(content).toHaveCSS("border-left-width", "2px");
        await expect(content).toHaveCSS("border-left-color", "rgb(0, 128, 0)");
        await expect(content).toHaveCSS("overflow", "hidden");
        await expect(content).toHaveCSS("margin-left", "3px");

        // Behaviour: placement and sideOffset still win over the layers.
        await expect(content).toHaveCSS("position", "fixed");
        await expect(content).toHaveCSS("margin-top", `${sideOffset}px`);

        const gap = await content.evaluate((element) => {
          const anchor = [
            ...(element.closest("[data-cascade-demo]")?.querySelectorAll("*") ??
              []),
          ].find(
            (candidate): candidate is HTMLElement =>
              candidate instanceof HTMLElement &&
              candidate.style.getPropertyValue("anchor-name") !== "",
          );
          if (!anchor) return null;
          return (
            element.getBoundingClientRect().top -
            anchor.getBoundingClientRect().bottom
          );
        });
        expect(gap).not.toBeNull();
        expect(gap).toBeCloseTo(sideOffset, 0);
      });
    }
  });
}
