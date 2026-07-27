import {
  cancelButtonPress,
  initializeButtonRuntime,
} from "../../runtime/button";

export type ButtonElement =
  HTMLButtonElement | HTMLDivElement | HTMLSpanElement;

export interface ButtonState {
  disabled?: boolean;
  focusableWhenDisabled?: boolean;
  pending?: boolean;
}

const DISABLED_ATTR = "data-ormo-button-disabled";
const FOCUSABLE_WHEN_DISABLED_ATTR = "data-focusable-when-disabled";
const RESTORABLE_TABINDEX_ATTR = "data-ormo-button-tabindex";
const previousTabIndex = new WeakMap<HTMLElement, string | null>();

function assertButton(element: ButtonElement): void {
  if (!element.hasAttribute("data-ormo-button")) {
    throw new TypeError("setButtonState expects an Ormo Button element.");
  }
}

function getRestorableTabIndex(
  element: HTMLElement,
): string | null | undefined {
  if (previousTabIndex.has(element)) {
    return previousTabIndex.get(element);
  }

  if (element.hasAttribute(RESTORABLE_TABINDEX_ATTR)) {
    return element.getAttribute(RESTORABLE_TABINDEX_ATTR);
  }

  return undefined;
}

function applyFocusableTabIndex(
  element: HTMLElement,
  restorable: string | null | undefined,
): void {
  if (restorable !== undefined && restorable !== null) {
    const parsed = Number(restorable);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      element.setAttribute("tabindex", restorable);
      return;
    }
  }

  element.tabIndex = 0;
}

function setDisabled(
  element: ButtonElement,
  disabled: boolean,
  focusableWhenDisabled: boolean,
): void {
  const isNativeButton = element.tagName === "BUTTON";
  const wasDisabled = element.hasAttribute(DISABLED_ATTR);

  if (disabled) {
    cancelButtonPress(element);
  }

  if (isNativeButton && disabled) {
    (element as HTMLButtonElement).disabled = true;
  }

  if (!isNativeButton && disabled && !wasDisabled) {
    previousTabIndex.set(element, element.getAttribute("tabindex"));
  }

  element.toggleAttribute(DISABLED_ATTR, disabled);
  element.toggleAttribute("data-disabled", disabled);
  element.toggleAttribute(FOCUSABLE_WHEN_DISABLED_ATTR, focusableWhenDisabled);

  if (isNativeButton) {
    const nativeElement = element as HTMLButtonElement;

    if (disabled && focusableWhenDisabled) {
      nativeElement.setAttribute("aria-disabled", "true");
      nativeElement.disabled = false;
    } else {
      nativeElement.removeAttribute("aria-disabled");
      nativeElement.disabled = disabled;
    }
    return;
  }

  if (disabled) {
    element.setAttribute("aria-disabled", "true");

    if (focusableWhenDisabled) {
      applyFocusableTabIndex(element, getRestorableTabIndex(element));
    } else {
      element.tabIndex = -1;
    }
    return;
  }

  element.removeAttribute("aria-disabled");

  if (!wasDisabled) {
    return;
  }

  const restorable = getRestorableTabIndex(element);
  previousTabIndex.delete(element);

  if (restorable === null) {
    element.removeAttribute("tabindex");
  } else if (restorable !== undefined) {
    element.setAttribute("tabindex", restorable);
  } else if (element.tabIndex < 0) {
    // Legacy server-rendered markup may not include a restorable snapshot.
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
    element.hasAttribute(DISABLED_ATTR)
  ) {
    setDisabled(element, true, focusableWhenDisabled);
  }
}
