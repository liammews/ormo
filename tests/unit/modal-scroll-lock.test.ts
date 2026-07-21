import { afterEach, describe, expect, it } from "vitest";

import {
  lockModalScroll,
  unlockModalScroll,
} from "../../src/runtime/modal-scroll-lock";

afterEach(() => {
  document.documentElement.removeAttribute("data-ormo-scroll-locked");
  document.documentElement.style.removeProperty("overflow");
});

describe("modal scroll lock", () => {
  it("retains the lock until every modal owner releases it", () => {
    const dialog = document.createElement("ormo-dialog");
    const alertDialog = document.createElement("ormo-alert-dialog");

    lockModalScroll(document, dialog);
    lockModalScroll(document, alertDialog);
    unlockModalScroll(document, dialog);

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(
      document.documentElement.hasAttribute("data-ormo-scroll-locked"),
    ).toBe(true);

    unlockModalScroll(document, alertDialog);

    expect(document.documentElement.style.overflow).toBe("");
    expect(
      document.documentElement.hasAttribute("data-ormo-scroll-locked"),
    ).toBe(false);
  });

  it("restores the authored inline overflow value and priority", () => {
    const owner = document.createElement("ormo-dialog");
    document.documentElement.style.setProperty("overflow", "auto", "important");

    lockModalScroll(document, owner);
    expect(document.documentElement.style.getPropertyValue("overflow")).toBe(
      "hidden",
    );

    unlockModalScroll(document, owner);

    expect(document.documentElement.style.getPropertyValue("overflow")).toBe(
      "auto",
    );
    expect(document.documentElement.style.getPropertyPriority("overflow")).toBe(
      "important",
    );
  });

  it("preserves an application change made while locked", () => {
    const owner = document.createElement("ormo-dialog");
    lockModalScroll(document, owner);
    document.documentElement.style.setProperty("overflow", "clip");

    unlockModalScroll(document, owner);

    expect(document.documentElement.style.overflow).toBe("clip");
  });
});
