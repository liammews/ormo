import { AsyncLocalStorage } from "node:async_hooks";
import type { SliderOrientation } from "../components/slider/types";

export interface SliderSsrContext {
  values: number[];
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  orientation: SliderOrientation;
  name: string | undefined;
  form: string | undefined;
  thumbIndex: number;
}

const storage = new AsyncLocalStorage<SliderSsrContext[]>();

export async function renderWithSliderContext(
  context: SliderSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const stack = [...(storage.getStore() ?? []), context];
  return storage.run(stack, render);
}

export function getSliderSsrContext(): SliderSsrContext | undefined {
  return storage.getStore()?.at(-1);
}
