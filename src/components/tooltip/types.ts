import type { HTMLAttributes } from "astro/types";

export type TooltipCloseReason =
  "escape" | "focus" | "pointer" | "programmatic" | "trigger";

export type TooltipSide = "top" | "right" | "bottom" | "left";
export type TooltipAlign = "start" | "center" | "end";
export type TooltipPositioning = "css-anchor" | "floating";

export interface TooltipRootProps extends HTMLAttributes<"div"> {
  /** Milliseconds to wait before opening on pointer interest. Focus opens immediately. */
  delay?: number;
  /** Milliseconds to wait before closing after pointer leaves trigger and content. */
  closeDelay?: number;
  /** Prevents the tooltip from opening. */
  disabled?: boolean;
  /**
   * Placement engine. `"floating"` requires
   * `import "@ormo/primitives/tooltip/floating"`.
   */
  positioning?: TooltipPositioning;
}

export interface TooltipTriggerProps extends HTMLAttributes<"button"> {
  /** ID of a Tooltip Root when the Trigger is rendered outside it. */
  for?: string;
}

export type TooltipContentProps = Omit<
  HTMLAttributes<"div">,
  "role" | "popover"
> & {
  /** Preferred side of the trigger to place Content. */
  side?: TooltipSide;
  /** Alignment along the side axis. */
  align?: TooltipAlign;
  /** Distance in pixels from the trigger. */
  sideOffset?: number;
};

export interface TooltipOpenChangeDetail {
  open: boolean;
  reason: TooltipCloseReason;
}

export type TooltipOpenChangeEvent = CustomEvent<TooltipOpenChangeDetail>;

export interface OrmoTooltipElement extends HTMLElement {
  closeDelay: number;
  delay: number;
  disabled: boolean;
  readonly open: boolean;
  show(): void;
  hide(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-tooltip": OrmoTooltipElement;
  }

  interface GlobalEventHandlersEventMap {
    "ormo:tooltip-open-change": TooltipOpenChangeEvent;
  }
}
