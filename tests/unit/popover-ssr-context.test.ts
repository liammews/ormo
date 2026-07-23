import { describe, expect, it } from "vitest";

import {
  getPopoverSsrContext,
  renderWithPopoverContext,
} from "../../src/internal/popover-ssr-context";

describe("popover SSR context", () => {
  it("scopes nested popover contexts during render", async () => {
    const seen: Array<boolean | undefined> = [];

    await renderWithPopoverContext(
      { disablePointerDismissal: true },
      async () => {
        seen.push(getPopoverSsrContext()?.disablePointerDismissal);

        await renderWithPopoverContext(
          { disablePointerDismissal: false },
          async () => {
            seen.push(getPopoverSsrContext()?.disablePointerDismissal);
            return "";
          },
        );

        seen.push(getPopoverSsrContext()?.disablePointerDismissal);
        return "";
      },
    );

    expect(getPopoverSsrContext()).toBeUndefined();
    expect(seen).toEqual([true, false, true]);
  });
});
