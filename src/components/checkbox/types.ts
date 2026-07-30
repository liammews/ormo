import type { HTMLAttributes } from "astro/types";
import type {} from "../../events";

type CheckboxInputAttributes = Omit<
  HTMLAttributes<"input">,
  "type" | "checked" | "indeterminate" | "parent" | "value"
>;

export interface CheckboxStandardProps extends CheckboxInputAttributes {
  indeterminate?: false;
  parent?: false;
  checked?: boolean | string;
  value?: string | number;
}

export interface CheckboxIndeterminateProps extends CheckboxInputAttributes {
  indeterminate: true;
  parent?: false;
  value?: string | number;
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
export type CheckboxGroupValueChangeReason =
  "member" | "parent" | "programmatic";

export interface CheckboxGroupValueChangeDetail {
  value: string[];
  reason: CheckboxGroupValueChangeReason;
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
  addEventListener(
    type: "ormo:value-change",
    listener:
      | ((
          this: OrmoCheckboxGroupElement,
          event: CheckboxGroupValueChangeEvent,
        ) => void)
      | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-checkbox-group": OrmoCheckboxGroupElement;
  }
}
