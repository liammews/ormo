import type { HTMLAttributes } from "astro/types";
import type { InputProps } from "../input/types";

export interface FieldRootProps extends HTMLAttributes<"div"> {
  invalid?: boolean;
  validationMode?: FieldValidationMode;
  /** Debounce in milliseconds for `validationMode="onChange"`. */
  validationDebounceTime?: number;
}

export type FieldLabelProps = HTMLAttributes<"label">;

export type FieldDescriptionProps = HTMLAttributes<"div">;

export type FieldControlProps = InputProps;

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

export interface FieldValidatorContext {
  formData: FormData | null;
  signal: AbortSignal;
}

export type FieldValidator = (
  value: string,
  control: FieldControlElement,
  context: FieldValidatorContext,
) => FieldValidationResult | Promise<FieldValidationResult>;

export interface FieldStateChangeDetail {
  state: FieldState;
}

export type FieldStateChangeEvent = CustomEvent<FieldStateChangeDetail>;

export interface FieldValidationErrorDetail {
  control: FieldControlElement;
  error: unknown;
  value: string;
}

export type FieldValidationErrorEvent = CustomEvent<FieldValidationErrorDetail>;

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
    "ormo:field-state-change": FieldStateChangeEvent;
    "ormo:field-validation-error": FieldValidationErrorEvent;
  }
}
