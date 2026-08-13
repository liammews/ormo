import type { OrmoCheckboxGroupElement } from "../components/checkbox/types";
import type { OrmoRadioGroupElement } from "../components/radio/types";
import type {
  FieldControlElement,
  FieldState,
  FieldValidationMode,
  FieldValidator,
  FieldValidityMatch,
  OrmoFieldElement,
} from "../components/field/types";
import { registerField, unregisterField } from "./field-form";
import {
  getRelationshipTokens,
  prepareFieldRelationshipIds,
  setDescribedBy,
} from "./field-relationships";
import {
  checkValidityWithoutRevalidation,
  getValidatorContext,
  isInternallyCheckedControl,
  reportValidityWithoutRevalidation,
  validityCheckWithoutRevalidation,
} from "./field-validation";

const tagName = "ormo-field";
const labelSelector = "[data-ormo-field-label]";
const descriptionSelector = "[data-ormo-field-description]";
const errorSelector = "[data-ormo-field-error]";
const controlSelector = 'input:not([type="hidden"]), select, textarea';
const fieldGroupSelector = "ormo-checkbox-group, ormo-radio-group";

type OrmoFieldGroupElement = OrmoCheckboxGroupElement | OrmoRadioGroupElement;

interface FieldParts {
  control: FieldControlElement | undefined;
  controls: FieldControlElement[];
  group: OrmoFieldGroupElement | undefined;
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

function isFieldGroup(
  element: Element | null | undefined,
): element is OrmoFieldGroupElement {
  return (
    element instanceof HTMLElement &&
    (element.localName === "ormo-checkbox-group" ||
      element.localName === "ormo-radio-group")
  );
}

function getGroupValue(group: OrmoFieldGroupElement): string {
  return Array.isArray(group.value)
    ? group.value.slice().sort().join("|")
    : (group.value ?? "");
}

function getGroupControl(
  group: OrmoFieldGroupElement,
): HTMLInputElement | undefined {
  const selector =
    group.localName === "ormo-radio-group"
      ? 'input[type="radio"]'
      : 'input[type="checkbox"]:not([data-ormo-checkbox-parent])';
  return group.querySelector<HTMLInputElement>(selector) ?? undefined;
}

function checkGroupValidityWithoutRevalidation(
  group: OrmoFieldGroupElement,
): boolean {
  const control = getGroupControl(group);
  return control
    ? validityCheckWithoutRevalidation(control, () => group.checkValidity())
    : group.checkValidity();
}

export function validateField(root: HTMLElement): void {
  if (!import.meta.env.DEV) {
    return;
  }

  const group = Array.from(root.querySelectorAll(fieldGroupSelector))
    .filter((element) => belongsToRoot(element, root))
    .find(isFieldGroup);
  const controls = Array.from(root.querySelectorAll(controlSelector))
    .filter((element) => belongsToRoot(element, root))
    .filter(isFieldControl)
    .filter((control) => !control.closest(fieldGroupSelector));
  const labels = Array.from(
    root.querySelectorAll<HTMLLabelElement>(labelSelector),
  ).filter((element) => belongsToRoot(element, root));

  if (group) {
    const groupName =
      group.localName === "ormo-radio-group" ? "RadioGroup" : "CheckboxGroup";

    if (labels.length > 0) {
      console.warn(
        `[Ormo Field] Use ${groupName}.Label for the group name. Field.Label targets a single control.`,
        root,
      );
    }

    if (root.hasAttribute("data-required")) {
      console.warn(
        group.localName === "ormo-radio-group"
          ? "[Ormo Field] Put required on RadioGroup.Root for group validation."
          : "[Ormo Field] Put required and requiredMessage on CheckboxGroup.Root for at-least-one validation.",
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

  labels
    .filter((label) => label.htmlFor && label.htmlFor !== control.id)
    .forEach((label) => {
      console.warn(
        `[Ormo Field] Field.Label for="${label.htmlFor}" does not reference the owned control id="${control.id}".`,
        label,
      );
    });
}

function setStateAttribute(
  elements: Element[],
  name: `data-${string}`,
  present: boolean,
): void {
  elements.forEach((element) => {
    if (element.hasAttribute(name) !== present) {
      element.toggleAttribute(name, present);
    }
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
  #boundForm: HTMLFormElement | undefined;
  #validationController: AbortController | undefined;
  #observer: MutationObserver | undefined;
  #debounceTimer: ReturnType<typeof setTimeout> | undefined;
  #control: FieldControlElement | undefined;
  #group: OrmoFieldGroupElement | undefined;
  #initialValue = "";
  #initialized = false;
  #invalidOverride = false;
  #originalAriaInvalid: string | null = null;
  #managedAriaInvalid: string | null | undefined;
  #originalGroupAriaInvalid: string | null = null;
  #managedGroupAriaInvalid: string | null | undefined;
  #authoredDescribedByIds = new Set<string>();
  #managedDescribedByIds = new Set<string>();
  #managedLabels = new Set<HTMLLabelElement>();
  #focused = false;
  #touched = false;
  #validated = false;
  #validating = false;
  #validationFailed = false;
  #validator: FieldValidator | undefined;
  #validatorApplied = false;
  #validatorGeneration = 0;
  #previousState: FieldState | undefined;

  connectedCallback(): void {
    if (!this.#initialized) {
      this.#invalidOverride = this.hasAttribute("data-invalid");
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
    this.#observer.observe(this, {
      attributeFilter: [
        "aria-describedby",
        "aria-invalid",
        "data-disabled",
        "data-match",
        "data-name",
        "data-required",
        "disabled",
        "for",
        "id",
        "name",
        "readonly",
        "required",
      ],
      attributes: true,
      childList: true,
      subtree: true,
    });
    this.#initialized = true;
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#formController?.abort();
    this.#formController = undefined;
    this.#unbindForm();
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#cancelValidation();
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
    if (this.#group) {
      this.#group.disabled = value;
    } else if (this.#control) {
      this.#control.disabled = value;
    }
    this.#applyState();
  }

  get name(): string {
    return this.#group?.name ?? this.#control?.name ?? "";
  }

  set name(value: string) {
    if (this.#group) {
      this.#group.name = value;
    } else if (this.#control) {
      this.#control.name = value;
    }
    this.#applyState();
  }

  get required(): boolean {
    return this.#group?.required ?? this.#control?.required ?? false;
  }

  set required(value: boolean) {
    if (this.#group) {
      this.#group.required = value;
    } else if (this.#control) {
      this.#control.required = value;
    }
    this.#applyState();
  }

  get readOnly(): boolean {
    return this.#control && "readOnly" in this.#control
      ? this.#control.readOnly
      : false;
  }

  set readOnly(value: boolean) {
    if (this.#control && "readOnly" in this.#control) {
      this.#control.readOnly = value;
    }
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
    this.#cancelValidation();
    this.#validator = value;
    const validatorControl =
      this.#control ?? (this.#group && getGroupControl(this.#group));

    if (validatorControl && this.#validatorApplied) {
      validatorControl.setCustomValidity("");
      this.#validatorApplied = false;
    }

    this.#validationFailed = false;

    if (value && this.#validated) {
      void this.#runValidator().then(() => this.#applyState());
    }

    this.#applyState();
  }

  async validate(): Promise<boolean> {
    this.#validated = true;
    this.#clearDebounce();
    const validationSucceeded = await this.#runValidator();

    if (this.#group) {
      const valid = checkGroupValidityWithoutRevalidation(this.#group);
      this.#applyState();
      return validationSucceeded && valid && !this.state.invalid;
    }

    const control = this.#control;

    if (!control) {
      return true;
    }

    const valid = checkValidityWithoutRevalidation(control);
    this.#applyState();
    return validationSucceeded && valid && !this.state.invalid;
  }

  #getParts(): FieldParts {
    const group = Array.from(this.querySelectorAll(fieldGroupSelector))
      .filter((element) => belongsToRoot(element, this))
      .find(isFieldGroup);
    const controls = Array.from(this.querySelectorAll(controlSelector))
      .filter((element) => belongsToRoot(element, this))
      .filter(isFieldControl)
      .filter((control) => !group || !control.closest(fieldGroupSelector));
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

  #setGroup(group: OrmoFieldGroupElement | undefined): void {
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
    this.#validationFailed = false;
    this.#cancelValidation();

    if (!group) {
      this.#initialValue = "";
      this.#originalGroupAriaInvalid = null;
      this.#managedGroupAriaInvalid = undefined;
      return;
    }

    this.#initialValue = getGroupValue(group);
    this.#originalGroupAriaInvalid = group.hasAttribute(
      "data-ormo-field-inherited-invalid",
    )
      ? null
      : group.getAttribute("aria-invalid");
    this.#managedGroupAriaInvalid = undefined;
    this.#authoredDescribedByIds = new Set(
      getRelationshipTokens(group.getAttribute("aria-describedby")),
    );
    this.#focused = group.contains(group.ownerDocument.activeElement);
  }

  #releaseGroup(): void {
    const group = this.#group;

    if (!group) {
      return;
    }

    if (this.#validatorApplied) {
      getGroupControl(group)?.setCustomValidity("");
      this.#validatorApplied = false;
    }

    if (this.#originalGroupAriaInvalid === null) {
      group.removeAttribute("aria-invalid");
    } else {
      group.setAttribute("aria-invalid", this.#originalGroupAriaInvalid);
    }
    this.#managedGroupAriaInvalid = undefined;

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
    this.#validationFailed = false;
    this.#cancelValidation();

    if (!control) {
      this.#initialValue = "";
      this.#originalAriaInvalid = null;
      this.#managedAriaInvalid = undefined;
      return;
    }

    this.#initialValue = getControlValue(control);
    this.#originalAriaInvalid = control.hasAttribute(
      "data-ormo-field-inherited-invalid",
    )
      ? null
      : control.getAttribute("aria-invalid");
    this.#managedAriaInvalid = undefined;
    this.#authoredDescribedByIds = new Set(
      getRelationshipTokens(control.getAttribute("aria-describedby")),
    );
    this.#focused = control === control.ownerDocument.activeElement;
  }

  #releaseControl(): void {
    const control = this.#control;

    if (!control) {
      return;
    }

    if (this.#originalAriaInvalid === null) {
      control.removeAttribute("aria-invalid");
    } else {
      control.setAttribute("aria-invalid", this.#originalAriaInvalid);
    }
    this.#managedAriaInvalid = undefined;

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

    prepareFieldRelationshipIds({
      root: this,
      control,
      group,
      labels,
      descriptions,
      errors,
      managedLabels: this.#managedLabels,
    });

    this.#authoredDescribedByIds = new Set(
      getRelationshipTokens(
        describedTarget.getAttribute("aria-describedby"),
      ).filter((id) => !this.#managedDescribedByIds.has(id)),
    );

    this.#syncDescribedBy(parts);
  }

  #syncDescribedBy(parts: FieldParts): void {
    const { control, group, descriptions, errors } = parts;
    const describedTarget = group ?? control;

    if (!describedTarget) {
      return;
    }

    const visibleErrors = errors.filter((error) => !error.hidden);

    this.#managedDescribedByIds = setDescribedBy(
      describedTarget,
      this.#authoredDescribedByIds,
      [...descriptions, ...visibleErrors],
    );
  }

  #bindForm(): void {
    this.#formController?.abort();
    this.#formController = new AbortController();
    this.#unbindForm();
    const form = this.#control?.form ?? this.#group?.form;

    if (!form) {
      return;
    }

    this.#boundForm = form;
    registerField(form, this, reportValidityWithoutRevalidation);
    form.addEventListener("reset", this.#handleReset, {
      signal: this.#formController.signal,
    });
  }

  #unbindForm(): void {
    if (!this.#boundForm) {
      return;
    }

    unregisterField(this.#boundForm, this);
    this.#boundForm = undefined;
  }

  #clearDebounce(): void {
    if (this.#debounceTimer !== undefined) {
      clearTimeout(this.#debounceTimer);
      this.#debounceTimer = undefined;
    }
  }

  #cancelValidation(): void {
    this.#clearDebounce();
    this.#validationController?.abort();
    this.#validationController = undefined;
    this.#validatorGeneration += 1;
    this.#validating = false;
  }

  async #runValidator(): Promise<boolean> {
    const control = this.#control;
    const group = this.#group;

    if ((!control && !group) || !this.#validator) {
      this.#validating = false;
      return true;
    }

    this.#validationController?.abort();
    const controller = new AbortController();
    this.#validationController = controller;
    const generation = ++this.#validatorGeneration;
    const value = group
      ? getGroupValue(group)
      : getControlValue(control as FieldControlElement);
    // Group fields pass the first member as the control argument when present.
    const validatorControl = control ?? (group && getGroupControl(group));

    if (!validatorControl || !isFieldControl(validatorControl)) {
      this.#validating = false;
      return true;
    }

    if (this.#validatorApplied) {
      validatorControl.setCustomValidity("");
      this.#validatorApplied = false;
    }
    this.#validationFailed = false;

    try {
      const result = this.#validator(
        value,
        validatorControl,
        getValidatorContext(validatorControl, controller.signal),
      );
      const isPromise =
        result !== null &&
        result !== undefined &&
        typeof result === "object" &&
        "then" in result;

      if (isPromise) {
        this.#validating = true;
        this.#applyState();
      }

      const message = isPromise
        ? await Promise.resolve(result)
        : (result as string | null | undefined);

      if (
        controller.signal.aborted ||
        generation !== this.#validatorGeneration ||
        (control && control !== this.#control) ||
        (group && group !== this.#group)
      ) {
        return false;
      }

      validatorControl.setCustomValidity(message ?? "");
      this.#validatorApplied = true;
      return true;
    } catch (error) {
      if (
        controller.signal.aborted ||
        generation !== this.#validatorGeneration
      ) {
        return false;
      }

      this.#validationFailed = true;
      this.dispatchEvent(
        new CustomEvent("ormo:field-validation-error", {
          bubbles: true,
          composed: true,
          detail: { control: validatorControl, error, value },
        }),
      );
      return false;
    } finally {
      if (generation === this.#validatorGeneration) {
        this.#validating = false;
        if (this.#validationController === controller) {
          this.#validationController = undefined;
        }
      }
    }
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
    const disabled = Boolean(group?.disabled ?? control?.disabled);
    const groupInvalid = group !== undefined && this.#validated && !group.valid;
    const invalid =
      this.#invalidOverride ||
      this.#originalAriaInvalid === "true" ||
      this.#originalGroupAriaInvalid === "true" ||
      this.#validationFailed ||
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
        ? getGroupValue(group) !== ""
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
      const ariaInvalid = state.invalid ? "true" : this.#originalAriaInvalid;
      if (control.getAttribute("aria-invalid") !== ariaInvalid) {
        this.#managedAriaInvalid = ariaInvalid;
        if (ariaInvalid === null) {
          control.removeAttribute("aria-invalid");
        } else {
          control.setAttribute("aria-invalid", ariaInvalid);
        }
      }
    }

    if (group) {
      const ariaInvalid = state.invalid
        ? "true"
        : this.#originalGroupAriaInvalid;
      if (group.getAttribute("aria-invalid") !== ariaInvalid) {
        this.#managedGroupAriaInvalid = ariaInvalid;
        if (ariaInvalid === null) {
          group.removeAttribute("aria-invalid");
        } else {
          group.setAttribute("aria-invalid", ariaInvalid);
        }
      }
    }

    const validityControl = control ?? (group && getGroupControl(group));

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
        new CustomEvent("ormo:field-state-change", {
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

    // Group primitives emit one authoritative value-change event after they
    // have reconciled their state. Ignore the native member change that
    // continues bubbling through Field.
    if (event.type === "change") {
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

    if (
      event.target instanceof Element &&
      isFieldControl(event.target) &&
      isInternallyCheckedControl(event.target)
    ) {
      this.#applyState();
      return;
    }

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

      this.#cancelValidation();
      this.#validationFailed = false;

      const validatorControl = control ?? (group && getGroupControl(group));
      if (this.#validatorApplied && validatorControl) {
        validatorControl.setCustomValidity("");
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

  #handleMutations = (records: MutationRecord[]): void => {
    if (
      this.#control &&
      records.some(
        (record) =>
          record.target === this.#control &&
          record.attributeName === "aria-invalid",
      )
    ) {
      const value = this.#control.getAttribute("aria-invalid");
      if (value !== this.#managedAriaInvalid) {
        this.#originalAriaInvalid = value;
      }
      this.#managedAriaInvalid = undefined;
    }

    if (
      this.#group &&
      records.some(
        (record) =>
          record.target === this.#group &&
          record.attributeName === "aria-invalid",
      )
    ) {
      const value = this.#group.getAttribute("aria-invalid");
      if (value !== this.#managedGroupAriaInvalid) {
        this.#originalGroupAriaInvalid = value;
      }
      this.#managedGroupAriaInvalid = undefined;
    }

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
