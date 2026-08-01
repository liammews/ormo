import { AsyncLocalStorage } from "node:async_hooks";
import { decodeHTML } from "entities";

export interface ComboboxSsrItem {
  value: string;
  textValue: string;
  keywords: string[];
  disabled: boolean;
  groupId: string | undefined;
  groupLabel: string | undefined;
}

export interface ComboboxSsrContext {
  rootId: string;
  defaultValue: string;
  items: ComboboxSsrItem[];
  groupCount: number;
  placeholder?: string;
  autocomplete?: string;
}

export interface ComboboxGroupSsrContext {
  id: string;
  labelId: string;
  label: string | undefined;
}

const comboboxStorage = new AsyncLocalStorage<ComboboxSsrContext[]>();
const groupStorage = new AsyncLocalStorage<ComboboxGroupSsrContext[]>();
let generatedRootId = 0;

export function createComboboxRootId(): string {
  generatedRootId += 1;
  return `ormo-combobox-${generatedRootId}`;
}

export async function renderWithComboboxContext(
  context: ComboboxSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  return comboboxStorage.run(
    [...(comboboxStorage.getStore() ?? []), context],
    render,
  );
}

export function getComboboxSsrContext(): ComboboxSsrContext | undefined {
  return comboboxStorage.getStore()?.at(-1);
}

export async function renderWithComboboxGroupContext(
  context: ComboboxGroupSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  return groupStorage.run(
    [...(groupStorage.getStore() ?? []), context],
    render,
  );
}

export function getComboboxGroupSsrContext():
  ComboboxGroupSsrContext | undefined {
  return groupStorage.getStore()?.at(-1);
}

export function comboboxHtmlToText(html: string): string {
  return decodeHTML(html.replace(/<[^>]*>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function comboboxItemHtmlToText(html: string): string {
  return comboboxHtmlToText(
    html.replace(
      /<span\b[^>]*data-ormo-combobox-item-indicator[^>]*>[\s\S]*?<\/span>/gi,
      " ",
    ),
  );
}
