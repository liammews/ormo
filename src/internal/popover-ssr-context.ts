import { AsyncLocalStorage } from "node:async_hooks";

export interface PopoverSsrContext {
  disablePointerDismissal: boolean;
}

const popoverStorage = new AsyncLocalStorage<PopoverSsrContext[]>();

export async function renderWithPopoverContext(
  context: PopoverSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = popoverStorage.getStore() ?? [];
  return popoverStorage.run([...parent, context], render);
}

export function getPopoverSsrContext(): PopoverSsrContext | undefined {
  return popoverStorage.getStore()?.at(-1);
}
