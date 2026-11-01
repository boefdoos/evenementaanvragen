# evenementaanvragen.be

Dienst die evenementaanvragen voor organisatoren in Vlaanderen opmaakt en indient.

## Structuur

- `website/` — publieke website
  - `index.html` — startpagina met termijncheck (aftelklok naar de indiendeadline)
  - `rekenlogica.js` — berekening van de indiendeadline per gemeente (zelfde logica als de Indienwijzer)
  - `regels.json` — termijnregels per gemeente (112 gemeenten)

Nog te maken: `aanvraag.html` (intake), `voorwaarden.html`, `privacy.html`.

## Lokaal bekijken

`regels.json` wordt met `fetch` geladen, dus de pagina moet via een webserver draaien:

```
cd website
python3 -m http.server 8000
```

Open daarna http://localhost:8000.
