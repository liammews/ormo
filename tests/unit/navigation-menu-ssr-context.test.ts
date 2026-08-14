import { describe, expect, it } from "vitest";
import {
  getNavigationMenuContext,
  getNavigationMenuItemContext,
  renderWithNavigationMenuContext,
  renderWithNavigationMenuItemContext,
} from "../../src/internal/navigation-menu-ssr-context";

describe("navigation menu SSR context", () => {
  it("isolates nested root and item state", async () => {
    await renderWithNavigationMenuContext(
      { openValue: "products" },
      async () => {
        expect(getNavigationMenuContext()?.openValue).toBe("products");
        await renderWithNavigationMenuItemContext(
          { value: "products", open: true },
          async () => {
            expect(getNavigationMenuItemContext()).toEqual({
              value: "products",
              open: true,
            });
          },
        );
        expect(getNavigationMenuItemContext()).toBeUndefined();
      },
    );
    expect(getNavigationMenuContext()).toBeUndefined();
  });
});
