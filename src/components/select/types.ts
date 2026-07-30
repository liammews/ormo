import type { HTMLAttributes } from "astro/types";

export type SelectSide = "top" | "right" | "bottom" | "left";
export type SelectAlign = "start" | "center" | "end";
export type SelectPositioning = "css-anchor" | "floating";
export type SelectChangeReason = "item" | "clear" | "programmatic";
export type SelectOpenChangeReason =
  "trigger" | "escape" | "outside" | "tab" | "selection" | "programmatic";

interface SelectRootBaseProps {
  id?: string;
  name?: string;
  form?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  autocomplete?: string;
}

export type SelectNativeRootProps = SelectRootBaseProps &
  Omit<HTMLAttributes<"select">, "multiple" | "size" | "value"> & {
    native: true;
  };

export type SelectCustomRootProps = SelectRootBaseProps &
  Omit<HTMLAttributes<"div">, "value"> & {
    native?: false;
    positioning?: SelectPositioning;
  };

export type SelectRootProps = SelectNativeRootProps | SelectCustomRootProps;

export type SelectTriggerProps = Omit<
  HTMLAttributes<"button">,
  "disabled" | "role" | "type"
>;

export interface SelectValueProps extends HTMLAttributes<"span"> {
  placeholder?: string;
}

export type SelectIconProps = Omit<HTMLAttributes<"span">, "aria-hidden">;

export type SelectClearProps = Omit<HTMLAttributes<"button">, "type">;

export interface SelectContentProps extends Omit<
  HTMLAttributes<"div">,
  "role" | "popover"
> {
  side?: SelectSide;
  align?: SelectAlign;
  sideOffset?: number;
}

export interface SelectItemProps extends Omit<
  HTMLAttributes<"div">,
  "role" | "value"
> {
  value: string;
  textValue?: string;
  disabled?: boolean;
}

export type SelectGroupProps = Omit<HTMLAttributes<"div">, "role">;
export type SelectGroupLabelProps = HTMLAttributes<"div">;
export type SelectSeparatorProps = Omit<
  HTMLAttributes<"div">,
  "role" | "aria-orientation" | "aria-hidden"
>;

export interface SelectBeforeValueChangeDetail {
  value: string;
  previousValue: string;
  reason: Exclude<SelectChangeReason, "programmatic">;
}

export interface SelectValueChangeDetail {
  value: string;
  previousValue: string;
  reason: SelectChangeReason;
}

export interface SelectOpenChangeDetail {
  open: boolean;
  reason: SelectOpenChangeReason;
}

export type SelectBeforeValueChangeEvent =
  CustomEvent<SelectBeforeValueChangeDetail>;
export type SelectValueChangeEvent = CustomEvent<SelectValueChangeDetail>;
export type SelectOpenChangeEvent = CustomEvent<SelectOpenChangeDetail>;

export interface OrmoSelectElement extends HTMLElement {
  value: string;
  disabled: boolean;
  readonly open: boolean;
  show(): void;
  hide(): void;
  toggle(force?: boolean): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-select": OrmoSelectElement;
  }

  interface GlobalEventHandlersEventMap {
    "ormo:select-before-value-change": SelectBeforeValueChangeEvent;
    "ormo:select-value-change": SelectValueChangeEvent;
    "ormo:select-open-change": SelectOpenChangeEvent;
  }
}
