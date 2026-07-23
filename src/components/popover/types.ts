import type { HTMLAttributes } from "astro/types";
import type { ButtonAsButtonProps } from "../button/types";

export type PopoverCloseReason =
  "close" | "escape" | "outside" | "programmatic";

export type PopoverSide = "top" | "right" | "bottom" | "left";
export type PopoverAlign = "start" | "center" | "end";
export type PopoverPositioning = "css-anchor" | "floating";

export interface PopoverRootProps extends HTMLAttributes<"div"> {
  /** Prevents pointer presses outside Content from closing the popover. */
  disablePointerDismissal?: boolean;
  /**
   * Placement engine. `"floating"` requires
   * `import "@ormo/primitives/popover/floating"`.
   */
  positioning?: PopoverPositioning;
}

export interface PopoverTriggerProps extends HTMLAttributes<"button"> {
  /** ID of a Popover Root when the Trigger is rendered outside it. */
  for?: string;
}

export type PopoverContentProps = Omit<
  HTMLAttributes<"div">,
  "role" | "popover"
> & {
  /** Preferred side of the trigger to place Content. */
  side?: PopoverSide;
  /** Alignment along the side axis. */
  align?: PopoverAlign;
  /** Distance in pixels from the trigger. */
  sideOffset?: number;
  /** CSS selector for an explicit focus-restoration destination. */
  finalFocus?: string;
};

export interface PopoverTitleProps extends HTMLAttributes<"h2"> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export interface PopoverDescriptionProps extends HTMLAttributes<"p"> {
  as?: "p" | "div";
}

export type PopoverCloseProps = Omit<
  ButtonAsButtonProps,
  "as" | "nativeButton"
>;

export interface PopoverOpenChangeDetail {
  open: boolean;
  reason: PopoverCloseReason | "trigger";
  returnValue: string;
}

export type PopoverOpenChangeEvent = CustomEvent<PopoverOpenChangeDetail>;

export interface OrmoPopoverElement extends HTMLElement {
  finalFocus: HTMLElement | null;
  readonly open: boolean;
  show(): void;
  hide(returnValue?: string): void;
  toggle(force?: boolean): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-popover": OrmoPopoverElement;
  }

  interface GlobalEventHandlersEventMap {
    "ormo:popover-open-change": PopoverOpenChangeEvent;
  }
}
