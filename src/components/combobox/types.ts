import type { HTMLAttributes } from "astro/types";

export type ComboboxSide = "top" | "right" | "bottom" | "left";
export type ComboboxAlign = "start" | "center" | "end";
export type ComboboxPositioning = "css-anchor" | "floating";
export type ComboboxFilter = "contains" | "startsWith" | "none";
export type ComboboxChangeReason = "item" | "clear" | "programmatic";
export type ComboboxInputChangeReason =
  "input" | "selection" | "clear" | "programmatic";
export type ComboboxOpenChangeReason =
  | "input"
  | "toggle"
  | "escape"
  | "outside"
  | "tab"
  | "selection"
  | "programmatic";

export interface ComboboxRootProps extends Omit<
  HTMLAttributes<"div">,
  "value"
> {
  id?: string;
  name?: string;
  form?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  autocomplete?: string;
  filter?: ComboboxFilter;
  positioning?: ComboboxPositioning;
}

export interface ComboboxInputProps extends Omit<
  HTMLAttributes<"input">,
  "list" | "role" | "type" | "value"
> {
  placeholder?: string;
}

export type ComboboxToggleProps = Omit<HTMLAttributes<"button">, "type">;
export type ComboboxIconProps = Omit<HTMLAttributes<"span">, "aria-hidden">;
export type ComboboxClearProps = Omit<HTMLAttributes<"button">, "type">;

export interface ComboboxContentProps extends Omit<
  HTMLAttributes<"div">,
  "role" | "popover"
> {
  side?: ComboboxSide;
  align?: ComboboxAlign;
  sideOffset?: number;
}

export interface ComboboxItemProps extends Omit<
  HTMLAttributes<"div">,
  "role" | "value"
> {
  value: string;
  textValue?: string;
  keywords?: string[];
  disabled?: boolean;
}

export type ComboboxItemIndicatorProps = Omit<
  HTMLAttributes<"span">,
  "aria-hidden"
>;
export type ComboboxEmptyProps = HTMLAttributes<"div">;
export type ComboboxGroupProps = Omit<HTMLAttributes<"div">, "role">;
export type ComboboxGroupLabelProps = HTMLAttributes<"div">;
export type ComboboxSeparatorProps = Omit<
  HTMLAttributes<"div">,
  "role" | "aria-orientation" | "aria-hidden"
>;

export interface ComboboxBeforeValueChangeDetail {
  value: string;
  previousValue: string;
  reason: Exclude<ComboboxChangeReason, "programmatic">;
}
export interface ComboboxValueChangeDetail {
  value: string;
  previousValue: string;
  reason: ComboboxChangeReason;
}
export interface ComboboxInputValueChangeDetail {
  inputValue: string;
  previousInputValue: string;
  reason: ComboboxInputChangeReason;
}
export interface ComboboxOpenChangeDetail {
  open: boolean;
  reason: ComboboxOpenChangeReason;
}

export type ComboboxBeforeValueChangeEvent =
  CustomEvent<ComboboxBeforeValueChangeDetail>;
export type ComboboxValueChangeEvent = CustomEvent<ComboboxValueChangeDetail>;
export type ComboboxInputValueChangeEvent =
  CustomEvent<ComboboxInputValueChangeDetail>;
export type ComboboxOpenChangeEvent = CustomEvent<ComboboxOpenChangeDetail>;

export interface OrmoComboboxElement extends HTMLElement {
  value: string;
  inputValue: string;
  disabled: boolean;
  readonly open: boolean;
  show(): void;
  hide(): void;
  toggle(force?: boolean): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-combobox": OrmoComboboxElement;
  }
  interface GlobalEventHandlersEventMap {
    "ormo:combobox-before-value-change": ComboboxBeforeValueChangeEvent;
    "ormo:combobox-value-change": ComboboxValueChangeEvent;
    "ormo:combobox-input-value-change": ComboboxInputValueChangeEvent;
    "ormo:combobox-open-change": ComboboxOpenChangeEvent;
  }
}
