import { AsyncLocalStorage } from "node:async_hooks";
import { decodeHTML } from "entities";

export interface AutocompleteSsrContext {
  rootId: string;
  defaultValue: string;
  name?: string | undefined;
  form?: string | undefined;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  autocomplete?: string | undefined;
  groupCount: number;
}

export interface AutocompleteGroupSsrContext {
  id: string;
  labelId: string;
}

const rootStorage = new AsyncLocalStorage<AutocompleteSsrContext[]>();
const groupStorage = new AsyncLocalStorage<AutocompleteGroupSsrContext[]>();
let generatedRootId = 0;

export function createAutocompleteRootId(): string {
  generatedRootId += 1;
  return `ormo-autocomplete-${generatedRootId}`;
}

export async function renderWithAutocompleteContext(
  context: AutocompleteSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  return rootStorage.run([...(rootStorage.getStore() ?? []), context], render);
}

export function getAutocompleteSsrContext():
  AutocompleteSsrContext | undefined {
  return rootStorage.getStore()?.at(-1);
}

export async function renderWithAutocompleteGroupContext(
  context: AutocompleteGroupSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  return groupStorage.run(
    [...(groupStorage.getStore() ?? []), context],
    render,
  );
}

export function getAutocompleteGroupSsrContext():
  AutocompleteGroupSsrContext | undefined {
  return groupStorage.getStore()?.at(-1);
}

export function autocompleteHtmlToText(html: string): string {
  return decodeHTML(html.replace(/<[^>]*>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/gu, " ")
    .trim();
}
