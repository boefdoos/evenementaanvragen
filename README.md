# evenementaanvragen.be

Dienst die evenementaanvragen voor organisatoren in Vlaanderen opmaakt en indient.

## Structuur

- `website/` — publieke website
  - `index.html` — startpagina met termijncheck (aftelklok naar de indiendeadline)
  - `rekenlogica.js` — berekening van de indiendeadline per gemeente (zelfde logica als de Indienwijzer)
  - `regels.json` — termijnregels per gemeente (112 gemeenten)
  - `aanvraag.html` — intakeformulier (stuurt naar de Apps Script-webapp); neemt `?gemeente=` en `?datum=` over van de termijncheck

## Termijncheck

Startpagina en intake rekenen met dezelfde logica (`rekenlogica.js` + `regels.json`).
Valt de deadline van een gemeente met gekende termijn vóór vandaag + `VERWERKTIJD`
werkdagen (nu 2, in `index.html` en `aanvraag.html`), dan toont de startpagina "te laat"
en kan de intake niet doorgestuurd worden. Bij gemeenten met een onzekere of geschatte
termijn blijft doorsturen mogelijk, met een waarschuwing.

Nog te maken: `voorwaarden.html`, `privacy.html`.

## Lokaal bekijken

`regels.json` wordt met `fetch` geladen, dus de pagina moet via een webserver draaien:

```
cd website
python3 -m http.server 8000
```

Open daarna http://localhost:8000.
