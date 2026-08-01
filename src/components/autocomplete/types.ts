import type { HTMLAttributes } from "astro/types";

export type AutocompleteSide = "top" | "right" | "bottom" | "left";
export type AutocompleteAlign = "start" | "center" | "end";
export type AutocompletePositioning = "css-anchor" | "floating";
export type AutocompleteFilter = "contains" | "startsWith" | "none";
export type AutocompleteValueChangeReason =
  "input" | "item" | "clear" | "programmatic";
export type AutocompleteOpenChangeReason =
  "input" | "escape" | "outside" | "tab" | "selection" | "programmatic";

export interface AutocompleteRootProps extends Omit<
  HTMLAttributes<"div">,
  "value"
> {
  id?: string;
  name?: string;
  form?: string;
  defaultValue?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  autocomplete?: string;
  filter?: AutocompleteFilter;
  minLength?: number;
  loading?: boolean;
  positioning?: AutocompletePositioning;
}

export interface AutocompleteInputProps extends Omit<
  HTMLAttributes<"input">,
  "list" | "name" | "role" | "type" | "value"
> {
  placeholder?: string;
}

export type AutocompleteClearProps = Omit<HTMLAttributes<"button">, "type">;

export interface AutocompleteContentProps extends Omit<
  HTMLAttributes<"div">,
  "role" | "popover"
> {
  side?: AutocompleteSide;
  align?: AutocompleteAlign;
  sideOffset?: number;
}

export interface AutocompleteItemProps extends Omit<
  HTMLAttributes<"div">,
  "role" | "value"
> {
  value: string;
  identifier?: string;
  textValue?: string;
  keywords?: string[];
  disabled?: boolean;
}

export type AutocompleteLoadingProps = HTMLAttributes<"div">;
export type AutocompleteEmptyProps = HTMLAttributes<"div">;
export type AutocompleteGroupProps = Omit<HTMLAttributes<"div">, "role">;
export type AutocompleteGroupLabelProps = HTMLAttributes<"div">;
export type AutocompleteSeparatorProps = Omit<
  HTMLAttributes<"div">,
  "role" | "aria-orientation" | "aria-hidden"
>;

export interface AutocompleteBeforeValueChangeDetail {
  value: string;
  previousValue: string;
  reason: Exclude<AutocompleteValueChangeReason, "programmatic">;
  identifier?: string;
}
export interface AutocompleteValueChangeDetail {
  value: string;
  previousValue: string;
  reason: AutocompleteValueChangeReason;
  identifier?: string;
}
export interface AutocompleteSelectDetail {
  value: string;
  identifier?: string;
}
export interface AutocompleteOpenChangeDetail {
  open: boolean;
  reason: AutocompleteOpenChangeReason;
}

export interface OrmoAutocompleteElement extends HTMLElement {
  value: string;
  disabled: boolean;
  readOnly: boolean;
  loading: boolean;
  readonly open: boolean;
  show(): void;
  hide(): void;
  toggle(force?: boolean): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-autocomplete": OrmoAutocompleteElement;
  }
  interface GlobalEventHandlersEventMap {
    "ormo:autocomplete-before-value-change": CustomEvent<AutocompleteBeforeValueChangeDetail>;
    "ormo:autocomplete-value-change": CustomEvent<AutocompleteValueChangeDetail>;
    "ormo:autocomplete-select": CustomEvent<AutocompleteSelectDetail>;
    "ormo:autocomplete-open-change": CustomEvent<AutocompleteOpenChangeDetail>;
  }
}
