const nonNativeButtonSelector =
  '[data-ormo-button][data-native-button="false"]';
const disabledButtonSelector = "[data-ormo-button][data-ormo-button-disabled]";
const focusableDisabledNativeSelector =
  'button[data-ormo-button][data-native-button="true"]' +
  "[data-ormo-button-disabled][data-focusable-when-disabled]";
const activeSpaceButtons = new WeakMap<Document, HTMLElement>();
const pendingSpaceKeyDowns = new WeakMap<Document, KeyboardEvent>();
const afterPropagationCallbacks = new WeakMap<Event, () => void>();
const initializedDocuments = new WeakSet<Document>();

function closestButton(
  event: Event,
  selector: string,
): HTMLElement | undefined {
  const target = event.target;

  if (!(target instanceof Element)) {
    return undefined;
  }

  return target.closest<HTMLElement>(selector) ?? undefined;
}

function preventDisabledInteraction(event: Event): void {
  const button = closestButton(event, disabledButtonSelector);

  if (!button) {
    return;
  }

  if (event instanceof KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    if (event.key === " ") {
      cancelButtonPress(button);
    }
  }

  event.preventDefault();
  event.stopImmediatePropagation();
}

function preventDisabledSubmit(event: Event): void {
  if (!(event instanceof SubmitEvent)) {
    return;
  }

  const submitter = event.submitter;

  if (
    submitter instanceof HTMLElement &&
    submitter.matches(disabledButtonSelector)
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

function completeAfterPropagation(event: Event): void {
  const callback = afterPropagationCallbacks.get(event);
  if (!callback) {
    return;
  }

  afterPropagationCallbacks.delete(event);
  callback();
}

/** Decides activation after consumers have handled the keyboard event. */
function afterPropagation(event: Event, callback: () => void): void {
  afterPropagationCallbacks.set(event, callback);
  setTimeout(() => completeAfterPropagation(event), 0);
}

function handleKeyDownCapture(event: KeyboardEvent): void {
  const button = closestButton(event, nonNativeButtonSelector);

  if (
    !button ||
    event.target !== button ||
    (event.key !== "Enter" && event.key !== " ")
  ) {
    return;
  }

  const targetDocument = button.ownerDocument;

  if (event.key === " " && !event.repeat) {
    activeSpaceButtons.delete(targetDocument);
    pendingSpaceKeyDowns.set(targetDocument, event);
  }

  afterPropagation(event, () => {
    if (pendingSpaceKeyDowns.get(targetDocument) === event) {
      pendingSpaceKeyDowns.delete(targetDocument);
    }
    if (
      event.defaultPrevented ||
      button.hasAttribute("data-ormo-button-disabled")
    ) {
      return;
    }

    if (event.key === "Enter") {
      button.click();
    } else {
      event.preventDefault();
      if (!event.repeat) {
        activeSpaceButtons.set(targetDocument, button);
      }
    }
  });
}

function handleKeyUpCapture(event: KeyboardEvent): void {
  if (event.key !== " ") {
    return;
  }

  const button = closestButton(event, nonNativeButtonSelector);
  const targetDocument =
    button?.ownerDocument ??
    (event.currentTarget instanceof Document ? event.currentTarget : document);
  const pendingKeyDown = pendingSpaceKeyDowns.get(targetDocument);
  if (pendingKeyDown) {
    completeAfterPropagation(pendingKeyDown);
  }

  const pressedButton = activeSpaceButtons.get(targetDocument);
  activeSpaceButtons.delete(targetDocument);

  if (!button || event.target !== button || pressedButton !== button) {
    return;
  }

  afterPropagation(event, () => {
    if (
      event.defaultPrevented ||
      button.hasAttribute("data-ormo-button-disabled")
    ) {
      return;
    }

    button.click();
  });
}

function clearSpacePress(event: FocusEvent): void {
  const button = closestButton(event, nonNativeButtonSelector);

  if (button) {
    cancelButtonPress(button);
  }
}

export function cancelButtonPress(button: HTMLElement): void {
  const targetDocument = button.ownerDocument;
  const pendingKeyDown = pendingSpaceKeyDowns.get(targetDocument);

  if (pendingKeyDown?.target === button) {
    pendingSpaceKeyDowns.delete(targetDocument);
    afterPropagationCallbacks.delete(pendingKeyDown);
  }

  if (activeSpaceButtons.get(targetDocument) === button) {
    activeSpaceButtons.delete(targetDocument);
  }
}

function upgradeFocusableDisabledNativeButtons(root: ParentNode): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>(
    focusableDisabledNativeSelector,
  )) {
    button.setAttribute("aria-disabled", "true");
    button.disabled = false;
  }
}

export function validateButtons(root: ParentNode = document): void {
  if (!import.meta.env.DEV) {
    return;
  }

  for (const button of root.querySelectorAll<HTMLElement>(
    "[data-ormo-button]",
  )) {
    if (button.tabIndex > 0) {
      console.warn(
        "[Ormo Button] Avoid positive tabindex values because they create an unexpected keyboard focus order.",
        button,
      );
    }

    const isNative = button.tagName === "BUTTON";
    const declaredNative = button.getAttribute("data-native-button") === "true";

    if (isNative !== declaredNative) {
      console.warn(
        '[Ormo Button] data-native-button does not match the rendered element. Native rendering is inferred from as="button".',
        button,
      );
    }

    if (
      button.querySelector(
        'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
      )
    ) {
      console.warn(
        "[Ormo Button] Nested interactive elements are not allowed inside a button.",
        button,
      );
    }
  }
}

export function initializeButtonRuntime(targetDocument: Document): void {
  if (!initializedDocuments.has(targetDocument)) {
    initializedDocuments.add(targetDocument);
    targetDocument.addEventListener("click", preventDisabledInteraction, true);
    targetDocument.addEventListener(
      "pointerdown",
      preventDisabledInteraction,
      true,
    );
    targetDocument.addEventListener(
      "keydown",
      preventDisabledInteraction,
      true,
    );
    targetDocument.addEventListener("keyup", preventDisabledInteraction, true);
    targetDocument.addEventListener("submit", preventDisabledSubmit, true);
    targetDocument.addEventListener("keydown", handleKeyDownCapture, true);
    targetDocument.addEventListener("keyup", handleKeyUpCapture, true);
    targetDocument.addEventListener("focusout", clearSpacePress, true);
    targetDocument.defaultView?.addEventListener(
      "keydown",
      completeAfterPropagation,
    );
    targetDocument.defaultView?.addEventListener(
      "keyup",
      completeAfterPropagation,
    );
    targetDocument.defaultView?.addEventListener("blur", () => {
      const pendingKeyDown = pendingSpaceKeyDowns.get(targetDocument);
      if (pendingKeyDown) {
        afterPropagationCallbacks.delete(pendingKeyDown);
        pendingSpaceKeyDowns.delete(targetDocument);
      }
      activeSpaceButtons.delete(targetDocument);
    });

    if (import.meta.env.DEV) {
      targetDocument.addEventListener("astro:page-load", () => {
        upgradeFocusableDisabledNativeButtons(targetDocument);
        validateButtons(targetDocument);
      });
    } else {
      targetDocument.addEventListener("astro:page-load", () =>
        upgradeFocusableDisabledNativeButtons(targetDocument),
      );
    }
  }

  upgradeFocusableDisabledNativeButtons(targetDocument);

  if (import.meta.env.DEV) {
    validateButtons(targetDocument);
  }
}

if (typeof document !== "undefined") {
  initializeButtonRuntime(document);
}
