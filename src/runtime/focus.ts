const focusableSelector = [
  "a[href]",
  "area[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "summary",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]",
].join(", ");

function isInsideClosedDetails(element: HTMLElement): boolean {
  const details = element.closest("details:not([open])");

  if (!details) {
    return false;
  }

  const summary = element.closest("summary");
  return !summary || summary.parentElement !== details;
}

function isRendered(element: HTMLElement): boolean {
  if (element.closest("[hidden], [inert]") || isInsideClosedDetails(element)) {
    return false;
  }

  const view = element.ownerDocument.defaultView;
  if (!view) {
    return true;
  }

  const styles = view.getComputedStyle(element);
  if (styles.display === "none" || styles.visibility === "hidden") {
    return false;
  }

  const documentHasLayout =
    element.ownerDocument.documentElement.getClientRects().length > 0;
  return !documentHasLayout || element.getClientRects().length > 0;
}

function isNativeDisabled(element: HTMLElement): boolean {
  return element.matches(":disabled");
}

function isValidSummary(element: HTMLElement): boolean {
  if (!(element instanceof HTMLElement) || element.tagName !== "SUMMARY") {
    return true;
  }

  const details = element.parentElement;
  return (
    details?.tagName === "DETAILS" &&
    details.querySelector(":scope > summary") === element
  );
}

function isRadioTabStop(element: HTMLElement): boolean {
  if (!(element instanceof HTMLInputElement) || element.type !== "radio") {
    return true;
  }

  if (!element.name || element.checked) {
    return true;
  }

  const radios = Array.from(
    element.ownerDocument.querySelectorAll<HTMLInputElement>(
      "input[type='radio']",
    ),
  ).filter(
    (radio) =>
      radio.name === element.name &&
      radio.form === element.form &&
      !isNativeDisabled(radio) &&
      isRendered(radio),
  );
  const checked = radios.find((radio) => radio.checked);

  return checked ? checked === element : radios[0] === element;
}

export function isProgrammaticallyFocusable(element: HTMLElement): boolean {
  if (
    !isRendered(element) ||
    isNativeDisabled(element) ||
    !isValidSummary(element)
  ) {
    return false;
  }

  return element.matches(focusableSelector);
}

export function resolveFinalFocus(options: {
  content: HTMLElement;
  explicitTarget: HTMLElement | undefined;
  invoker: HTMLElement | undefined;
  owner: HTMLElement;
  warningPrefix: string;
}): HTMLElement | undefined {
  const { content, explicitTarget, invoker, owner, warningPrefix } = options;

  if (
    explicitTarget?.isConnected &&
    isProgrammaticallyFocusable(explicitTarget)
  ) {
    return explicitTarget;
  }

  const selector = content.dataset.finalFocus?.trim();
  if (selector) {
    try {
      const target = owner.ownerDocument.querySelector<HTMLElement>(selector);
      if (target && isProgrammaticallyFocusable(target)) return target;

      if (import.meta.env.DEV) {
        console.warn(
          `${warningPrefix} finalFocus selector "${selector}" must match a focusable element.`,
          owner,
        );
      }
    } catch {
      if (import.meta.env.DEV) {
        console.warn(
          `${warningPrefix} finalFocus selector "${selector}" is not valid CSS.`,
          owner,
        );
      }
    }
  }

  return invoker?.isConnected && isProgrammaticallyFocusable(invoker)
    ? invoker
    : undefined;
}

export function isTabbable(element: HTMLElement): boolean {
  return (
    isProgrammaticallyFocusable(element) &&
    element.tabIndex >= 0 &&
    isRadioTabStop(element)
  );
}

export function getTabbableElements(
  root: ParentNode,
  owns: (element: HTMLElement) => boolean = () => true,
): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter((element) => owns(element) && isTabbable(element));
}
