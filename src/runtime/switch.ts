import type {
  SwitchBeforeCheckedChangeDetail,
  SwitchCheckedChangeDetail,
  SwitchCheckedChangeReason,
} from "../components/switch/types";
import "./switch.css";

const tagName = "ormo-switch";
const inputSelector = "[data-ormo-switch-input]";
const thumbSelector = "[data-ormo-switch-thumb]";

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
    if (!this.#input) return;
    this.#snapshot(this.#input, [
      "data-state",
      "data-disabled",
      "data-readonly",
      "data-required",
    ]);
    for (const thumb of this.#thumbs)
      this.#snapshot(thumb, [
        "data-state",
        "data-disabled",
        "data-readonly",
        "data-required",
      ]);
    this.#lastChecked = this.#input.checked;
    this.#input.addEventListener("click", this.#onClick, { signal });
    this.#input.addEventListener("input", this.#onInput, { signal });
    this.#input.form?.addEventListener("reset", this.#onReset, { signal });
    this.setAttribute("data-enhanced", "");
    this.#sync();
    validateSwitch(this);
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#restore();
  }

  get #input(): HTMLInputElement | undefined {
    return this.querySelector<HTMLInputElement>(inputSelector) ?? undefined;
  }

  get #thumbs(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(thumbSelector));
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
    const previousChecked = !this.checked;
    if (this.readOnly || !this.#before(previousChecked)) {
      event.preventDefault();
      queueMicrotask(() => this.#sync());
    }
  };

  #onInput = (): void => {
    const previousChecked = this.#lastChecked;
    this.#lastChecked = this.checked;
    this.#sync();
    this.#emit(previousChecked, "user");
  };

  #onReset = (): void => {
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
