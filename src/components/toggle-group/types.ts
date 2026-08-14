import type { HTMLAttributes } from "astro/types";

export type ToggleGroupType = "single" | "multiple";
export type ToggleGroupOrientation = "horizontal" | "vertical";

export interface ToggleGroupRootProps extends HTMLAttributes<"div"> {
  type: ToggleGroupType;
  value?: string | string[];
  defaultValue?: string | string[];
  disabled?: boolean;
  required?: boolean;
  orientation?: ToggleGroupOrientation;
  loopFocus?: boolean;
  name?: string;
  form?: string;
}

export interface ToggleGroupItemProps extends Omit<
  HTMLAttributes<"button">,
  "value"
> {
  value: string;
  disabled?: boolean;
}

export interface ToggleGroupValueChangeDetail {
  value: string | string[];
  previousValue: string | string[];
  reason: "item" | "programmatic" | "member-removed";
}

export type ToggleGroupValueChangeEvent =
  CustomEvent<ToggleGroupValueChangeDetail>;

export interface OrmoToggleGroupElement extends HTMLElement {
  value: string | string[];
  disabled: boolean;
  required: boolean;
  orientation: ToggleGroupOrientation;
  loopFocus: boolean;
  name: string;
  readonly form: HTMLFormElement | null;
  readonly valid: boolean;
  checkValidity(): boolean;
  reportValidity(): boolean;
  addEventListener(
    type: "ormo:value-change",
    listener:
      | ((
          this: OrmoToggleGroupElement,
          event: ToggleGroupValueChangeEvent,
        ) => void)
      | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "ormo-toggle-group": OrmoToggleGroupElement;
  }
}
