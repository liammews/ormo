import mdx from "@astrojs/mdx";
import { rehypeHeadingIds, unified } from "@astrojs/markdown-remark";
import { defineConfig } from "astro/config";
import ormoDevToolbar from "../src/dev-toolbar/integration.ts";
import rehypeHeadingLinks from "./src/plugins/rehype-heading-links.mjs";

export default defineConfig({
  integrations: [mdx(), ormoDevToolbar()],
  markdown: {
    processor: unified({
      rehypePlugins: [rehypeHeadingIds, rehypeHeadingLinks],
    }),
  },
});
