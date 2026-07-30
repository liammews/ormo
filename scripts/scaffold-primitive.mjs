import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";

const root = process.cwd();
const suppliedId = process.argv[2];

if (suppliedId === "--help" || suppliedId === "-h") {
  process.stdout.write(`Usage: pnpm scaffold:primitive [id]

Creates the contract-defined static primitive surface and prompts for its root
export and changeset. Runtime behaviour is never generated.
`);
  process.exit(0);
}

const prompts = createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function ask(question, fallback) {
  const answer = (await prompts.question(`${question} (${fallback}) `)).trim();
  return answer || fallback;
}

const id = suppliedId ?? (await ask("Primitive ID", "example"));
if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) {
  prompts.close();
  throw new Error(`Invalid primitive ID "${id}"`);
}

const defaultLabel = id
  .split("-")
  .map((part) => part[0].toUpperCase() + part.slice(1))
  .join(" ");
const label = await ask("Display label", defaultLabel);
const exportMode = await ask("Root export: namespace or named", "namespace");
if (!["namespace", "named"].includes(exportMode)) {
  prompts.close();
  throw new Error('Root export must be "namespace" or "named"');
}
const changesetAnswer = await ask("Create a patch changeset: yes or no", "yes");
if (!["yes", "no"].includes(changesetAnswer)) {
  prompts.close();
  throw new Error('Changeset answer must be "yes" or "no"');
}
prompts.close();

const pascalName = label.replace(/[^a-zA-Z0-9]+(.)/g, (_, character) =>
  character.toUpperCase(),
);
const componentDirectory = `src/components/${id}`;

try {
  await access(path.join(root, componentDirectory));
  throw new Error(`Primitive directory already exists: ${componentDirectory}`);
} catch (error) {
  if (error instanceof Error && !("code" in error)) throw error;
  if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
    throw error;
  }
}

const files = new Map([
  [
    `${componentDirectory}/types.ts`,
    `import type { HTMLAttributes } from "astro/types";

export type RootProps = HTMLAttributes<"div">;
`,
  ],
  [
    `${componentDirectory}/Root.astro`,
    `---
import type { RootProps } from "./types";

type Props = RootProps;
const attributes: Props = Astro.props;
---

<div {...attributes} data-ormo-${id}-root>
  <slot />
</div>
`,
  ],
  [
    `${componentDirectory}/index.ts`,
    `export { default as Root } from "./Root.astro";
export type { RootProps } from "./types";
`,
  ],
  [
    `tests/fixtures/${id}/Default.astro`,
    `---
import * as ${pascalName} from "../../../src/components/${id}";
---

<${pascalName}.Root>${label}</${pascalName}.Root>
`,
  ],
  [
    `tests/unit/${id}.astro.test.ts`,
    `import { experimental_AstroContainer } from "astro/container";
import { expect, it } from "vitest";

import Default from "../fixtures/${id}/Default.astro";

it("renders ${label} semantics", async () => {
  const container = await experimental_AstroContainer.create();
  const html = await container.renderToString(Default);
  expect(html).toContain("data-ormo-${id}-root");
});
`,
  ],
  [
    `ormo.docs/src/components/demos/${pascalName}/${pascalName}Demo.astro`,
    `---
import * as ${pascalName} from "@ormo/primitives/${id}";
---

<${pascalName}.Root>${label}</${pascalName}.Root>
`,
  ],
  [
    `ormo.docs/src/pages/docs/components/${id}.mdx`,
    `---
layout: ../../../layouts/MdxDocLayout.astro
title: ${label}
description: ${label} primitive.
---

import DemoBlock from "../../../components/docs/DemoBlock/DemoBlock.astro";
import ${pascalName}Demo from "../../../components/demos/${pascalName}/${pascalName}Demo.astro";

<DemoBlock><${pascalName}Demo /></DemoBlock>

## Anatomy

Document the minimum valid structure, API, accessibility, styling and runtime contract before promoting this primitive from development status.
`,
  ],
  [
    `ormo.docs/src/pages/test-fixtures/browser/${id}.astro`,
    `---
import ${pascalName}Demo from "../../../components/demos/${pascalName}/${pascalName}Demo.astro";
import BrowserFixtureLayout from "../../../layouts/BrowserFixtureLayout.astro";
---

<BrowserFixtureLayout title="${label}">
  <${pascalName}Demo />
</BrowserFixtureLayout>
`,
  ],
  [
    `tests/browser/${id}.spec.ts`,
    `import { test } from "@playwright/test";
import { expectNoAxeViolations } from "./helpers/axe";

test("${label} demo has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/test-fixtures/browser/${id}/");
  await expectNoAxeViolations(page);
});
`,
  ],
]);

if (changesetAnswer === "yes") {
  files.set(
    `.changeset/add-${id}-primitive.md`,
    `---
"@ormo/primitives": patch
---

Add the ${label} primitive.
`,
  );
}

for (const [file, contents] of files) {
  const destination = path.join(root, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, contents, { flag: "wx" });
}

const packagePath = path.join(root, "package.json");
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
packageJson.exports[`./${id}`] = {
  types: `./${componentDirectory}/index.ts`,
  import: `./${componentDirectory}/index.ts`,
};
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

const rootIndexPath = path.join(root, "src/index.ts");
const rootExport =
  exportMode === "namespace"
    ? `export * as ${pascalName} from "./components/${id}/index";`
    : `export { Root as ${pascalName} } from "./components/${id}/index";`;
await writeFile(
  rootIndexPath,
  `${(await readFile(rootIndexPath, "utf8")).trimEnd()}\n${rootExport}\n`,
);

const manifestPath = path.join(root, "primitive-contracts.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.primitives.push({
  id,
  label,
  status: "dev",
  runtimeModel: "static",
  parts: ["Root"],
  runtime: [],
  ssrContext: null,
  behaviourCss: [],
  tests: [`tests/unit/${id}.astro.test.ts`],
});
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

process.stdout.write(
  `Created ${label}. Run pnpm format, complete its contract and documentation, then run pnpm validate.\n`,
);
