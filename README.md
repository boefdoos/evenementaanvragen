# evenementaanvragen.be

Dienst die evenementaanvragen voor organisatoren in Vlaanderen opmaakt en indient.

## Structuur

- `website/` — publieke website
  - `index.html` — startpagina met termijncheck (aftelklok naar de indiendeadline)
  - `rekenlogica.js` — berekening van de indiendeadline per gemeente (zelfde logica als de Indienwijzer)
  - `regels.json` — termijnregels per gemeente (112 gemeenten)
  - `indienmoment.js` — vast wekelijks indienmoment en het oordeel op tijd / krap / te laat
  - `aanvraag.html` — intakeformulier (stuurt naar de Apps Script-webapp); neemt `?gemeente=` en `?datum=` over van de termijncheck

## Termijncheck

Startpagina en intake rekenen met dezelfde logica (`rekenlogica.js` + `regels.json`) en
hetzelfde vaste indienmoment (`indienmoment.js`): aanvragen worden één keer per week
ingediend, op woensdag om 20:00. Een intake moet vóór woensdag 12:00 binnen zijn om
die avond mee te gaan.

Valt de deadline van een gemeente met gekende termijn vóór de eerstvolgende indiensessie
die de aanvraag nog haalt, dan toont de startpagina "te laat" en kan de intake niet
doorgestuurd worden. Bij gemeenten met een onzekere of geschatte termijn blijft doorsturen
mogelijk, met een waarschuwing. Dag, uur en sluitingstijd staan in `INDIEN` bovenaan
`indienmoment.js`.

Nog te maken: `voorwaarden.html`, `privacy.html`.

## Lokaal bekijken

`regels.json` wordt met `fetch` geladen, dus de pagina moet via een webserver draaien:

```
cd website
python3 -m http.server 8000
```

Open daarna http://localhost:8000.
