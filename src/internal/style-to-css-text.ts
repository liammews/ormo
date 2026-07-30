export function styleToCssText(value: unknown): string {
  if (value == null || value === false) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value !== "object") return "";

  return Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry != null && entry !== false)
    .map(([property, entry]) => {
      const cssProperty = property.startsWith("--")
        ? property
        : property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
      return `${cssProperty}: ${String(entry)}`;
    })
    .join("; ");
}
