import type { HTMLAttributes } from "astro/types";

export type NumberFieldStep = number | "any";
export type NumberFieldValueChangeReason =
  | "input"
  | "keyboard"
  | "increment"
  | "decrement"
  | "wheel"
  | "programmatic"
  | "reset";

export interface NumberFieldRootProps extends HTMLAttributes<"div"> {
  value?: number | null;
  defaultValue?: number | null;
  min?: number;
  max?: number;
  step?: NumberFieldStep;
  smallStep?: number;
  largeStep?: number;
  name?: string;
  form?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  allowWheelStep?: boolean;
}

export type NumberFieldGroupProps = HTMLAttributes<"div">;

export interface NumberFieldInputProps extends Omit<
  HTMLAttributes<"input">,
  | "type"
  | "value"
  | "defaultValue"
  | "min"
  | "max"
  | "step"
  | "name"
  | "form"
  | "disabled"
  | "readonly"
  | "required"
> {
  name?: string;
  form?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
}

export type NumberFieldIncrementProps = Omit<HTMLAttributes<"button">, "type">;
export type NumberFieldDecrementProps = NumberFieldIncrementProps;

export interface NumberFieldValueChangeDetail {
  value: number | null;
  previousValue: number | null;
  reason: NumberFieldValueChangeReason;
}

export type NumberFieldValueChangeEvent =
  CustomEvent<NumberFieldValueChangeDetail>;

export interface OrmoNumberFieldElement extends HTMLElement {
  value: number | null;
  disabled: boolean;
  readOnly: boolean;
  min: number | undefined;
  max: number | undefined;
  step: NumberFieldStep;
  increment(multiplier?: number): void;
  decrement(multiplier?: number): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-number-field": OrmoNumberFieldElement;
  }

  interface GlobalEventHandlersEventMap {
    "ormo:number-field-value-change": NumberFieldValueChangeEvent;
  }
}
