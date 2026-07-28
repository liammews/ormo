import type {
  CheckboxGroupDataState,
  CheckboxGroupValueChangeReason,
  OrmoCheckboxGroupElement,
} from "../components/checkbox/types";
import { initializeCheckboxRuntime, validateCheckboxes } from "./checkbox";

const tagName = "ormo-checkbox-group";
const checkboxSelector = "[data-ormo-checkbox]";
const labelSelector = "[data-ormo-checkbox-group-label]";

function belongsToRoot(element: Element, root: HTMLElement): boolean {
  return element.closest(tagName) === root;
}

function isEffectivelyDisabled(checkbox: HTMLInputElement): boolean {
  if (checkbox.disabled) {
    return true;
  }

  for (
    let ancestor = checkbox.parentElement;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    if (!(ancestor instanceof HTMLFieldSetElement) || !ancestor.disabled) {
      continue;
    }

    const firstLegend = Array.from(ancestor.children).find(
      (child): child is HTMLLegendElement => child instanceof HTMLLegendElement,
    );
    if (!firstLegend?.contains(checkbox)) {
      return true;
    }
  }

  return false;
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
  #formController: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #initialized = false;
  #managedNames = new WeakMap<HTMLInputElement, string | null>();
  #validityMessage: string | undefined;
  #validityTarget: HTMLInputElement | undefined;
  #suppressEvents = false;

  connectedCallback(): void {
    initializeCheckboxRuntime(this.ownerDocument);

    if (!this.#initialized) {
      this.#applyName();
      this.#applyDisabled();
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
    this.#bindFormEvents();

    if (import.meta.env.DEV) {
      validateCheckboxGroup(this);
      validateCheckboxes(this);
    }

    this.#observer?.disconnect();
    this.#observer = new MutationObserver((records) => {
      this.#captureMemberMutations(records);
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
        "disabled",
        "id",
        "value",
        "name",
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
    const previous = this.value;
    const values = new Set(next);
    this.#suppressEvents = true;

    for (const member of this.#members()) {
      member.checked = values.has(member.value);
    }

    this.#suppressEvents = false;
    this.#reconcile();
    this.#applyRequiredValidity();

    const current = this.value;
    if (
      previous.length !== current.length ||
      previous.some((value, index) => value !== current[index])
    ) {
      this.#emitValueChange("programmatic");
    }
  }

  get form(): HTMLFormElement | null {
    const checkbox = this.#members()[0] ?? this.#parents()[0];
    return checkbox?.form ?? null;
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

  get valid(): boolean {
    this.#applyRequiredValidity();
    return this.#members().every((member) => member.validity.valid);
  }

  checkValidity(): boolean {
    this.#applyRequiredValidity();
    let valid = true;

    for (const member of this.#members()) {
      if (!member.checkValidity()) {
        valid = false;
      }
    }

    return valid;
  }

  reportValidity(): boolean {
    this.#applyRequiredValidity();
    const invalid = this.#members().find((member) => !member.validity.valid);
    return invalid ? invalid.reportValidity() : true;
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
    return this.#members().filter((member) => !isEffectivelyDisabled(member));
  }

  #readMemberValues(): string[] {
    return this.#members()
      .filter((member) => member.checked)
      .map((member) => member.value);
  }

  #captureMemberMutations(records: MutationRecord[]): void {
    for (const record of records) {
      const target = record.target;
      if (
        !(target instanceof HTMLInputElement) ||
        !belongsToRoot(target, this)
      ) {
        continue;
      }

      if (record.attributeName === "name" && isMemberCheckbox(target, this)) {
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

    for (const checkbox of this.querySelectorAll(checkboxSelector)) {
      if (
        !(checkbox instanceof HTMLInputElement) ||
        !belongsToRoot(checkbox, this)
      ) {
        continue;
      }

      const itemDisabled = checkbox.hasAttribute("data-item-disabled");
      const disabled = groupDisabled || itemDisabled;
      if (checkbox.disabled !== disabled) {
        checkbox.disabled = disabled;
      }
      checkbox.toggleAttribute("data-disabled", disabled);
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
    const baseId = `${this.id || "ormo-checkbox-group"}-label`;
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
    this.ownerDocument.addEventListener("submit", this.#handleSubmit, {
      capture: true,
      signal: this.#formController.signal,
    });
  }

  #belongsToForm(form: HTMLFormElement): boolean {
    return [...this.#members(), ...this.#parents()].some(
      (checkbox) => checkbox.form === form,
    );
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
    if (
      this.#validityTarget &&
      this.#validityMessage !== undefined &&
      this.#validityTarget.validity.customError &&
      this.#validityTarget.validationMessage === this.#validityMessage
    ) {
      this.#validityTarget.setCustomValidity("");
    }

    this.#validityTarget = undefined;
    this.#validityMessage = undefined;
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
    if (enabled.some((member) => member.checked)) {
      return;
    }

    const target = enabled.find((member) => member.validity.valid);
    if (!target) {
      return;
    }

    this.#validityTarget = target;
    this.#validityMessage = message;
    target.setCustomValidity(message);
  }

  #emitValueChange(reason: CheckboxGroupValueChangeReason): void {
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

  #handleReset = (event: Event): void => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !this.#belongsToForm(form)) {
      return;
    }

    queueMicrotask(() => {
      if (!this.isConnected) {
        return;
      }

      this.#reconcile();
      this.#applyRequiredValidity();
    });
  };

  #handleSubmit = (event: Event): void => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !this.#belongsToForm(form)) {
      return;
    }

    const submitter = event instanceof SubmitEvent ? event.submitter : null;
    const bypassesValidation =
      form.noValidate ||
      ((submitter instanceof HTMLButtonElement ||
        submitter instanceof HTMLInputElement) &&
        submitter.formNoValidate);
    if (bypassesValidation) {
      return;
    }

    this.#applyRequiredValidity();
    const invalid = this.#members().find((member) => !member.validity.valid);
    if (!invalid) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    invalid.reportValidity();
  };

  #handleChange = (event: Event): void => {
    if (this.#suppressEvents) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element) || !belongsToRoot(target, this)) {
      return;
    }

    if (isParentCheckbox(target, this)) {
      if (isEffectivelyDisabled(target)) {
        return;
      }

      const previous = this.value;

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

      const current = this.value;
      if (
        previous.length !== current.length ||
        previous.some((value, index) => value !== current[index])
      ) {
        this.#emitValueChange("parent");
      }
      return;
    }

    if (!isMemberCheckbox(target, this)) {
      return;
    }

    this.#reconcile();
    this.#applyRequiredValidity();
    this.#emitValueChange("member");
  };
}

if (!customElements.get(tagName)) {
  customElements.define(tagName, OrmoCheckboxGroup);
}

export type { OrmoCheckboxGroupElement };
