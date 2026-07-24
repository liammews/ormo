import type { HTMLAttributes } from "astro/types";

export interface FieldRootProps extends HTMLAttributes<"div"> {
  invalid?: boolean;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  readOnly?: boolean;
  validationMode?: FieldValidationMode;
  /** Debounce in milliseconds for `validationMode="onChange"`. */
  validationDebounceTime?: number;
}

export type FieldLabelProps = HTMLAttributes<"label">;

export type FieldDescriptionProps = HTMLAttributes<"div">;

export type FieldControlProps = HTMLAttributes<"input">;

export interface FieldErrorProps extends HTMLAttributes<"div"> {
  match?: FieldValidityMatch;
}

export type FieldValidationMode = "onSubmit" | "onBlur" | "onChange";

export type FieldValidityMatch =
  | boolean
  | "badInput"
  | "customError"
  | "patternMismatch"
  | "rangeOverflow"
  | "rangeUnderflow"
  | "stepMismatch"
  | "tooLong"
  | "tooShort"
  | "typeMismatch"
  | "valid"
  | "valueMissing";

export type FieldControlElement =
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export interface FieldState {
  disabled: boolean;
  dirty: boolean;
  filled: boolean;
  focused: boolean;
  invalid: boolean;
  touched: boolean;
  valid: boolean;
  validating: boolean;
}

export type FieldValidationResult = string | null | undefined;

export type FieldValidator = (
  value: string,
  control: FieldControlElement,
) => FieldValidationResult | Promise<FieldValidationResult>;

export interface FieldStateChangeDetail {
  state: FieldState;
}

export type FieldStateChangeEvent = CustomEvent<FieldStateChangeDetail>;

export interface OrmoFieldElement extends HTMLElement {
  invalid: boolean;
  disabled: boolean;
  name: string;
  required: boolean;
  readOnly: boolean;
  readonly state: FieldState;
  validationMode: FieldValidationMode;
  validationDebounceTime: number;
  validator: FieldValidator | undefined;
  validate(): Promise<boolean>;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-field": OrmoFieldElement;
  }

  interface GlobalEventHandlersEventMap {
    "ormo:state-change": FieldStateChangeEvent;
  }
}
