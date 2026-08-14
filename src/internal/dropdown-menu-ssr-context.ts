import { AsyncLocalStorage } from "node:async_hooks";

export interface DropdownMenuSsrContext {
  rootId: string;
  defaultOpen: boolean;
  groupCount: number;
}

export interface DropdownMenuGroupSsrContext {
  id: string;
  labelId: string;
}

export interface DropdownMenuRadioGroupSsrContext {
  value: string | undefined;
}

const rootStorage = new AsyncLocalStorage<DropdownMenuSsrContext[]>();
const groupStorage = new AsyncLocalStorage<DropdownMenuGroupSsrContext[]>();
const radioGroupStorage = new AsyncLocalStorage<
  DropdownMenuRadioGroupSsrContext[]
>();
let generatedRootId = 0;
let generatedGroupId = 0;

export function createDropdownMenuRootId(): string {
  generatedRootId += 1;
  return `ormo-dropdown-menu-${generatedRootId}`;
}

export function createDropdownMenuGroupId(): string {
  generatedGroupId += 1;
  return `ormo-dropdown-menu-group-${generatedGroupId}`;
}

export async function renderWithDropdownMenuContext(
  context: DropdownMenuSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = rootStorage.getStore() ?? [];
  return rootStorage.run([...parent, context], render);
}

export function getDropdownMenuSsrContext():
  DropdownMenuSsrContext | undefined {
  return rootStorage.getStore()?.at(-1);
}

export async function renderWithDropdownMenuGroupContext(
  context: DropdownMenuGroupSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = groupStorage.getStore() ?? [];
  return groupStorage.run([...parent, context], render);
}

export function getDropdownMenuGroupSsrContext():
  DropdownMenuGroupSsrContext | undefined {
  return groupStorage.getStore()?.at(-1);
}

export async function renderWithDropdownMenuRadioGroupContext(
  context: DropdownMenuRadioGroupSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = radioGroupStorage.getStore() ?? [];
  return radioGroupStorage.run([...parent, context], render);
}

export function getDropdownMenuRadioGroupSsrContext():
  DropdownMenuRadioGroupSsrContext | undefined {
  return radioGroupStorage.getStore()?.at(-1);
}
