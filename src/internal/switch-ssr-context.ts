import { AsyncLocalStorage } from "node:async_hooks";

export interface SwitchSsrContext {
  checked: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
}

const storage = new AsyncLocalStorage<SwitchSsrContext[]>();

export async function renderWithSwitchContext(
  context: SwitchSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  return storage.run([...(storage.getStore() ?? []), context], render);
}

export function getSwitchSsrContext(): SwitchSsrContext | undefined {
  return storage.getStore()?.at(-1);
}
