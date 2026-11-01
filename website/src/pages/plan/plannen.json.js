// Welke plannen een gemeente uitdrukkelijk vraagt, afgeleid uit regels.json bij elke build.
// Vermeldt een gemeente ergens een inplantingsplan (of situatieschets, liggingsplan, omgevingsplan) of een grondplan
// (of evacuatieplan), dan rekent de plantekenaar dat plan mee. Ook als het maar in bepaalde gevallen gevraagd wordt:
// bij twijfel tekenen we het, net als de agent. Interne notities (note) tellen niet mee en komen niet in dit openbare bestand.
import regels from "../../../public/regels.json";

const I = /inplantingsplan|situatieschets|liggingsplan|omgevingsplan/i;
const G = /grondplan|evacuatieplan/i;
// Zelfde filter als op de gemeentepagina's: onderzoeksnotities nooit tonen.
const INTERN = /niet expliciet|niet (gelezen|vermeld|gevonden|leesbaar)|onbekend|geblokkeerd|robots|client_error|limiet|aanname|strengste|gemapt|nakijken|navragen|softwarenaam/i;

function teksten(v, uit = []) {
  if (typeof v === "string") uit.push(v);
  else if (Array.isArray(v)) v.forEach((x) => teksten(x, uit));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => teksten(x, uit));
  return uit;
}
function citaat(alle, re) {
  for (const t of alle) {
    const zin = t.split(/(?<=[.;])\s+/).find((z) => re.test(z) && !INTERN.test(z));
    if (zin) return zin.length > 160 ? zin.slice(0, 157).trim() + "…" : zin.trim();
  }
  return null;
}

export function GET() {
  const uit = {};
  for (const r of regels) {
    const alle = teksten(Object.fromEntries(Object.entries(r).filter(([k]) => !["gemeente", "bron", "link", "contact", "note", "status"].includes(k))));
    const i = citaat(alle, I), g = citaat(alle, G);
    if (i || g) uit[r.gemeente] = Object.assign({}, i && { inplanting: i }, g && { grondplan: g });
  }
  return new Response(JSON.stringify(uit), { headers: { "Content-Type": "application/json" } });
}
