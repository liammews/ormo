import type { HTMLAttributes } from "astro/types";

export interface FieldRootProps extends HTMLAttributes<"div"> {
  invalid?: boolean;
  disabled?: boolean;
  validationMode?: FieldValidationMode;
}

export type FieldLabelProps = HTMLAttributes<"label">;

export type FieldDescriptionProps = HTMLAttributes<"div">;

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
}

export type FieldValidationResult = string | null | undefined;

export type FieldValidator = (
  value: string,
  control: FieldControlElement,
) => FieldValidationResult;

export interface FieldStateChangeDetail {
  state: FieldState;
}

export type FieldStateChangeEvent = CustomEvent<FieldStateChangeDetail>;

export interface OrmoFieldElement extends HTMLElement {
  invalid: boolean;
  disabled: boolean;
  readonly state: FieldState;
  validationMode: FieldValidationMode;
  validator: FieldValidator | undefined;
  validate(): boolean;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-field": OrmoFieldElement;
  }

  interface GlobalEventHandlersEventMap {
    "ormo:state-change": FieldStateChangeEvent;
  }
}
