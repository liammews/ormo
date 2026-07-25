import type {
  CheckboxGroupDataState,
  OrmoCheckboxGroupElement,
} from "../components/checkbox/types";
import { initializeCheckboxRuntime, validateCheckboxes } from "./checkbox";

const tagName = "ormo-checkbox-group";
const checkboxSelector = "[data-ormo-checkbox]";
const labelSelector = "[data-ormo-checkbox-group-label]";

function belongsToRoot(element: Element, root: HTMLElement): boolean {
  return element.closest(tagName) === root;
}

function isMemberCheckbox(
  element: Element,
  root: HTMLElement,
): element is HTMLInputElement {
  return (
    element instanceof HTMLInputElement &&
    element.type === "checkbox" &&
    element.hasAttribute("data-ormo-checkbox") &&
    !element.hasAttribute("data-ormo-checkbox-parent") &&
    belongsToRoot(element, root)
  );
}

function isParentCheckbox(
  element: Element,
  root: HTMLElement,
): element is HTMLInputElement {
  return (
    element instanceof HTMLInputElement &&
    element.type === "checkbox" &&
    element.hasAttribute("data-ormo-checkbox-parent") &&
    belongsToRoot(element, root)
  );
}

function parseDefaultValue(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

function valuesEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

export function validateCheckboxGroup(root: HTMLElement): void {
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
      "[Ormo CheckboxGroup] Add CheckboxGroup.Label, aria-label, or aria-labelledby.",
      root,
    );
  }

  const parents = Array.from(root.querySelectorAll(checkboxSelector)).filter(
    (element) => isParentCheckbox(element, root),
  );

  if (parents.length > 1) {
    console.warn(
      "[Ormo CheckboxGroup] Only one parent checkbox is supported per group.",
      root,
    );
  }

  const members = Array.from(root.querySelectorAll(checkboxSelector)).filter(
    (element) => isMemberCheckbox(element, root),
  );

  const name = root.getAttribute("data-name") ?? "";
  for (const member of members) {
    if (name && !member.value) {
      console.warn(
        "[Ormo CheckboxGroup] Members in a named group need a non-empty value.",
        member,
      );
    }
  }

  const defaultValues = parseDefaultValue(root.dataset.defaultValue);
  const memberValues = new Set(members.map((member) => member.value));
  for (const value of defaultValues) {
    if (!memberValues.has(value)) {
      console.warn(
        `[Ormo CheckboxGroup] defaultValue entry "${value}" matches no member.`,
        root,
      );
    }
  }

  if (
    root.hasAttribute("data-required") &&
    !root.getAttribute("data-required-message")?.trim()
  ) {
    console.warn(
      "[Ormo CheckboxGroup] required requires requiredMessage.",
      root,
    );
  }

  const field = root.closest("ormo-field");
  if (field?.querySelector("[data-ormo-field-label]")) {
    console.warn(
      "[Ormo CheckboxGroup] Use CheckboxGroup.Label for the group name. Field.Label is for a single control.",
      root,
    );
  }
}

export class OrmoCheckboxGroup
  extends HTMLElement
  implements OrmoCheckboxGroupElement
{
  static observedAttributes = [
    "data-disabled",
    "data-name",
    "data-required",
    "data-required-message",
  ];

  #controller: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #initialized = false;
  #initialValue: string[] = [];
  #validityTarget: HTMLInputElement | undefined;
  #suppressEvents = false;

  connectedCallback(): void {
    initializeCheckboxRuntime(this.ownerDocument);

    if (!this.#initialized) {
      this.#applyName();
      this.#applyDisabled();
      this.#initialValue = this.#readMemberValues();
      this.#initialized = true;
    }

    this.#controller?.abort();
    this.#controller = new AbortController();

    this.addEventListener("change", this.#handleChange, {
      signal: this.#controller.signal,
    });

    this.#syncLabel();
    this.#reconcile();
    this.#applyRequiredValidity();

    if (import.meta.env.DEV) {
      validateCheckboxGroup(this);
      validateCheckboxes(this);
    }

    this.#observer?.disconnect();
    this.#observer = new MutationObserver(() => {
      this.#applyName();
      this.#applyDisabled();
      this.#syncLabel();
      this.#reconcile();
      this.#applyRequiredValidity();

      if (import.meta.env.DEV) {
        validateCheckboxGroup(this);
      }
    });
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-ormo-checkbox-parent",
        "data-item-disabled",
        "value",
        "name",
      ],
    });
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#clearValidity();
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) {
      return;
    }

    if (name === "data-disabled") {
      this.#applyDisabled();
      this.#reconcile();
      return;
    }

    if (name === "data-name") {
      this.#applyName();
      return;
    }

    if (name === "data-required" || name === "data-required-message") {
      this.#applyRequiredValidity();
    }
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
  }

  get value(): string[] {
    return this.#readMemberValues();
  }

  set value(next: string[]) {
    const values = new Set(next);
    this.#suppressEvents = true;

    for (const member of this.#members()) {
      if (member.disabled) {
        continue;
      }
      member.checked = values.has(member.value);
    }

    this.#suppressEvents = false;
    this.#reconcile();
    this.#applyRequiredValidity();
    this.#emitValueChange();
  }

  get disabled(): boolean {
    return this.hasAttribute("data-disabled");
  }

  set disabled(value: boolean) {
    this.toggleAttribute("data-disabled", value);
    this.#applyDisabled();
    this.#reconcile();
  }

  get required(): boolean {
    return this.hasAttribute("data-required");
  }

  set required(value: boolean) {
    this.toggleAttribute("data-required", value);
    this.#applyRequiredValidity();
  }

  get requiredMessage(): string {
    return this.getAttribute("data-required-message") ?? "";
  }

  set requiredMessage(value: string) {
    if (value) {
      this.setAttribute("data-required-message", value);
    } else {
      this.removeAttribute("data-required-message");
    }
    this.#applyRequiredValidity();
  }

  checkValidity(): boolean {
    this.#applyRequiredValidity();
    const target = this.#validityTarget;
    return target ? target.validity.valid : true;
  }

  reportValidity(): boolean {
    this.#applyRequiredValidity();
    const target = this.#validityTarget;
    if (!target) {
      return true;
    }
    return target.reportValidity();
  }

  #members(): HTMLInputElement[] {
    return Array.from(this.querySelectorAll(checkboxSelector)).filter(
      (element): element is HTMLInputElement => isMemberCheckbox(element, this),
    );
  }

  #parents(): HTMLInputElement[] {
    return Array.from(this.querySelectorAll(checkboxSelector)).filter(
      (element): element is HTMLInputElement => isParentCheckbox(element, this),
    );
  }

  #enabledMembers(): HTMLInputElement[] {
    return this.#members().filter((member) => !member.disabled);
  }

  #readMemberValues(): string[] {
    return this.#members()
      .filter((member) => member.checked)
      .map((member) => member.value);
  }

  #applyName(): void {
    const name = this.name;
    if (!name) {
      return;
    }

    for (const member of this.#members()) {
      member.name = name;
    }
  }

  #applyDisabled(): void {
    const groupDisabled = this.disabled;

    for (const checkbox of this.querySelectorAll(checkboxSelector)) {
      if (
        !(checkbox instanceof HTMLInputElement) ||
        !belongsToRoot(checkbox, this)
      ) {
        continue;
      }

      const itemDisabled = checkbox.hasAttribute("data-item-disabled");
      checkbox.disabled = groupDisabled || itemDisabled;
      checkbox.toggleAttribute("data-disabled", checkbox.disabled);
    }
  }

  #syncLabel(): void {
    if (
      this.hasAttribute("aria-label") ||
      this.getAttribute("aria-labelledby")
    ) {
      return;
    }

    const label = this.querySelector(labelSelector);
    if (label instanceof HTMLElement) {
      if (!label.id) {
        label.id = `${this.id || "ormo-checkbox-group"}-label`;
      }
      this.setAttribute("aria-labelledby", label.id);
    }
  }

  #aggregateState(): CheckboxGroupDataState {
    const members = this.#members();
    if (members.length === 0) {
      return "none";
    }

    const checkedCount = members.filter((member) => member.checked).length;
    if (checkedCount === 0) {
      return "none";
    }
    if (checkedCount === members.length) {
      return "all";
    }
    return "partial";
  }

  #reconcile(): void {
    const state = this.#aggregateState();
    this.dataset.state = state;

    // Parent visuals reflect every member, including disabled ones, so a
    // disabled unchecked option keeps the control mixed rather than checked.
    const members = this.#members();
    const checkedCount = members.filter((member) => member.checked).length;

    for (const parent of this.#parents()) {
      parent.removeAttribute("name");
      parent.removeAttribute("value");

      if (members.length === 0 || checkedCount === 0) {
        parent.checked = false;
        parent.indeterminate = false;
        parent.removeAttribute("data-indeterminate");
      } else if (checkedCount === members.length) {
        parent.checked = true;
        parent.indeterminate = false;
        parent.removeAttribute("data-indeterminate");
      } else {
        parent.checked = false;
        parent.indeterminate = true;
        parent.setAttribute("data-indeterminate", "");
      }
    }
  }

  #clearValidity(): void {
    if (this.#validityTarget) {
      this.#validityTarget.setCustomValidity("");
      this.#validityTarget = undefined;
    }
  }

  #applyRequiredValidity(): void {
    this.#clearValidity();

    if (!this.required) {
      return;
    }

    const message = this.requiredMessage.trim();
    if (!message) {
      return;
    }

    const enabled = this.#enabledMembers();
    const anyChecked = enabled.some((member) => member.checked);
    const target = enabled[0];

    if (!target) {
      return;
    }

    this.#validityTarget = target;
    target.setCustomValidity(anyChecked ? "" : message);
  }

  #emitValueChange(): void {
    if (this.#suppressEvents || !this.isConnected) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent("ormo:value-change", {
        bubbles: true,
        composed: true,
        detail: { value: this.value },
      }),
    );
  }

  #handleChange = (event: Event): void => {
    if (this.#suppressEvents) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element) || !belongsToRoot(target, this)) {
      return;
    }

    if (isParentCheckbox(target, this)) {
      if (target.disabled) {
        return;
      }

      // After the native toggle, checked is the intent: indeterminate or
      // unchecked become checked (select all); checked becomes unchecked.
      const shouldCheck = target.checked;
      const enabled = this.#enabledMembers();

      this.#suppressEvents = true;
      for (const member of enabled) {
        member.checked = shouldCheck;
      }
      this.#suppressEvents = false;

      this.#reconcile();
      this.#applyRequiredValidity();
      this.#emitValueChange();
      return;
    }

    if (!isMemberCheckbox(target, this)) {
      return;
    }

    this.#reconcile();
    this.#applyRequiredValidity();
    this.#emitValueChange();
  };
}

if (!customElements.get(tagName)) {
  customElements.define(tagName, OrmoCheckboxGroup);
}

export type { OrmoCheckboxGroupElement };
