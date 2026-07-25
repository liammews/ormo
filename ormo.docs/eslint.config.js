import { fileURLToPath, URL } from "node:url";

import eslint from "@eslint/js";
import astro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

const tsconfigRootDir = fileURLToPath(new URL(".", import.meta.url));

export default tseslint.config(
  {
    ignores: [".astro/**", "dist/**", "node_modules/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir,
      },
    },
  },
);
