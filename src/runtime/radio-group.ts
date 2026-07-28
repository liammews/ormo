import type {
  OrmoRadioGroupElement,
  RadioGroupValueChangeReason,
} from "../components/radio/types";
import { initializeRadioRuntime, validateRadios } from "./radio";

const tagName = "ormo-radio-group";
const radioSelector = "[data-ormo-radio]";
const labelSelector = "[data-ormo-radio-group-label]";

function belongsToRoot(element: Element, root: HTMLElement): boolean {
  return element.closest(tagName) === root;
}

function isMemberRadio(
  element: Element,
  root: HTMLElement,
): element is HTMLInputElement {
  return (
    element instanceof HTMLInputElement &&
    element.type === "radio" &&
    element.hasAttribute("data-ormo-radio") &&
    belongsToRoot(element, root)
  );
}

export function validateRadioGroup(root: HTMLElement): void {
  if (!import.meta.env.DEV) {
    return;
  }

  const labelledBy = root.getAttribute("aria-labelledby");
  const hasLabel =
    Boolean(root.getAttribute("aria-label")?.trim()) ||
    (labelledBy !== null &&
      labelledBy
        .split(/\s+/)
        .some((id) =>
          Boolean(
            id && root.ownerDocument.getElementById(id)?.textContent?.trim(),
          ),
        ));

  if (!hasLabel) {
    console.warn(
      "[Ormo RadioGroup] Add RadioGroup.Label, aria-label, or aria-labelledby.",
      root,
    );
  }

  const members = Array.from(root.querySelectorAll(radioSelector)).filter(
    (element): element is HTMLInputElement => isMemberRadio(element, root),
  );

  if (members.length === 0) {
    console.warn("[Ormo RadioGroup] Add at least one Radio.", root);
    return;
  }

  const names = new Set(members.map((member) => member.name));
  if (names.size !== 1 || names.has("")) {
    console.warn(
      "[Ormo RadioGroup] Members need one shared, non-empty name for native grouping.",
      root,
    );
  }

  const values = new Set<string>();
  for (const member of members) {
    if (!member.hasAttribute("value") || member.value === "") {
      console.warn(
        "[Ormo RadioGroup] Every member needs a non-empty value.",
        member,
      );
      continue;
    }

    if (values.has(member.value)) {
      console.warn(
        `[Ormo RadioGroup] Member value "${member.value}" is duplicated.`,
        member,
      );
    }
    values.add(member.value);
  }

  const defaultValue = root.getAttribute("data-default-value");
  if (defaultValue !== null && !values.has(defaultValue)) {
    console.warn(
      `[Ormo RadioGroup] defaultValue "${defaultValue}" matches no member.`,
      root,
    );
  }

  const checkedAttributes = members.filter((member) =>
    member.hasAttribute("checked"),
  );
  if (checkedAttributes.length > 1) {
    console.warn(
      "[Ormo RadioGroup] Only one member should author checked state.",
      root,
    );
  }

  if (
    defaultValue !== null &&
    checkedAttributes.some((member) => member.value !== defaultValue)
  ) {
    console.warn(
      "[Ormo RadioGroup] Do not combine defaultValue with checked on another member.",
      root,
    );
  }

  const field = root.closest("ormo-field");
  if (field?.querySelector("[data-ormo-field-label]")) {
    console.warn(
      "[Ormo RadioGroup] Use RadioGroup.Label for the group name. Field.Label is for a single control.",
      root,
    );
  }
}

export class OrmoRadioGroup
  extends HTMLElement
  implements OrmoRadioGroupElement
{
  static observedAttributes = ["data-disabled", "data-name", "data-required"];

  #controller: AbortController | undefined;
  #formController: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #initialized = false;
  #managedNames = new WeakMap<HTMLInputElement, string | null>();
  #managedRequired = new WeakMap<HTMLInputElement, boolean>();
  #lastValue: string | null = null;
  #suppressEvents = false;

  connectedCallback(): void {
    initializeRadioRuntime(this.ownerDocument);

    if (!this.#initialized) {
      this.#applyName();
      this.#applyDisabled();
      this.#applyRequired();
      this.#initialized = true;
    }

    this.#controller?.abort();
    this.#controller = new AbortController();
    this.addEventListener("change", this.#handleChange, {
      signal: this.#controller.signal,
    });

    this.#syncLabel();
    this.#lastValue = this.value;
    this.#bindFormEvents();

    if (import.meta.env.DEV) {
      validateRadioGroup(this);
      validateRadios(this);
    }

    this.#observer?.disconnect();
    this.#observer = new MutationObserver((records) => {
      this.#captureMemberMutations(records);
      this.#applyName();
      this.#applyDisabled();
      this.#applyRequired();
      this.#syncLabel();
      this.#lastValue = this.value;

      if (import.meta.env.DEV) {
        validateRadioGroup(this);
      }
    });
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "checked",
        "data-item-disabled",
        "data-item-required-authored",
        "disabled",
        "id",
        "name",
        "required",
        "value",
      ],
    });
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#formController?.abort();
    this.#formController = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) {
      return;
    }

    if (name === "data-disabled") {
      this.#applyDisabled();
      return;
    }

    if (name === "data-name") {
      this.#applyName();
      this.#lastValue = this.value;
      return;
    }

    if (name === "data-required") {
      this.#applyRequired();
    }
  }

  get form(): HTMLFormElement | null {
    return this.#members()[0]?.form ?? null;
  }

  get name(): string {
    return this.getAttribute("data-name") ?? "";
  }

  set name(value: string) {
    if (value) {
      this.setAttribute("data-name", value);
    } else {
      this.removeAttribute("data-name");
    }
    this.#applyName();
    this.#lastValue = this.value;
  }

  get value(): string | null {
    return this.#members().find((member) => member.checked)?.value ?? null;
  }

  set value(next: string | null) {
    const previous = this.value;
    const match =
      next === null
        ? undefined
        : this.#members().find((member) => member.value === next);
    this.#suppressEvents = true;

    for (const member of this.#members()) {
      member.checked = member === match;
    }

    this.#suppressEvents = false;
    const current = this.value;
    this.#lastValue = current;

    if (previous !== current) {
      this.#emitValueChange("programmatic");
    }
  }

  get disabled(): boolean {
    return this.hasAttribute("data-disabled");
  }

  set disabled(value: boolean) {
    this.toggleAttribute("data-disabled", value);
    this.#applyDisabled();
  }

  get required(): boolean {
    return this.hasAttribute("data-required");
  }

  set required(value: boolean) {
    this.toggleAttribute("data-required", value);
    this.#applyRequired();
  }

  get valid(): boolean {
    return this.#members().every((member) => member.validity.valid);
  }

  checkValidity(): boolean {
    let valid = true;

    for (const member of this.#members()) {
      if (!member.checkValidity()) {
        valid = false;
      }
    }

    return valid;
  }

  reportValidity(): boolean {
    const invalid = this.#members().find((member) => !member.validity.valid);
    return invalid ? invalid.reportValidity() : true;
  }

  #members(): HTMLInputElement[] {
    return Array.from(this.querySelectorAll(radioSelector)).filter(
      (element): element is HTMLInputElement => isMemberRadio(element, this),
    );
  }

  #captureMemberMutations(records: MutationRecord[]): void {
    for (const record of records) {
      const target = record.target;
      if (
        !(target instanceof HTMLInputElement) ||
        !isMemberRadio(target, this)
      ) {
        continue;
      }

      if (record.attributeName === "name") {
        const current = target.getAttribute("name");
        if (this.#managedNames.get(target) !== current) {
          target.setAttribute("data-item-name-authored", "");
          this.#managedNames.delete(target);
        }
      }

      if (
        record.attributeName === "disabled" &&
        (!this.disabled || !target.disabled)
      ) {
        target.toggleAttribute("data-item-disabled", target.disabled);
      }

      if (record.attributeName === "required") {
        const current = target.required;
        if (this.#managedRequired.get(target) !== current) {
          target.toggleAttribute("data-item-required-authored", current);
          this.#managedRequired.delete(target);
        }
      }
    }
  }

  #applyName(): void {
    const name = this.name;

    for (const member of this.#members()) {
      if (member.hasAttribute("data-item-name-authored")) {
        this.#managedNames.delete(member);
        continue;
      }

      const desired = name || null;
      this.#managedNames.set(member, desired);
      if (member.getAttribute("name") === desired) {
        continue;
      }

      if (desired === null) {
        member.removeAttribute("name");
      } else {
        member.name = desired;
      }
    }
  }

  #applyDisabled(): void {
    const groupDisabled = this.disabled;

    for (const member of this.#members()) {
      const itemDisabled = member.hasAttribute("data-item-disabled");
      const disabled = groupDisabled || itemDisabled;
      if (member.disabled !== disabled) {
        member.disabled = disabled;
      }
      member.toggleAttribute("data-disabled", disabled);
    }
  }

  #applyRequired(): void {
    const groupRequired = this.required;
    this.setAttribute("aria-required", String(groupRequired));

    for (const member of this.#members()) {
      const itemRequired = member.hasAttribute("data-item-required-authored");
      const required = groupRequired || itemRequired;
      this.#managedRequired.set(member, required);
      if (member.required !== required) {
        member.required = required;
      }
    }
  }

  #syncLabel(): void {
    const managed = this.getAttribute("data-managed-labelledby");
    const current = this.getAttribute("aria-labelledby");

    if (this.getAttribute("aria-label")?.trim()) {
      if (managed !== null && current === managed) {
        this.removeAttribute("aria-labelledby");
        this.removeAttribute("data-managed-labelledby");
      }
      return;
    }

    if (current !== null && current !== managed) {
      this.removeAttribute("data-managed-labelledby");
      return;
    }

    const labels = Array.from(this.querySelectorAll(labelSelector)).filter(
      (label): label is HTMLElement =>
        label instanceof HTMLElement && belongsToRoot(label, this),
    );
    const baseId = `${this.id || "ormo-radio-group"}-label`;
    const labelIds = labels.map((label, index) => {
      if (!label.id) {
        label.id = index === 0 ? baseId : `${baseId}-${index + 1}`;
      }
      return label.id;
    });
    const next = labelIds.join(" ");

    if (!next) {
      if (managed !== null && current === managed) {
        this.removeAttribute("aria-labelledby");
        this.removeAttribute("data-managed-labelledby");
      }
      return;
    }

    if (current !== next) {
      this.setAttribute("aria-labelledby", next);
    }
    if (managed !== next) {
      this.setAttribute("data-managed-labelledby", next);
    }
  }

  #bindFormEvents(): void {
    this.#formController?.abort();
    this.#formController = new AbortController();
    this.ownerDocument.addEventListener("reset", this.#handleReset, {
      capture: true,
      signal: this.#formController.signal,
    });
  }

  #emitValueChange(reason: RadioGroupValueChangeReason): void {
    if (this.#suppressEvents || !this.isConnected) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent("ormo:value-change", {
        bubbles: true,
        composed: true,
        detail: { value: this.value, reason },
      }),
    );
  }

  #handleChange = (event: Event): void => {
    const target = event.target;
    if (
      !(target instanceof Element) ||
      !isMemberRadio(target, this) ||
      !target.checked
    ) {
      return;
    }

    const current = this.value;
    if (current === this.#lastValue) {
      return;
    }

    this.#lastValue = current;
    this.#emitValueChange("member");
  };

  #handleReset = (event: Event): void => {
    const form = event.target;
    if (
      !(form instanceof HTMLFormElement) ||
      !this.#members().some((member) => member.form === form)
    ) {
      return;
    }

    queueMicrotask(() => {
      this.#lastValue = this.value;
    });
  };
}

if (!customElements.get(tagName)) {
  customElements.define(tagName, OrmoRadioGroup);
}
