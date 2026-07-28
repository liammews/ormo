import { AsyncLocalStorage } from "node:async_hooks";

export interface RadioGroupSsrContext {
  name: string | undefined;
  disabled: boolean;
  required: boolean;
  defaultValue: string | undefined;
  rootId: string;
  labelId: string;
  /** Mutable: populated as RadioGroup.Label parts render. */
  labelIds: string[];
}

const groupStorage = new AsyncLocalStorage<RadioGroupSsrContext[]>();

let generatedRootId = 0;

export function createRadioGroupRootId(): string {
  generatedRootId += 1;
  return `ormo-radio-group-${generatedRootId}`;
}

export async function renderWithRadioGroupContext(
  context: RadioGroupSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = groupStorage.getStore() ?? [];
  return groupStorage.run([...parent, context], render);
}

export function getRadioGroupSsrContext(): RadioGroupSsrContext | undefined {
  return groupStorage.getStore()?.at(-1);
}
