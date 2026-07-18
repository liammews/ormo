import type { HTMLAttributes } from "astro/types";

export type AccordionType = "single" | "multiple";
export type AccordionOrientation = "vertical" | "horizontal";
export type AccordionDirection = "ltr" | "rtl";
export type AccordionValue = string | string[] | null;

export interface AccordionRootProps extends Omit<HTMLAttributes<"div">, "dir"> {
  type?: AccordionType;
  collapsible?: boolean;
  defaultValue?: string | string[];
  orientation?: AccordionOrientation;
  dir?: AccordionDirection;
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

export type AccordionContentProps = HTMLAttributes<"div">;

export interface AccordionValueChangeDetail {
  value: AccordionValue;
}

export type AccordionValueChangeEvent = CustomEvent<AccordionValueChangeDetail>;

export interface GoodUIAccordionElement extends HTMLElement {
  value: AccordionValue;
}

declare global {
  interface HTMLElementTagNameMap {
    "goodui-accordion": GoodUIAccordionElement;
  }

  interface GlobalEventHandlersEventMap {
    "goodui:value-change": AccordionValueChangeEvent;
  }
}
