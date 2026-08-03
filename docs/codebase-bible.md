# Ormo codebase bible

This is the working guide for people building, reviewing, testing, documenting,
and releasing Ormo primitives. It describes the repository as it exists today.
When this guide and executable configuration disagree, the configuration and
tests are authoritative; update this guide in the same change.

## What Ormo is

Ormo is an accessible, unstyled primitive library for Astro. Its components
provide semantics, relationships, state, keyboard and pointer behaviour, and a
small framework-independent DOM API where necessary. Consumers own product
layout and presentation.

The design priorities are:

1. Prefer the web platform and native elements.
2. Produce useful, accessible server-rendered HTML.
3. Add JavaScript only when behaviour requires it.
4. Keep the public API small and composable.
5. Preserve authored attributes and native behaviour.
6. Expose stable public state hooks without leaking private configuration.
7. Treat tests, demos, documentation, and changesets as part of the primitive.

Read `docs/guiding-principles.md` before making a significant API decision.

## Supported toolchain

- Node.js 22.12 or newer
- pnpm 11.12
- Astro 7
- TypeScript 6
- Vitest with Happy DOM for runtime tests
- Astro’s experimental container for server-render tests
- Playwright for browser tests
- axe-core for automated accessibility checks
- Changesets for release notes and versioning

Install and validate from the repository root:

```sh
pnpm install
pnpm validate
```

## Repository map

```text
.
├── src/
│   ├── components/          Public Astro component parts and types
│   ├── runtime/             Browser controllers and behaviour-critical CSS
│   ├── internal/            Private SSR contexts and shared implementation
│   ├── dev-toolbar/         Development diagnostics integration and scanners
│   ├── events.ts            Shared public event types
│   └── index.ts             Root package exports
├── tests/
│   ├── unit/                Runtime, SSR-context, diagnostics and render tests
│   ├── fixtures/            Minimal Astro fixtures for render tests
│   └── browser/             Playwright tests against built public demos
├── ormo.docs/
│   └── src/
│       ├── components/
│       │   ├── demos/       Public educational demos
│       │   └── docs/        Documentation UI components
│       ├── layouts/         Documentation and browser-fixture layouts
│       ├── pages/
│       │   ├── docs/        Public MDX documentation pages
│       │   └── test-fixtures/browser/
│       │                     Stable routes used by Playwright
│       └── styles/          Documentation tokens, utilities and global styles
├── scripts/                 Contract checking and primitive scaffolding
├── .changeset/              Consumer-facing release notes
├── primitive-contracts.json Checked inventory of all primitive families
├── PRIMITIVE_CONTRACT.md    Manifest policy and scaffold notes
├── package.json             Package exports and canonical commands
├── playwright.config.ts     Browser projects and docs preview server
├── vitest.config.ts         Runtime test configuration
├── vitest.astro.config.ts   Astro render test configuration
└── .github/workflows/ci.yml CI validation and browser cadence
```

### Important ownership boundaries

`src/components/` owns rendered markup and the public Astro API.

`src/runtime/` owns behaviour after connection. A runtime must not silently
become the only source of essential initial semantics that can be rendered on
the server.

`src/internal/` is not public API. SSR context, shared serializers, and
placement helpers belong here.

`ormo.docs/` is a real consumer of the package. Demos should import public
subpaths such as `@ormo/primitives/popover`, not private source modules.

`tests/fixtures/` are deliberately small test inputs. Public docs demos are
educational examples and are exercised separately through Playwright.

## The primitive contract

`primitive-contracts.json` is the checked inventory for all primitive families.
Every entry records:

- ID, display label, and maturity status;
- runtime model;
- public Astro parts;
- runtime modules;
- SSR context, when present;
- behaviour-critical CSS;
- representative runtime and render tests.

`pnpm check:contracts` verifies package exports, component files, docs pages,
browser fixtures/specs, runtime modules, and listed tests. Documentation
navigation order remains hand-authored, while labels and statuses are derived
from the manifest.

Update the manifest whenever a primitive’s parts, runtime model, files, or
status change. A missing mandatory surface must fail validation rather than
becoming a review convention people need to remember.

## Runtime models

Choose the least powerful model that satisfies the interaction contract.

### Static

The server-rendered HTML is the complete component. No component runtime is
loaded.

Typical concerns:

- semantic element choice;
- native attribute forwarding;
- IDs and relationships created during rendering;
- composition with surrounding primitives;
- SSR diagnostics.

Examples include Input, Fieldset, and Breadcrumbs, although a static primitive
may still use private SSR context to coordinate multipart markup.

### Conditionally enhanced native

Native HTML remains useful without JavaScript. JavaScript is loaded only for a
configuration that adds coordinated behaviour.

Test both paths:

- native/no-JavaScript semantics and form behaviour;
- enhanced runtime behaviour and DOM API;
- transition between authored and runtime-managed state.

Select is the clearest example: native mode remains an operating-system
`<select>`, while enhanced mode adds the custom trigger and listbox.

### Custom element

A custom element coordinates multipart state after rendering. Use this when
consumers genuinely need post-render state, methods, events, mutation handling,
or reconnect behaviour.

Custom-element runtimes must:

- initialise idempotently;
- survive removal and reconnection;
- avoid duplicate global listeners;
- clean observers, timers, document listeners, and positioners;
- preserve authored attributes and inline styles;
- restore temporarily managed values on disconnection;
- support Astro navigation where relevant;
- expose a typed, framework-independent DOM API.

## Primitive composition

### Folder shape

A multipart primitive normally looks like:

```text
src/components/example/
├── Root.astro
├── Trigger.astro
├── Content.astro
├── Item.astro
├── types.ts
└── index.ts
```

Use one `.astro` file per meaningful public part. Do not split private markup
into public parts merely for implementation convenience.

### Public types

Types extend or omit Astro’s native element attributes:

```ts
import type { HTMLAttributes } from "astro/types";

export interface ExampleRootProps extends HTMLAttributes<"div"> {
  defaultValue?: string;
  disabled?: boolean;
}

export interface ExampleItemProps extends Omit<
  HTMLAttributes<"button">,
  "value"
> {
  value: string;
}
```

Guidelines:

- forward relevant native attributes;
- omit attributes whose native meaning conflicts with the Ormo API;
- type constrained unions rather than accepting arbitrary strings;
- document surprising defaults in TSDoc;
- type DOM properties, methods, and custom events in the same public module;
- augment `HTMLElementTagNameMap` for public custom elements.

### Astro part template

```astro
---
import type { ExampleItemProps } from "./types";

type Props = ExampleItemProps;

const { value, disabled = false, ...attributes }: Props = Astro.props;
---

<button
  {...attributes}
  type="button"
  data-ormo-example-item
  data-value={value}
  data-disabled={disabled ? "" : undefined}
  disabled={disabled || undefined}
>
  <slot />
</button>
```

Attribute ordering matters. Spread consumer attributes before deliberate
Ormo-owned semantic attributes when consumers must not override the contract.
If an attribute should remain author-controlled, resolve it explicitly rather
than relying on incidental spread order.

Every native `<button>` receives an intentional `type`, normally `"button"`.

### Exports

The component folder exports parts and public types:

```ts
export { default as Root } from "./Root.astro";
export { default as Item } from "./Item.astro";
export type {
  ExampleItemProps,
  ExampleRootProps,
  OrmoExampleElement,
} from "./types";
```

Then add:

1. a package subpath in `package.json`;
2. the intended root export in `src/index.ts`;
3. the primitive entry in `primitive-contracts.json`.

Consumers should be able to use the focused import:

```astro
---
import * as Example from "@ormo/primitives/example";
---
```

### SSR context

Multipart parts sometimes need state from their nearest root during server
rendering. Use an `AsyncLocalStorage` stack in `src/internal/` so nested and
concurrent renders remain isolated.

The pattern is:

```ts
const storage = new AsyncLocalStorage<ExampleContext[]>();

export function getExampleSsrContext() {
  return storage.getStore()?.at(-1);
}

export function renderWithExampleContext(
  context: ExampleContext,
  render: () => Promise<string>,
): Promise<string> {
  const parent = storage.getStore() ?? [];
  return storage.run([...parent, context], render);
}
```

The root renders its slot inside `renderWithExampleContext`. Descendant parts
read the nearest context. Add direct tests for nesting, concurrency, and cleanup
after rendering.

Never use a process-global mutable “current root”; it leaks between concurrent
SSR requests and nested primitives.

### Runtime template

```ts
const tagName = "ormo-example";

export class OrmoExample extends HTMLElement {
  #controller: AbortController | undefined;
  #observer: MutationObserver | undefined;

  connectedCallback(): void {
    this.#controller?.abort();
    this.#controller = new AbortController();

    this.#prepare();
    this.addEventListener("click", this.#handleClick, {
      signal: this.#controller.signal,
    });

    this.#observer?.disconnect();
    this.#observer = new MutationObserver(() => this.#prepare());
    this.#observer.observe(this, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  disconnectedCallback(): void {
    this.#controller?.abort();
    this.#controller = undefined;
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#restoreAuthoredState();
  }

  #prepare(): void {
    // Discover parts, reconcile semantics, and validate the composition.
  }

  #handleClick = (event: MouseEvent): void => {
    // Keep event handling scoped to this root.
  };

  #restoreAuthoredState(): void {
    // Restore every attribute/style temporarily owned by the runtime.
  }
}

if (!customElements.get(tagName)) {
  customElements.define(tagName, OrmoExample);
}
```

Use an `AbortController` for listeners. Mutation observers should ignore
runtime-owned mutations where necessary to prevent reconciliation loops.

### Events and DOM API

Prefer DOM properties and methods over framework-specific state:

```ts
interface OrmoExampleElement extends HTMLElement {
  value: string;
  show(): void;
  hide(): void;
}
```

Use a cancellable “before” event only when consumers need to veto a
user-requested change. Emit a non-cancellable event after committed state.
Document:

- event name;
- `detail` shape;
- trigger reasons;
- whether it bubbles and is composed;
- whether it is cancellable;
- whether direct property assignment emits it.

Keep cross-primitive event detail types in `src/events.ts` when they are truly
shared.

### Public and private attributes

Public styling state is concise and documented:

```text
data-state="open|closed"
data-disabled
data-placeholder
data-side="top|right|bottom|left"
data-align="start|center|end"
```

Stable `data-ormo-*` hooks identify parts for runtime discovery:

```text
data-ormo-popover-trigger
data-ormo-popover-content
```

Do not present private configuration attributes as styling API. Keep a clear
distinction between:

- public state hooks consumers may style;
- stable internal part selectors used by the runtime;
- private serialized configuration used between Astro and the runtime.

### Behaviour-critical CSS

Primitives are unstyled. CSS in `src/runtime/*.css` is allowed only for
behaviour or accessibility, such as:

- hiding an enhanced native control while retaining form semantics;
- preventing a decorative indicator from intercepting pointer input;
- popover positioning mechanics;
- resetting native top-layer defaults needed for placement.

Wrap presentation-neutral rules in `:where()` to keep specificity at zero.
Document any deliberate `!important` exception directly above the rule.
Consumer presentation belongs in demo or application CSS.

## Testing

Testing is split by responsibility. Do not force browser behaviour into Happy
DOM or use a full browser for assertions that are clearer in rendered HTML.

### Runtime unit tests

Location:

```text
tests/unit/<primitive>.test.ts
```

Command:

```sh
pnpm test:runtime
pnpm test:watch:runtime
```

Use these for:

- public DOM properties and methods;
- state transitions;
- native and custom events;
- cancelled events;
- mutation and dynamic insertion;
- reconnection and cleanup;
- form reset and validation coordination;
- authored attribute/style snapshot and restoration;
- development runtime warnings;
- keyboard logic that does not require a real layout engine.

Test behaviour through public elements and events. Avoid asserting private
fields or function call order.

### Astro render tests

Fixtures:

```text
tests/fixtures/<primitive>/*.astro
```

Tests:

```text
tests/unit/<primitive>.astro.test.ts
```

Commands:

```sh
pnpm test:astro
pnpm test:watch:astro
```

Use Astro’s container:

```ts
import { experimental_AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import Default from "../fixtures/example/Default.astro";
import { findOpeningTag } from "./helpers/astro";

describe("Example markup", () => {
  let container: Awaited<ReturnType<typeof experimental_AstroContainer.create>>;

  beforeAll(async () => {
    container = await experimental_AstroContainer.create();
  });

  it("renders initial semantics", async () => {
    const html = await container.renderToString(Default);
    const root = findOpeningTag(html, "ormo-example", "data-ormo-example-root");

    expect(root).toContain('data-state="closed"');
  });
});
```

Use render tests for:

- default native elements;
- server-rendered state;
- forwarded attributes;
- initial IDs and relationships;
- conditional runtime loading;
- native/no-JavaScript markup;
- SSR warnings that occur during component rendering.

The shared `findOpeningTag` helper removes repeated parsing without hiding the
rendered output.

### SSR-context tests

Location:

```text
tests/unit/<primitive>-ssr-context.test.ts
```

Test nested scopes, concurrent renders, and absence of context after the render
finishes. These run in the runtime Vitest suite because the context module is
ordinary TypeScript.

### Behaviour CSS tests

`tests/unit/behaviour-css.test.ts` checks complete public placement matrices and
other mechanically verifiable behaviour rules. Prefer a compact data matrix to
twelve nearly identical tests.

Placement primitives must cover:

- four sides;
- start, centre, and end alignment;
- LTR and RTL intent;
- CSS-anchor and Floating UI mappings;
- cleanup of resolved placement attributes and inline styles.

### Browser tests

Public fixture route:

```text
ormo.docs/src/pages/test-fixtures/browser/<primitive>.astro
```

Test:

```text
tests/browser/<primitive>.spec.ts
```

Commands:

```sh
pnpm test:browser:chromium
pnpm test:browser
```

Playwright tests the built docs site, so the public demos and actual package
imports are part of the integration. Use browser tests for:

- real focus movement and Tab order;
- native dialog and popover behaviour;
- pointer interactions;
- form submission and constraint validation;
- computed layout, contrast, reflow, and viewport behaviour;
- reduced-motion media queries;
- no-JavaScript fallbacks;
- automated accessibility checks.

Browser specs start from a stable `data-<primitive>-demo` wrapper rather than
depending on documentation layout or heading text.

Do not use fixed sleeps. Wait for a user-visible state, DOM property, event, or
attribute.

### Automated accessibility

Use the shared helper:

```ts
import { expectNoAxeViolations } from "./helpers/axe";

await expectNoAxeViolations(page);
```

It runs WCAG A/AA tags through WCAG 2.2 and requires zero violations. For
disclosure primitives, test closed and open states.

axe does not replace:

- complete keyboard testing;
- focus-order review;
- screen-reader testing;
- zoom, reflow, text-spacing, contrast, and target-size review;
- checking content quality and author responsibilities.

Follow `tests/browser/MANUAL_ACCESSIBILITY.md` for the manual pass.

### Diagnostics tests

Diagnostic ownership is:

- SSR warnings: Astro render tests beside the component;
- runtime warnings: runtime unit tests beside the owning controller;
- dev-toolbar diagnostics: scanner-rule tests and toolbar integration tests.

Warnings must identify the primitive, describe the authoring error, and suggest
the correction. Do not warn for valid alternative semantics.

### Test isolation

- Restore mocks after every test.
- Restore fake timers.
- Remove appended DOM.
- Delete global runtime registration hooks used by floating-position tests.
- Make external browser capabilities deterministic. For example, mock
  `navigator.clipboard.writeText` instead of assuming a browser denies it.
- Avoid shared mutable SSR context.
- Prefer assertions that eventually observe the contract over arbitrary delay.

## Validation and CI

Canonical commands:

| Command                 | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `pnpm format`           | Write Prettier formatting                          |
| `pnpm format:check`     | Check formatting                                   |
| `pnpm lint`             | Lint library and scripts                           |
| `pnpm check`            | Astro/TypeScript diagnostics                       |
| `pnpm check:contracts`  | Verify primitive delivery surfaces                 |
| `pnpm test:runtime`     | Runtime and internal unit tests                    |
| `pnpm test:astro`       | Astro render tests                                 |
| `pnpm validate:library` | Contract, format, lint, types and both unit suites |
| `pnpm validate:docs`    | Docs format, lint, types and static build          |
| `pnpm validate`         | Complete fast local suite                          |
| `pnpm validate:full`    | `validate` plus Chromium browser tests             |
| `pnpm test:browser`     | Build docs and run all configured browsers         |

CI runs:

- `pnpm validate`;
- Chromium on pull requests;
- Chromium, Firefox, and WebKit on `main` and the weekly schedule;
- failure artefact and Playwright trace upload.

The docs build produced by validation is reused for browser tests in CI.

## Documentation site

Start the site:

```sh
pnpm docs:dev
```

Build it:

```sh
pnpm docs:build
```

Public component pages live at:

```text
ormo.docs/src/pages/docs/components/<primitive>.mdx
```

The page status displayed in navigation comes from
`primitive-contracts.json`. Navigation order is hand-authored in
`ormo.docs/src/layouts/layout.astro`.

### Documentation page order

Use this order, deleting sections that genuinely do not apply:

1. frontmatter and imports;
2. opening default demo;
3. Anatomy;
4. focused Examples;
5. API reference;
6. JavaScript API and events;
7. Accessibility and keyboard behaviour;
8. Styling;
9. Runtime.

Start from `docs/component-documentation-template.mdx`. Accordion is the
reference for a multipart page; Input is a useful single-component reference.

### Documentation template

```mdx
---
layout: ../../../layouts/MdxDocLayout.astro
title: "Example"
description: "A concise description of what the primitive enables."
---

import ExampleDemo from "../../../components/demos/Example/ExampleDemo.astro";
import exampleDemoCode from "../../../components/demos/Example/ExampleDemo.astro?raw";
import exampleDemoCss from "../../../components/demos/Example/index.css?raw";
import CodeBlock from "../../../components/docs/CodeBlock/CodeBlock.astro";
import DemoBlock from "../../../components/docs/DemoBlock/DemoBlock.astro";
import PropsTable from "../../../components/docs/PropsTable/PropsTable.astro";

<DemoBlock
  files={[
    { filename: "Example.astro", code: exampleDemoCode },
    { filename: "index.css", code: exampleDemoCss },
  ]}
>
  <ExampleDemo />
</DemoBlock>

## Anatomy

<CodeBlock
  lang="astro"
  code={`---
import * as Example from "@ormo/primitives/example";
---

<Example.Root>
  <Example.Trigger>Open example</Example.Trigger>
  <Example.Content>Meaningful content</Example.Content>
</Example.Root>`}
/>

## API reference

All parts forward the relevant native HTML attributes unless noted otherwise.

## Accessibility

State the native or WAI-ARIA pattern, naming responsibilities, generated
relationships, focus behaviour, and keyboard commands.

## Styling

Document public state attributes and custom properties. Distinguish these from
internal `data-ormo-*` part hooks.

## Runtime

Summarise shipped JavaScript and what remains functional before or without it.
```

### Editorial rules

- Use British English.
- Use curly apostrophes in prose.
- Use the lowercase conceptual noun: “the dialog”.
- Use exact identifiers in backticks: `Dialog.Root`.
- Put physical keys in `<kbd>` elements.
- Explain why and when to use an option, not only its type.
- State the native element each part renders.
- Do not duplicate the entire native attribute API.
- Keep Accessibility concise and actionable.
- Combine browser properties, methods, and events into one coherent section.
- Do not add a per-component Installation section.
- Do not repeat shared dev-toolbar instructions on every page.
- Remove template comments, unused imports, and irrelevant optional sections.

## Demo components

Demos are both documentation and executable integration fixtures. They must
teach safe production usage.

### Folder shape

```text
ormo.docs/src/components/demos/Example/
├── ExampleDemo.astro
├── ExampleDisabledDemo.astro
├── ExamplePlacementDemo.astro
└── index.css
```

Nested folders are acceptable when a primitive has many focused examples.
Keep naming consistent within one primitive.

### Default demo template

```astro
---
import * as Example from "@ormo/primitives/example";
import "./index.css";
---

<Example.Root class="example">
  <Example.Trigger class="example__trigger"> Open example </Example.Trigger>
  <Example.Content class="example__content">
    <h2>Example title</h2>
    <p>Meaningful example content.</p>
  </Example.Content>
</Example.Root>
```

### Demo CSS template

```css
.example__trigger {
  min-block-size: 2.75rem;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-2);
  padding-inline: var(--space-3);
  color: var(--content-default);
  background: var(--surface-base);
}

.example__trigger:focus-visible {
  outline: var(--focus-width) solid var(--focus-default);
  outline-offset: var(--focus-offset);
}

.example__content {
  max-inline-size: min(24rem, calc(100vw - 2rem));
  color: var(--content-default);
  background: var(--surface-base);
}

@media (prefers-reduced-motion: no-preference) {
  .example__content {
    transition:
      opacity 120ms ease,
      transform 120ms ease;
  }
}
```

Use documentation tokens and utilities. Do not add fixture-wide CSS that hides
component-specific accessibility defects.

### Demo rules

- Begin with the safest minimal default.
- Each later demo teaches one decision.
- Use realistic labels and content.
- Include relevant disabled, invalid, controlled, no-JavaScript, placement, or
  composition states.
- Hide decorative icons from assistive technology.
- Use visible focus styles.
- Meet contrast and target-size requirements.
- Reflow at narrow widths and increased text size.
- Respect reduced motion.
- Keep styling in CSS, not in the primitive.
- Import every stylesheet used by the live demo.
- Only show CSS source when it teaches something new.
- Never publish a semantically invalid pattern merely because it is visually
  common.

### Browser fixture template

```astro
---
import ExampleDemo from "../../../components/demos/Example/ExampleDemo.astro";
import BrowserFixtureLayout from "../../../layouts/BrowserFixtureLayout.astro";
---

<BrowserFixtureLayout title="Example">
  <div data-example-demo="default">
    <ExampleDemo />
  </div>
</BrowserFixtureLayout>
```

Include focused public demos needed by browser tests. If a documentation demo
is intentionally omitted, leave a short comment explaining which equivalent
contract is covered elsewhere.

## Adding a primitive

Use the scaffold for repetitive surfaces:

```sh
pnpm scaffold:primitive example
```

It asks for:

- display label;
- namespace or named root export;
- whether to create a patch changeset.

It creates a static starting surface and deliberately does not invent runtime
behaviour.

Then work through this sequence.

### 1. Define the interaction contract

- Identify the user need.
- Find the closest native element/API.
- Research the established accessibility pattern.
- Define server HTML, naming, relationships, keyboard behaviour, state, focus,
  form behaviour, and no-JavaScript behaviour.
- Decide which runtime model is justified.
- Challenge every prop and part.

### 2. Build the server-rendered API

- Implement the smallest meaningful parts.
- Forward appropriate native attributes.
- Add SSR context only if descendants need root state.
- Export folder types and parts.
- Add package and root exports.
- Complete the manifest entry.

### 3. Add runtime behaviour

- Reconcile existing markup; do not replace it gratuitously.
- Add typed DOM properties, methods, and events.
- Handle dynamic content only when it is part of the public contract.
- Snapshot and restore authored state.
- Clean every listener, observer, timer, positioner, and global registration.
- Add diagnostics for authoring errors the type system cannot prevent.

### 4. Add tests with the implementation

- Runtime unit suite.
- Astro render fixture and suite.
- SSR-context isolation suite, if applicable.
- Browser fixture and Playwright suite.
- Closed/open axe checks for disclosures.
- No-JavaScript coverage for native or server-rendered paths.
- Manual accessibility review.

### 5. Build demos and documentation

- Default demo and shared CSS.
- Focused demos for important decisions.
- Complete MDX page from the template.
- API, browser API/events, accessibility, styling, and runtime documentation.
- Stable browser fixture route.

### 6. Finish delivery

- Add a changeset for consumer-visible behaviour.
- Run `pnpm check:contracts`.
- Run `pnpm validate`.
- Run `pnpm validate:full` for browser-facing changes.
- Review the built public documentation, not only source.

## Changing an existing primitive

Before editing, trace the complete surface:

```text
component parts
  → public types and exports
  → SSR context
  → runtime and behaviour CSS
  → unit/render/browser tests
  → demos and MDX
  → primitive manifest/status
  → changeset
```

Questions for review:

- Does the server output remain useful?
- Is the change native-first?
- Is it a public API change or private configuration?
- Are authored attributes/styles preserved?
- Do reconnection and Astro navigation still work?
- Does the no-JavaScript path regress?
- Are events ordered and cancellable as documented?
- Are docs examples still safe?
- Does the change require a changeset?

## Accessibility definition of done

A primitive is not complete because axe passes. Before beta status:

- semantics and names are correct before interaction;
- generated IDs and relationships are stable and scoped;
- keyboard behaviour matches native or established patterns;
- normal Tab order is preserved;
- focus moves and restores predictably;
- disabled, invalid, required, selected, expanded, and busy states are exposed;
- form participation works where relevant;
- zoom, reflow, text spacing, contrast, target size, and reduced motion have
  been reviewed;
- complex widgets receive representative screen-reader testing;
- author responsibilities and native alternatives are documented.

## Development diagnostics

Diagnostics exist to catch composition errors that cannot be prevented by
types. They are development-only and must not be required for correct runtime
behaviour.

Put:

- component render warnings near the Astro component;
- live DOM warnings near the owning runtime;
- cross-page inspection rules in `src/dev-toolbar/`.

Keep scanner modules focused. The toolbar UI should consume diagnostic results
rather than contain every rule inline.

## Changesets and releases

Add a changeset for consumer-visible:

- props, parts, types, exports, DOM properties or methods;
- events or event detail;
- rendered semantics;
- keyboard, focus, form, or state behaviour;
- public styling hooks or custom properties;
- behaviour-critical CSS;
- status changes.

Usually no changeset is needed for tests, internal refactors, CI-only changes,
or documentation corrections that do not change the public contract.

Create one with:

```sh
pnpm changeset
```

Write the note from the consumer’s perspective. State what changed, not which
internal files were edited.

## Common pitfalls

- Adding a custom element when static or native HTML is sufficient.
- Treating client JavaScript as the source of initial semantics.
- Exposing private `data-ormo-*` configuration as public styling API.
- Overwriting authored ARIA, IDs, disabled state, `tabindex`, or inline styles.
- Cleaning listeners but forgetting observers, timers, floating positioners,
  or runtime-authored attributes.
- Using global mutable state during SSR.
- Testing implementation details instead of public behaviour.
- Relying on fixed Playwright delays.
- Assuming browser permissions behave identically across engines.
- Running axe only while a disclosure is closed.
- Showing source CSS that the live demo does not import.
- Applying broad fixture CSS that masks target-size or contrast failures.
- Documenting a prop without explaining when it should be used.
- Adding a component page but forgetting the manifest, browser fixture,
  package export, or changeset.

## Review checklist

### API and composition

- [ ] Native-first design and justified runtime model.
- [ ] Minimal public parts and props.
- [ ] Types, component index, package subpath, and root export agree.
- [ ] Manifest entry is current.
- [ ] Public hooks are documented; private configuration remains private.

### Runtime

- [ ] Idempotent connection and safe reconnection.
- [ ] Authored state is preserved and restored.
- [ ] Observers/listeners/timers/positioners clean up.
- [ ] DOM API and events are typed and documented.
- [ ] Native and no-JavaScript paths remain useful.

### Testing

- [ ] Runtime behaviour tests.
- [ ] Astro render tests.
- [ ] SSR isolation tests where context exists.
- [ ] Browser interaction and form/focus tests.
- [ ] Accessibility checks in all meaningful states.
- [ ] Manual keyboard and representative assistive-technology review.

### Documentation

- [ ] Default and focused demos are accessible.
- [ ] Opening demo displays the real imported CSS.
- [ ] Anatomy is valid and minimal.
- [ ] Every public API is covered.
- [ ] Accessibility, styling, and runtime sections are accurate.
- [ ] Browser fixture is stable and focused.

### Delivery

- [ ] Changeset added when consumer-visible.
- [ ] `pnpm check:contracts` passes.
- [ ] `pnpm validate` passes.
- [ ] Browser suite run for browser-facing work.
- [ ] Built documentation reviewed.

## Source-of-truth index

Use these files when this guide needs verification:

- principles: `docs/guiding-principles.md`;
- full component workflow: `docs/creating-a-new-component.md`;
- page skeleton: `docs/component-documentation-template.mdx`;
- primitive inventory: `primitive-contracts.json`;
- contract policy: `PRIMITIVE_CONTRACT.md`;
- canonical commands and exports: `package.json`;
- CI cadence: `.github/workflows/ci.yml`;
- runtime test configuration: `vitest.config.ts`;
- render test configuration: `vitest.astro.config.ts`;
- browser configuration: `playwright.config.ts`;
- manual accessibility pass: `tests/browser/MANUAL_ACCESSIBILITY.md`;
- public navigation/status integration:
  `ormo.docs/src/layouts/layout.astro`.

## Repository note

The root `.gitignore` currently ignores `docs/`. This file can be used locally,
but a new file under `docs/` will not be included by a normal `git add`.
Force-add it with `git add -f docs/codebase-bible.md`, or revise the ignore rule
if this guide should be maintained in version control.
