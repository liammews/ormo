import type { HTMLAttributes } from "astro/types";

export interface ToggleProps extends Omit<HTMLAttributes<"button">, "value"> {
  pressed?: boolean;
  defaultPressed?: boolean;
  value?: string | number;
  disabled?: boolean;
}

export interface TogglePressedChangeDetail {
  pressed: boolean;
  previousPressed: boolean;
}

export type TogglePressedChangeEvent = CustomEvent<TogglePressedChangeDetail>;

declare global {
  interface GlobalEventHandlersEventMap {
    "ormo:pressed-change": TogglePressedChangeEvent;
  }
}
