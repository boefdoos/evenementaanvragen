# evenementaanvragen.be

Dienst die evenementaanvragen voor organisatoren in Vlaanderen opmaakt en indient.

## Structuur

`website/` is een Astro-project (statisch, gebouwd door Vercel bij elke push).

- `src/layouts/Basis.astro` — gemeenschappelijke kop, menu en voet
- `src/pages/index.astro` — startpagina met termijncheck
- `src/pages/aanvraag.astro` — intakeformulier (`/aanvraag.html`), neemt `?gemeente=`, `?type=` en `?datum=` over
- `src/pages/[gemeente]/index.astro` — één pagina per gemeente met eigen termijn (status ok of onzeker), uit `public/regels.json`
- `src/huisstijl.css`, `src/gemeentepagina.css` — stijl
- `public/regels.json` — termijnregels voor alle 285 Vlaamse gemeenten
- `public/rekenlogica.js`, `public/indienmoment.js` — berekening en oordeel (zelfde logica als de Indienwijzer)
- sitemap: automatisch (`@astrojs/sitemap`)

Nog te maken: `voorwaarden`, `privacy`.

## Lokaal bekijken

```
cd website
npm install
npm run dev      # of: npm run build && npm run preview
```
