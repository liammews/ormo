import type { HTMLAttributes } from "astro/types";

export type PreviewCardSide = "top" | "right" | "bottom" | "left";
export type PreviewCardAlign = "start" | "center" | "end";
export type PreviewCardPositioning = "css-anchor" | "floating";
export type PreviewCardOpenChangeReason =
  "focus" | "pointer" | "escape" | "trigger" | "programmatic";

export interface PreviewCardRootProps extends HTMLAttributes<"div"> {
  defaultOpen?: boolean;
  delay?: number;
  closeDelay?: number;
  disabled?: boolean;
  positioning?: PreviewCardPositioning;
}

export type PreviewCardTriggerProps = Omit<HTMLAttributes<"a">, "href"> & {
  href: string;
};

export interface PreviewCardContentProps extends Omit<
  HTMLAttributes<"div">,
  "aria-hidden" | "popover" | "role" | "tabindex"
> {
  side?: PreviewCardSide;
  align?: PreviewCardAlign;
  sideOffset?: number;
}

export interface PreviewCardOpenChangeDetail {
  open: boolean;
  reason: PreviewCardOpenChangeReason;
}

export type PreviewCardOpenChangeEvent =
  CustomEvent<PreviewCardOpenChangeDetail>;

export interface OrmoPreviewCardElement extends HTMLElement {
  delay: number;
  closeDelay: number;
  disabled: boolean;
  readonly open: boolean;
  show(): void;
  hide(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-preview-card": OrmoPreviewCardElement;
  }
  interface GlobalEventHandlersEventMap {
    "ormo:preview-card-open-change": PreviewCardOpenChangeEvent;
  }
}
