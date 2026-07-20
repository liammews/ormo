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
const controlSelector =
  'input:not([type="hidden"]), select, textarea, [data-ormo-field-control]';

let generatedId = 0;

interface FieldParts {
  control: FieldControlElement | undefined;
  labels: HTMLLabelElement[];
  descriptions: HTMLElement[];
  errors: HTMLElement[];
}

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
    left.valid === right.valid
  );
}

function normalizeValidationMode(
  value: string | undefined,
): FieldValidationMode {
  return value === "onBlur" || value === "onChange" ? value : "onSubmit";
}

export class OrmoField extends HTMLElement implements OrmoFieldElement {
  #controller: AbortController | undefined;
  #formController: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #control: FieldControlElement | undefined;
  #initialValue = "";
  #initialized = false;
  #invalidOverride = false;
  #disabledOverride = false;
  #originalAriaInvalid: string | null = null;
  #originalDisabled = false;
  #authoredDescribedByIds = new Set<string>();
  #managedDescribedByIds = new Set<string>();
  #managedLabels = new Set<HTMLLabelElement>();
  #focused = false;
  #touched = false;
  #validated = false;
  #validator: FieldValidator | undefined;
  #validatorApplied = false;
  #previousState: FieldState | undefined;

  connectedCallback(): void {
    if (!this.#initialized) {
      this.#invalidOverride = this.hasAttribute("data-invalid");
      this.#disabledOverride = this.hasAttribute("data-disabled");
    }

    this.#controller?.abort();
    this.#controller = new AbortController();

    this.addEventListener("input", this.#handleInput, {
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
    this.#setControl(parts.control);
    this.#prepareRelationships(parts);
    this.#bindForm();
    this.#applyState();

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

  get validationMode(): FieldValidationMode {
    return normalizeValidationMode(this.dataset.validationMode);
  }

  set validationMode(value: FieldValidationMode) {
    this.dataset.validationMode = normalizeValidationMode(value);
  }

  get validator(): FieldValidator | undefined {
    return this.#validator;
  }

  set validator(value: FieldValidator | undefined) {
    this.#validator = value;

    if (!value && this.#control && this.#validatorApplied) {
      this.#control.setCustomValidity("");
      this.#validatorApplied = false;
    } else if (value && this.#validated) {
      this.#runValidator();
    }

    this.#applyState();
  }

  validate(): boolean {
    const control = this.#control;

    if (!control) {
      return true;
    }

    this.#validated = true;
    this.#runValidator();
    const valid = control.checkValidity();
    this.#applyState();
    return valid;
  }

  #getParts(): FieldParts {
    const control = Array.from(this.querySelectorAll(controlSelector))
      .filter((element) => belongsToRoot(element, this))
      .find(isFieldControl);
    const labels = Array.from(
      this.querySelectorAll<HTMLLabelElement>(labelSelector),
    ).filter((element) => belongsToRoot(element, this));
    const descriptions = Array.from(
      this.querySelectorAll<HTMLElement>(descriptionSelector),
    ).filter((element) => belongsToRoot(element, this));
    const errors = Array.from(
      this.querySelectorAll<HTMLElement>(errorSelector),
    ).filter((element) => belongsToRoot(element, this));

    return { control, labels, descriptions, errors };
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

    if (!control) {
      this.#initialValue = "";
      this.#originalAriaInvalid = null;
      this.#originalDisabled = false;
      return;
    }

    this.#initialValue = getControlValue(control);
    this.#originalAriaInvalid = control.getAttribute("aria-invalid");
    this.#originalDisabled = control.disabled;
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
    const { control, labels, descriptions, errors } = parts;

    if (!control) {
      return;
    }

    if (!this.id) {
      generatedId += 1;
      this.id = `ormo-field-${generatedId}`;
    }

    control.id ||= `${this.id}-control`;

    labels.forEach((label, index) => {
      label.id ||= `${this.id}-label-${index + 1}`;

      if (!label.htmlFor || this.#managedLabels.has(label)) {
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

    getTokens(control.getAttribute("aria-describedby"))
      .filter((id) => !this.#managedDescribedByIds.has(id))
      .forEach((id) => this.#authoredDescribedByIds.add(id));

    this.#managedDescribedByIds = new Set(
      [...descriptions, ...errors].map((element) => element.id),
    );

    const describedByIds = [
      ...this.#authoredDescribedByIds,
      ...this.#managedDescribedByIds,
    ];

    if (describedByIds.length > 0) {
      control.setAttribute("aria-describedby", describedByIds.join(" "));
    } else {
      control.removeAttribute("aria-describedby");
    }
  }

  #bindForm(): void {
    this.#formController?.abort();
    this.#formController = new AbortController();
    const form = this.#control?.form;

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

  #runValidator(): void {
    const control = this.#control;

    if (!control || !this.#validator) {
      return;
    }

    const message = this.#validator(getControlValue(control), control);
    control.setCustomValidity(message ?? "");
    this.#validatorApplied = true;
  }

  #getState(parts: FieldParts): FieldState {
    const { control } = parts;
    const disabled = this.#disabledOverride || this.#originalDisabled;
    const invalid =
      this.#invalidOverride ||
      this.#originalAriaInvalid === "true" ||
      (this.#validated && control !== undefined && !control.validity.valid);

    return {
      disabled,
      dirty: control ? getControlValue(control) !== this.#initialValue : false,
      filled: control ? getControlValue(control) !== "" : false,
      focused: control ? this.#focused : false,
      invalid,
      touched: this.#touched,
      valid: this.#validated && !invalid,
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

  #applyState(): void {
    const parts = this.#getParts();
    const { control, labels, descriptions, errors } = parts;

    if (control !== this.#control) {
      this.#setControl(control);
      this.#prepareRelationships(parts);
      this.#bindForm();
    }

    if (control) {
      control.disabled = this.#disabledOverride || this.#originalDisabled;
    }

    const state = this.#getState(parts);
    const stateElements: Element[] = [
      this,
      ...labels,
      ...descriptions,
      ...errors,
      ...(control ? [control] : []),
    ];

    setStateAttribute(stateElements, "data-disabled", state.disabled);
    setStateAttribute(stateElements, "data-dirty", state.dirty);
    setStateAttribute(stateElements, "data-filled", state.filled);
    setStateAttribute(stateElements, "data-focused", state.focused);
    setStateAttribute(stateElements, "data-invalid", state.invalid);
    setStateAttribute(stateElements, "data-touched", state.touched);
    setStateAttribute(stateElements, "data-valid", state.valid);

    if (control) {
      if (state.invalid) {
        control.setAttribute("aria-invalid", "true");
      } else if (this.#originalAriaInvalid === null) {
        control.removeAttribute("aria-invalid");
      } else {
        control.setAttribute("aria-invalid", this.#originalAriaInvalid);
      }
    }

    errors.forEach((error) => {
      error.hidden = !this.#errorMatches(error, control, state);
    });

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

  #handleInput = (event: Event): void => {
    if (!this.#isControlEvent(event)) {
      return;
    }

    if (this.validationMode === "onChange") {
      this.#validated = true;
    }

    if (this.#validated) {
      this.#runValidator();
    }

    this.#applyState();
  };

  #handleFocusIn = (event: FocusEvent): void => {
    if (this.#isControlEvent(event)) {
      this.#focused = true;
      this.#applyState();
    }
  };

  #handleFocusOut = (event: FocusEvent): void => {
    if (!this.#isControlEvent(event)) {
      return;
    }

    this.#focused = false;
    this.#touched = true;

    if (this.validationMode === "onBlur") {
      this.#validated = true;
      this.#runValidator();
    }

    this.#applyState();
  };

  #handleInvalid = (event: Event): void => {
    if (!this.#isControlEvent(event)) {
      return;
    }

    this.#touched = true;
    this.#validated = true;
    this.#runValidator();
    this.#applyState();
  };

  #handleReset = (): void => {
    queueMicrotask(() => {
      const control = this.#control;

      if (!control) {
        return;
      }

      if (this.#validatorApplied) {
        control.setCustomValidity("");
        this.#validatorApplied = false;
      }

      this.#initialValue = getControlValue(control);
      this.#touched = false;
      this.#validated = false;
      this.#focused = control === control.ownerDocument.activeElement;
      this.#applyState();
    });
  };

  #handleSubmit = (event: SubmitEvent): void => {
    this.#validated = true;
    this.#runValidator();

    if (this.#control && !this.#control.checkValidity()) {
      event.preventDefault();
      this.#control.reportValidity();
    }

    this.#applyState();
  };

  #handleMutations = (): void => {
    const parts = this.#getParts();
    const controlChanged = parts.control !== this.#control;

    if (controlChanged) {
      this.#setControl(parts.control);
      this.#bindForm();
    }

    this.#prepareRelationships(parts);
    this.#applyState();
  };
}

if (!customElements.get(tagName)) {
  customElements.define(tagName, OrmoField);
}
