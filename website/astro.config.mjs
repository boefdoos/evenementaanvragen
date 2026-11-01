import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://evenementaanvragen.be",
  // index.astro -> /, aanvraag.astro -> /aanvraag.html, [gemeente]/index.astro -> /<slug>/
  build: { format: "preserve" },
  integrations: [sitemap()],
});
