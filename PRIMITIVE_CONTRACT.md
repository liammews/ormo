# Primitive contract manifest

`primitive-contracts.json` is the checked source of truth for the repository
surface every primitive must maintain. It records the component parts, maturity
status, runtime model, SSR context, behaviour CSS, runtime modules, and
representative unit and render tests. Its top-level `contract` defines the
public, private, delivery, diagnostic, test and changeset expectations shared
by every entry.

The manifest deliberately does not control documentation navigation order.
Navigation is an editorial decision; the documentation layout joins its
hand-authored order to the manifest by primitive ID and derives labels and
statuses from it.

Run `pnpm check:contracts` after adding or restructuring a primitive. The check
requires each entry to have:

- a package subpath export;
- component index, types, and listed part files;
- a documentation page and browser fixture;
- a browser specification; and
- every listed runtime and test file.

When adding a primitive, add its entry at the same time as its first public
export. Keep `status` at `dev` until its API and documentation are ready for
external testing. Status changes are product decisions and should be reviewed
like public API changes.
