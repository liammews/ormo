import "./radio.css";

const radioSelector = "[data-ormo-radio]";
const indicatorSelector = "[data-ormo-radio-indicator]";
const initializedDocuments = new WeakSet<Document>();

function isRadio(element: Element): element is HTMLInputElement {
  return (
    element instanceof HTMLInputElement &&
    element.type === "radio" &&
    element.hasAttribute("data-ormo-radio")
  );
}

function previousRenderedSibling(element: Element): Element | null {
  let sibling = element.previousElementSibling;

  while (sibling?.tagName === "SCRIPT") {
    sibling = sibling.previousElementSibling;
  }

  return sibling;
}

function hasAccessibleName(radio: HTMLInputElement): boolean {
  if (radio.getAttribute("aria-label")?.trim()) {
    return true;
  }

  const labelledBy = radio.getAttribute("aria-labelledby")?.trim().split(/\s+/);
  if (
    labelledBy?.some((id) =>
      radio.ownerDocument.getElementById(id)?.textContent?.trim(),
    )
  ) {
    return true;
  }

  if (radio.labels && radio.labels.length > 0) {
    return Array.from(radio.labels).some((label) =>
      Boolean(label.textContent?.trim()),
    );
  }

  return Boolean(radio.getAttribute("title")?.trim());
}

function isRemovedFromInteraction(radio: HTMLInputElement): boolean {
  if (radio.hidden) {
    return true;
  }

  const style = radio.ownerDocument.defaultView?.getComputedStyle(radio);
  return style?.display === "none" || style?.visibility === "hidden";
}

export function validateRadios(root: ParentNode = document): void {
  if (!import.meta.env.DEV) {
    return;
  }

  for (const element of root.querySelectorAll(radioSelector)) {
    if (!isRadio(element)) {
      continue;
    }

    if (!hasAccessibleName(element)) {
      console.warn(
        "[Ormo Radio] Add a wrapping label, sibling label with for/id, aria-label, or aria-labelledby.",
        element,
      );
    }

    if (isRemovedFromInteraction(element)) {
      console.warn(
        "[Ormo Radio] The radio is removed from interaction or the accessibility tree. Use appearance: none or another focusable native-input technique instead of hidden, display: none, or visibility: hidden.",
        element,
      );
    }

    if (element.form && element.name === "") {
      console.warn(
        "[Ormo Radio] A radio inside a form needs a name to submit and coordinate selection.",
        element,
      );
    }

    const label = element.closest("label");
    if (label && label.querySelectorAll('input[type="radio"]').length > 1) {
      console.warn(
        "[Ormo Radio] A single label must not wrap more than one radio.",
        label,
      );
    }
  }

  for (const indicator of root.querySelectorAll(indicatorSelector)) {
    const previous = previousRenderedSibling(indicator);
    const adjacentRadio = previous && isRadio(previous) ? previous : undefined;

    if (!adjacentRadio) {
      console.warn(
        "[Ormo RadioIndicator] Place RadioIndicator after Radio under the same parent so :checked ~ selectors work.",
        indicator,
      );
    }

    if (
      indicator.querySelector(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
    ) {
      console.warn(
        "[Ormo RadioIndicator] Do not put focusable elements inside an aria-hidden indicator.",
        indicator,
      );
    }
  }
}

export function initializeRadioRuntime(targetDocument: Document): void {
  if (initializedDocuments.has(targetDocument)) {
    if (import.meta.env.DEV) {
      validateRadios(targetDocument);
    }
    return;
  }

  initializedDocuments.add(targetDocument);

  if (import.meta.env.DEV) {
    validateRadios(targetDocument);
    targetDocument.addEventListener("astro:page-load", () => {
      validateRadios(targetDocument);
    });
  }
}

if (typeof document !== "undefined") {
  initializeRadioRuntime(document);
}
