export function getCollectionItems<T extends Element>(
  root: ParentNode,
  selector: string,
  owns: (item: T) => boolean = () => true,
): T[] {
  return Array.from(root.querySelectorAll<T>(selector)).filter(owns);
}

export function moveCollectionItem<T>(options: {
  items: readonly T[];
  current: T | undefined;
  delta: -1 | 1;
  loop?: boolean;
}): T | undefined {
  const { items, current, delta, loop = false } = options;
  if (items.length === 0) return undefined;

  const currentIndex = current === undefined ? -1 : items.indexOf(current);
  if (currentIndex < 0) return delta > 0 ? items[0] : items.at(-1);

  let nextIndex = currentIndex + delta;
  if (loop) {
    nextIndex = (nextIndex + items.length) % items.length;
  } else {
    nextIndex = Math.max(0, Math.min(items.length - 1, nextIndex));
  }

  return items[nextIndex];
}

export function setRovingTabStop<T extends HTMLElement>(
  items: readonly T[],
  tabStop: T | undefined,
): void {
  for (const item of items) item.tabIndex = item === tabStop ? 0 : -1;
}
