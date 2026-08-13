import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { gzipSync } from "node:zlib";

import { build } from "esbuild";

const root = process.cwd();
const manifest = JSON.parse(
  await readFile(path.join(root, "primitive-contracts.json"), "utf8"),
);
const budgets = JSON.parse(
  await readFile(path.join(root, "primitive-size-budgets.json"), "utf8"),
);
const measurements = {};
const failures = [];

for (const primitive of manifest.primitives) {
  if (primitive.runtime.length === 0) {
    measurements[primitive.id] = 0;
    continue;
  }

  const contents = primitive.runtime
    .map((file) => `import ${JSON.stringify(`./${file}`)};`)
    .join("\n");
  const result = await build({
    absWorkingDir: root,
    bundle: true,
    format: "esm",
    minify: true,
    outdir: "size-output",
    platform: "browser",
    stdin: {
      contents,
      loader: "ts",
      resolveDir: root,
      sourcefile: `${primitive.id}-size-entry.ts`,
    },
    target: ["es2022"],
    write: false,
  });
  const bytes = result.outputFiles.reduce(
    (total, file) => total + gzipSync(file.contents).byteLength,
    0,
  );
  measurements[primitive.id] = bytes;

  const budget = budgets[primitive.id];
  if (!Number.isInteger(budget)) {
    failures.push(`${primitive.id}: missing integer byte budget`);
  } else if (bytes > budget) {
    failures.push(`${primitive.id}: ${bytes} B exceeds ${budget} B budget`);
  }
}

const unknownBudgets = Object.keys(budgets).filter(
  (id) => !manifest.primitives.some((primitive) => primitive.id === id),
);
for (const id of unknownBudgets)
  failures.push(`${id}: unknown primitive budget`);

for (const [id, bytes] of Object.entries(measurements)) {
  process.stdout.write(
    `${id.padEnd(16)} ${String(bytes).padStart(6)} B gzip\n`,
  );
}

if (failures.length > 0) {
  process.stderr.write("Primitive size checks failed:\n");
  process.stderr.write(
    `${failures.map((failure) => `- ${failure}`).join("\n")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write("Primitive size checks passed.\n");
}
