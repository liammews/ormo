import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.astro.test.ts"],
  },
});
