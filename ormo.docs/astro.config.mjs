import mdx from "@astrojs/mdx";
import { rehypeHeadingIds, unified } from "@astrojs/markdown-remark";
import { defineConfig } from "astro/config";
import rehypeHeadingLinks from "./src/plugins/rehype-heading-links.mjs";

export default defineConfig({
  integrations: [mdx()],
  markdown: {
    processor: unified({
      rehypePlugins: [rehypeHeadingIds, rehypeHeadingLinks],
    }),
  },
});
