import type { OrmoCheckboxGroupElement } from "../components/checkbox/types";
import type {
  FieldControlElement,
  FieldState,
  FieldValidationMode,
  FieldValidator,
  FieldValidityMatch,
  OrmoFieldElement,
} from "../components/field/types";

const tagName = "ormo-field";
const labelSelector = "[data-ormo-field-label]";
const descriptionSelector = "[data-ormo-field-description]";
const errorSelector = "[data-ormo-field-error]";
const controlSelector = 'input:not([type="hidden"]), select, textarea';
const checkboxGroupSelector = "ormo-checkbox-group";

let generatedId = 0;

interface FieldParts {
  control: FieldControlElement | undefined;
  controls: FieldControlElement[];
  group: OrmoCheckboxGroupElement | undefined;
  labels: HTMLLabelElement[];
  descriptions: HTMLElement[];
  errors: HTMLElement[];
}

interface FormSubmitBarrier {
  tasks: Promise<void>[];
  scheduled: boolean;
}

const formSubmitBarriers = new WeakMap<HTMLFormElement, FormSubmitBarrier>();
const resumableSubmitForms = new WeakSet<HTMLFormElement>();

const validityMatches: Exclude<FieldValidityMatch, boolean>[] = [
  "badInput",
  "customError",
  "patternMismatch",
  "rangeOverflow",
  "rangeUnderflow",
  "stepMismatch",
  "tooLong",
  "tooShort",
  "typeMismatch",
  "valid",
  "valueMissing",
];

function belongsToRoot(element: Element, root: HTMLElement): boolean {
  return element.closest(tagName) === root;
}

function isFieldControl(element: Element): element is FieldControlElement {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  );
}

function getTokens(value: string | null): string[] {
  return value?.split(/\s+/).filter(Boolean) ?? [];
}

function getControlValue(control: FieldControlElement): string {
  if (
    control instanceof HTMLInputElement &&
    (control.type === "checkbox" || control.type === "radio")
  ) {
    return String(control.checked);
  }

  if (control instanceof HTMLInputElement && control.type === "file") {
    return Array.from(control.files ?? [])
      .map((file) => `${file.name}:${file.size}:${file.lastModified}`)
      .join("|");
  }

  return control.value;
}

function isControlFilled(control: FieldControlElement): boolean {
  if (control instanceof HTMLInputElement) {
    if (control.type === "checkbox" || control.type === "radio") {
      return control.checked;
    }

    if (control.type === "file") {
      return (control.files?.length ?? 0) > 0;
    }
  }

  if (control instanceof HTMLSelectElement && control.multiple) {
    return control.selectedOptions.length > 0;
  }

  return control.value !== "";
}

function normalizeValidationMode(
  value: string | undefined,
): FieldValidationMode {
  return value === "onBlur" || value === "onChange" ? value : "onSubmit";
}

function normalizeDebounceTime(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function firstInvalidControl(
  form: HTMLFormElement,
): FieldControlElement | undefined {
  return Array.from(form.querySelectorAll(controlSelector))
    .filter(isFieldControl)
    .find((candidate) => {
      const field = candidate.closest(tagName);
      return field instanceof OrmoField && !candidate.validity.valid;
    });
}

function isCheckboxGroup(
  element: Element | null | undefined,
): element is OrmoCheckboxGroupElement {
  return (
    element instanceof HTMLElement &&
    element.localName === "ormo-checkbox-group"
  );
}

function getGroupValue(group: OrmoCheckboxGroupElement): string {
  return group.value.slice().sort().join("|");
}

export function validateField(root: HTMLElement): void {
  if (!import.meta.env.DEV) {
    return;
  }

  const group = Array.from(root.querySelectorAll(checkboxGroupSelector))
    .filter((element) => belongsToRoot(element, root))
    .find(isCheckboxGroup);
  const controls = Array.from(root.querySelectorAll(controlSelector))
    .filter((element) => belongsToRoot(element, root))
    .filter(isFieldControl)
    .filter((control) => !control.closest(checkboxGroupSelector));
  const labels = Array.from(
    root.querySelectorAll<HTMLLabelElement>(labelSelector),
  ).filter((element) => belongsToRoot(element, root));

  if (group) {
    if (labels.length > 0) {
      console.warn(
        "[Ormo Field] Use CheckboxGroup.Label for the group name. Field.Label targets a single control.",
        root,
      );
    }

    if (root.hasAttribute("data-required")) {
      console.warn(
        "[Ormo Field] Put required and requiredMessage on CheckboxGroup.Root for at-least-one validation.",
        root,
      );
    }

    return;
  }

  const control = controls[0];

  if (!control) {
    console.warn(
      "[Ormo Field] Add a native input, select, or textarea inside Field.Root.",
      root,
    );
    return;
  }

  if (controls.length > 1) {
    console.warn(
      "[Ormo Field] Field.Root owns only the first native control. Use one control per field, or a dedicated group primitive for radios and checkboxes.",
      root,
    );
  }

  if (
    labels.length === 0 &&
    !control.hasAttribute("aria-label") &&
    !control.hasAttribute("aria-labelledby")
  ) {
    console.warn(
      "[Ormo Field] Add Field.Label or an aria-label to the field control.",
      root,
    );
  }
}

function setStateAttribute(
  elements: Element[],
  name: `data-${string}`,
  present: boolean,
): void {
  elements.forEach((element) => {
    element.toggleAttribute(name, present);
  });
}

function statesEqual(left: FieldState, right: FieldState): boolean {
  return (
    left.disabled === right.disabled &&
    left.dirty === right.dirty &&
    left.filled === right.filled &&
    left.focused === right.focused &&
    left.invalid === right.invalid &&
    left.touched === right.touched &&
    left.valid === right.valid &&
    left.validating === right.validating
  );
}

export class OrmoField extends HTMLElement implements OrmoFieldElement {
  #controller: AbortController | undefined;
  #formController: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #debounceTimer: ReturnType<typeof setTimeout> | undefined;
  #control: FieldControlElement | undefined;
  #group: OrmoCheckboxGroupElement | undefined;
  #initialValue = "";
  #initialized = false;
  #invalidOverride = false;
  #disabledOverride = false;
  #requiredOverride = false;
  #readOnlyOverride = false;
  #nameOverride: string | undefined;
  #originalAriaInvalid: string | null = null;
  #originalDisabled = false;
  #originalRequired = false;
  #originalReadOnly = false;
  #originalName = "";
  #originalGroupAriaInvalid: string | null = null;
  #authoredDescribedByIds = new Set<string>();
  #managedDescribedByIds = new Set<string>();
  #managedLabels = new Set<HTMLLabelElement>();
  #focused = false;
  #touched = false;
  #validated = false;
  #validating = false;
  #validator: FieldValidator | undefined;
  #validatorApplied = false;
  #validatorGeneration = 0;
  #previousState: FieldState | undefined;

  connectedCallback(): void {
    if (!this.#initialized) {
      this.#invalidOverride = this.hasAttribute("data-invalid");
      this.#disabledOverride = this.hasAttribute("data-disabled");
      this.#requiredOverride = this.hasAttribute("data-required");
      this.#readOnlyOverride = this.hasAttribute("data-readonly");
      this.#nameOverride = this.hasAttribute("name")
        ? (this.getAttribute("name") ?? "")
        : undefined;
    }

    this.#controller?.abort();
    this.#controller = new AbortController();

    this.addEventListener("input", this.#handleInput, {
      signal: this.#controller.signal,
    });
    this.addEventListener("change", this.#handleGroupChange, {
      signal: this.#controller.signal,
    });
    this.addEventListener("ormo:value-change", this.#handleGroupChange, {
      signal: this.#controller.signal,
    });
    this.addEventListener("focusin", this.#handleFocusIn, {
      signal: this.#controller.signal,
    });
    this.addEventListener("focusout", this.#handleFocusOut, {
      signal: this.#controller.signal,
    });
    this.addEventListener("invalid", this.#handleInvalid, {
      capture: true,
      signal: this.#controller.signal,
    });

    const parts = this.#getParts();
    this.#setGroup(parts.group);
    this.#setControl(parts.group ? undefined : parts.control);
    this.#prepareRelationships(parts);
    this.#bindForm();
    this.#applyState();

    if (import.meta.env.DEV) {
      validateField(this);
    }

    this.#observer?.disconnect();
    this.#observer = new MutationObserver(this.#handleMutations);
    this.#observer.observe(this, { childList: true, subtree: true });
    this.#initialized = true;
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#formController?.abort();
    this.#formController = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#clearDebounce();
    this.#validatorGeneration += 1;
    this.#validating = false;
  }

  get state(): FieldState {
    return { ...this.#getState(this.#getParts()) };
  }

  get invalid(): boolean {
    return this.state.invalid;
  }

  set invalid(value: boolean) {
    this.#invalidOverride = value;
    this.#applyState();
  }

  get disabled(): boolean {
    return this.state.disabled;
  }

  set disabled(value: boolean) {
    this.#disabledOverride = value;
    this.#applyState();
  }

  get name(): string {
    return this.#nameOverride ?? this.#group?.name ?? this.#control?.name ?? "";
  }

  set name(value: string) {
    this.#nameOverride = value;
    this.setAttribute("name", value);
    if (this.#group) {
      this.#group.name = value;
    }
    this.#applyState();
  }

  get required(): boolean {
    return this.#requiredOverride || this.#originalRequired;
  }

  set required(value: boolean) {
    this.#requiredOverride = value;
    this.toggleAttribute("data-required", value);
    this.#applyState();
  }

  get readOnly(): boolean {
    return this.#readOnlyOverride || this.#originalReadOnly;
  }

  set readOnly(value: boolean) {
    this.#readOnlyOverride = value;
    this.toggleAttribute("data-readonly", value);
    this.#applyState();
  }

  get validationMode(): FieldValidationMode {
    return normalizeValidationMode(this.dataset.validationMode);
  }

  set validationMode(value: FieldValidationMode) {
    this.dataset.validationMode = normalizeValidationMode(value);
  }

  get validationDebounceTime(): number {
    return normalizeDebounceTime(this.dataset.validationDebounceTime);
  }

  set validationDebounceTime(value: number) {
    if (value > 0) {
      this.dataset.validationDebounceTime = String(value);
    } else {
      delete this.dataset.validationDebounceTime;
    }
  }

  get validator(): FieldValidator | undefined {
    return this.#validator;
  }

  set validator(value: FieldValidator | undefined) {
    this.#validator = value;

    if (!value && this.#control && this.#validatorApplied) {
      this.#control.setCustomValidity("");
      this.#validatorApplied = false;
      this.#validating = false;
    } else if (value && this.#validated) {
      void this.#runValidator();
    }

    this.#applyState();
  }

  async validate(): Promise<boolean> {
    this.#validated = true;
    this.#clearDebounce();

    if (this.#group) {
      await this.#runValidator();
      const valid = this.#group.checkValidity();
      this.#applyState();
      return valid;
    }

    const control = this.#control;

    if (!control) {
      return true;
    }

    await this.#runValidator();
    const valid = control.checkValidity();
    this.#applyState();
    return valid;
  }

  #getParts(): FieldParts {
    const group = Array.from(this.querySelectorAll(checkboxGroupSelector))
      .filter((element) => belongsToRoot(element, this))
      .find(isCheckboxGroup);
    const controls = Array.from(this.querySelectorAll(controlSelector))
      .filter((element) => belongsToRoot(element, this))
      .filter(isFieldControl)
      .filter((control) => !group || !control.closest(checkboxGroupSelector));
    const labels = Array.from(
      this.querySelectorAll<HTMLLabelElement>(labelSelector),
    ).filter((element) => belongsToRoot(element, this));
    const descriptions = Array.from(
      this.querySelectorAll<HTMLElement>(descriptionSelector),
    ).filter((element) => belongsToRoot(element, this));
    const errors = Array.from(
      this.querySelectorAll<HTMLElement>(errorSelector),
    ).filter((element) => belongsToRoot(element, this));

    return {
      control: group ? undefined : controls[0],
      controls,
      group,
      labels,
      descriptions,
      errors,
    };
  }

  #setGroup(group: OrmoCheckboxGroupElement | undefined): void {
    if (group === this.#group) {
      return;
    }

    this.#releaseGroup();
    this.#group = group;
    this.#managedDescribedByIds.clear();
    this.#authoredDescribedByIds.clear();
    this.#touched = false;
    this.#validated = false;
    this.#focused = false;
    this.#validatorApplied = false;
    this.#validating = false;
    this.#validatorGeneration += 1;
    this.#clearDebounce();

    if (!group) {
      this.#initialValue = "";
      this.#originalGroupAriaInvalid = null;
      return;
    }

    this.#initialValue = getGroupValue(group);
    this.#originalGroupAriaInvalid = group.getAttribute("aria-invalid");
    this.#authoredDescribedByIds = new Set(
      getTokens(group.getAttribute("aria-describedby")),
    );
    this.#focused = group.contains(group.ownerDocument.activeElement);
  }

  #releaseGroup(): void {
    const group = this.#group;

    if (!group) {
      return;
    }

    if (this.#originalGroupAriaInvalid === null) {
      group.removeAttribute("aria-invalid");
    } else {
      group.setAttribute("aria-invalid", this.#originalGroupAriaInvalid);
    }

    const describedBy = Array.from(this.#authoredDescribedByIds).join(" ");

    if (describedBy) {
      group.setAttribute("aria-describedby", describedBy);
    } else {
      group.removeAttribute("aria-describedby");
    }
  }

  #setControl(control: FieldControlElement | undefined): void {
    if (control === this.#control) {
      return;
    }

    this.#releaseControl();
    this.#control = control;
    this.#managedDescribedByIds.clear();
    this.#authoredDescribedByIds.clear();
    this.#touched = false;
    this.#validated = false;
    this.#focused = false;
    this.#validatorApplied = false;
    this.#validating = false;
    this.#validatorGeneration += 1;
    this.#clearDebounce();

    if (!control) {
      this.#initialValue = "";
      this.#originalAriaInvalid = null;
      this.#originalDisabled = false;
      this.#originalRequired = false;
      this.#originalReadOnly = false;
      this.#originalName = "";
      return;
    }

    this.#initialValue = getControlValue(control);
    this.#originalAriaInvalid = control.getAttribute("aria-invalid");
    this.#originalDisabled = control.disabled;
    this.#originalRequired = control.required;
    this.#originalReadOnly = "readOnly" in control ? control.readOnly : false;
    this.#originalName = control.name;
    this.#authoredDescribedByIds = new Set(
      getTokens(control.getAttribute("aria-describedby")),
    );
    this.#focused = control === control.ownerDocument.activeElement;
  }

  #releaseControl(): void {
    const control = this.#control;

    if (!control) {
      return;
    }

    control.disabled = this.#originalDisabled;
    control.required = this.#originalRequired;
    if ("readOnly" in control) {
      control.readOnly = this.#originalReadOnly;
    }
    control.name = this.#originalName;

    if (this.#originalAriaInvalid === null) {
      control.removeAttribute("aria-invalid");
    } else {
      control.setAttribute("aria-invalid", this.#originalAriaInvalid);
    }

    const describedBy = Array.from(this.#authoredDescribedByIds).join(" ");

    if (describedBy) {
      control.setAttribute("aria-describedby", describedBy);
    } else {
      control.removeAttribute("aria-describedby");
    }
  }

  #prepareRelationships(parts: FieldParts): void {
    const { control, group, labels, descriptions, errors } = parts;
    const describedTarget = group ?? control;

    if (!describedTarget) {
      return;
    }

    if (!this.id) {
      generatedId += 1;
      this.id = `ormo-field-${generatedId}`;
    }

    if (control) {
      control.id ||= `${this.id}-control`;
    }

    if (group && !group.id) {
      group.id = `${this.id}-group`;
    }

    labels.forEach((label, index) => {
      label.id ||= `${this.id}-label-${index + 1}`;

      if (control && (!label.htmlFor || this.#managedLabels.has(label))) {
        label.htmlFor = control.id;
        this.#managedLabels.add(label);
      }
    });
    descriptions.forEach((description, index) => {
      description.id ||= `${this.id}-description-${index + 1}`;
    });
    errors.forEach((error, index) => {
      error.id ||= `${this.id}-error-${index + 1}`;
    });

    getTokens(describedTarget.getAttribute("aria-describedby"))
      .filter((id) => !this.#managedDescribedByIds.has(id))
      .forEach((id) => this.#authoredDescribedByIds.add(id));

    this.#syncDescribedBy(parts);
  }

  #syncDescribedBy(parts: FieldParts): void {
    const { control, group, descriptions, errors } = parts;
    const describedTarget = group ?? control;

    if (!describedTarget) {
      return;
    }

    const visibleErrors = errors.filter((error) => !error.hidden);

    this.#managedDescribedByIds = new Set(
      [...descriptions, ...visibleErrors].map((element) => element.id),
    );

    const describedByIds = [
      ...this.#authoredDescribedByIds,
      ...this.#managedDescribedByIds,
    ];

    if (describedByIds.length > 0) {
      describedTarget.setAttribute(
        "aria-describedby",
        describedByIds.join(" "),
      );
    } else {
      describedTarget.removeAttribute("aria-describedby");
    }
  }

  #bindForm(): void {
    this.#formController?.abort();
    this.#formController = new AbortController();
    const form =
      this.#control?.form ??
      this.#group?.querySelector<HTMLInputElement>("input[type='checkbox']")
        ?.form;

    if (!form) {
      return;
    }

    form.addEventListener("reset", this.#handleReset, {
      signal: this.#formController.signal,
    });
    form.addEventListener("submit", this.#handleSubmit, {
      capture: true,
      signal: this.#formController.signal,
    });
  }

  #clearDebounce(): void {
    if (this.#debounceTimer !== undefined) {
      clearTimeout(this.#debounceTimer);
      this.#debounceTimer = undefined;
    }
  }

  async #runValidator(): Promise<void> {
    const control = this.#control;
    const group = this.#group;

    if ((!control && !group) || !this.#validator) {
      this.#validating = false;
      return;
    }

    const generation = ++this.#validatorGeneration;
    const value = group
      ? getGroupValue(group)
      : getControlValue(control as FieldControlElement);
    // Group fields pass the first member as the control argument when present.
    const validatorControl =
      control ??
      group?.querySelector<HTMLInputElement>(
        'input[type="checkbox"]:not([data-ormo-checkbox-parent])',
      );

    if (!validatorControl || !isFieldControl(validatorControl)) {
      this.#validating = false;
      return;
    }

    const result = this.#validator(value, validatorControl);

    if (
      result !== null &&
      result !== undefined &&
      typeof result === "object" &&
      "then" in result
    ) {
      this.#validating = true;
      this.#applyState();

      try {
        const message = await result;

        if (
          generation !== this.#validatorGeneration ||
          (control && control !== this.#control) ||
          (group && group !== this.#group)
        ) {
          return;
        }

        validatorControl.setCustomValidity(message ?? "");
        this.#validatorApplied = true;
      } finally {
        if (generation === this.#validatorGeneration) {
          this.#validating = false;
        }
      }

      return;
    }

    this.#validating = false;
    validatorControl.setCustomValidity(
      (result as string | null | undefined) ?? "",
    );
    this.#validatorApplied = true;
  }

  #scheduleValidation(): void {
    this.#clearDebounce();

    const debounceTime = this.validationDebounceTime;

    if (debounceTime > 0 && this.validationMode === "onChange") {
      this.#debounceTimer = setTimeout(() => {
        this.#debounceTimer = undefined;
        void this.#runValidator().then(() => this.#applyState());
      }, debounceTime);
      return;
    }

    void this.#runValidator().then(() => this.#applyState());
  }

  #getState(parts: FieldParts): FieldState {
    const { control, group } = parts;
    const disabled =
      this.#disabledOverride ||
      this.#originalDisabled ||
      Boolean(group?.disabled);
    const groupInvalid = group !== undefined && this.#validated && !group.valid;
    const invalid =
      this.#invalidOverride ||
      this.#originalAriaInvalid === "true" ||
      this.#originalGroupAriaInvalid === "true" ||
      groupInvalid ||
      (this.#validated &&
        !this.#validating &&
        control !== undefined &&
        !control.validity.valid);

    return {
      disabled,
      dirty: group
        ? getGroupValue(group) !== this.#initialValue
        : control
          ? getControlValue(control) !== this.#initialValue
          : false,
      filled: group
        ? group.value.length > 0
        : control
          ? isControlFilled(control)
          : false,
      focused: group || control ? this.#focused : false,
      invalid,
      touched: this.#touched,
      valid: this.#validated && !this.#validating && !invalid,
      validating: this.#validating,
    };
  }

  #errorMatches(
    error: HTMLElement,
    control: FieldControlElement | undefined,
    state: FieldState,
  ): boolean {
    const match = error.dataset.match;

    if (match === "true") {
      return true;
    }

    if (match === "false") {
      return false;
    }

    if (!match) {
      return state.invalid;
    }

    const validityMatch = match as Exclude<FieldValidityMatch, boolean>;

    if (!control || !validityMatches.includes(validityMatch)) {
      return false;
    }

    if (match === "valid") {
      return state.valid;
    }

    return (
      state.invalid &&
      control.validity[match as Exclude<FieldValidityMatch, boolean | "valid">]
    );
  }

  #applyControlAttributes(control: FieldControlElement): void {
    control.disabled = this.#disabledOverride || this.#originalDisabled;
    control.required = this.#requiredOverride || this.#originalRequired;

    if ("readOnly" in control) {
      control.readOnly = this.#readOnlyOverride || this.#originalReadOnly;
    }

    if (this.#nameOverride !== undefined) {
      control.name = this.#nameOverride;
    }
  }

  #applyGroupAttributes(group: OrmoCheckboxGroupElement): void {
    if (this.#disabledOverride) {
      group.disabled = true;
    }

    if (this.#nameOverride !== undefined) {
      group.name = this.#nameOverride;
    }
  }

  #applyState(): void {
    const parts = this.#getParts();
    const { control, group, labels, descriptions, errors } = parts;

    if (group !== this.#group) {
      this.#setGroup(group);
      this.#prepareRelationships(parts);
      this.#bindForm();
    }

    if (control !== this.#control) {
      this.#setControl(group ? undefined : control);
      this.#prepareRelationships(parts);
      this.#bindForm();
    }

    if (group) {
      this.#applyGroupAttributes(group);
    } else if (control) {
      this.#applyControlAttributes(control);
    }

    const state = this.#getState(parts);
    const stateElements: Element[] = [
      this,
      ...labels,
      ...descriptions,
      ...errors,
      ...(control ? [control] : []),
      ...(group ? [group] : []),
    ];

    setStateAttribute(stateElements, "data-disabled", state.disabled);
    setStateAttribute(stateElements, "data-dirty", state.dirty);
    setStateAttribute(stateElements, "data-filled", state.filled);
    setStateAttribute(stateElements, "data-focused", state.focused);
    setStateAttribute(stateElements, "data-invalid", state.invalid);
    setStateAttribute(stateElements, "data-touched", state.touched);
    setStateAttribute(stateElements, "data-valid", state.valid);
    setStateAttribute(stateElements, "data-validating", state.validating);

    if (control) {
      if (state.invalid) {
        control.setAttribute("aria-invalid", "true");
      } else if (this.#originalAriaInvalid === null) {
        control.removeAttribute("aria-invalid");
      } else {
        control.setAttribute("aria-invalid", this.#originalAriaInvalid);
      }
    }

    if (group) {
      if (state.invalid) {
        group.setAttribute("aria-invalid", "true");
      } else if (this.#originalGroupAriaInvalid === null) {
        group.removeAttribute("aria-invalid");
      } else {
        group.setAttribute("aria-invalid", this.#originalGroupAriaInvalid);
      }
    }

    const validityControl =
      control ??
      group?.querySelector<HTMLInputElement>(
        'input[type="checkbox"]:not([data-ormo-checkbox-parent])',
      );

    errors.forEach((error) => {
      if (!error.hasAttribute("role")) {
        error.setAttribute("role", "alert");
      }

      error.hidden = !this.#errorMatches(
        error,
        validityControl && isFieldControl(validityControl)
          ? validityControl
          : undefined,
        state,
      );
    });

    this.#syncDescribedBy(parts);

    if (
      this.#previousState &&
      !statesEqual(this.#previousState, state) &&
      this.isConnected
    ) {
      this.dispatchEvent(
        new CustomEvent("ormo:state-change", {
          bubbles: true,
          composed: true,
          detail: { state: { ...state } },
        }),
      );
    }

    this.#previousState = { ...state };
  }

  #isControlEvent(event: Event): boolean {
    return event.target === this.#control;
  }

  #isGroupEvent(event: Event): boolean {
    const group = this.#group;
    if (!group) {
      return false;
    }

    const target = event.target;
    return (
      target instanceof Node && (target === group || group.contains(target))
    );
  }

  #handleInput = (event: Event): void => {
    if (!this.#isControlEvent(event)) {
      return;
    }

    if (this.validationMode === "onChange") {
      this.#validated = true;
    }

    if (this.#validated) {
      this.#scheduleValidation();
    }

    this.#applyState();
  };

  #handleGroupChange = (event: Event): void => {
    if (!this.#group || !this.#isGroupEvent(event)) {
      return;
    }

    if (this.validationMode === "onChange") {
      this.#validated = true;
    }

    if (this.#validated) {
      this.#scheduleValidation();
    }

    this.#applyState();
  };

  #handleFocusIn = (event: FocusEvent): void => {
    if (this.#isControlEvent(event) || this.#isGroupEvent(event)) {
      this.#focused = true;
      this.#applyState();
    }
  };

  #handleFocusOut = (event: FocusEvent): void => {
    const related = event.relatedTarget;
    const stayingInGroup =
      this.#group && related instanceof Node && this.#group.contains(related);

    if (this.#isControlEvent(event)) {
      this.#focused = false;
      this.#touched = true;

      if (this.validationMode === "onBlur") {
        this.#validated = true;
        this.#clearDebounce();
        void this.#runValidator().then(() => this.#applyState());
      }

      this.#applyState();
      return;
    }

    if (!this.#isGroupEvent(event) || stayingInGroup) {
      return;
    }

    this.#focused = false;
    this.#touched = true;

    if (this.validationMode === "onBlur") {
      this.#validated = true;
      this.#clearDebounce();
      void this.#runValidator().then(() => this.#applyState());
    }

    this.#applyState();
  };

  #handleInvalid = (event: Event): void => {
    if (!this.#isControlEvent(event) && !this.#isGroupEvent(event)) {
      return;
    }

    this.#touched = true;
    this.#validated = true;
    this.#clearDebounce();
    void this.#runValidator().then(() => this.#applyState());
    this.#applyState();
  };

  #handleReset = (): void => {
    queueMicrotask(() => {
      const control = this.#control;
      const group = this.#group;

      if (!control && !group) {
        return;
      }

      this.#clearDebounce();
      this.#validatorGeneration += 1;
      this.#validating = false;

      if (this.#validatorApplied && control) {
        control.setCustomValidity("");
        this.#validatorApplied = false;
      }

      this.#initialValue = group
        ? getGroupValue(group)
        : getControlValue(control as FieldControlElement);
      this.#touched = false;
      this.#validated = false;
      this.#focused = group
        ? group.contains(group.ownerDocument.activeElement)
        : control === control?.ownerDocument.activeElement;
      this.#applyState();
    });
  };

  #handleSubmit = (event: SubmitEvent): void => {
    const control = this.#control;
    const group = this.#group;
    const form =
      control?.form ??
      group?.querySelector<HTMLInputElement>("input[type='checkbox']")?.form;

    if (form && resumableSubmitForms.has(form)) {
      return;
    }

    this.#validated = true;
    this.#clearDebounce();

    const validation = this.#runValidator();

    if (!form) {
      event.preventDefault();
      void validation.then(() => {
        this.#applyState();

        if (group && !group.checkValidity()) {
          group.reportValidity();
          return;
        }

        if (control && !control.checkValidity()) {
          control.focus();
          control.reportValidity();
        }
      });
      return;
    }

    event.preventDefault();

    let barrier = formSubmitBarriers.get(form);

    if (!barrier) {
      barrier = { tasks: [], scheduled: false };
      formSubmitBarriers.set(form, barrier);
    }

    barrier.tasks.push(
      validation.then(() => {
        this.#applyState();
      }),
    );

    if (barrier.scheduled) {
      return;
    }

    barrier.scheduled = true;

    queueMicrotask(() => {
      const active = formSubmitBarriers.get(form);

      if (!active) {
        return;
      }

      formSubmitBarriers.delete(form);

      void Promise.all(active.tasks).then(() => {
        const invalidControl = firstInvalidControl(form);

        if (invalidControl) {
          invalidControl.focus();
          invalidControl.reportValidity();
          return;
        }

        resumableSubmitForms.add(form);
        form.requestSubmit(
          event.submitter instanceof HTMLElement ? event.submitter : undefined,
        );
        resumableSubmitForms.delete(form);
      });
    });
  };

  #handleMutations = (): void => {
    const parts = this.#getParts();
    const controlChanged = parts.control !== this.#control;
    const groupChanged = parts.group !== this.#group;

    if (groupChanged) {
      this.#setGroup(parts.group);
    }

    if (controlChanged) {
      this.#setControl(parts.group ? undefined : parts.control);
    }

    if (controlChanged || groupChanged) {
      this.#bindForm();
    }

    this.#prepareRelationships(parts);
    this.#applyState();

    if (import.meta.env.DEV) {
      validateField(this);
    }
  };
}

if (!customElements.get(tagName)) {
  customElements.define(tagName, OrmoField);
}
