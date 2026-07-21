# Ormo guiding principles

## Purpose

Ormo is the open-source primitive layer for Astro design systems. It provides
accessible, unstyled components built on native HTML and browser APIs, adding
only the JavaScript required for dependable behaviour.

Ormo is designed to provide the behavioural foundation of a design system, but
it can be used in any Astro project. Developers can import one primitive or the
entire library and use it as they wish.

## Ethos

Ormo should feel native to Astro and native to the web. Components should be
small, understandable, adaptable, and dependable. The library owns semantics
and behaviour while consumers retain control of presentation, composition, and
application architecture.

We favour complete support for common needs over a large API filled with
features that few projects will use. Ormo should not become complex simply to
match another library's feature list.

## Principles

### Start with the web platform

Use native elements, semantics, behaviours, and browser capabilities whenever
they meet the requirements. Every abstraction should justify what it adds
beyond native HTML.

When native behaviour is insufficient, extend it without obscuring or replacing
the platform unnecessarily.

### Treat accessibility as correctness

Accessible names, roles, states, relationships, focus management, and keyboard
behaviour are part of a primitive's core functionality. They are not optional
features or work to defer until after implementation.

Follow established WCAG and ARIA Authoring Practices patterns where they apply.
Prefer native semantics over ARIA, prevent invalid combinations through the API
where practical, and provide useful development diagnostics for mistakes that
cannot be prevented.

### Ship only the JavaScript the interaction needs

Align with Astro's performance model: render native HTML by default, add client
JavaScript only when it expands necessary browser functionality, and ensure
unused behaviour is absent from the production output.

JavaScript is not a problem when it provides meaningful behaviour. Unnecessary
JavaScript and complexity are the problem.

### Own behaviour, not presentation

Ormo primitives provide no visual design. They should not prescribe colour,
spacing, typography, borders, shadows, or brand expression. A separate themed
library may provide that layer in the future.

Expose semantic structure, state attributes, CSS custom properties, and other
stable styling hooks where they are useful. Consumers must remain free to build
their own visual language.

### Build for design systems without requiring one

APIs should be suitable as the foundation of a larger design system: composable,
predictable, typed, and straightforward to wrap. The same primitives should
also remain useful when imported directly into a small Astro project.

Each component should be independently importable. Using one primitive must not
require adopting the rest of Ormo.

### Make the correct path the easiest path

Choose safe defaults, such as native elements and non-submitting buttons. Make
unusual behaviour explicit, especially when it requires Ormo to recreate native
semantics.

Allow escape hatches only when Ormo can preserve the component's behavioural
and accessibility contract. Flexibility should not make it easy to produce a
different or invalid semantic role accidentally.

### Prefer composable parts over configuration-heavy components

Split a primitive into meaningful parts when consumers need control over its
structure. Avoid presentation-oriented props and large APIs that attempt to
predict every possible design.

Composition should expose genuine structural choices, not internal machinery.

### Make state visible in the DOM

Expose useful state through semantic attributes and consistent `data-*`
attributes. This keeps styling available to ordinary CSS and makes behaviour
understandable through browser developer tools.

Do not introduce framework-specific styling callbacks when DOM state and CSS
selectors solve the same problem more simply.

### Use framework-independent DOM control where it adds value

When consumers genuinely need to inspect or change a stateful primitive after
rendering, provide an interface based on standard DOM properties, methods,
attributes, and events. It should be usable from a plain Astro script or any
island framework.

Not every component needs a browser API. Native elements should retain their
native APIs, and static primitives should not gain controllers without a real
use case.

### Be modern, but dependable

Consider emerging browser capabilities case by case. Ormo should feel current
and take advantage of broadly available platform improvements, but its core
behaviour should not depend on features that are unsupported by major browsers.

Where an enhancement is newer, confirm support, understand its failure mode,
and decide whether a fallback is required before including it.

### Prioritise needs over possibilities

Aim to provide all of the functionality most users need before pursuing the
long tail of functionality some users may use. Add features in response to a
clear interaction, accessibility, design-system, or Astro integration need.

Feature parity with another library is not a goal by itself. Complexity must be
earned.

### Keep the implementation inspectable

Rendered markup, public state, events, and runtime behaviour should be possible
to understand without knowing Ormo's internals. Avoid hidden global state and
framework-specific ownership where a direct browser model will work.

### Documentation and verification are part of the component

A primitive is not complete when its implementation compiles. It also requires
tests, accessible demos, an API reference, keyboard and accessibility guidance,
styling documentation, and a changeset for user-facing work.

## A decision filter

Before adding a component or feature, ask:

1. Is this a common, concrete need for Astro projects or design systems?
2. Can native HTML or an existing browser API already provide it?
3. What semantics and accessible behaviour must always be preserved?
4. Does it require client JavaScript, and can that JavaScript be scoped or
   omitted when unused?
5. Does the API expose behaviour without introducing presentation?
6. Can state be expressed through the DOM and ordinary CSS?
7. Does post-render control provide real value, and if so, can it use a
   framework-independent DOM interface?
8. Is any browser feature it depends on supported widely enough for the core
   experience?
9. Is this functionality broadly needed, or are we adding complexity for a
   hypothetical edge case?
10. Can we explain, demonstrate, test, and maintain the resulting behaviour?
