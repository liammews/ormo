import { AsyncLocalStorage } from "node:async_hooks";

export interface PreviewCardSsrContext {
  rootId: string;
  defaultOpen: boolean;
}

const storage = new AsyncLocalStorage<PreviewCardSsrContext[]>();
let generatedId = 0;

export function createPreviewCardRootId(): string {
  generatedId += 1;
  return `ormo-preview-card-${generatedId}`;
}

export async function renderWithPreviewCardContext(
  context: PreviewCardSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = storage.getStore() ?? [];
  return storage.run([...parent, context], render);
}

export function getPreviewCardSsrContext(): PreviewCardSsrContext | undefined {
  return storage.getStore()?.at(-1);
}
