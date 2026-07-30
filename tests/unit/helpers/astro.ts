export function findOpeningTag(
  html: string,
  tagName: string,
  attribute: string,
): string {
  const match = html.match(
    new RegExp(`<${tagName}[^>]*${attribute}(?:=[^ >]+)?[^>]*>`),
  );
  if (!match) throw new Error(`Expected <${tagName}> with ${attribute}`);
  return match[0];
}
