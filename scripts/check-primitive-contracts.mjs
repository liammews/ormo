import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const manifest = JSON.parse(
  await readFile(path.join(root, "primitive-contracts.json"), "utf8"),
);
const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const failures = [];
const ids = new Set();

async function requireFile(file, context) {
  try {
    await access(path.join(root, file));
  } catch {
    failures.push(`${context}: missing ${file}`);
  }
}

for (const primitive of manifest.primitives) {
  const {
    id,
    label,
    status,
    runtimeModel,
    parts,
    runtime,
    ssrContext,
    behaviourCss,
    tests,
  } = primitive;

  if (ids.has(id)) failures.push(`${id}: duplicate primitive id`);
  ids.add(id);
  if (!label) failures.push(`${id}: label is required`);
  if (!manifest.statuses.includes(status)) {
    failures.push(`${id}: unknown status "${status}"`);
  }
  if (!manifest.contract.runtimeModels[runtimeModel]) {
    failures.push(`${id}: unknown runtime model "${runtimeModel}"`);
  }
  if (!packageJson.exports[`./${id}`]) {
    failures.push(`${id}: package.json is missing the "./${id}" export`);
  }

  await requireFile(`src/components/${id}/index.ts`, id);
  await requireFile(`src/components/${id}/types.ts`, id);
  await requireFile(`ormo.docs/src/pages/docs/components/${id}.mdx`, id);
  await requireFile(
    `ormo.docs/src/pages/test-fixtures/browser/${id}.astro`,
    id,
  );
  await requireFile(`tests/browser/${id}.spec.ts`, id);

  for (const part of parts) {
    await requireFile(`src/components/${id}/${part}.astro`, id);
  }
  for (const file of runtime) await requireFile(file, id);
  if (ssrContext) await requireFile(ssrContext, id);
  for (const file of behaviourCss) await requireFile(file, id);
  for (const file of tests) await requireFile(file, id);
}

if (failures.length) {
  process.stderr.write("Primitive contract checks failed:\n");
  process.stderr.write(
    `${failures.map((failure) => `- ${failure}`).join("\n")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Primitive contract checks passed for ${manifest.primitives.length} primitives.\n`,
  );
}
