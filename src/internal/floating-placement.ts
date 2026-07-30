export type FloatingSide = "top" | "right" | "bottom" | "left";
export type FloatingAlign = "start" | "center" | "end";
export type FloatingPlacement =
  FloatingSide | `${FloatingSide}-start` | `${FloatingSide}-end`;

export function floatingPlacement(
  side: FloatingSide,
  align: FloatingAlign,
): FloatingPlacement {
  return align === "center" ? side : `${side}-${align}`;
}
