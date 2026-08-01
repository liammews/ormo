import { AsyncLocalStorage } from "node:async_hooks";

export interface PasswordFieldSsrContext {
  inputCount: number;
  inputDisabled: boolean;
  inputId: string;
  toggleCount: number;
  visible: boolean;
}

const storage = new AsyncLocalStorage<PasswordFieldSsrContext[]>();

let generatedRootId = 0;

export function createPasswordFieldRootId(): string {
  generatedRootId += 1;
  return `ormo-password-field-${generatedRootId}`;
}

export async function renderWithPasswordFieldContext(
  context: PasswordFieldSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  return storage.run([...(storage.getStore() ?? []), context], render);
}

export function getPasswordFieldSsrContext():
  PasswordFieldSsrContext | undefined {
  return storage.getStore()?.at(-1);
}
