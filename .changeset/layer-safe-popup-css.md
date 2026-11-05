---
"@ormo/primitives": patch
---

Let consumer styles in cascade layers, such as Tailwind v4 utilities, style
Tooltip, Popover, Select, Combobox, Autocomplete, Dropdown Menu and Preview Card
content without `!important`. The runtime CSS no longer resets border, padding,
colour, background, overflow or margin on popup content. Unstyled content now
shows the browser's default popover styles. Placement rules and the `sideOffset`
margin stay enforced.
