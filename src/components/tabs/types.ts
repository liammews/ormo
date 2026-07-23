import type { HTMLAttributes } from "astro/types";

export type TabsOrientation = "horizontal" | "vertical";

export interface TabsRootProps extends HTMLAttributes<"div"> {
  defaultValue?: string;
  orientation?: TabsOrientation;
  /**
   * When `true`, focusing a tab with the arrow keys also selects it.
   * When `false` (the default), Enter or Space activates the focused tab.
   */
  activateOnFocus?: boolean;
  /**
   * When `true` (the default), arrow keys wrap from the last tab to the first
   * and from the first tab to the last.
   */
  loopFocus?: boolean;
  disabled?: boolean;
}

export type TabsListProps = HTMLAttributes<"div">;

export interface TabsTabProps extends Omit<HTMLAttributes<"button">, "value"> {
  value: string;
  disabled?: boolean;
}

export interface TabsPanelProps extends Omit<HTMLAttributes<"div">, "value"> {
  value: string;
}

export interface TabsValueChangeDetail {
  value: string;
}

export type TabsValueChangeEvent = CustomEvent<TabsValueChangeDetail>;

export interface OrmoTabsElement extends HTMLElement {
  value: string;
  orientation: TabsOrientation;
  activateOnFocus: boolean;
  loopFocus: boolean;
  disabled: boolean;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-tabs": OrmoTabsElement;
  }
}
