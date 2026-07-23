import { AsyncLocalStorage } from "node:async_hooks";

export interface AvatarSsrContext {
  hasImageSource: boolean;
}

const avatarStorage = new AsyncLocalStorage<AvatarSsrContext[]>();

export async function renderWithAvatarContext(
  context: AvatarSsrContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = avatarStorage.getStore() ?? [];
  return avatarStorage.run([...parent, context], render);
}

export function getAvatarSsrContext(): AvatarSsrContext | undefined {
  return avatarStorage.getStore()?.at(-1);
}
