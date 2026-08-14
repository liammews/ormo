import { AsyncLocalStorage } from "node:async_hooks";
import type { NumberFieldStep } from "../components/number-field/types";

export interface NumberFieldSsrContext {
  value: number | null;
  min: number | undefined;
  max: number | undefined;
  step: NumberFieldStep;
  name: string | undefined;
  form: string | undefined;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
}

const storage = new AsyncLocalStorage<NumberFieldSsrContext[]>();

export async function renderWithNumberFieldContext(
  context: NumberFieldSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  return storage.run([...(storage.getStore() ?? []), context], render);
}

export function getNumberFieldSsrContext(): NumberFieldSsrContext | undefined {
  return storage.getStore()?.at(-1);
}
