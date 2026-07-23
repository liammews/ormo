import { describe, expect, it } from "vitest";

import {
  getAvatarSsrContext,
  renderWithAvatarContext,
} from "../../src/internal/avatar-ssr-context";

describe("avatar SSR context", () => {
  it("exposes the active context to nested renders", async () => {
    const context = { hasImageSource: false };
    let seen = false;

    await renderWithAvatarContext(context, async () => {
      const active = getAvatarSsrContext();
      expect(active).toBe(context);
      active!.hasImageSource = true;
      seen = true;
      return "";
    });

    expect(seen).toBe(true);
    expect(context.hasImageSource).toBe(true);
    expect(getAvatarSsrContext()).toBeUndefined();
  });
});
