import type { HTMLAttributes } from "astro/types";

export type SliderOrientation = "horizontal" | "vertical";

export interface SliderRootProps extends HTMLAttributes<"div"> {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  orientation?: SliderOrientation;
  name?: string;
  form?: string;
}

export type SliderTrackProps = HTMLAttributes<"div">;
export type SliderRangeProps = HTMLAttributes<"div">;

export interface SliderThumbProps extends Omit<
  HTMLAttributes<"input">,
  "type" | "value" | "defaultValue" | "min" | "max" | "step" | "name" | "form"
> {
  name?: string;
  form?: string;
}

export interface SliderValueChangeDetail {
  value: number[];
  previousValue: number[];
  thumbIndex: number;
  reason: "input" | "programmatic" | "reset";
}

export type SliderValueChangeEvent = CustomEvent<SliderValueChangeDetail>;

export interface OrmoSliderElement extends HTMLElement {
  value: number[];
  disabled: boolean;
  min: number;
  max: number;
  step: number;
  orientation: SliderOrientation;
  addEventListener(
    type: "ormo:value-change",
    listener:
      ((this: OrmoSliderElement, event: SliderValueChangeEvent) => void) | null,
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
    "ormo-slider": OrmoSliderElement;
  }
}
