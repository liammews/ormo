import { afterEach, describe, expect, it, vi } from "vitest";

import { PopupTransition } from "../../src/runtime/popup-transition";

function mockAnimationFrame(): () => void {
  let callback: FrameRequestCallback | undefined;
  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((next) => {
    callback = next;
    return 1;
  });
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {
    callback = undefined;
  });
  return () => {
    const next = callback;
    callback = undefined;
    next?.(0);
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("popup transition", () => {
  it("applies and clears the opening style after one frame", () => {
    const element = document.createElement("div");
    const transition = new PopupTransition();
    const runFrame = mockAnimationFrame();

    transition.beginOpening(element, () => true);
    expect(element.hasAttribute("data-starting-style")).toBe(true);

    runFrame();
    expect(element.hasAttribute("data-starting-style")).toBe(false);
  });

  it("waits for active closing animations", async () => {
    const element = document.createElement("div");
    const transition = new PopupTransition();
    const runFrame = mockAnimationFrame();
    let finish: (() => void) | undefined;
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    element.getAnimations = () =>
      [
        {
          effect: { getComputedTiming: () => ({ endTime: 100 }) },
          finished,
          playState: "running",
        },
      ] as unknown as Animation[];

    transition.beginClosing(element, () => false);
    runFrame();
    expect(element.hasAttribute("data-ending-style")).toBe(true);

    finish?.();
    await finished;
    await Promise.resolve();
    await Promise.resolve();
    expect(element.hasAttribute("data-ending-style")).toBe(false);
  });

  it("cancels stale closing work when reopened", () => {
    const element = document.createElement("div");
    const transition = new PopupTransition();
    const runFrame = mockAnimationFrame();

    transition.beginClosing(element, () => false);
    transition.beginOpening(element, () => true);
    expect(element.hasAttribute("data-ending-style")).toBe(false);
    expect(element.hasAttribute("data-starting-style")).toBe(true);

    runFrame();
    expect(element.hasAttribute("data-starting-style")).toBe(false);
  });
});
