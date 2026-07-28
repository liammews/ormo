import type { HTMLAttributes } from "astro/types";

type RadioInputAttributes = Omit<
  HTMLAttributes<"input">,
  "type" | "checked" | "value"
>;

export interface RadioProps extends RadioInputAttributes {
  checked?: boolean | string;
  value?: string | number;
}

export type RadioIndicatorProps = Omit<HTMLAttributes<"span">, "aria-hidden">;

export type RadioGroupRootProps = Omit<
  HTMLAttributes<"div">,
  "role" | "defaultValue"
> & {
  name?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
};

export type RadioGroupLabelProps = HTMLAttributes<"span">;

export type RadioGroupValueChangeReason = "member" | "programmatic";

export interface RadioGroupValueChangeDetail {
  value: string | null;
  reason: RadioGroupValueChangeReason;
}

export type RadioGroupValueChangeEvent =
  CustomEvent<RadioGroupValueChangeDetail>;

export interface OrmoRadioGroupElement extends HTMLElement {
  readonly form: HTMLFormElement | null;
  name: string;
  value: string | null;
  disabled: boolean;
  required: boolean;
  readonly valid: boolean;
  checkValidity(): boolean;
  reportValidity(): boolean;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-radio-group": OrmoRadioGroupElement;
  }
}
