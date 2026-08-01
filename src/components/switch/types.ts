import type { HTMLAttributes } from "astro/types";

export interface SwitchRootProps extends Omit<
  HTMLAttributes<"div">,
  "id" | "value"
> {
  id?: string;
  name?: string;
  value?: string | number;
  form?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
}

export type SwitchThumbProps = Omit<HTMLAttributes<"span">, "aria-hidden">;

export type SwitchCheckedChangeReason = "user" | "programmatic" | "reset";

export interface SwitchBeforeCheckedChangeDetail {
  checked: boolean;
  previousChecked: boolean;
  reason: "user";
}

export interface SwitchCheckedChangeDetail {
  checked: boolean;
  previousChecked: boolean;
  reason: SwitchCheckedChangeReason;
}

export interface OrmoSwitchElement extends HTMLElement {
  checked: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  name: string;
  value: string;
  readonly form: HTMLFormElement | null;
  readonly valid: boolean;
  checkValidity(): boolean;
  reportValidity(): boolean;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-switch": OrmoSwitchElement;
  }

  interface GlobalEventHandlersEventMap {
    "ormo:switch-before-checked-change": CustomEvent<SwitchBeforeCheckedChangeDetail>;
    "ormo:switch-checked-change": CustomEvent<SwitchCheckedChangeDetail>;
  }
}
