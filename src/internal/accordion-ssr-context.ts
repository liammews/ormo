import { AsyncLocalStorage } from "node:async_hooks";

import type { AccordionType } from "../components/accordion/types";

export interface AccordionSsrContext {
  type: AccordionType;
  collapsible: boolean;
  openValues: ReadonlySet<string>;
  hiddenUntilFound: boolean;
}

export interface AccordionItemSsrContext {
  open: boolean;
}

const accordionStorage = new AsyncLocalStorage<AccordionSsrContext[]>();
const itemStorage = new AsyncLocalStorage<AccordionItemSsrContext[]>();

export function normalizeDefaultOpenValues(
  type: AccordionType,
  defaultValue: string | string[] | undefined,
): ReadonlySet<string> {
  if (defaultValue === undefined) {
    return new Set();
  }

  if (type === "multiple") {
    const values = Array.isArray(defaultValue) ? defaultValue : [defaultValue];
    return new Set(
      values.filter((value): value is string => typeof value === "string"),
    );
  }

  if (Array.isArray(defaultValue)) {
    const first = defaultValue.find(
      (value): value is string => typeof value === "string",
    );
    return first === undefined ? new Set() : new Set([first]);
  }

  return typeof defaultValue === "string" ? new Set([defaultValue]) : new Set();
}

export async function renderWithAccordionContext(
  context: AccordionSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = accordionStorage.getStore() ?? [];
  return accordionStorage.run([...parent, context], render);
}

export function getAccordionSsrContext(): AccordionSsrContext | undefined {
  return accordionStorage.getStore()?.at(-1);
}

export async function renderWithAccordionItemContext(
  context: AccordionItemSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = itemStorage.getStore() ?? [];
  return itemStorage.run([...parent, context], render);
}

export function getAccordionItemSsrContext():
  AccordionItemSsrContext | undefined {
  return itemStorage.getStore()?.at(-1);
}
