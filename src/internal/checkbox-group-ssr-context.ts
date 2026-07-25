import { AsyncLocalStorage } from "node:async_hooks";

export interface CheckboxGroupSsrContext {
  name: string | undefined;
  disabled: boolean;
  defaultValue: ReadonlySet<string>;
  rootId: string;
  labelId: string;
  /** Mutable: set true when CheckboxGroup.Label renders. */
  hasLabel: boolean;
}

const groupStorage = new AsyncLocalStorage<CheckboxGroupSsrContext[]>();

let generatedRootId = 0;

export function createCheckboxGroupRootId(): string {
  generatedRootId += 1;
  return `ormo-checkbox-group-${generatedRootId}`;
}

export function normalizeDefaultValues(
  defaultValue: string[] | undefined,
): ReadonlySet<string> {
  if (defaultValue === undefined) {
    return new Set();
  }

  return new Set(
    defaultValue.filter((value): value is string => typeof value === "string"),
  );
}

export async function renderWithCheckboxGroupContext(
  context: CheckboxGroupSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = groupStorage.getStore() ?? [];
  return groupStorage.run([...parent, context], render);
}

export function getCheckboxGroupSsrContext():
  CheckboxGroupSsrContext | undefined {
  return groupStorage.getStore()?.at(-1);
}
