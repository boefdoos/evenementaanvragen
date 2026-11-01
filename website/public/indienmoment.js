/* Oordeel op tijd / krap / te laat, gedeeld door index.html en aanvraag.html.
   Volgt de regel uit de werkwijze: de wekelijkse platformsessie is geen harde grens;
   valt de aanbevolen indiendatum vóór de eerstvolgende woensdag, dan komt er een aparte
   sessie. Te laat is dus enkel: de deadline van de gemeente is voorbij (zelfde als state()
   in rekenlogica.js). Krap: binnen de marge van 5 werkdagen vóór de deadline.

   laat   : gekende termijn en de deadline is voorbij
   twijfel: zelfde, maar de termijn is onzeker of geschat (geen blokkade)
   krap   : deadline nog niet voorbij, maar binnen de marge
   ok / geschat : ruim op tijd (gekend / onzeker of geschat) */
function indienOordeel(res) {
  const t = today(), zeker = !res.aanname && !res.onzeker, deadline = res.best.date;
  let soort;
  if (deadline < t) soort = zeker ? "laat" : "twijfel";
  else if (res.rec < t) soort = "krap";
  else soort = zeker ? "ok" : "geschat";
  return { soort, deadline, voorbij: deadline < t };
}

/* Buiten het aanbod in fase 1 (zie todo-en-beslissingen.md): stoeten, wielerwedstrijden,
   1.000 of meer bezoekers. Gedeeld door startpagina en intake. */
const BUITEN_AANBOD_TYPES = ["stoet", "wielerwedstrijd"];
const MAX_BEZOEKERS = 999;
function buitenAanbod(type, bezoekers) {
  if (BUITEN_AANBOD_TYPES.includes(type)) return "Stoeten, optochten en wielerwedstrijden vallen (nog) niet in ons aanbod.";
  if (bezoekers > MAX_BEZOEKERS) return "Evenementen met 1.000 of meer bezoekers vallen (nog) niet in ons aanbod.";
  return null;
}
