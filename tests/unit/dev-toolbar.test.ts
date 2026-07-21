import { describe, expect, it, vi } from "vitest";

import ormoDevToolbar from "../../src/dev-toolbar/integration";

describe("Ormo development toolbar integration", () => {
  it("registers an opt-in Astro toolbar app", () => {
    const addDevToolbarApp = vi.fn();
    const integration = ormoDevToolbar();
    const setup = integration.hooks?.["astro:config:setup"];

    expect(typeof setup).toBe("function");
    if (typeof setup !== "function") return;

    setup({ addDevToolbarApp } as never);

    expect(addDevToolbarApp).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ormo",
        name: "Ormo",
        entrypoint: expect.any(URL),
      }),
    );
  });
});
