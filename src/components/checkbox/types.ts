import type { HTMLAttributes } from "astro/types";

type CheckboxInputAttributes = Omit<
  HTMLAttributes<"input">,
  "type" | "checked" | "indeterminate" | "parent"
>;

export interface CheckboxStandardProps extends CheckboxInputAttributes {
  indeterminate?: false;
  parent?: false;
  checked?: boolean | string;
}

export interface CheckboxIndeterminateProps extends CheckboxInputAttributes {
  indeterminate: true;
  parent?: false;
  /** Indeterminate checkboxes must not also be marked checked. */
  checked?: never;
}

export interface CheckboxParentProps extends Omit<
  CheckboxInputAttributes,
  "name" | "value"
> {
  parent: true;
  indeterminate?: boolean;
  name?: never;
  value?: never;
  /** Parent checked state is derived from group members. */
  checked?: never;
}

export type CheckboxProps =
  CheckboxStandardProps | CheckboxIndeterminateProps | CheckboxParentProps;

export type CheckboxIndicatorProps = Omit<
  HTMLAttributes<"span">,
  "aria-hidden"
>;

type CheckboxGroupBaseProps = Omit<
  HTMLAttributes<"div">,
  "role" | "defaultValue"
> & {
  name?: string;
  defaultValue?: string[];
  disabled?: boolean;
};

export type CheckboxGroupRootProps =
  | (CheckboxGroupBaseProps & {
      required?: false;
      requiredMessage?: never;
    })
  | (CheckboxGroupBaseProps & {
      required: true;
      requiredMessage: string;
    });

export type CheckboxGroupLabelProps = HTMLAttributes<"span">;

export type CheckboxGroupDataState = "none" | "partial" | "all";

export interface CheckboxGroupValueChangeDetail {
  value: string[];
}

export type CheckboxGroupValueChangeEvent =
  CustomEvent<CheckboxGroupValueChangeDetail>;

export interface OrmoCheckboxGroupElement extends HTMLElement {
  readonly form: HTMLFormElement | null;
  name: string;
  value: string[];
  disabled: boolean;
  required: boolean;
  requiredMessage: string;
  readonly valid: boolean;
  checkValidity(): boolean;
  reportValidity(): boolean;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-checkbox-group": OrmoCheckboxGroupElement;
  }
}
