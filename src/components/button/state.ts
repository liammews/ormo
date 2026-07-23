import { initializeButtonRuntime } from "../../runtime/button";

export type ButtonElement =
  HTMLButtonElement | HTMLDivElement | HTMLSpanElement;

export interface ButtonState {
  disabled?: boolean;
  focusableWhenDisabled?: boolean;
  pending?: boolean;
}

const FOCUSABLE_WHEN_DISABLED_ATTR = "data-focusable-when-disabled";
const previousTabIndex = new WeakMap<HTMLElement, string | null>();

function assertButton(element: ButtonElement): void {
  if (!element.hasAttribute("data-ormo-button")) {
    throw new TypeError("setButtonState expects an Ormo Button element.");
  }
}

function resolveFocusableTabIndex(
  element: HTMLElement,
  previous: string | null | undefined,
): number {
  if (previous !== undefined && previous !== null) {
    const parsed = Number(previous);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  if (element.tabIndex >= 0) {
    return element.tabIndex;
  }

  return 0;
}

function setDisabled(
  element: ButtonElement,
  disabled: boolean,
  focusableWhenDisabled: boolean,
): void {
  const isNativeButton = element.tagName === "BUTTON";

  element.toggleAttribute("data-disabled", disabled);
  element.toggleAttribute(FOCUSABLE_WHEN_DISABLED_ATTR, focusableWhenDisabled);

  if (isNativeButton) {
    const nativeElement = element as HTMLButtonElement;
    nativeElement.disabled = disabled && !focusableWhenDisabled;

    if (disabled && focusableWhenDisabled) {
      nativeElement.setAttribute("aria-disabled", "true");
    } else {
      nativeElement.removeAttribute("aria-disabled");
    }
    return;
  }

  if (disabled) {
    element.setAttribute("aria-disabled", "true");
  } else {
    element.removeAttribute("aria-disabled");
  }

  if (disabled) {
    if (!previousTabIndex.has(element)) {
      previousTabIndex.set(element, element.getAttribute("tabindex"));
    }

    element.tabIndex = focusableWhenDisabled
      ? resolveFocusableTabIndex(element, previousTabIndex.get(element))
      : -1;
    return;
  }

  const previous = previousTabIndex.get(element);
  previousTabIndex.delete(element);

  if (previous === null) {
    element.removeAttribute("tabindex");
  } else if (previous !== undefined) {
    element.setAttribute("tabindex", previous);
  } else if (element.tabIndex < 0) {
    // A server-rendered disabled non-native Button has no client-side snapshot.
    element.tabIndex = 0;
  }
}

function setPending(element: ButtonElement, pending: boolean): void {
  element.toggleAttribute("data-pending", pending);

  if (pending) {
    element.setAttribute("aria-busy", "true");
  } else {
    element.removeAttribute("aria-busy");
  }
}

/** Synchronizes interactive and styling state on a rendered Ormo Button. */
export function setButtonState(
  element: ButtonElement,
  state: ButtonState,
): void {
  assertButton(element);
  initializeButtonRuntime(element.ownerDocument);

  if (state.pending !== undefined) {
    setPending(element, state.pending);
  }

  if (state.focusableWhenDisabled !== undefined) {
    element.toggleAttribute(
      FOCUSABLE_WHEN_DISABLED_ATTR,
      state.focusableWhenDisabled,
    );
  }

  const focusableWhenDisabled =
    state.focusableWhenDisabled ??
    element.hasAttribute(FOCUSABLE_WHEN_DISABLED_ATTR);

  if (state.disabled !== undefined) {
    setDisabled(element, state.disabled, focusableWhenDisabled);
    return;
  }

  if (
    state.focusableWhenDisabled !== undefined &&
    element.hasAttribute("data-disabled")
  ) {
    setDisabled(element, true, focusableWhenDisabled);
  }
}
