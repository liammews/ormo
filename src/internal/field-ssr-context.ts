import { AsyncLocalStorage } from "node:async_hooks";

export interface FieldSsrContext {
  invalid: boolean;
  rootId: string;
  controlId: string;
  labelCount: number;
  descriptionCount: number;
  errorCount: number;
}

const fieldStorage = new AsyncLocalStorage<FieldSsrContext[]>();

let generatedRootId = 0;

export function createFieldRootId(): string {
  generatedRootId += 1;
  return `ormo-field-${generatedRootId}`;
}

export async function renderWithFieldContext(
  context: FieldSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = fieldStorage.getStore() ?? [];
  return fieldStorage.run([...parent, context], render);
}

export function getFieldSsrContext(): FieldSsrContext | undefined {
  return fieldStorage.getStore()?.at(-1);
}
