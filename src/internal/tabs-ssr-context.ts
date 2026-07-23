import { AsyncLocalStorage } from "node:async_hooks";

import type { TabsOrientation } from "../components/tabs/types";

export interface TabsSsrPartIds {
  index: number;
  tabId: string;
  panelId: string;
}

export interface TabsSsrContext {
  defaultValue: string | undefined;
  orientation: TabsOrientation;
  disabled: boolean;
  /** Mutable: resolved selected value after tab registration. */
  selectedValue: string | null;
  rootId: string;
  nextIndex: number;
  parts: Map<string, TabsSsrPartIds>;
}

const tabsStorage = new AsyncLocalStorage<TabsSsrContext[]>();

let generatedRootId = 0;

export function createTabsRootId(): string {
  generatedRootId += 1;
  return `ormo-tabs-${generatedRootId}`;
}

export function ensureTabsSsrPart(
  context: TabsSsrContext,
  value: string,
  options: { tabId?: string; panelId?: string } = {},
): TabsSsrPartIds {
  const existing = context.parts.get(value);

  if (existing) {
    if (options.tabId) {
      existing.tabId = options.tabId;
    }
    if (options.panelId) {
      existing.panelId = options.panelId;
    }
    return existing;
  }

  context.nextIndex += 1;
  const index = context.nextIndex;
  const part: TabsSsrPartIds = {
    index,
    tabId: options.tabId ?? `${context.rootId}-tab-${index}`,
    panelId: options.panelId ?? `${context.rootId}-panel-${index}`,
  };
  context.parts.set(value, part);
  return part;
}

export function resolveTabSelected(
  context: TabsSsrContext,
  value: string,
  tabDisabled: boolean,
): boolean {
  if (context.selectedValue !== null) {
    return context.selectedValue === value;
  }

  if (context.defaultValue !== undefined) {
    if (context.defaultValue === value) {
      context.selectedValue = value;
      return true;
    }
    return false;
  }

  if (!context.disabled && !tabDisabled) {
    context.selectedValue = value;
    return true;
  }

  return false;
}

export function isPanelSelected(
  context: TabsSsrContext,
  value: string,
): boolean {
  if (context.selectedValue !== null) {
    return context.selectedValue === value;
  }

  return context.defaultValue === value;
}

export async function renderWithTabsContext(
  context: TabsSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = tabsStorage.getStore() ?? [];
  return tabsStorage.run([...parent, context], render);
}

export function getTabsSsrContext(): TabsSsrContext | undefined {
  return tabsStorage.getStore()?.at(-1);
}
