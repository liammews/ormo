import { afterEach, describe, expect, it, vi } from "vitest";

import {
  setAccordionContentState,
  setAccordionContentWidth,
} from "../../src/runtime/accordion-content-state";

const heightProperty = "--ormo-test-height";

function createAnimation(
  playState: AnimationPlayState = "running",
  endTime = 150,
): {
  animation: Animation;
  finish: () => void;
  finished: Promise<void>;
} {
  let finish: (() => void) | undefined;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const animation = {
    effect: {
      getComputedTiming: () => ({ endTime }),
    },
    finished,
    playState,
  } as unknown as Animation;

  return {
    animation,
    finish: () => finish?.(),
    finished,
  };
}

function mockMotion(element: HTMLElement, animation: Animation): void {
  vi.spyOn(globalThis, "getComputedStyle").mockReturnValue({
    animationDuration: "0s",
    animationName: "none",
    transitionDuration: "150ms",
    transitionProperty: "height",
  } as CSSStyleDeclaration);

  let animationReadCount = 0;
  element.getAnimations = () => (animationReadCount++ === 0 ? [] : [animation]);
}

function mockAnimationFrame(): () => void {
  let callback: FrameRequestCallback | undefined;

  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
    (nextCallback) => {
      callback = nextCallback;
      return 1;
    },
  );
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {
    callback = undefined;
  });

  return () => {
    const nextCallback = callback;
    callback = undefined;
    nextCallback?.(0);
  };
}

async function flushAnimation(finished: Promise<void>): Promise<void> {
  await finished;
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("accordion content state", () => {
  it("measures content and exposes a starting style while opening", async () => {
    const element = document.createElement("div");
    const { animation, finish, finished } = createAnimation();
    const runAnimationFrame = mockAnimationFrame();

    Object.defineProperty(element, "scrollHeight", {
      configurable: true,
      value: 120,
    });
    mockMotion(element, animation);
    element.dataset.state = "closed";
    element.hidden = true;
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("inert", "");

    setAccordionContentState(element, true, {
      animate: true,
      heightProperty,
    });

    expect(element.hidden).toBe(false);
    expect(element.dataset.state).toBe("open");
    expect(element.hasAttribute("aria-hidden")).toBe(false);
    expect(element.hasAttribute("inert")).toBe(false);
    expect(element.hasAttribute("data-starting-style")).toBe(true);
    expect(element.style.getPropertyValue(heightProperty)).toBe("120px");

    runAnimationFrame();
    expect(element.hasAttribute("data-starting-style")).toBe(false);

    finish();
    await flushAnimation(finished);

    expect(element.style.getPropertyValue(heightProperty)).toBe("auto");
  });

  it("keeps closing content rendered until its animation finishes", async () => {
    const trigger = document.createElement("button");
    const element = document.createElement("div");
    const input = document.createElement("input");
    const { animation, finish, finished } = createAnimation();
    const runAnimationFrame = mockAnimationFrame();

    Object.defineProperty(element, "scrollHeight", {
      configurable: true,
      value: 120,
    });
    mockMotion(element, animation);
    element.dataset.state = "open";
    element.append(input);
    document.body.append(trigger, element);
    input.focus();

    setAccordionContentState(element, false, {
      animate: true,
      fallbackFocus: trigger,
      heightProperty,
    });

    expect(document.activeElement).toBe(trigger);
    expect(element.hidden).toBe(false);
    expect(element.dataset.state).toBe("closed");
    expect(element.getAttribute("aria-hidden")).toBe("true");
    expect(element.hasAttribute("inert")).toBe(true);
    expect(element.hasAttribute("data-ending-style")).toBe(true);
    expect(element.style.getPropertyValue(heightProperty)).toBe("120px");

    runAnimationFrame();
    finish();
    await flushAnimation(finished);

    expect(element.hidden).toBe(true);
    expect(element.hasAttribute("data-ending-style")).toBe(false);
    expect(element.style.getPropertyValue(heightProperty)).toBe("auto");
  });

  it("makes until-found content searchable after its closing transition", async () => {
    const element = document.createElement("div");
    const { animation, finish, finished } = createAnimation();
    const runAnimationFrame = mockAnimationFrame();

    Object.defineProperty(element, "scrollHeight", {
      configurable: true,
      value: 120,
    });
    mockMotion(element, animation);
    element.dataset.state = "open";

    setAccordionContentState(element, false, {
      animate: true,
      heightProperty,
      hiddenUntilFound: true,
    });

    expect(element.hidden).toBe(false);
    expect(element.hasAttribute("inert")).toBe(true);

    runAnimationFrame();
    finish();
    await flushAnimation(finished);

    expect(element.getAttribute("hidden")).toBe("until-found");
    expect(element.hasAttribute("inert")).toBe(false);
  });

  it("cleans up a closing transition when it is rapidly reopened", () => {
    const element = document.createElement("div");
    const { animation } = createAnimation();
    const runAnimationFrame = mockAnimationFrame();

    Object.defineProperty(element, "scrollHeight", {
      configurable: true,
      value: 120,
    });
    mockMotion(element, animation);
    element.dataset.state = "open";
    document.body.append(element);

    setAccordionContentState(element, false, {
      animate: true,
      heightProperty,
    });
    setAccordionContentState(element, true, {
      animate: true,
      heightProperty,
    });

    expect(element.dataset.state).toBe("open");
    expect(element.hidden).toBe(false);
    expect(element.hasAttribute("aria-hidden")).toBe(false);
    expect(element.hasAttribute("inert")).toBe(false);
    expect(element.hasAttribute("data-ending-style")).toBe(false);

    runAnimationFrame();

    expect(element.style.getPropertyValue(heightProperty)).toBe("auto");
    expect(element.hasAttribute("data-starting-style")).toBe(false);
    expect(element.hasAttribute("data-ending-style")).toBe(false);
  });

  it("does not wait for an unrelated animation that was already running", async () => {
    const element = document.createElement("div");
    const decorativeAnimation = createAnimation("running", 30_000);
    const heightAnimation = createAnimation();
    const runAnimationFrame = mockAnimationFrame();
    let animationReadCount = 0;

    Object.defineProperty(element, "scrollHeight", {
      configurable: true,
      value: 120,
    });
    vi.spyOn(globalThis, "getComputedStyle").mockReturnValue({
      animationDuration: "0s",
      animationName: "none",
      transitionDuration: "150ms",
      transitionProperty: "height",
    } as CSSStyleDeclaration);
    element.getAnimations = () =>
      animationReadCount++ === 0
        ? [decorativeAnimation.animation]
        : [decorativeAnimation.animation, heightAnimation.animation];
    element.dataset.state = "open";

    setAccordionContentState(element, false, {
      animate: true,
      heightProperty,
    });

    runAnimationFrame();
    heightAnimation.finish();
    await flushAnimation(heightAnimation.finished);

    expect(element.hidden).toBe(true);
    expect(element.hasAttribute("data-ending-style")).toBe(false);
  });

  it("does not leave focus inside content when its fallback is disabled", () => {
    const trigger = document.createElement("button");
    const element = document.createElement("div");
    const input = document.createElement("input");

    vi.spyOn(globalThis, "getComputedStyle").mockReturnValue({
      animationDuration: "0s",
      animationName: "none",
      transitionDuration: "0s",
      transitionProperty: "none",
    } as CSSStyleDeclaration);
    trigger.disabled = true;
    element.dataset.state = "open";
    element.append(input);
    document.body.append(trigger, element);
    input.focus();

    setAccordionContentState(element, false, {
      animate: true,
      fallbackFocus: trigger,
      heightProperty,
    });

    expect(element.contains(document.activeElement)).toBe(false);
    expect(element.hidden).toBe(true);
  });

  it("does not wait indefinitely for a paused animation", () => {
    const element = document.createElement("div");
    const { animation } = createAnimation("paused");
    const runAnimationFrame = mockAnimationFrame();

    Object.defineProperty(element, "scrollHeight", {
      configurable: true,
      value: 120,
    });
    mockMotion(element, animation);
    element.dataset.state = "open";

    setAccordionContentState(element, false, {
      animate: true,
      heightProperty,
    });

    expect(element.hidden).toBe(false);
    runAnimationFrame();
    expect(element.hidden).toBe(true);
  });

  it("hides immediately when no motion is defined", () => {
    const element = document.createElement("div");

    vi.spyOn(globalThis, "getComputedStyle").mockReturnValue({
      animationDuration: "0s",
      animationName: "none",
      transitionDuration: "0s",
      transitionProperty: "none",
    } as CSSStyleDeclaration);
    element.dataset.state = "open";

    setAccordionContentState(element, false, {
      animate: true,
      heightProperty,
    });

    expect(element.hidden).toBe(true);
    expect(element.dataset.state).toBe("closed");
    expect(element.hasAttribute("data-ending-style")).toBe(false);
  });

  it("updates the exposed content width when its measurement changes", () => {
    const element = document.createElement("div");
    const widthProperty = "--ormo-test-width";

    Object.defineProperty(element, "scrollWidth", {
      configurable: true,
      value: 320,
    });
    setAccordionContentWidth(element, widthProperty);
    expect(element.style.getPropertyValue(widthProperty)).toBe("320px");

    Object.defineProperty(element, "scrollWidth", {
      configurable: true,
      value: 480,
    });
    setAccordionContentWidth(element, widthProperty);
    expect(element.style.getPropertyValue(widthProperty)).toBe("480px");
  });
});
