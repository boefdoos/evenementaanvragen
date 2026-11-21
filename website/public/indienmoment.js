/* Oordeel op tijd / krap / te laat, gedeeld door index.html en aanvraag.html.
   Volgt de regel uit de werkwijze: de wekelijkse platformsessie is geen harde grens;
   valt de aanbevolen indiendatum vóór de eerstvolgende woensdag, dan komt er een aparte
   sessie. Te laat is dus enkel: de deadline van de gemeente is voorbij (zelfde als state()
   in rekenlogica.js). Krap: binnen de marge van 5 werkdagen vóór de deadline.

   Minimale doorlooptijd (beslist 9/11/2026): ligt een gekende deadline minder dan
   MIN_WERKDAGEN werkdagen weg, dan nemen we de aanvraag niet meer aan ("tekort").
   Bij een onzekere of geschatte termijn niet: die wordt toch eerst nagevraagd.

   laat   : gekende termijn en de deadline is voorbij
   tekort : gekende termijn, deadline nog niet voorbij maar minder dan MIN_WERKDAGEN werkdagen weg
   twijfel: zelfde, maar de termijn is onzeker of geschat (geen blokkade)
   krap   : deadline nog niet voorbij, maar binnen de marge
   ok / geschat : ruim op tijd (gekend / onzeker of geschat) */
const MIN_WERKDAGEN = 2;
function plusWerkdagen(d, n) { const x = new Date(d); let c = 0; while (c < n) { x.setDate(x.getDate() + 1); if (isWorkday(x)) c++; } return x; }
/* Aantal werkdagen na vandaag tot en met de deadline (weekends en feestdagen tellen niet). tekort <=> < MIN_WERKDAGEN. */
function werkdagenTot(deadline) { const x = today(); let n = 0; while (true) { x.setDate(x.getDate() + 1); if (x > deadline) return n; if (isWorkday(x)) n++; } }
/* Uitleg voor "tekort", met het echte aantal werkdagen (een deadline op een feestdag oogt anders ruimer dan ze is). */
function tekortUitleg(deadline) {
  const n = werkdagenTot(deadline);
  return (n === 0 ? "Geen werkdag meer" : "Nog maar " + n + " werkdag") + " tot de deadline (weekends en feestdagen tellen niet). Wij hebben er minstens " + MIN_WERKDAGEN + " nodig.";
}
function indienOordeel(res) {
  const t = today(), zeker = !res.aanname && !res.onzeker, deadline = res.best.date;
  let soort;
  if (deadline < t) soort = zeker ? "laat" : "twijfel";
  else if (zeker && deadline < plusWerkdagen(t, MIN_WERKDAGEN)) soort = "tekort";
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

/* Resultaat van de termijncheck (startpagina en gemeentepagina's): het oordeel als gekleurd label,
   het aantal dagen groot, de deadline, en een tijdlijn vandaag → deadline → evenement.
   Bij "te laat" en "te kort dag" zegt een getal niets: dan staat het oordeel zelf groot. */
const OORDEEL_KOP = { ok: "Je bent op tijd", geschat: "Waarschijnlijk op tijd", krap: "Het wordt krap", twijfel: "Mogelijk te laat", tekort: "Te kort dag", laat: "Te laat" };
const OORDEEL_KLEUR = { ok: "ok", geschat: "ok", krap: "tight", twijfel: "tight", tekort: "late", laat: "late" };
function oordeelHTML(res, o, evDatum) {
  const t = today(), dl = res.best.date, st = OORDEEL_KLEUR[o.soort], d = daysUntil(dl);
  const teLaat = o.soort === "laat" || o.soort === "tekort";
  let extra = "";
  if (teLaat) extra = " Kies een latere datum als dat kan, of neem zelf contact op met de gemeente.";
  if (o.soort === "krap") extra = " Je kunt nog indienen, maar zonder marge.";
  if (o.soort === "geschat" || o.soort === "twijfel") extra = " De termijn van deze gemeente is niet zeker: wij kijken hem na.";
  // Tijdlijn: van de vroegste van vandaag en de deadline tot het evenement.
  const start = dl < t ? dl : t, span = Math.max(1, evDatum - start);
  const pos = x => Math.min(100, Math.max(0, (x - start) / span * 100)).toFixed(1) + "%";
  const pT = pos(t), pD = pos(dl);
  const balk = dl < t
    ? '<span class="tl-vul late" style="left:' + pD + ';width:calc(' + pT + ' - ' + pD + ')"></span>'
    : '<span class="tl-vul ' + st + '" style="left:' + pT + ';width:calc(' + pD + ' - ' + pT + ')"></span>';
  const tijdlijn = '<div class="tl" aria-hidden="true"><div class="tl-lijn">' + balk +
    '<span class="tl-pt" style="left:' + pT + '"></span>' +
    '<span class="tl-pt dl ' + st + '" style="left:' + pD + '"></span>' +
    '<span class="tl-pt ev" style="left:100%"></span></div>' +
    '<div class="tl-lab">' + labels([[parseFloat(pT), "vandaag"], [parseFloat(pD), "deadline"], [100, "evenement"]]) + "</div></div>";
  if (teLaat) {
    const zin = (o.soort === "laat" ? "De deadline was " + esc(fmtLong(dl)) + "." : esc(tekortUitleg(dl))) + extra;
    return '<div class="verdict ' + st + '"><div class="v-kop">' + OORDEEL_KOP[o.soort] + '</div><p class="v-zin">' + zin + "</p>" + tijdlijn + "</div>";
  }
  return '<div class="verdict ' + st + '"><span class="v-pil">' + OORDEEL_KOP[o.soort] + "</span>" +
    '<div class="count"><span class="num">' + d + '</span><span class="unit">' + (d === 1 ? "dag" : "dagen") + "</span></div>" +
    '<p class="v-zin">om in te dienen, tot <b>' + esc(fmtLong(dl)) + "</b>." + extra + "</p>" + tijdlijn +
    '<p class="rule">Termijn: ' + esc(label(res.best.n, res.best.u)) + " vooraf.</p></div>";
}

/* Labels onder de tijdlijn: punten die dicht bij elkaar liggen krijgen één label; randen lijnen links of rechts uit. */
function labels(pts) {
  pts.sort((a, b) => a[0] - b[0]);
  const groepen = [];
  for (const [x, t] of pts) { const g = groepen[groepen.length - 1]; if (g && x - g.x < 22) g.t.push(t); else groepen.push({ x, t: [t] }); }
  return groepen.map(g => { const al = g.x < 12 ? "l" : g.x > 88 ? "r" : "m"; return '<span class="' + al + '" style="left:' + g.x.toFixed(1) + '%">' + g.t.join(" · ") + "</span>"; }).join("");
}
