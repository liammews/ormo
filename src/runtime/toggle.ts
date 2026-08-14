import type { TogglePressedChangeDetail } from "../components/toggle/types";

const selector = "button[data-ormo-toggle]:not([data-ormo-toggle-group-item])";
const documents = new WeakSet<Document>();

export function validateToggles(root: ParentNode = document): void {
  if (!import.meta.env.DEV) return;
  for (const button of root.querySelectorAll<HTMLButtonElement>(selector)) {
    const labelledBy = button.getAttribute("aria-labelledby")?.split(/\s+/);
    const named = Boolean(
      button.textContent?.trim() ||
      button.getAttribute("aria-label")?.trim() ||
      labelledBy?.some((id) =>
        button.ownerDocument.getElementById(id)?.textContent?.trim(),
      ),
    );
    if (!named) console.warn("[Ormo Toggle] Add an accessible name.", button);
  }
}

function sync(button: HTMLButtonElement, pressed: boolean): void {
  button.setAttribute("aria-pressed", String(pressed));
  button.dataset.state = pressed ? "on" : "off";
  button.toggleAttribute("data-disabled", button.disabled);
}

export function setTogglePressed(
  button: HTMLButtonElement,
  pressed: boolean,
): void {
  if (!button.matches(selector)) {
    throw new TypeError("setTogglePressed expects an Ormo Toggle button.");
  }
  sync(button, Boolean(pressed));
}

function initialise(target: Document): void {
  if (documents.has(target)) return;
  documents.add(target);
  target.addEventListener("click", (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>(selector)
        : null;
    if (!button || button.disabled) return;
    const previousPressed = button.getAttribute("aria-pressed") === "true";
    const detail: TogglePressedChangeDetail = {
      pressed: !previousPressed,
      previousPressed,
    };
    const accepted = button.dispatchEvent(
      new CustomEvent("ormo:pressed-change", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail,
      }),
    );
    if (accepted && !button.hasAttribute("data-controlled")) {
      sync(button, detail.pressed);
    }
  });
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const button = record.target;
      if (!(button instanceof HTMLButtonElement) || !button.matches(selector))
        continue;
      const pressed = button.getAttribute("aria-pressed") === "true";
      button.dataset.state = pressed ? "on" : "off";
      button.toggleAttribute("data-disabled", button.disabled);
    }
  });
  observer.observe(target, {
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-pressed", "disabled"],
  });
  validateToggles(target);
}

if (typeof document !== "undefined") initialise(document);
