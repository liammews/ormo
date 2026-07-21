import { initializeButtonRuntime } from "../../runtime/button";

export type ButtonElement =
  HTMLButtonElement | HTMLDivElement | HTMLSpanElement;

export interface ButtonState {
  disabled?: boolean;
  focusableWhenDisabled?: boolean;
  pending?: boolean;
}

const previousTabIndex = new WeakMap<HTMLElement, string | null>();

function assertButton(element: ButtonElement): void {
  if (!element.hasAttribute("data-ormo-button")) {
    throw new TypeError("setButtonState expects an Ormo Button element.");
  }
}

function setDisabled(
  element: ButtonElement,
  disabled: boolean,
  focusableWhenDisabled: boolean,
): void {
  const isNativeButton = element.tagName === "BUTTON";

  element.toggleAttribute("data-disabled", disabled);

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

    element.tabIndex = focusableWhenDisabled ? 0 : -1;
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

/** Synchronizes interactive and styling state on a rendered Ormo Button. */
export function setButtonState(
  element: ButtonElement,
  state: ButtonState,
): void {
  assertButton(element);
  initializeButtonRuntime(element.ownerDocument);

  if (state.pending !== undefined) {
    element.toggleAttribute("data-pending", state.pending);
  }

  if (state.disabled !== undefined) {
    setDisabled(element, state.disabled, state.focusableWhenDisabled ?? false);
  }
}
