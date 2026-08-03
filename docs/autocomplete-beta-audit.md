# Autocomplete beta-readiness audit

Date: 2026-08-01

## Recommendation

**The original P0 correctness blockers are resolved.** The primitive has a sound
core and can now move through the P1 beta-readiness matrix before promotion.

After the P0 work and its browser coverage are complete, Autocomplete is a good
beta candidate. The richer Base UI features listed later are not all required
for Ormo beta and should not expand the first release indiscriminately.

## What is already strong

- The native text input is the submitted control. Freeform values, required
  validity, autofill hints, external form association, and reset do not depend
  on a mirrored hidden field.
- The component has a clear semantic distinction from Combobox: suggestions are
  optional and the typed value remains valid without a matching item.
- Local `contains` and `startsWith` filtering, externally managed filtering,
  keywords, text values, identifiers, disabled items, groups, loading, empty,
  clearing, and `minLength` are implemented.
- Focus remains on the input and active options use `aria-activedescendant`.
  Arrow navigation, Enter, Escape, Tab, pointer selection, and light dismissal
  are present.
- Both CSS Anchor Positioning and the Floating UI adapter are supported.
- The custom events expose reasons and allow authored input, item, and clear
  value changes to be cancelled.
- SSR markup is useful before enhancement; without JavaScript the native field
  remains visible and submittable while custom UI stays hidden.
- Development validation catches missing input/content, missing accessible
  names, unlabeled groups, and a missing floating adapter.
- Current unit, SSR, browser, form, no-JavaScript, async, and axe coverage gives
  the primitive a substantially better baseline than a demo-only component.

## P0 — required before beta

### 1. Make dynamic disabling atomic — resolved

Previous behavior: setting `root.disabled = true` updated the input and clear
button, but an already-open popup remains open. Pointer selection is still
possible because item selection only checks the item's disabled state, not the
root's disabled state.

Action:

- Close the popup when the root becomes disabled.
- Clear the active descendant and highlighted state.
- Guard item and clear selection paths against a disabled root.
- Add unit and real-browser tests for disabling while open and re-enabling.

### 2. Clear stale active items when async content changes — resolved

Previous behavior: the child-list observer re-prepared and filtered replaced
items, but an active item that was removed can remain in `#active`. The input can
retain an `aria-activedescendant` pointing to detached DOM, and Enter can select
that detached result.

Action:

- Clear highlight when the active item is no longer contained by the root, is
  hidden, or becomes disabled.
- Never select an item unless it is still contained, visible, and enabled.
- Add a browser test that highlights an async result, replaces the result set,
  then verifies ARIA state and Enter behavior.

### 3. Define and support IME composition — resolved

Previous behavior: composition was not tracked. Intermediate `input` events could
filter, open the popup, and emit cancellable value events while a user is still
composing East Asian or other IME text.

Action:

- Track `compositionstart`/`compositionend` or `InputEvent.isComposing`.
- Do not filter, select, or treat Enter as option acceptance during composition.
- Process the committed value once composition ends.
- Add unit and Chromium browser coverage using composition events.

### 4. Define readonly behavior — resolved

Readonly is now a first-class Root state, synchronized to the native input. It
closes an open popup and prevents item selection and clearing while preserving
native readonly focus and copy behavior.

Action:

- Either add `readonly` to Root and fully synchronize it, or explicitly reject
  readonly Input composition in development.
- If supported, prevent selection and clear from mutating the input while
  retaining the expected readonly focus/copy behavior.
- Document and test the chosen contract.

## P1 — strongly recommended for beta

### Keyboard and pointer coverage

- Test ArrowUp from no active item, boundaries, disabled-item skipping, and
  navigation after filtering.
- Decide whether navigation clamps, wraps through the input, or is configurable;
  document the decision. Current behavior clamps at the first and last option.
- Test clicking the already-matching active item, outside light dismissal, Tab,
  Escape, touch selection, and input focus retention in real browsers.
- Test that Enter submits freeform text when nothing is highlighted and does not
  submit when accepting an option.
- Decide whether pointer exit should clear highlight. Current pointer movement
  highlights an item and keeps it highlighted after leaving the list.

### Dynamic state and authored DOM

- Observe or explicitly document which runtime changes are supported for
  `loading`, `filter`, `minLength`, item text/value/keywords, disabled items, and
  grouping. Today child insertion/removal is observed, but attribute and text
  mutations are not.
- Test duplicate values and duplicate identifiers; identifiers are metadata but
  the expected event behavior should be explicit.
- Test multiple roots, nested unrelated listboxes, disconnect/reconnect while
  open, and content removal while open.

### Accessibility

- Run manual screen-reader checks with at least NVDA/Firefox and VoiceOver/Safari
  for closed, results, empty, loading, disabled, and grouped states.
- Verify whether Empty and Loading should remain disabled `option` elements or
  use a dedicated status region outside the listbox. Axe currently passes, but
  this deserves assistive-technology validation.
- Add browser assertions for `aria-expanded`, `aria-controls`,
  `aria-activedescendant`, option selection state, group labels, and busy state.
- Test forced colors, 200% zoom, narrow mobile viewports, and RTL positioning.

### Filtering

- Document that matching currently normalizes case and whitespace but is not
  diacritic-insensitive. For example, `cafe` does not match `Café`.
- Consider an `Intl.Collator`-based implementation or a locale/sensitivity
  option before stable. This can be deferred during beta if documented.
- Add tests for Unicode, whitespace-only queries, keywords, `textValue`, and
  `startsWith`.

### Browser and positioning matrix

- Add WebKit coverage before beta; current automated browser evidence is
  Chromium and Firefox.
- Test popup width with and without Clear, long scrollable result sets, viewport
  collision, page scroll, resize, zoom, and all side/alignment combinations.
- State the minimum browser contract for the Popover API. The catch-path opens a
  fallback popup, but it does not implement equivalent outside dismissal.

## P2 — useful additions, not beta blockers

### Missing demos

- Grouped results with disabled items and separators.
- `startsWith`, keywords, and custom displayed content via `textValue`.
- `minLength` and an explanatory idle state.
- Event cancellation and programmatic `value`/`show()`/`hide()` usage.
- Floating positioning and a constrained/scrolling results panel.
- External form association and form reset.

### API and documentation polish

- Add a usage-guidelines section explaining when to choose Autocomplete versus
  Combobox, mirroring the clear distinction in Base UI's documentation.
- Document all part props rather than only Root and a prose summary of Item.
- Document state/data attributes available for styling.
- Document native `input`/`change` event behavior alongside Ormo events.
- Clarify whether programmatic `value` changes intentionally bypass the
  cancellable before-change event.
- Consider a dedicated `Status` part for arbitrary result counts and async
  errors; Loading alone is narrower than real async-search needs.

## Feature comparison

### Base UI

Base UI's Autocomplete is a mature React implementation and a useful ceiling,
not a minimum beta checklist. It confirms Ormo's core product distinction:
Autocomplete permits freeform input, while Combobox is for remembered
selection.

| Capability | Ormo | Base UI | Beta decision |
| --- | --- | --- | --- |
| Freeform text and suggestions | Yes | Yes | Core; keep |
| Native form name/form/required | Yes | Yes | Ormo implementation is strong |
| Local filtering | Contains, starts-with | Filter functions, locale-aware helpers | Document gap; improve by stable |
| Externally filtered async results | Yes | Yes | Core; fix stale-active bug |
| Groups, labels, separators | Yes | Yes | Add demo and browser tests |
| Empty and async status | Empty + Loading | Empty + general Status | Consider Status; not blocking |
| Clear action | Yes | Yes | Core |
| Trigger/icon | Intentionally absent | Optional parts | Correct Ormo product choice |
| Inline autocompletion | No | `list`, `both`, `inline`, `none` modes | Defer |
| Configurable auto-highlight | No | Yes | Defer; current no-highlight-on-type is safe |
| Highlight callbacks/options | No dedicated event | Rich highlight event/config | Consider after beta feedback |
| Open on input click | No | Optional | Consider small post-beta feature |
| Controlled open/value | Imperative properties/events | Controlled and uncontrolled React state | Ormo model is appropriate, but document it |
| Custom object item values | String value + identifier metadata | Typed object values | Ormo's DOM/Astro API is intentionally simpler |
| Result limit | No | Yes | Easy future enhancement; not blocking |
| Locale-aware filtering | Runtime locale lowercasing only | `Intl.Collator`, locale and sensitivity | Improve by stable |
| Portal/backdrop/arrow | Native popover; no parts | Yes | Not required for non-modal autocomplete beta |
| Inline/command-palette mode | No | Yes | Separate advanced use case |
| Grid navigation | No | Yes | Defer |
| Virtualization integration | No | Yes | Defer until demanded |
| Form submit on item click | No option | Configurable | Defer |

Base UI also exposes list/collection/row primitives and supports fuzzy matching,
result limiting, command palettes, grid layouts, and virtualization. Adding all
of these now would make Ormo's first beta less coherent. The right benchmark is
correct editable-combobox behavior, resilient dynamic DOM, forms, and
accessibility—not parity with every React data-management feature.

### Radix

Radix Primitives and Radix Themes currently do **not** publish an Autocomplete
component. Radix offers Select and Text Field, but composing those does not
provide autocomplete semantics, filtering, active-descendant navigation, or
suggestion lifecycle. There is therefore no honest Radix Autocomplete feature
matrix to compare against.

This is useful evidence in itself: Ormo should follow Radix's low-level,
unstyled, composable philosophy, but Base UI and the WAI-ARIA editable-combobox
pattern are the relevant behavioral references for this primitive.

## Promotion checklist

- [x] Fix dynamic disabled behavior.
- [x] Fix detached async active-item state.
- [x] Implement and test IME composition behavior.
- [x] Define and test readonly behavior.
- [ ] Complete the P1 keyboard/pointer browser matrix.
- [ ] Add WebKit automation and manual screen-reader notes.
- [ ] Add grouped/disabled and filtering demos.
- [ ] Expand accessibility/state/API documentation.
- [ ] Re-run unit, render, contract, type, docs, axe, and browser suites.
- [ ] Change `primitive-contracts.json` status from `dev` to `beta` and update
      the changeset only after all required items pass.

## Sources

- Base UI Autocomplete documentation: https://base-ui.com/react/components/autocomplete
- Radix Primitives component index: https://www.radix-ui.com/primitives/docs/components
- Radix Themes component index: https://www.radix-ui.com/themes/docs/components
