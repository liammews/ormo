import { AsyncLocalStorage } from "node:async_hooks";

interface NavigationMenuContext {
  openValue: string | undefined;
}

interface NavigationMenuItemContext {
  value: string;
  open: boolean;
}

const rootStorage = new AsyncLocalStorage<NavigationMenuContext[]>();
const itemStorage = new AsyncLocalStorage<NavigationMenuItemContext[]>();

export function renderWithNavigationMenuContext<T>(
  context: NavigationMenuContext,
  render: () => T,
): T {
  const parents = rootStorage.getStore() ?? [];
  return rootStorage.run([...parents, context], render);
}

export function getNavigationMenuContext(): NavigationMenuContext | undefined {
  return rootStorage.getStore()?.at(-1);
}

export function renderWithNavigationMenuItemContext<T>(
  context: NavigationMenuItemContext,
  render: () => T,
): T {
  const parents = itemStorage.getStore() ?? [];
  return itemStorage.run([...parents, context], render);
}

export function getNavigationMenuItemContext():
  NavigationMenuItemContext | undefined {
  return itemStorage.getStore()?.at(-1);
}
