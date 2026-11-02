import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Pagina's in src/pages die als <naam>.html gebouwd worden (build.format "preserve").
const LOSSE_PAGINAS = new Set(["aanvraag", "privacy", "voorwaarden", "plan", "betaald"]);

export default defineConfig({
  site: "https://evenementaanvragen.be",
  // index.astro -> /, aanvraag.astro -> /aanvraag.html, [gemeente]/index.astro -> /<slug>/
  build: { format: "preserve" },
  integrations: [sitemap({
    // Niet indexeren: bedankpagina na betaling en de plantekenaar (werkt enkel met een dossier).
    filter: (p) => !/\/(betaald|plan)(\.html|\/)?$/.test(p),
    // De sitemap moet dezelfde URL's tonen als de canonieke links: losse pagina's met .html, mappen met een slash.
    serialize(item) {
      const u = new URL(item.url);
      const pad = u.pathname.replace(/\/$/, "");
      if (pad) u.pathname = LOSSE_PAGINAS.has(pad.slice(1)) ? pad + ".html" : pad + "/";
      item.url = u.href;
      return item;
    },
  })],
});
