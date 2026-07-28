# Radio and RadioGroup plan

This note starts the behavioural plan for `radio` and `radio-group`.

It uses these inputs:

- Ormo's [guiding principles](./guiding-principles.md)
- The existing [`checkbox`](../src/components/checkbox/) structure
- Radix Radio Group: <https://www.radix-ui.com/primitives/docs/components/radio-group>
- Base UI Radio: <https://base-ui.com/react/components/radio>

The goal is not parity with Radix or Base UI. They are references for useful
patterns, edge cases, and naming pressure. The implementation should stay
native-first and only add JavaScript when it expands necessary behaviour.

## 1. Core problem

We need two related primitives:

- `Radio`: one native radio control that is easy to style and compose
- `RadioGroup`: an optional enhanced group primitive for radios that need
  coordinated naming, group labeling, group-level DOM control, and `Field`
  integration beyond what a plain `fieldset` gives us

This mirrors the checkbox split:

- a single control should remain mostly native and very cheap
- a dedicated group primitive can justify a small runtime when it provides real
  coordination value

## 2. First-release scope

### `Radio`

`Radio` should render a native `<input type="radio">`.

Planned parts:

- `Radio`
- `RadioIndicator`

Initial behaviour:

- No client JavaScript for a standalone radio
- Native checked, disabled, required, invalid, and focus behaviour
- Styling through native selectors such as `:checked`, `:disabled`,
  `:focus-visible`, `:invalid`, and `:has()`
- `RadioIndicator` as an optional `aria-hidden` sibling, matching the checkbox
  indicator model

### `RadioGroup`

`RadioGroup` should exist, but it should be explicitly narrower than a
React-style composite widget.

Planned parts:

- `RadioGroup.Root`
- `RadioGroup.Label`

Initial group responsibilities:

- Provide a stable group root for `aria-labelledby`
- Inherit `name`, `disabled`, and `required` to radios that do not author their
  own values
- Expose framework-independent DOM control for the selected value
- Emit a group-level value change event
- Integrate cleanly with `Field.Root` without triggering the "multiple native
  controls" warning

## 3. Default HTML and semantics

### `Radio`

Default markup should follow the checkbox pattern closely:

- render `<input type="radio">`
- forward relevant native input attributes
- do not add presentation classes or visual structure
- use stable internal runtime markers such as `data-ormo-radio`

The first version should not recreate radios as buttons plus hidden inputs.
That pattern solves framework composition problems that Ormo does not need to
inherit.

### `RadioGroup.Root`

Planned default markup:

- render `<ormo-radio-group role="radiogroup">`
- render children as ordinary native radios inside the custom element
- derive `aria-labelledby` from one or more `RadioGroup.Label` parts when the
  author does not provide `aria-labelledby` or `aria-label`

This is the main design fork from `Fieldset`:

- `Fieldset.Root` remains the default semantic grouping primitive
- `RadioGroup.Root` becomes the enhanced primitive when consumers need a group
  value API, group-level events, or live coordination of child radios

That keeps the zero-JavaScript path available for ordinary forms while still
leaving room for an Ormo group primitive.

## 4. Why `RadioGroup` can justify a runtime

Unlike checkbox groups, native radios already provide most interaction:

- only one item in a same-name group can be checked
- form submission is native
- native required validation already means "choose one option"
- browsers already provide the one-Tab-stop radio-group behaviour
- arrow-key movement is largely native when radios share a name

So the runtime should stay thin. It only earns its cost if it provides:

- live propagation of group `name`, `disabled`, and `required`
- a group `value` property (`string | null`)
- a group `form` getter
- `checkValidity()` and `reportValidity()` on the group root
- a bubbled `ormo:value-change` event
- SSR-derived `aria-labelledby` management that survives dynamic updates

If the implementation grows beyond that, the scope has likely drifted too far
from the guiding principles.

## 5. Proposed public API

### `Radio`

Proposed exports:

- `Radio`
- `RadioIndicator`

Proposed prop shape:

- base on `HTMLAttributes<"input">`
- omit `type`
- keep native `checked`, `name`, `value`, `required`, `disabled`, and `form`
- support group inheritance when `name`, `disabled`, or `required` are omitted

Notes:

- no `readOnly` API in v1
- no `asChild`, `render`, or `nativeButton`
- no item-level `data-state`; native pseudo-classes already expose the useful
  state

### `RadioGroup.Root`

Proposed props:

- `name?: string`
- `defaultValue?: string`
- `disabled?: boolean`
- `required?: boolean`

Potentially useful but not automatic in v1:

- `value`
- custom validation messaging
- orientation
- loop

Recommendation for v1:

- support `defaultValue`
- do not add a controlled `value` prop yet
- provide post-render control through the custom-element API instead

That keeps the Astro surface simple and consistent with Ormo's preference for
DOM-first control over framework-specific controlled/uncontrolled prop systems.

### `RadioGroup.Label`

Planned behaviour:

- render a native `<span>`
- register its generated or authored `id` with the nearest SSR group context
- support multiple labels the same way checkbox group does

## 6. Proposed DOM API

The group custom element should expose the smallest useful surface:

- `readonly form: HTMLFormElement | null`
- `name: string`
- `value: string | null`
- `disabled: boolean`
- `required: boolean`
- `readonly valid: boolean`
- `checkValidity(): boolean`
- `reportValidity(): boolean`

Planned event:

- `ormo:value-change`
  - bubbles
  - should carry `{ value: string | null }`

Open point:

- property assignment should probably update the checked radio without firing a
  synthetic second native `change` event

## 7. Styling contract

Public styling hooks should stay minimal.

For radios:

- rely on native selectors first
- expose `data-disabled` only when it represents resolved group-disabled state
- keep `data-ormo-*` markers internal

For the group root:

- `data-disabled`
- `data-required`
- avoid reflecting arbitrary values to `data-value` in v1 unless a concrete
  styling need appears

The checkbox lesson applies here: do not mirror native state into `data-state`
without a clear gain.

## 8. Relationship to `Field` and `Fieldset`

This component should fit the existing split rather than blur it.

Planned rule:

- use `Fieldset` for ordinary semantic grouping
- use `RadioGroup` when a design system needs group-level naming, events,
  browser API access, or `Field` integration for a set of radios

Implementation consequence:

- `Field.Root` should recognise `ormo-radio-group` as a dedicated group
  primitive, similar to `ormo-checkbox-group`
- `Field` should own group-level description and invalid state wiring on the
  group root, not on each member radio

## 9. Likely file structure

Mirror the checkbox component where it still makes sense:

```text
src/components/radio/
  Radio.astro
  Indicator.astro
  Group.astro
  GroupLabel.astro
  Runtime.astro
  group.ts
  types.ts
  index.ts
```

Likely supporting internals:

```text
src/internal/radio-group-ssr-context.ts
src/runtime/radio.ts
src/runtime/radio-group.ts
src/runtime/radio.css
```

Notes:

- `src/runtime/radio.ts` may only be needed for development diagnostics or
  future group-aware wiring; the standalone radio itself should not require a
  runtime
- `src/runtime/radio.css` should only exist if the indicator needs the same
  `pointer-events: none` rule as checkbox

## 10. Implementation order

1. Write a decision entry after the group shape is fully agreed.
2. Build `Radio` and `RadioIndicator` with no runtime by default.
3. Build the SSR context and `RadioGroup.Root` / `RadioGroup.Label`.
4. Build the custom-element runtime with `value`, validity, and inheritance
   coordination.
5. Update `Field` to recognise the radio group primitive.
6. Add unit and browser tests.
7. Add demos and the MDX docs page.

## 11. Test plan

### Unit tests

- `Radio` renders a native radio input and forwards key native attributes
- `RadioIndicator` remains `aria-hidden`
- `RadioGroup` generates and resolves `aria-labelledby`
- group `defaultValue` selects the matching radio during SSR
- omitted item `name` inherits the group name
- authored item `name` is preserved
- group `disabled` and `required` propagate correctly
- `value` getter and setter reconcile checked state
- `checkValidity()` and `reportValidity()` match native radio-group validity
- form reset restores defaults without emitting synthetic extra changes
- `ormo:value-change` fires once for user changes

### Browser tests

- one Tab stop for the group
- arrow-key behaviour remains correct with native radios
- disabled checked radios are not submitted
- `Field` integration wires `aria-describedby` and invalid state correctly
- no-JavaScript baseline for standalone radios

## 12. Explicit non-goals for v1

- button-based custom radios
- roving `tabindex`
- orientation and loop props
- item text-value inference
- nested subgroups
- custom validation message APIs
- framework-style controlled props designed around React state
- presentation props

## 13. Main open questions

1. Should `RadioGroup.Root` ship in the first radio release, or should we begin
   with `Radio` plus guidance to use `Fieldset` until the enhanced group
   behaviour is implemented?
2. Is a custom group root justified without a controlled Astro prop API, or is
   the DOM property surface alone the right first step?
3. Do we want group-level `required` to propagate to every member, or only to
   the first enabled member while preserving native group validation?
4. Should the runtime attempt to normalise arrow-key edge cases across browsers,
   or should v1 rely entirely on native radio behaviour?

## 14. Recommendation

Proceed with:

- `Radio` + `RadioIndicator` first
- `RadioGroup.Root` + `RadioGroup.Label` in the same workstream if we confirm
  that the DOM API and `Field` integration are required for v1

Avoid carrying over checkbox-group features that radios do not need. The right
radio plan is smaller than the checkbox plan, not symmetric with it.
