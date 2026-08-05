import type {
  SwitchBeforeCheckedChangeDetail,
  SwitchCheckedChangeDetail,
  SwitchCheckedChangeReason,
} from "../components/switch/types";
import "./switch.css";

const tagName = "ormo-switch";
const inputSelector = "[data-ormo-switch-input]";
const thumbSelector = "[data-ormo-switch-thumb]";
const readOnlyFallbackAttribute = "data-ormo-switch-readonly-fallback";

function isOwnedBy(root: HTMLElement, element: Element): boolean {
  return element.closest(tagName) === root;
}

function hasAccessibleName(input: HTMLInputElement): boolean {
  if (input.getAttribute("aria-label")?.trim()) return true;
  const labelledBy = input.getAttribute("aria-labelledby")?.trim().split(/\s+/);
  if (
    labelledBy?.some((id) =>
      input.ownerDocument.getElementById(id)?.textContent?.trim(),
    )
  )
    return true;
  return Boolean(
    input.labels &&
    Array.from(input.labels).some((label) => label.textContent?.trim()),
  );
}

export function validateSwitch(root: HTMLElement): void {
  if (!import.meta.env.DEV) return;
  const input = root.querySelector<HTMLInputElement>(inputSelector);
  if (!input) {
    console.warn("[Ormo Switch] Root must contain its native input.", root);
    return;
  }
  if (!hasAccessibleName(input)) {
    console.warn(
      "[Ormo Switch] Add a wrapping label, a label with for/id, aria-label, or aria-labelledby.",
      root,
    );
  }
  if (!root.querySelector(thumbSelector)) {
    console.warn("[Ormo Switch] Add Switch.Thumb inside Switch.Root.", root);
  }
}

export class OrmoSwitch extends HTMLElement {
  #controller: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #managedInput: HTMLInputElement | undefined;
  #lastChecked = false;
  #authoredAttributes = new Map<Element, Map<string, string | null>>();

  connectedCallback(): void {
    this.#controller?.abort();
    this.#controller = new AbortController();
    const signal = this.#controller.signal;
    this.#snapshot(this, [
      "data-enhanced",
      "data-state",
      "data-disabled",
      "data-readonly",
      "data-required",
    ]);
    this.addEventListener("click", this.#onClick, { capture: true, signal });
    this.addEventListener("input", this.#onInput, { signal });
    this.ownerDocument.addEventListener("reset", this.#onReset, {
      capture: true,
      signal,
    });
    this.#observer = new MutationObserver(this.#prepare);
    this.#observer.observe(this, { childList: true, subtree: true });
    this.#prepare();
    validateSwitch(this);
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#managedInput = undefined;
    this.#restore();
  }

  get #input(): HTMLInputElement | undefined {
    return Array.from(
      this.querySelectorAll<HTMLInputElement>(inputSelector),
    ).find((input) => isOwnedBy(this, input));
  }

  get #thumbs(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(thumbSelector)).filter(
      (thumb) => isOwnedBy(this, thumb),
    );
  }

  get checked(): boolean {
    return Boolean(this.#input?.checked);
  }
  set checked(value: boolean) {
    const input = this.#input;
    if (!input || input.checked === Boolean(value)) return;
    const previousChecked = input.checked;
    input.checked = Boolean(value);
    this.#lastChecked = input.checked;
    this.#sync();
    this.#emit(previousChecked, "programmatic");
  }

  get disabled(): boolean {
    return Boolean(this.#input?.disabled);
  }
  set disabled(value: boolean) {
    if (!this.#input) return;
    this.#input.disabled = Boolean(value);
    this.#sync();
  }

  get readOnly(): boolean {
    return this.hasAttribute("data-readonly");
  }
  set readOnly(value: boolean) {
    this.toggleAttribute("data-readonly", Boolean(value));
    this.#sync();
  }

  get required(): boolean {
    return Boolean(this.#input?.required);
  }
  set required(value: boolean) {
    if (!this.#input) return;
    this.#input.required = Boolean(value);
    this.#sync();
  }

  get name(): string {
    return this.#input?.name ?? "";
  }
  set name(value: string) {
    if (this.#input) this.#input.name = String(value);
  }

  get value(): string {
    return this.#input?.value ?? "";
  }
  set value(value: string) {
    if (this.#input) this.#input.value = String(value);
  }

  get form(): HTMLFormElement | null {
    return this.#input?.form ?? null;
  }
  get valid(): boolean {
    return this.#input?.validity.valid ?? true;
  }
  checkValidity(): boolean {
    return this.#input?.checkValidity() ?? true;
  }
  reportValidity(): boolean {
    return this.#input?.reportValidity() ?? true;
  }

  #snapshot(element: Element, names: string[]): void {
    let values = this.#authoredAttributes.get(element);
    if (!values) {
      values = new Map();
      this.#authoredAttributes.set(element, values);
    }
    for (const name of names)
      if (!values.has(name)) values.set(name, element.getAttribute(name));
  }

  #restore(): void {
    for (const [element, values] of this.#authoredAttributes) {
      for (const [name, value] of values) {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      }
    }
    this.#authoredAttributes.clear();
  }

  #prepare = (): void => {
    const input = this.#input;
    if (!input) {
      this.#managedInput = undefined;
      this.removeAttribute("data-enhanced");
      return;
    }
    if (input !== this.#managedInput) {
      this.#snapshot(input, [
        "disabled",
        "aria-readonly",
        "data-state",
        "data-disabled",
        "data-readonly",
        "data-required",
      ]);
      if (input.hasAttribute(readOnlyFallbackAttribute)) {
        input.disabled = false;
      }
      this.#managedInput = input;
      this.#lastChecked = input.checked;
    }
    for (const thumb of this.#thumbs) {
      this.#snapshot(thumb, [
        "data-state",
        "data-disabled",
        "data-readonly",
        "data-required",
      ]);
    }
    this.setAttribute("data-enhanced", "");
    this.#sync();
  };

  #sync(): void {
    const input = this.#input;
    if (!input) return;
    const state = input.checked ? "checked" : "unchecked";
    const disabled = input.disabled;
    const readOnly = this.readOnly;
    const required = input.required;
    for (const element of [this, input, ...this.#thumbs]) {
      element.setAttribute("data-state", state);
      element.toggleAttribute("data-disabled", disabled);
      element.toggleAttribute("data-readonly", readOnly);
      element.toggleAttribute("data-required", required);
    }
    input.setAttribute("aria-readonly", String(readOnly));
  }

  #before(previousChecked: boolean): boolean {
    const detail: SwitchBeforeCheckedChangeDetail = {
      checked: this.checked,
      previousChecked,
      reason: "user",
    };
    return this.dispatchEvent(
      new CustomEvent("ormo:switch-before-checked-change", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail,
      }),
    );
  }

  #emit(previousChecked: boolean, reason: SwitchCheckedChangeReason): void {
    const detail: SwitchCheckedChangeDetail = {
      checked: this.checked,
      previousChecked,
      reason,
    };
    this.dispatchEvent(
      new CustomEvent("ormo:switch-checked-change", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  #onClick = (event: MouseEvent): void => {
    const input = this.#input;
    if (event.target !== input) return;
    const previousChecked = !this.checked;
    if (this.readOnly || !this.#before(previousChecked)) {
      event.preventDefault();
      input.checked = previousChecked;
      this.#lastChecked = previousChecked;
      this.#sync();
      queueMicrotask(() => {
        input.checked = previousChecked;
        this.#lastChecked = previousChecked;
        this.#sync();
      });
    }
  };

  #onInput = (event: Event): void => {
    if (event.target !== this.#input) return;
    const previousChecked = this.#lastChecked;
    this.#lastChecked = this.checked;
    this.#sync();
    this.#emit(previousChecked, "user");
  };

  #onReset = (event: Event): void => {
    if (event.target !== this.#input?.form) return;
    const previousChecked = this.checked;
    queueMicrotask(() => {
      this.#lastChecked = this.checked;
      this.#sync();
      if (previousChecked !== this.checked)
        this.#emit(previousChecked, "reset");
    });
  };
}

if (!customElements.get(tagName)) customElements.define(tagName, OrmoSwitch);
