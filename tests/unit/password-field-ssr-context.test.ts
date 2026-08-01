import { describe, expect, it } from "vitest";
import {
  getPasswordFieldSsrContext,
  renderWithPasswordFieldContext,
} from "../../src/internal/password-field-ssr-context";

function context(visible: boolean) {
  return {
    visible,
    inputId: visible ? "visible-input" : "hidden-input",
    inputCount: 0,
    toggleCount: 0,
    inputDisabled: false,
  };
}

describe("password field SSR context", () => {
  it("scopes state across asynchronous and nested rendering", async () => {
    expect(getPasswordFieldSsrContext()).toBeUndefined();
    await renderWithPasswordFieldContext(context(false), async () => {
      await Promise.resolve();
      expect(getPasswordFieldSsrContext()?.visible).toBe(false);
      await renderWithPasswordFieldContext(context(true), async () => {
        await Promise.resolve();
        expect(getPasswordFieldSsrContext()?.visible).toBe(true);
        return "";
      });
      expect(getPasswordFieldSsrContext()?.visible).toBe(false);
      return "";
    });
    expect(getPasswordFieldSsrContext()).toBeUndefined();
  });
});
