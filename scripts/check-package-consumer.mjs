import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
const root = process.cwd();
const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const astroPackageJson = JSON.parse(
  await readFile(
    path.join(root, "node_modules", "astro", "package.json"),
    "utf8",
  ),
);
const floatingPackageJson = JSON.parse(
  await readFile(
    path.join(root, "node_modules", "@floating-ui", "dom", "package.json"),
    "utf8",
  ),
);
const temporaryDirectory = await mkdtemp(
  path.join(os.tmpdir(), "ormo-package-consumer-"),
);

async function run(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${signal ?? code}`));
    });
  });
}

try {
  await run("pnpm", ["pack", "--pack-destination", temporaryDirectory], root);
  const tarball = path.join(
    temporaryDirectory,
    `ormo-primitives-${packageJson.version}.tgz`,
  );

  await mkdir(path.join(temporaryDirectory, "src", "pages"), {
    recursive: true,
  });
  const packageDirectory = path.join(
    temporaryDirectory,
    "node_modules",
    "@ormo",
    "primitives",
  );
  await mkdir(packageDirectory, { recursive: true });
  await run(
    "tar",
    ["-xzf", tarball, "-C", packageDirectory, "--strip-components=1"],
    root,
  );
  await mkdir(path.join(temporaryDirectory, "node_modules", "@floating-ui"), {
    recursive: true,
  });
  await mkdir(path.join(temporaryDirectory, "node_modules", "@astrojs"), {
    recursive: true,
  });
  await symlink(
    path.join(root, "node_modules", "astro"),
    path.join(temporaryDirectory, "node_modules", "astro"),
    "junction",
  );
  await symlink(
    path.join(root, "node_modules", "@floating-ui", "dom"),
    path.join(temporaryDirectory, "node_modules", "@floating-ui", "dom"),
    "junction",
  );
  await symlink(
    path.join(root, "node_modules", "entities"),
    path.join(temporaryDirectory, "node_modules", "entities"),
    "junction",
  );
  await symlink(
    path.join(root, "node_modules", "@astrojs", "check"),
    path.join(temporaryDirectory, "node_modules", "@astrojs", "check"),
    "junction",
  );
  await symlink(
    path.join(root, "node_modules", "typescript"),
    path.join(temporaryDirectory, "node_modules", "typescript"),
    "junction",
  );
  await writeFile(
    path.join(temporaryDirectory, "package.json"),
    `${JSON.stringify(
      {
        name: "ormo-package-consumer",
        private: true,
        type: "module",
        dependencies: {
          "@floating-ui/dom": floatingPackageJson.version,
          "@ormo/primitives": `file:${tarball}`,
          astro: astroPackageJson.version,
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(temporaryDirectory, "tsconfig.json"),
    `${JSON.stringify({ extends: "astro/tsconfigs/strictest" }, null, 2)}\n`,
  );
  await writeFile(
    path.join(temporaryDirectory, "src", "imports.ts"),
    `import type * as Ormo from "@ormo/primitives";
import type * as Accordion from "@ormo/primitives/accordion";
import type * as AlertDialog from "@ormo/primitives/alert-dialog";
import type * as Autocomplete from "@ormo/primitives/autocomplete";
import type * as AutocompleteFloating from "@ormo/primitives/autocomplete/floating";
import type * as Avatar from "@ormo/primitives/avatar";
import type * as Breadcrumbs from "@ormo/primitives/breadcrumbs";
import type * as Button from "@ormo/primitives/button";
import type * as Checkbox from "@ormo/primitives/checkbox";
import type * as CheckboxGroup from "@ormo/primitives/checkbox/group";
import type * as Combobox from "@ormo/primitives/combobox";
import type * as ComboboxFloating from "@ormo/primitives/combobox/floating";
import type * as DevToolbar from "@ormo/primitives/dev-toolbar";
import type * as Dialog from "@ormo/primitives/dialog";
import type * as Field from "@ormo/primitives/field";
import type * as Fieldset from "@ormo/primitives/fieldset";
import type * as Input from "@ormo/primitives/input";
import type * as PasswordField from "@ormo/primitives/password-field";
import type * as Popover from "@ormo/primitives/popover";
import type * as PopoverFloating from "@ormo/primitives/popover/floating";
import type * as Radio from "@ormo/primitives/radio";
import type * as RadioGroup from "@ormo/primitives/radio/group";
import type * as Select from "@ormo/primitives/select";
import type * as SelectFloating from "@ormo/primitives/select/floating";
import type * as Separator from "@ormo/primitives/separator";
import type * as Switch from "@ormo/primitives/switch";
import type * as Tabs from "@ormo/primitives/tabs";
import type * as Tooltip from "@ormo/primitives/tooltip";
import type * as TooltipFloating from "@ormo/primitives/tooltip/floating";

export type PublicModules = [
  typeof Ormo, typeof Accordion, typeof AlertDialog, typeof Autocomplete,
  typeof AutocompleteFloating, typeof Avatar, typeof Breadcrumbs, typeof Button,
  typeof Checkbox, typeof CheckboxGroup, typeof Combobox,
  typeof ComboboxFloating, typeof DevToolbar, typeof Dialog, typeof Field,
  typeof Fieldset, typeof Input, typeof PasswordField, typeof Popover,
  typeof PopoverFloating, typeof Radio, typeof RadioGroup, typeof Select,
  typeof SelectFloating, typeof Separator, typeof Switch, typeof Tabs,
  typeof Tooltip, typeof TooltipFloating,
];
`,
  );
  await writeFile(
    path.join(temporaryDirectory, "src", "pages", "index.astro"),
    `---
import { Separator } from "@ormo/primitives/separator";
import type { PublicModules } from "../imports";

const publicModuleCount: PublicModules["length"] = 29;
---

<main data-module-count={publicModuleCount}>
  <Separator />
</main>
`,
  );

  const astroExecutable = path.join(root, "node_modules", ".bin", "astro");
  await run(astroExecutable, ["check"], temporaryDirectory);
  await run(astroExecutable, ["build"], temporaryDirectory);
  process.stdout.write("Packed package consumer checks passed.\n");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
