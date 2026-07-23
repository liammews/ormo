---
"@ormo/primitives": minor
---

Improve Accordion SSR initial state, browser control surface, and diagnostics.

Reflect `defaultValue` and root `hiddenUntilFound` in server HTML, expose `type` on the custom element, keep authored trigger `disabled` in sync after mount, and warn about incomplete or duplicated Accordion parts in the dev toolbar.

Make single Accordions collapsible by default. Require an always-open panel with `collapsible={false}`.
