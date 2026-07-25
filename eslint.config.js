import { fileURLToPath, URL } from "node:url";

import eslint from "@eslint/js";
import astro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

const tsconfigRootDir = fileURLToPath(new URL(".", import.meta.url));

export default tseslint.config(
  {
    ignores: [
      ".astro/**",
      "dist/**",
      "node_modules/**",
      "ormo.docs/**",
      "playwright-report/**",
      "test-results/**",
    ],
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
  {
    files: ["src/components/**/index.ts"],
    rules: {
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": "allow-with-description",
          minimumDescriptionLength: 10,
        },
      ],
    },
  },
);
