import { AsyncLocalStorage } from "node:async_hooks";
import type {
  ToggleGroupOrientation,
  ToggleGroupType,
} from "../components/toggle-group/types";

export interface ToggleGroupSsrContext {
  type: ToggleGroupType;
  values: Set<string>;
  disabled: boolean;
  orientation: ToggleGroupOrientation;
  tabStopFound: boolean;
  items: Array<{ value: string; disabled: boolean }>;
}

const storage = new AsyncLocalStorage<ToggleGroupSsrContext[]>();

export async function renderWithToggleGroupContext(
  context: ToggleGroupSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const stack = [...(storage.getStore() ?? []), context];
  return storage.run(stack, render);
}

export function getToggleGroupSsrContext(): ToggleGroupSsrContext | undefined {
  return storage.getStore()?.at(-1);
}
