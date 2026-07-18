const startingStyleAttribute = "data-starting-style";
const endingStyleAttribute = "data-ending-style";

interface CollapsibleState {
  frameId: number | undefined;
  version: number;
}

interface CollapsibleOptions {
  animate: boolean;
  fallbackFocus?: HTMLElement;
  heightProperty: `--${string}`;
}

const states = new WeakMap<HTMLElement, CollapsibleState>();

function getState(element: HTMLElement): CollapsibleState {
  const existingState = states.get(element);

  if (existingState) {
    return existingState;
  }

  const state: CollapsibleState = {
    frameId: undefined,
    version: 0,
  };

  states.set(element, state);
  return state;
}

function hasNonZeroDuration(value: string): boolean {
  return value
    .split(",")
    .map((part) => part.trim())
    .some((part) => part !== "" && Number.parseFloat(part) > 0);
}

function hasMotion(element: HTMLElement): boolean {
  const styles = getComputedStyle(element);
  const hasTransition =
    styles.transitionProperty !== "none" &&
    hasNonZeroDuration(styles.transitionDuration);
  const hasAnimation =
    styles.animationName
      .split(",")
      .map((name) => name.trim())
      .some((name) => name !== "" && name !== "none") &&
    hasNonZeroDuration(styles.animationDuration);

  return hasTransition || hasAnimation;
}

function getAnimationEndTime(animation: Animation): number | undefined {
  const endTime = animation.effect?.getComputedTiming().endTime;
  const numericEndTime = Number(endTime);

  return endTime !== null && Number.isFinite(numericEndTime)
    ? numericEndTime
    : undefined;
}

function getElementAnimations(element: HTMLElement): Animation[] {
  return typeof element.getAnimations === "function"
    ? element.getAnimations()
    : [];
}

function isHeightTransition(animation: Animation): boolean {
  return (
    "transitionProperty" in animation &&
    animation.transitionProperty === "height"
  );
}

function getFiniteAnimations(
  element: HTMLElement,
  existingAnimations: Set<Animation>,
): Animation[] {
  return getElementAnimations(element).filter(
    (animation) =>
      animation.playState !== "paused" &&
      getAnimationEndTime(animation) !== undefined &&
      (!existingAnimations.has(animation) || isHeightTransition(animation)),
  );
}

function waitForAnimations(animations: Animation[]): Promise<void> {
  const maximumEndTime = Math.max(
    ...animations.map((animation) => getAnimationEndTime(animation) ?? 0),
  );

  return new Promise((resolve) => {
    const timeoutId = setTimeout(resolve, maximumEndTime + 50);

    void Promise.allSettled(
      animations.map((animation) => animation.finished),
    ).then(() => {
      clearTimeout(timeoutId);
      resolve();
    });
  });
}

function beginUpdate(element: HTMLElement): {
  state: CollapsibleState;
  version: number;
} {
  const state = getState(element);
  state.version += 1;

  if (state.frameId !== undefined) {
    cancelAnimationFrame(state.frameId);
    state.frameId = undefined;
  }

  return { state, version: state.version };
}

function scheduleAnimationCompletion(
  element: HTMLElement,
  state: CollapsibleState,
  version: number,
  existingAnimations: Set<Animation>,
  start: () => void,
  complete: () => void,
): void {
  state.frameId = requestAnimationFrame(() => {
    state.frameId = undefined;

    if (state.version !== version) {
      return;
    }

    start();
    element.getBoundingClientRect();

    const animations = getFiniteAnimations(element, existingAnimations);

    if (animations.length === 0) {
      complete();
      return;
    }

    void waitForAnimations(animations).then(() => {
      if (state.version === version) {
        complete();
      }
    });
  });
}

function finishOpening(element: HTMLElement, heightProperty: string): void {
  if (element.dataset.state === "open") {
    element.style.setProperty(heightProperty, "auto");
  }
}

function finishClosing(element: HTMLElement, heightProperty: string): void {
  if (element.dataset.state !== "closed") {
    return;
  }

  element.hidden = true;
  element.removeAttribute(endingStyleAttribute);
  element.style.setProperty(heightProperty, "auto");
}

export function setCollapsibleState(
  element: HTMLElement,
  open: boolean,
  options: CollapsibleOptions,
): void {
  const { animate, fallbackFocus, heightProperty } = options;
  const { state, version } = beginUpdate(element);
  const existingAnimations = new Set(getElementAnimations(element));

  if (open) {
    const wasExiting = element.hasAttribute(endingStyleAttribute);

    element.hidden = false;
    element.removeAttribute("aria-hidden");
    element.removeAttribute("inert");
    element.removeAttribute(endingStyleAttribute);
    element.dataset.state = "open";

    if (!animate) {
      element.removeAttribute(startingStyleAttribute);
      element.style.setProperty(heightProperty, "auto");
      return;
    }

    if (wasExiting) {
      if (!hasMotion(element)) {
        finishOpening(element, heightProperty);
        return;
      }

      scheduleAnimationCompletion(
        element,
        state,
        version,
        existingAnimations,
        () => undefined,
        () => finishOpening(element, heightProperty),
      );
      return;
    }

    element.style.setProperty(heightProperty, "auto");
    const height = element.scrollHeight;
    element.style.setProperty(heightProperty, `${height}px`);
    element.setAttribute(startingStyleAttribute, "");

    if (height === 0 || !hasMotion(element)) {
      element.removeAttribute(startingStyleAttribute);
      finishOpening(element, heightProperty);
      return;
    }

    element.getBoundingClientRect();
    scheduleAnimationCompletion(
      element,
      state,
      version,
      existingAnimations,
      () => element.removeAttribute(startingStyleAttribute),
      () => finishOpening(element, heightProperty),
    );
    return;
  }

  element.removeAttribute(startingStyleAttribute);

  if (element.contains(element.ownerDocument.activeElement)) {
    fallbackFocus?.focus();

    const remainingActiveElement = element.ownerDocument.activeElement;
    if (
      element.contains(remainingActiveElement) &&
      remainingActiveElement instanceof HTMLElement
    ) {
      remainingActiveElement.blur();
    }
  }

  element.setAttribute("aria-hidden", "true");
  element.setAttribute("inert", "");

  if (!animate || element.hidden) {
    element.dataset.state = "closed";
    element.hidden = true;
    element.removeAttribute(endingStyleAttribute);
    element.style.setProperty(heightProperty, "auto");
    return;
  }

  const height = element.scrollHeight;
  element.style.setProperty(heightProperty, `${height}px`);
  element.getBoundingClientRect();
  element.dataset.state = "closed";
  element.setAttribute(endingStyleAttribute, "");

  if (height === 0 || !hasMotion(element)) {
    finishClosing(element, heightProperty);
    return;
  }

  scheduleAnimationCompletion(
    element,
    state,
    version,
    existingAnimations,
    () => undefined,
    () => finishClosing(element, heightProperty),
  );
}

export function cancelCollapsibleState(element: HTMLElement): void {
  beginUpdate(element);
}
