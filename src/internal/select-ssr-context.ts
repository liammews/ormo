import { AsyncLocalStorage } from "node:async_hooks";
import { decodeHTML } from "entities";

export interface SelectSsrItem {
  value: string;
  textValue: string;
  disabled: boolean;
  groupId: string | undefined;
  groupLabel: string | undefined;
}

export interface SelectSsrContext {
  native: boolean;
  rootId: string;
  defaultValue: string;
  items: SelectSsrItem[];
  placeholder?: string;
  groupCount: number;
}

export interface SelectGroupSsrContext {
  id: string;
  labelId: string;
  label: string | undefined;
}

const selectStorage = new AsyncLocalStorage<SelectSsrContext[]>();
const groupStorage = new AsyncLocalStorage<SelectGroupSsrContext[]>();
let generatedRootId = 0;

export function createSelectRootId(): string {
  generatedRootId += 1;
  return `ormo-select-${generatedRootId}`;
}

export async function renderWithSelectContext(
  context: SelectSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = selectStorage.getStore() ?? [];
  return selectStorage.run([...parent, context], render);
}

export function getSelectSsrContext(): SelectSsrContext | undefined {
  return selectStorage.getStore()?.at(-1);
}

export async function renderWithSelectGroupContext(
  context: SelectGroupSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = groupStorage.getStore() ?? [];
  return groupStorage.run([...parent, context], render);
}

export function getSelectGroupSsrContext(): SelectGroupSsrContext | undefined {
  return groupStorage.getStore()?.at(-1);
}

export function htmlToText(html: string): string {
  return decodeHTML(html.replace(/<[^>]*>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/gu, " ")
    .trim();
}
