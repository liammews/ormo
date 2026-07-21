# Creating a new component

This guide describes the standard process for adding an Ormo primitive. Read
the [guiding principles](./guiding-principles.md) before beginning.

The process has five stages:

1. Identify the core functionality.
2. Build the primitive.
3. Test the primitive.
4. Build the documentation demos.
5. Build the MDX documentation page.

Treat accessibility, browser behaviour, TypeScript, and documentation as part
of the component throughout the process rather than as a final polish pass.

## 1. Identify the core functionality

Begin with the user need and interaction model, not a list of props from another
library.

### Define the problem

- Describe what the primitive helps a user accomplish.
- Decide whether it is a single element or a composition of meaningful parts.
- Separate essential behaviour from useful extensions and long-tail features.
- Prioritise the functionality most projects need. Record possible additions
  without including them automatically in the first API.

### Research the platform and pattern

- Identify the closest native HTML element or browser API.
- If it is an established widget pattern, review the relevant ARIA Authoring
  Practices guidance and WCAG requirements.
- Compare respected primitive libraries as research, but do not copy features
  solely for parity.
- Check support across major browsers before relying on newer platform
  capabilities.
- Understand what happens before JavaScript loads and when JavaScript fails.

### Define the contract

Write down:

- The default rendered HTML.
- Required semantics, accessible names, relationships, and states.
- Keyboard and pointer behaviour.
- Initial, disabled, invalid, open, selected, or other relevant states.
- Which behaviour is native and which behaviour requires JavaScript.
- Whether the primitive needs multiple component parts.
- Which native attributes should be forwarded.
- Which state should be exposed for CSS through `data-*` attributes or custom
  properties.
- Whether consumers need to read or change state after rendering.
- If post-render control is needed, the properties, methods, attributes, and
  events that form its framework-independent DOM API.

### Challenge the scope

Before implementation, ask:

- Can any proposed prop be replaced by native HTML or composition?
- Does any option introduce presentation into the primitive layer?
- Can invalid semantic combinations be prevented by the type or runtime API?
- Can JavaScript be omitted for native or static configurations?
- Are we solving a demonstrated need or a hypothetical possibility?

The outcome of this stage should be a small behavioural specification and an
initial list of demos and tests.

## 2. Build the primitive

Add the component under `src/components/<component>/`. Use the existing Button
and Accordion directories as examples for single-component and multipart
primitives.

### Component structure

- Use `.astro` files for authored component parts.
- Put shared public types in `types.ts`.
- Export the public component and types from the component's `index.ts`.
- Add a package subpath export in `package.json`.
- Export the intended root API from `src/index.ts`.
- Forward appropriate native HTML attributes.
- Give every interactive native button a deliberate `type`.
- Use stable `data-ormo-*` hooks for behaviour and documented state attributes
  for styling.

### Runtime behaviour

If client behaviour is required:

- Put reusable browser logic in `src/runtime/`.
- Prefer native events, custom elements, DOM properties, and custom events over
  framework-specific state.
- Scope event handling to the primitive and avoid leaking global behaviour.
- Make runtime initialisation idempotent so multiple component instances do not
  install duplicate behaviour.
- Support Astro page navigation and reconnection where relevant.
- Preserve authored attributes and restore state when temporary behaviour ends.
- Make cancelable pre-change events and post-change events explicit where
  consumers need to coordinate state.
- Load the runtime only for configurations that require it where Astro permits
  this distinction.

Do not add a custom element or state controller automatically. Add one when
consumers have a genuine need to control coordinated state after rendering.

### Accessibility implementation

- Prefer native semantics and behaviour.
- Generate and maintain required IDs and ARIA relationships.
- Keep keyboard behaviour aligned with the native element or established
  pattern.
- Preserve normal Tab navigation and never introduce a keyboard trap.
- Synchronise semantic attributes and styling state.
- Handle disabled and focusable-disabled behaviour deliberately.
- Consider focus restoration when an interaction opens, closes, removes, or
  replaces content.
- Add development diagnostics for clear accessibility mistakes that the API
  cannot prevent. Prefer integration with Astro's development tooling when it
  becomes available.

### Keep it unstyled

The primitive must not include product or brand presentation. Only add CSS when
it is strictly required for behaviour or accessibility, and document why it is
part of the primitive rather than the future themed layer.

## 3. Test the primitive

Add unit tests under `tests/unit/<component>.test.ts`. Test the public behaviour,
not private implementation details.

### Core tests

- Default state and rendered semantic relationships.
- Every public option and meaningful combination.
- State transitions and repeated interactions.
- Disabled behaviour and restoration.
- Native attribute forwarding where Ormo changes or depends on it.
- Public DOM properties, methods, and events.
- Dynamic insertion, removal, reconnection, or mutation when supported.
- Cleanup of observers and event listeners.
- Invalid or malformed input where the public API can encounter it.

### Interaction and accessibility tests

- Accessible roles, names, states, and relationships.
- Tab order and focus behaviour.
- Every required keyboard command.
- Pointer and programmatic interaction where they differ.
- Canceled events and interrupted key sequences.
- No unexpected interception of unrelated keys.
- Reduced-motion behaviour when animation is involved.

Use browser tests for behaviour that a DOM test environment cannot represent
reliably. Run automated accessibility checks against the rendered demos, while
remembering that automated tools do not replace keyboard and screen-reader
testing.

Run the complete validation suite before considering the implementation ready:

```sh
pnpm validate
```

## 4. Build the documentation demos

Create demos under:

```text
ormo.docs/src/components/demos/<Component>/
```

Follow the Accordion demos for file organisation and presentation.

### Demo requirements

- Start with a minimal default demo.
- Add one focused demo for each important behaviour or decision.
- Include disabled, invalid, or other important states where applicable.
- Keep each demo small enough to teach one idea.
- Use realistic labels and content so accessible behaviour is meaningful.
- Ensure icons that do not contribute meaning are hidden from assistive
  technology.
- Keep all visual styling in the demo stylesheet; demo styles are examples, not
  part of the primitive.
- Make focus indicators, target sizes, contrast, reflow, and reduced motion
  accessible in the example presentation.
- Avoid demos that encourage incorrect semantics, even if the underlying visual
  result is common. Explain those cases in prose instead.

Each demo must work as both a live example and source code displayed through
`DemoBlock`.

## 5. Build the MDX documentation page

Create the component page at:

```text
ormo.docs/src/pages/docs/components/<component>.mdx
```

Use the Accordion documentation page as the structural reference and add the
component to the documentation navigation.

### Recommended page structure

1. **Default** — explain and demonstrate the safest default behaviour.
2. **Anatomy** — show the minimum useful component structure and imports.
3. **Examples** — document each important option with one focused demo.
4. **API reference** — list props for every component part, including types,
   defaults, requirements, and native HTML effects.
5. **Browser API and events** — document public DOM control when the primitive
   provides it.
6. **Accessibility** — explain naming, semantics, focus responsibilities, and
   author requirements that Ormo cannot enforce.
7. **Keyboard behaviour** — list supported keys and their effects.
8. **Styling** — document state attributes, selectors, and custom properties.
9. **Runtime** — explain when JavaScript is shipped and what it provides when
   this is useful to consumers.

Documentation should explain why and when to use an option, not merely repeat
its type. Clearly distinguish actions from navigation and other semantic
boundaries. Call out native alternatives when the Ormo component is not the
right tool.

### Final review

Before marking the component ready:

- Confirm every public API appears in the documentation.
- Confirm every documented behaviour is implemented and tested.
- Check demos at narrow widths, increased text spacing, zoom, light and dark
  themes where applicable.
- Test the demos with a keyboard.
- Run automated accessibility checks.
- Perform representative testing with current screen-reader and browser
  combinations for complex interaction patterns.
- Confirm native-only paths do not ship unnecessary component JavaScript.
- Confirm the component can be imported through its package subpath.
- Add a changeset describing the user-facing addition.
- Run `pnpm validate` from the repository root.

## Definition of done

A new Ormo component is ready for beta testing when:

- Its scope follows the guiding principles.
- Its native and JavaScript responsibilities are clear.
- Its accessible behaviour is implemented and verified as far as automated and
  manual testing allow.
- Its public API is typed, independently importable, and framework-independent
  where post-render control is necessary.
- It contains no presentation beyond behaviourally essential CSS.
- Its core states and interactions have tests.
- Its demos teach correct usage.
- Its documentation covers anatomy, API, accessibility, keyboard behaviour,
  styling, and runtime behaviour.
- The repository validation suite passes.
- A changeset is present.
