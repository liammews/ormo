import type { HTMLAttributes } from "astro/types";

export type DropdownMenuSide = "top" | "right" | "bottom" | "left";
export type DropdownMenuAlign = "start" | "center" | "end";
export type DropdownMenuPositioning = "css-anchor" | "floating";
export type DropdownMenuOpenChangeReason =
  "trigger" | "escape" | "outside" | "tab" | "selection" | "programmatic";

export interface DropdownMenuRootProps extends HTMLAttributes<"div"> {
  defaultOpen?: boolean;
  positioning?: DropdownMenuPositioning;
}

export type DropdownMenuTriggerProps = Omit<
  HTMLAttributes<"button">,
  "aria-controls" | "aria-expanded" | "aria-haspopup"
>;

export interface DropdownMenuContentProps extends Omit<
  HTMLAttributes<"div">,
  "popover" | "role"
> {
  side?: DropdownMenuSide;
  align?: DropdownMenuAlign;
  sideOffset?: number;
}

export interface DropdownMenuItemProps extends Omit<
  HTMLAttributes<"div">,
  "role" | "tabindex"
> {
  disabled?: boolean;
  textValue?: string;
}

export interface DropdownMenuCheckboxItemProps extends Omit<
  DropdownMenuItemProps,
  "role"
> {
  checked?: boolean;
}

export interface DropdownMenuRadioGroupProps extends Omit<
  HTMLAttributes<"div">,
  "role"
> {
  value?: string;
}

export interface DropdownMenuRadioItemProps extends Omit<
  DropdownMenuItemProps,
  "role"
> {
  value: string;
}

export type DropdownMenuItemIndicatorProps = HTMLAttributes<"span">;
export type DropdownMenuSubProps = DropdownMenuRootProps;
export type DropdownMenuSubTriggerProps = DropdownMenuItemProps;
export type DropdownMenuSubContentProps = DropdownMenuContentProps;

export interface DropdownMenuLinkItemProps extends Omit<
  HTMLAttributes<"a">,
  "role" | "tabindex"
> {
  disabled?: boolean;
  textValue?: string;
}

export type DropdownMenuGroupProps = Omit<HTMLAttributes<"div">, "role">;
export type DropdownMenuGroupLabelProps = HTMLAttributes<"div">;
export type DropdownMenuSeparatorProps = Omit<
  HTMLAttributes<"div">,
  "aria-orientation" | "role"
>;

export interface DropdownMenuBeforeSelectDetail {
  item: HTMLElement;
}

export interface DropdownMenuCheckedChangeDetail {
  checked: boolean;
  item: HTMLElement;
}

export interface DropdownMenuValueChangeDetail {
  value: string;
  item: HTMLElement;
}

export interface DropdownMenuOpenChangeDetail {
  open: boolean;
  reason: DropdownMenuOpenChangeReason;
}

export type DropdownMenuBeforeSelectEvent =
  CustomEvent<DropdownMenuBeforeSelectDetail>;
export type DropdownMenuOpenChangeEvent =
  CustomEvent<DropdownMenuOpenChangeDetail>;
export type DropdownMenuCheckedChangeEvent =
  CustomEvent<DropdownMenuCheckedChangeDetail>;
export type DropdownMenuValueChangeEvent =
  CustomEvent<DropdownMenuValueChangeDetail>;

export interface OrmoDropdownMenuElement extends HTMLElement {
  readonly open: boolean;
  show(): void;
  hide(): void;
  toggle(force?: boolean): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-dropdown-menu": OrmoDropdownMenuElement;
  }

  interface GlobalEventHandlersEventMap {
    "ormo:dropdown-menu-before-select": DropdownMenuBeforeSelectEvent;
    "ormo:dropdown-menu-open-change": DropdownMenuOpenChangeEvent;
    "ormo:dropdown-menu-checked-change": DropdownMenuCheckedChangeEvent;
    "ormo:dropdown-menu-value-change": DropdownMenuValueChangeEvent;
  }
}
