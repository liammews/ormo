function addHeadingLinks(node) {
  if (!node || typeof node !== "object") return;

  if (
    node.type === "element" &&
    node.tagName === "h2" &&
    typeof node.properties?.id === "string"
  ) {
    const children = node.children;

    node.children = [
      {
        type: "element",
        tagName: "a",
        properties: {
          className: ["heading-anchor"],
          href: `#${node.properties.id}`,
        },
        children,
      },
    ];

    return;
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      addHeadingLinks(child);
    }
  }
}

export default function rehypeHeadingLinks() {
  return addHeadingLinks;
}
