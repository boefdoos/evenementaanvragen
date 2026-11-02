import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";


export default defineConfig({
  site: "https://evenementaanvragen.be",
  // index.astro -> /, aanvraag.astro -> /aanvraag.html, [gemeente]/index.astro -> /<slug>/
  // Cloudflare serveert /aanvraag.html als /aanvraag (en stuurt .html door), dus links en canonieke URL's zijn zonder .html.
  build: { format: "preserve" },
  integrations: [sitemap({
    // Niet indexeren: bedankpagina na betaling en de plantekenaar (werkt enkel met een dossier).
    filter: (p) => !/\/(betaald|plan)(\.html|\/)?$/.test(p),
    // De sitemap moet dezelfde URL's tonen als de canonieke links: losse pagina's zonder .html en zonder slash, mappen met een slash.
    serialize(item) {
      const u = new URL(item.url);
      const pad = u.pathname.replace(/\/$/, "").replace(/\.html$/, "");
      if (pad) u.pathname = ["/aanvraag", "/privacy", "/voorwaarden"].includes(pad) ? pad : pad + "/";
      item.url = u.href;
      return item;
    },
  })],
});
