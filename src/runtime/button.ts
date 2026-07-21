const nonNativeButtonSelector =
  '[data-ormo-button][data-native-button="false"]';
const disabledButtonSelector = '[data-ormo-button][aria-disabled="true"]';
const pressedWithSpace = new WeakSet<HTMLElement>();
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
      pressedWithSpace.delete(button);
    }
  }

  event.preventDefault();
  event.stopImmediatePropagation();
}

function handleKeyDown(event: KeyboardEvent): void {
  const button = closestButton(event, nonNativeButtonSelector);

  if (
    !button ||
    event.target !== button ||
    (event.key !== "Enter" && event.key !== " ")
  ) {
    return;
  }

  if (event.defaultPrevented) {
    return;
  }

  if (button.getAttribute("aria-disabled") === "true") {
    event.preventDefault();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    button.click();
  } else {
    event.preventDefault();
    pressedWithSpace.add(button);
  }
}

function handleKeyUp(event: KeyboardEvent): void {
  const button = closestButton(event, nonNativeButtonSelector);

  if (!button || event.target !== button || event.key !== " ") {
    return;
  }

  const hadMatchingKeyDown = pressedWithSpace.delete(button);

  if (
    event.defaultPrevented ||
    button.getAttribute("aria-disabled") === "true" ||
    !hadMatchingKeyDown
  ) {
    return;
  }

  button.click();
}

function clearSpacePress(event: FocusEvent): void {
  const button = closestButton(event, nonNativeButtonSelector);

  if (button) {
    pressedWithSpace.delete(button);
  }
}

function hasAccessibleName(button: HTMLElement): boolean {
  if (button.getAttribute("aria-label")?.trim()) {
    return true;
  }

  const labelledBy = button
    .getAttribute("aria-labelledby")
    ?.trim()
    .split(/\s+/);
  if (
    labelledBy?.some((id) =>
      button.ownerDocument.getElementById(id)?.textContent?.trim(),
    )
  ) {
    return true;
  }

  return Boolean(
    button.textContent?.trim() ||
    button.getAttribute("title")?.trim() ||
    button.querySelector('img[alt]:not([alt=""]), input[value], svg title'),
  );
}

export function validateButtons(root: ParentNode = document): void {
  if (!import.meta.env.DEV) {
    return;
  }

  for (const button of root.querySelectorAll<HTMLElement>(
    "[data-ormo-button]",
  )) {
    if (!hasAccessibleName(button)) {
      console.warn(
        "[Ormo Button] Add visible text, aria-label, or aria-labelledby so the button has an accessible name.",
        button,
      );
    }

    if (button.tabIndex > 0) {
      console.warn(
        "[Ormo Button] Avoid positive tabindex values because they create an unexpected keyboard focus order.",
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
  if (initializedDocuments.has(targetDocument)) {
    return;
  }

  initializedDocuments.add(targetDocument);
  targetDocument.addEventListener("click", preventDisabledInteraction, true);
  targetDocument.addEventListener(
    "pointerdown",
    preventDisabledInteraction,
    true,
  );
  targetDocument.addEventListener("keydown", preventDisabledInteraction, true);
  targetDocument.addEventListener("keyup", preventDisabledInteraction, true);
  targetDocument.addEventListener("keydown", handleKeyDown);
  targetDocument.addEventListener("keyup", handleKeyUp);
  targetDocument.addEventListener("focusout", clearSpacePress);

  if (import.meta.env.DEV) {
    validateButtons(targetDocument);
    targetDocument.addEventListener("astro:page-load", () =>
      validateButtons(targetDocument),
    );
  }
}

if (typeof document !== "undefined") {
  initializeButtonRuntime(document);
}
