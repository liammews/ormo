import type { HTMLAttributes } from "astro/types";

export type NavigationMenuOrientation = "horizontal" | "vertical";
export type NavigationMenuSide = "top" | "right" | "bottom" | "left";
export type NavigationMenuAlign = "start" | "center" | "end";
export type NavigationMenuPositioning = "css-anchor" | "floating";
export type NavigationMenuOpenReason =
  | "trigger"
  | "keyboard"
  | "pointer"
  | "focus"
  | "escape"
  | "outside"
  | "programmatic";

export interface NavigationMenuOpenChangeDetail {
  value: string | null;
  open: boolean;
  reason: NavigationMenuOpenReason;
}

export type NavigationMenuOpenChangeEvent =
  CustomEvent<NavigationMenuOpenChangeDetail>;

export interface NavigationMenuRootProps extends HTMLAttributes<"nav"> {
  /** Accessible label for the navigation landmark. */
  "aria-label"?: string;
  defaultValue?: string;
  /** Controls the open item. `null` closes all items. */
  value?: string | null;
  orientation?: NavigationMenuOrientation;
  positioning?: NavigationMenuPositioning;
  openOnHover?: boolean;
  openDelay?: number;
  closeDelay?: number;
}

export type NavigationMenuListProps = HTMLAttributes<"ul">;

export interface NavigationMenuItemProps extends Omit<
  HTMLAttributes<"li">,
  "value"
> {
  value: string;
}

export type NavigationMenuLinkProps = HTMLAttributes<"a">;
export type NavigationMenuTriggerProps = HTMLAttributes<"button">;
export interface NavigationMenuContentProps extends HTMLAttributes<"div"> {
  side?: NavigationMenuSide;
  align?: NavigationMenuAlign;
  sideOffset?: number;
}
export type NavigationMenuIndicatorProps = HTMLAttributes<"div">;

export interface OrmoNavigationMenuElement extends HTMLElement {
  value: string | null;
  open(value: string, reason?: NavigationMenuOpenReason): boolean;
  close(reason?: NavigationMenuOpenReason): boolean;
  addEventListener(
    type: "ormo:open-change",
    listener:
      | ((
          this: OrmoNavigationMenuElement,
          event: NavigationMenuOpenChangeEvent,
        ) => void)
      | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-navigation-menu": OrmoNavigationMenuElement;
  }
}
