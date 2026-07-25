import "./checkbox.css";

const checkboxSelector = "[data-ormo-checkbox]";
const indicatorSelector = "[data-ormo-checkbox-indicator]";
const initializedDocuments = new WeakSet<Document>();

function isCheckbox(element: Element): element is HTMLInputElement {
  return (
    element instanceof HTMLInputElement &&
    element.type === "checkbox" &&
    element.hasAttribute("data-ormo-checkbox")
  );
}

function applyIndeterminate(root: ParentNode = document): void {
  for (const element of root.querySelectorAll(checkboxSelector)) {
    if (!isCheckbox(element)) {
      continue;
    }

    if (element.hasAttribute("data-indeterminate")) {
      element.indeterminate = true;
    }
  }
}

function hasAccessibleName(checkbox: HTMLInputElement): boolean {
  if (checkbox.getAttribute("aria-label")?.trim()) {
    return true;
  }

  const labelledBy = checkbox
    .getAttribute("aria-labelledby")
    ?.trim()
    .split(/\s+/);
  if (
    labelledBy?.some((id) =>
      checkbox.ownerDocument.getElementById(id)?.textContent?.trim(),
    )
  ) {
    return true;
  }

  if (checkbox.labels && checkbox.labels.length > 0) {
    return Array.from(checkbox.labels).some((label) =>
      Boolean(label.textContent?.trim()),
    );
  }

  return Boolean(checkbox.getAttribute("title")?.trim());
}

function isRemovedFromInteraction(checkbox: HTMLInputElement): boolean {
  if (checkbox.hidden) {
    return true;
  }

  const style = checkbox.ownerDocument.defaultView?.getComputedStyle(checkbox);
  return style?.display === "none" || style?.visibility === "hidden";
}

export function validateCheckboxes(root: ParentNode = document): void {
  if (!import.meta.env.DEV) {
    return;
  }

  for (const element of root.querySelectorAll(checkboxSelector)) {
    if (!isCheckbox(element)) {
      continue;
    }

    if (!hasAccessibleName(element)) {
      console.warn(
        "[Ormo Checkbox] Add a wrapping label, sibling label with for/id, aria-label, or aria-labelledby.",
        element,
      );
    }

    if (isRemovedFromInteraction(element)) {
      console.warn(
        "[Ormo Checkbox] The checkbox is removed from interaction or the accessibility tree. Use appearance: none or another focusable native-input technique instead of hidden, display: none, or visibility: hidden.",
        element,
      );
    }

    if (
      element.hasAttribute("data-indeterminate") &&
      element.hasAttribute("checked")
    ) {
      console.warn(
        "[Ormo Checkbox] Do not combine indeterminate with checked.",
        element,
      );
    }

    if (
      element.hasAttribute("data-ormo-checkbox-parent") &&
      !element.closest("ormo-checkbox-group")
    ) {
      console.warn(
        "[Ormo Checkbox] parent must be used inside CheckboxGroup.Root.",
        element,
      );
    }

    if (
      element.hasAttribute("data-ormo-checkbox-parent") &&
      (element.name || element.getAttribute("value") !== null)
    ) {
      console.warn(
        "[Ormo Checkbox] A parent checkbox must not set name or value.",
        element,
      );
    }

    if (
      element.form &&
      !element.hasAttribute("data-ormo-checkbox-parent") &&
      element.name === "" &&
      element.value !== "on"
    ) {
      console.warn(
        "[Ormo Checkbox] A checkbox with a value inside a form needs a name to submit.",
        element,
      );
    }

    const label = element.closest("label");
    if (label && label.querySelectorAll('input[type="checkbox"]').length > 1) {
      console.warn(
        "[Ormo Checkbox] A single label must not wrap more than one checkbox.",
        label,
      );
    }
  }

  for (const indicator of root.querySelectorAll(indicatorSelector)) {
    const previous = indicator.previousElementSibling;
    const next = indicator.nextElementSibling;
    const adjacentCheckbox =
      (previous && isCheckbox(previous) && previous) ||
      (next && isCheckbox(next) && next) ||
      undefined;

    if (!adjacentCheckbox) {
      console.warn(
        "[Ormo CheckboxIndicator] Place CheckboxIndicator as a sibling of Checkbox so :checked + selectors work.",
        indicator,
      );
    }

    if (
      indicator.querySelector(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
    ) {
      console.warn(
        "[Ormo CheckboxIndicator] Do not put focusable elements inside an aria-hidden indicator.",
        indicator,
      );
    }
  }
}

export function initializeCheckboxRuntime(targetDocument: Document): void {
  if (initializedDocuments.has(targetDocument)) {
    applyIndeterminate(targetDocument);
    if (import.meta.env.DEV) {
      validateCheckboxes(targetDocument);
    }
    return;
  }

  initializedDocuments.add(targetDocument);
  applyIndeterminate(targetDocument);

  if (import.meta.env.DEV) {
    validateCheckboxes(targetDocument);
    targetDocument.addEventListener("astro:page-load", () => {
      applyIndeterminate(targetDocument);
      validateCheckboxes(targetDocument);
    });
  } else {
    targetDocument.addEventListener("astro:page-load", () => {
      applyIndeterminate(targetDocument);
    });
  }
}

if (typeof document !== "undefined") {
  initializeCheckboxRuntime(document);
}
