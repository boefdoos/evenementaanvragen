/* Vast indienmoment: Thomas dient alle aanvragen zelf in, één keer per week.
   Gedeeld door index.html en aanvraag.html, zodat beide pagina's hetzelfde oordeel geven.

   Een aanvraag kan alleen als de deadline van de gemeente niet vóór de eerstvolgende
   indiensessie valt die de aanvraag nog haalt. Een intake moet SLUIT_UREN_VOORAF uur vóór
   de sessie binnen zijn om erin mee te gaan; anders schuift ze door naar de week erna. */
const INDIEN = {
  dag: 3,              // 0 = zondag … 3 = woensdag
  uur: 20, minuut: 0,  // woensdag 20:00
  sluitUrenVooraf: 8   // intake binnen vóór woensdag 12:00
};

function volgendeIndiensessie(nu) {
  nu = nu || new Date();
  const s = new Date(nu);
  s.setHours(INDIEN.uur, INDIEN.minuut, 0, 0);
  s.setDate(s.getDate() + (INDIEN.dag - s.getDay() + 7) % 7);
  while (s.getTime() - INDIEN.sluitUrenVooraf * 3600e3 <= nu.getTime()) s.setDate(s.getDate() + 7);
  return s;
}

/* Oordeel over een resultaat van evaluate()/fallback() uit rekenlogica.js.
   laat   : gekende termijn en de deadline valt vóór de dag van de indiensessie
   twijfel: zelfde, maar de termijn is onzeker of geschat (geen blokkade)
   krap   : haalbaar, maar de deadline valt binnen de marge (res.rec) vóór de sessie
   ok / geschat : ruim op tijd (gekend / onzeker of geschat) */
function indienOordeel(res, nu) {
  const sessie = volgendeIndiensessie(nu);
  const sessieDag = new Date(sessie); sessieDag.setHours(0, 0, 0, 0);
  const zeker = !res.aanname && !res.onzeker;
  const deadline = res.best.date;
  let soort;
  if (deadline < sessieDag) soort = zeker ? "laat" : "twijfel";
  else if (res.rec < sessieDag) soort = "krap";
  else soort = zeker ? "ok" : "geschat";
  return { soort, sessie, deadline, voorbij: deadline < today() };
}

const fmtSessie = d => d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
