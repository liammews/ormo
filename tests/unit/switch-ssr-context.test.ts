import { describe, expect, it } from "vitest";
import {
  getSwitchSsrContext,
  renderWithSwitchContext,
} from "../../src/internal/switch-ssr-context";

describe("switch SSR context", () => {
  it("scopes state across asynchronous rendering", async () => {
    expect(getSwitchSsrContext()).toBeUndefined();
    await renderWithSwitchContext(
      { checked: true, disabled: false, readOnly: false, required: true },
      async () => {
        await Promise.resolve();
        expect(getSwitchSsrContext()?.checked).toBe(true);
        return "";
      },
    );
    expect(getSwitchSsrContext()).toBeUndefined();
  });
});
