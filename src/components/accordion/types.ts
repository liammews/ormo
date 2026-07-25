import type { HTMLAttributes } from "astro/types";

export type AccordionType = "single" | "multiple";
export type AccordionOrientation = "vertical" | "horizontal";
export type AccordionValue = string | string[] | null;

export interface AccordionRootProps extends HTMLAttributes<"div"> {
  type?: AccordionType;
  /**
   * When `true` (the default), the open panel in a single accordion can be
   * closed without opening another. Set to `false` to require one open panel.
   */
  collapsible?: boolean;
  defaultValue?: string | string[];
  disabled?: boolean;
  /**
   * Keeps closed content discoverable with the browser’s Find in page feature.
   * @default true
   */
  hiddenUntilFound?: boolean;
  /**
   * Exposes styling metadata only. Accordion triggers remain in the normal tab
   * sequence regardless of orientation.
   * @deprecated
   */
  orientation?: AccordionOrientation;
}

export interface AccordionItemProps extends Omit<
  HTMLAttributes<"div">,
  "value"
> {
  value: string;
  disabled?: boolean;
}

export interface AccordionHeaderProps extends HTMLAttributes<"h3"> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export type AccordionTriggerProps = HTMLAttributes<"button">;

export interface AccordionContentProps extends HTMLAttributes<"div"> {
  /** Overrides the Root setting for this panel. */
  hiddenUntilFound?: boolean;
}

export interface AccordionValueChangeDetail {
  value: AccordionValue;
}

export type AccordionValueChangeEvent = CustomEvent<AccordionValueChangeDetail>;

export interface AccordionOpenChangeDetail {
  open: boolean;
  value: string;
}

export type AccordionOpenChangeEvent = CustomEvent<AccordionOpenChangeDetail>;

/** Shared by Accordion and Tabs selection changes. */
export type OrmoValueChangeEvent = CustomEvent<{
  value: string | string[] | null;
}>;

export interface OrmoAccordionElement extends HTMLElement {
  type: AccordionType;
  value: AccordionValue;
  collapsible: boolean;
  disabled: boolean;
  hiddenUntilFound: boolean;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-accordion": OrmoAccordionElement;
  }

  interface GlobalEventHandlersEventMap {
    "ormo:value-change": OrmoValueChangeEvent;
    "ormo:open-change": AccordionOpenChangeEvent;
  }
}
