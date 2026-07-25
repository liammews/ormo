import { AsyncLocalStorage } from "node:async_hooks";

export interface BreadcrumbsRootSsrContext {
  microdata: boolean;
}

export interface BreadcrumbsListSsrContext {
  microdata: boolean;
  nextPosition: number;
}

const rootStorage = new AsyncLocalStorage<BreadcrumbsRootSsrContext[]>();
const listStorage = new AsyncLocalStorage<BreadcrumbsListSsrContext[]>();

export async function renderWithBreadcrumbsRootContext(
  context: BreadcrumbsRootSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = rootStorage.getStore() ?? [];
  return rootStorage.run([...parent, context], render);
}

export function getBreadcrumbsRootSsrContext():
  | BreadcrumbsRootSsrContext
  | undefined {
  return rootStorage.getStore()?.at(-1);
}

export async function renderWithBreadcrumbsListContext(
  context: BreadcrumbsListSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = listStorage.getStore() ?? [];
  return listStorage.run([...parent, context], render);
}

export function getBreadcrumbsListSsrContext():
  | BreadcrumbsListSsrContext
  | undefined {
  return listStorage.getStore()?.at(-1);
}

export function claimBreadcrumbPosition(
  context: BreadcrumbsListSsrContext,
): number {
  context.nextPosition += 1;
  return context.nextPosition;
}
