/* Begeleide plantekenaar – evenementaanvragen.be
 * Inplantingsplan op de basiskaart (GRB) en grondplan van een tent of zaal, in stappen.
 * Opslaan in het dossier kan pas als alle controles in orde zijn. Het plan wordt als pdf (A3, op schaal)
 * met watermerk "ONTWERP – nog niet nagekeken" in de bijlagenmap van het dossier gezet.
 * Normen: /plan/normen.json (per brandweerzone, met bron; onbekend = strengste gekende eis). */
"use strict";
(function () {
const ENDPOINT = "https://script.google.com/macros/s/AKfycbz-EAv8lTkB6Y5_yKjc9SWB5UrtYHjuUV_ffm4yqTiMgYR7XjiB0unzoneptmGkJYDuaQ/exec";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString("nl-BE");

// ---------- Catalogus ----------
const KAT_I = {
  zone: { n: "Terrein / afsluiting", c: "#8a8fa3", w: 30, l: 20, f: "rect" },
  tent: { n: "Tent", c: "#3b7dd8", w: 12, l: 6, f: "rect" },
  podium: { n: "Podium", c: "#8e4fc2", w: 8, l: 6, f: "rect" },
  bar: { n: "Bar", c: "#c8761f", w: 6, l: 2, f: "rect" },
  toilet: { n: "Toiletten", c: "#3e9a9a", w: 2.5, l: 6, f: "rect" },
  food: { n: "Foodtruck / stand", c: "#a8861c", w: 6, l: 2.5, f: "rect" },
  stroom: { n: "Stroomgroep", c: "#e0a816", w: 2, l: 1.5, f: "rect" },
  doorgang: { n: "Doorgang hulpdiensten", c: "#e0392e", w: 4, l: 20, f: "rect" },
  ingang: { n: "Ingang / kassa", c: "#3b7dd8", f: "pt", s: "I" },
  uitgang: { n: "Nooduitgang", c: "#1f9d55", f: "pt", s: "U", breedte: 1.2 },
  blus: { n: "Blustoestel", c: "#e0392e", f: "pt", s: "B" },
  ehbo: { n: "EHBO-post", c: "#1f9d55", f: "pt", s: "+" },
};
const KAT_G = {
  deur: { n: "Deur", c: "#3b7dd8", w: 1.0, f: "deur" },
  nooduitgang: { n: "Nooduitgang", c: "#1f9d55", w: 1.2, f: "deur" },
  podium: { n: "Podium", c: "#8e4fc2", w: 6, l: 4, f: "rect" },
  bar: { n: "Bar", c: "#c8761f", w: 5, l: 1.5, f: "rect" },
  dj: { n: "Dj-booth", c: "#6a4c93", w: 2, l: 1, f: "rect" },
  tafel: { n: "Tafel / obstakel", c: "#8a8fa3", w: 2, l: 1, f: "rect" },
  blus: { n: "Blustoestel", c: "#e0392e", f: "pt", s: "B" },
  nood: { n: "Noodverlichting", c: "#1f9d55", f: "pt", s: "N" },
  stroom: { n: "Stroomaansluiting", c: "#e0a816", f: "pt", s: "S" },
};
const KAT = { inplanting: KAT_I, grondplan: KAT_G };
const NAAM_PLAN = { inplanting: "Inplantingsplan", grondplan: "Grondplan" };

const STAPPEN = {
  inplanting: [
    { t: "Terrein", u: "Zoek het adres en duid het terrein van je evenement aan. Versleep de vlakken naar de juiste plaats.", el: ["zone"], veld: "terrein" },
    { t: "Opstelling", u: "Zet alles wat er komt op zijn plaats, met de echte maten. Klik een element aan om de maten of de draaiing aan te passen.", el: ["tent", "podium", "bar", "toilet", "food", "stroom"] },
    { t: "Hulpdiensten en uitgangen", u: "Duid de vrije doorgang voor brandweer en ziekenwagen aan, de ingang en de nooduitgangen. Meet met een maatlijn de afstand tot de gebouwen errond.", el: ["doorgang", "ingang", "uitgang"], maat: true },
    { t: "Veiligheid", u: "Duid de blustoestellen en de EHBO-post aan.", el: ["blus", "ehbo"] },
    { t: "Controle", u: "Alles in het groen? Dan kan je het plan in je dossier opslaan.", controle: true },
  ],
  grondplan: [
    { t: "Ruimte", u: "Geef de binnenmaten van de tent of zaal en het materiaal.", el: [], veld: "ruimte" },
    { t: "Uitgangen", u: "Zet de deuren en nooduitgangen in de wanden. Ze klikken vast aan de dichtste wand. Kies bij elke deur de draairichting.", el: ["deur", "nooduitgang"] },
    { t: "Opstelling", u: "Zet podium, bar, dj en tafels op hun plaats. Hou de ruimte voor de uitgangen vrij.", el: ["podium", "bar", "dj", "tafel"] },
    { t: "Veiligheid", u: "Duid de blustoestellen, de noodverlichting boven de uitgangen en de stroomaansluiting aan.", el: ["blus", "nood", "stroom"] },
    { t: "Controle", u: "Alles in het groen? Dan kan je het plan in je dossier opslaan.", controle: true },
  ],
};

// ---------- Toestand ----------
let S = null, sel = null, uid = 1, DEMO = false, AUTH = null, NORMEN = null;
function nieuweStaat(d) {
  const sit = d.situatie || "tent";
  const plannen = sit === "zaal" ? ["grondplan"] : sit === "buiten" ? ["inplanting"] : ["inplanting", "grondplan"];
  const tent = String(d.tent || "").match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  const tl = tent ? parseFloat(tent[1].replace(",", ".")) : 12, tb = tent ? parseFloat(tent[2].replace(",", ".")) : 6;
  return {
    d, plannen, actief: plannen[0], stap: { inplanting: 0, grondplan: 0 },
    personen: +d.bezoekers || 150,
    I: { center: [51.2265, 2.9085], zoom: 19, items: [], maten: [], tent: [tl, tb], gezocht: false },
    G: { l: sit === "zaal" ? 20 : tl, b: sit === "zaal" ? 12 : tb, mat: sit === "zaal" ? "" : "tent", items: [] },
  };
}
const sleutel = () => "plantekenaar:" + (DEMO ? "demo" : AUTH.id);
function bewaar() { try { localStorage.setItem(sleutel(), JSON.stringify(S)); } catch (e) {} }
function laad(d) {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(sleutel()) || "null"); } catch (e) {}
  S = s && s.I && s.G ? s : nieuweStaat(d);
  S.d = d;
  uid = 1 + Math.max(0, ...S.I.items.map((i) => i.id), ...S.I.maten.map((i) => i.id), ...S.G.items.map((i) => i.id));
}

// ---------- Normen ----------
// normen.json: { gemeenten: {gemeente: zone}, zones: {zone: {...}}, strengste: {...} }; per parameter {waarde, bron, zone}.
function norm(param) {
  if (!NORMEN) return null;
  const gr = NORMEN.gemeente_regels && NORMEN.gemeente_regels[S.d.gemeente];
  if (gr && gr[param] != null) return Object.assign({ gemeente: S.d.gemeente }, gr[param]);
  const zone = NORMEN.gemeenten && NORMEN.gemeenten[S.d.gemeente];
  const z = zone && NORMEN.zones && NORMEN.zones[zone];
  if (z && z[param] != null) return Object.assign({ zone }, z[param]);
  const st = NORMEN.strengste && NORMEN.strengste[param];
  return st ? Object.assign({ strengste: true }, st) : null;
}
function aantalUitgangen(personen) {
  const n = norm("uitgangen");
  if (!n || !Array.isArray(n.trappen)) return null;
  let a = 1;
  for (const t of n.trappen) if (personen >= t.vanaf) a = Math.max(a, t.aantal);
  return { aantal: a, bron: n };
}
function bronTekst(n) {
  if (!n) return "";
  const wie = n.gemeente ? "Reglement van " + n.gemeente : n.strengste ? "Geen eigen regel van je zone gevonden: strengste gekende eis (" + n.zone + ")" : n.zone || "";
  return wie + (n.plaats ? ", " + n.plaats : "");
}

// ---------- Kaart (inplantingsplan) ----------
let map = null, laag = null, polys = {}, rasterLaag = null;
const mLat = () => 1 / 111320, mLng = (lat) => 1 / (111320 * Math.cos((lat * Math.PI) / 180));
function hoeken(it) {
  const a = (it.rot * Math.PI) / 180;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
    const x = (sx * it.w) / 2, y = (sy * it.l) / 2;
    const rx = x * Math.cos(a) - y * Math.sin(a), ry = x * Math.sin(a) + y * Math.cos(a);
    return [it.lat + ry * mLat(), it.lng + rx * mLng(it.lat)];
  });
}
function initKaart() {
  map = L.map("map", { zoomControl: true, maxZoom: 22 }).setView(S.I.center, S.I.zoom);
  map.zoomControl.setPosition("bottomright");
  const grb = L.tileLayer.wms("https://geo.api.vlaanderen.be/GRB-basiskaart/wms", {
    layers: "GRB_BSK", format: "image/png", transparent: false, version: "1.3.0", maxZoom: 22, maxNativeZoom: 21,
    attribution: "Bron: Grootschalig Referentie Bestand Vlaanderen, Digitaal Vlaanderen",
  });
  let fouten = 0;
  grb.on("tileerror", () => { if (++fouten === 4) { banner("De basiskaart laadt niet. Je kan verder tekenen; de kaart verschijnt op het plan zodra ze bereikbaar is."); raster(); } });
  grb.addTo(map);
  L.control.scale({ metric: true, imperial: false, maxWidth: 160 }).addTo(map);
  laag = L.layerGroup().addTo(map);
  map.on("moveend", () => { S.I.center = [map.getCenter().lat, map.getCenter().lng]; S.I.zoom = map.getZoom(); bewaar(); });
  map.on("click", kaartKlik);
}
function raster() {
  if (rasterLaag) return;
  rasterLaag = L.layerGroup().addTo(map);
  const teken = () => {
    rasterLaag.clearLayers();
    const b = map.getBounds(), c = map.getCenter(), st = 10;
    for (let y = Math.floor(b.getSouth() / (st * mLat())) * st * mLat(); y < b.getNorth(); y += st * mLat()) L.polyline([[y, b.getWest()], [y, b.getEast()]], { color: "#556", weight: 0.5, interactive: false }).addTo(rasterLaag);
    for (let x = Math.floor(b.getWest() / (st * mLng(c.lat))) * st * mLng(c.lat); x < b.getEast(); x += st * mLng(c.lat)) L.polyline([[b.getSouth(), x], [b.getNorth(), x]], { color: "#556", weight: 0.5, interactive: false }).addTo(rasterLaag);
  };
  map.on("moveend zoomend", teken); teken();
}
function tekenKaart() {
  if (!map) return;
  laag.clearLayers(); polys = {};
  const volgorde = (it) => (it.k === "zone" ? 0 : it.k === "doorgang" ? 1 : 2);
  for (const it of [...S.I.items].sort((a, b) => volgorde(a) - volgorde(b))) {
    const k = KAT_I[it.k];
    if (k.f === "rect") {
      const p = L.polygon(hoeken(it), {
        color: k.c, weight: sel === it.id ? 3 : 2,
        fillOpacity: it.k === "zone" ? 0.05 : it.k === "doorgang" ? 0.15 : 0.35,
        dashArray: it.k === "doorgang" || it.k === "zone" ? "6 4" : null,
      }).on("click", (e) => { L.DomEvent.stop(e); kies(it.id); }).addTo(laag);
      polys[it.id] = p;
      const m = L.marker([it.lat, it.lng], { draggable: true, icon: L.divIcon({ className: "lbl", html: "<span>" + esc(it.naam || k.n) + " · " + fmt(it.w) + "×" + fmt(it.l) + " m</span>", iconSize: [0, 0] }) });
      m.on("dragstart", () => kies(it.id, true));
      m.on("drag", (e) => { const q = e.target.getLatLng(); it.lat = q.lat; it.lng = q.lng; polys[it.id].setLatLngs(hoeken(it)); });
      m.on("dragend", () => { allesTekenen(); bewaar(); });
      m.on("click", () => kies(it.id));
      m.addTo(laag);
    } else {
      const m = L.marker([it.lat, it.lng], { draggable: true, icon: L.divIcon({ className: "sym", html: '<span style="background:' + k.c + '">' + esc(k.s) + "</span>", iconSize: [0, 0] }) });
      m.on("dragend", (e) => { const q = e.target.getLatLng(); it.lat = q.lat; it.lng = q.lng; allesTekenen(); bewaar(); });
      m.on("click", () => kies(it.id));
      m.addTo(laag);
    }
  }
  for (const mt of S.I.maten) {
    L.polyline([mt.a, mt.b], { color: "#111", weight: 2, dashArray: "3 4" }).addTo(laag);
    L.marker([(mt.a[0] + mt.b[0]) / 2, (mt.a[1] + mt.b[1]) / 2], { interactive: false, icon: L.divIcon({ className: "lbl", html: "<span>" + fmt(map.distance(mt.a, mt.b)) + " m</span>", iconSize: [0, 0] }) }).addTo(laag);
  }
}
let maatStart = null, maatModus = false;
function kaartKlik(e) {
  if (!maatModus) { kies(null); return; }
  const p = [e.latlng.lat, e.latlng.lng];
  if (!maatStart) { maatStart = p; banner("Klik nu het tweede punt."); return; }
  S.I.maten.push({ id: uid++, a: maatStart, b: p }); maatStart = null; maatModus = false; banner(null);
  allesTekenen(); bewaar();
}

// ---------- Grondplan (SVG in meter) ----------
function tekenGrondplan() {
  const { l, b } = S.G, mg = 2, W = l + 2 * mg, H = b + 2 * mg;
  const px = Math.max(14, Math.min(48, Math.floor(Math.min(($("gp").clientWidth - 48) / W, ($("gp").clientHeight - 110) / H))));
  let s = '<svg id="gsvg" xmlns="http://www.w3.org/2000/svg" viewBox="' + -mg + " " + -mg + " " + W + " " + H + '" width="' + W * px + '" height="' + H * px + '" font-family="Instrument Sans, Arial, sans-serif">';
  for (let x = 0; x <= l; x++) s += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + b + '" stroke="#e4e6ee" stroke-width="0.02"/>';
  for (let y = 0; y <= b; y++) s += '<line x1="0" y1="' + y + '" x2="' + l + '" y2="' + y + '" stroke="#e4e6ee" stroke-width="0.02"/>';
  s += '<rect x="0" y="0" width="' + l + '" height="' + b + '" fill="none" stroke="#1a1d2b" stroke-width="0.15"/>';
  s += '<text x="' + l / 2 + '" y="-0.6" text-anchor="middle" font-size="0.45" fill="#1a1d2b">' + fmt(l) + " m</text>";
  s += '<text x="-0.6" y="' + b / 2 + '" text-anchor="middle" font-size="0.45" fill="#1a1d2b" transform="rotate(-90 -0.6 ' + b / 2 + ')">' + fmt(b) + " m</text>";
  for (const it of S.G.items) s += svgItem(it, sel === it.id);
  s += "</svg>";
  $("gp").innerHTML = s;
  $("gsvg").querySelectorAll("g[data-id]").forEach((g) => g.addEventListener("pointerdown", startSleep));
  $("gsvg").addEventListener("pointerdown", (e) => { if (e.target.id === "gsvg" || e.target.tagName === "line" || e.target.tagName === "rect" && !e.target.closest("g[data-id]")) kies(null); });
}
function svgItem(it, gekozen) {
  const k = KAT_G[it.k], sw = gekozen ? 0.09 : 0.045;
  let s = '<g data-id="' + it.id + '" transform="translate(' + it.x + " " + it.y + ") rotate(" + it.rot + ')" style="cursor:move">';
  if (k.f === "rect") {
    s += '<rect x="' + -it.w / 2 + '" y="' + -it.l / 2 + '" width="' + it.w + '" height="' + it.l + '" fill="' + k.c + '" fill-opacity="0.3" stroke="' + k.c + '" stroke-width="' + sw + '"/>';
    s += '<text y="0.15" text-anchor="middle" font-size="0.4" fill="#1a1d2b">' + esc(it.naam || k.n) + "</text>";
  } else if (k.f === "deur") {
    const r = it.w, dir = it.open === "binnen" ? -1 : 1; // lokaal: wand langs x, +y = buiten
    s += '<rect x="' + -r / 2 + '" y="-0.15" width="' + r + '" height="0.3" fill="#fff" stroke="' + k.c + '" stroke-width="' + sw + '"/>';
    s += '<path d="M ' + -r / 2 + " 0 L " + -r / 2 + " " + dir * r + " A " + r + " " + r + " 0 0 " + (dir > 0 ? 0 : 1) + " " + r / 2 + ' 0" fill="none" stroke="' + k.c + '" stroke-width="0.045" stroke-dasharray="0.12 0.08"/>';
    if (it.k === "nooduitgang") s += '<rect x="-0.4" y="' + (-dir * 0.75 - 0.2) + '" width="0.8" height="0.4" fill="#1f9d55"/><text x="0" y="' + (-dir * 0.75 + 0.1) + '" text-anchor="middle" font-size="0.24" font-weight="700" fill="#fff">NOOD</text>';
    s += '<text y="' + dir * (r + 0.45) + '" text-anchor="middle" font-size="0.32" fill="#1a1d2b" transform="rotate(' + -it.rot + " 0 " + dir * (r + 0.45) + ')">' + fmt(it.w) + " m</text>";
  } else {
    s += '<circle r="0.35" fill="' + k.c + '" stroke="#fff" stroke-width="0.06"/><text y="0.13" text-anchor="middle" font-size="0.35" font-weight="700" fill="#fff" transform="rotate(' + -it.rot + ')">' + esc(k.s) + "</text>";
  }
  return s + "</g>";
}
let sleep = null;
function svgPunt(e) { const svg = $("gsvg"), p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
function startSleep(e) {
  const id = +e.currentTarget.dataset.id, it = S.G.items.find((i) => i.id === id); if (!it) return;
  kies(id, true); const p = svgPunt(e); sleep = { it, dx: p.x - it.x, dy: p.y - it.y }; e.preventDefault();
}
window.addEventListener("pointermove", (e) => {
  if (!sleep) return; const p = svgPunt(e);
  sleep.it.x = Math.round((p.x - sleep.dx) * 10) / 10; sleep.it.y = Math.round((p.y - sleep.dy) * 10) / 10;
  if (KAT_G[sleep.it.k].f === "deur") klikAanWand(sleep.it);
  const g = document.querySelector('g[data-id="' + sleep.it.id + '"]');
  if (g) g.setAttribute("transform", "translate(" + sleep.it.x + " " + sleep.it.y + ") rotate(" + sleep.it.rot + ")");
});
window.addEventListener("pointerup", () => { if (sleep) { sleep = null; allesTekenen(); bewaar(); } });
// Deuren hangen altijd in een wand: dichtste wand kiezen, draaiing zo dat +y naar buiten wijst.
function klikAanWand(it) {
  const { l, b } = S.G, h = it.w / 2;
  const opties = [
    { d: Math.abs(it.y - b), x: Math.min(l - h, Math.max(h, it.x)), y: b, rot: 0 },
    { d: Math.abs(it.y), x: Math.min(l - h, Math.max(h, it.x)), y: 0, rot: 180 },
    { d: Math.abs(it.x), x: 0, y: Math.min(b - h, Math.max(h, it.y)), rot: 90 },
    { d: Math.abs(it.x - l), x: l, y: Math.min(b - h, Math.max(h, it.y)), rot: 270 },
  ].sort((a, c) => a.d - c.d)[0];
  it.x = opties.x; it.y = opties.y; it.rot = opties.rot;
}

// ---------- Elementen ----------
function lijst() { return S.actief === "inplanting" ? S.I.items : S.G.items; }
function voegToe(k) {
  const kk = KAT[S.actief][k];
  if (S.actief === "inplanting") {
    const c = map.getCenter(), n = S.I.items.length, off = 4 * ((n % 5) - 2);
    const it = { id: uid++, k, naam: "", lat: c.lat + off * mLat(), lng: c.lng + off * mLng(c.lat), w: kk.w || 0, l: kk.l || 0, rot: 0 };
    if (k === "tent") { it.w = S.I.tent[0]; it.l = S.I.tent[1]; }
    if (k === "uitgang") it.breedte = kk.breedte;
    S.I.items.push(it);
  } else {
    const { l, b } = S.G, n = S.G.items.length;
    const it = { id: uid++, k, naam: "", x: Math.min(l - 1, 1.5 + ((n * 2.5) % Math.max(3, l - 3))), y: b / 2, w: kk.w || 0, l: kk.l || 0, rot: 0 };
    if (kk.f === "deur") { it.y = b; it.open = "buiten"; klikAanWand(it); }
    S.G.items.push(it);
  }
  kies(uid - 1); bewaar();
}
function kies(id, stil) { sel = id; if (stil) { tekenLijst(); return; } allesTekenen(); }
function tekenLijst() {
  const st = STAPPEN[S.actief][S.stap[S.actief]];
  const toon = st.controle ? lijst() : lijst().filter((it) => (st.el || []).includes(it.k));
  $("lijst").innerHTML = toon.map((it) => {
    const k = KAT[S.actief][it.k];
    const m = k.f === "rect" ? fmt(it.w) + " × " + fmt(it.l) + " m" : k.f === "deur" ? fmt(it.w) + " m" : it.k === "uitgang" ? fmt(it.breedte) + " m" : "";
    return '<div class="item' + (sel === it.id ? " sel" : "") + '" data-id="' + it.id + '"><span class="sw" style="background:' + k.c + '"></span>' + esc(it.naam || k.n) + (m ? '<span class="maat">' + m + "</span>" : "") + "</div>";
  }).join("") + (S.actief === "inplanting" && st.maat ? S.I.maten.map((m) => '<div class="item" data-maat="' + m.id + '"><span class="sw" style="background:#111"></span>Maatlijn<span class="maat">' + fmt(map.distance(m.a, m.b)) + " m · wissen</span></div>").join("") : "");
  $("lijst").querySelectorAll("[data-id]").forEach((d) => d.addEventListener("click", () => kies(+d.dataset.id)));
  $("lijst").querySelectorAll("[data-maat]").forEach((d) => d.addEventListener("click", () => { S.I.maten = S.I.maten.filter((m) => m.id !== +d.dataset.maat); allesTekenen(); bewaar(); }));
  const it = lijst().find((i) => i.id === sel), ed = $("edit");
  if (!it) { ed.innerHTML = ""; return; }
  const k = KAT[S.actief][it.k];
  let h = '<div class="edit"><label for="e-naam">Naam<input id="e-naam" value="' + esc(it.naam) + '" placeholder="' + esc(k.n) + '"></label>';
  if (k.f === "rect") h += '<div class="r3"><label for="e-w">Lengte (m)<input id="e-w" type="number" step="0.5" min="0.5" value="' + it.w + '"></label><label for="e-l">Breedte (m)<input id="e-l" type="number" step="0.5" min="0.5" value="' + it.l + '"></label><label for="e-r">Draaiing (°)<input id="e-r" type="number" step="5" value="' + it.rot + '"></label></div>';
  if (k.f === "deur") h += '<div class="r2"><label for="e-w">Breedte (m)<input id="e-w" type="number" step="0.1" min="0.6" value="' + it.w + '"></label><label for="e-o">Draait<select id="e-o"><option value="buiten"' + (it.open === "buiten" ? " selected" : "") + '>naar buiten</option><option value="binnen"' + (it.open === "binnen" ? " selected" : "") + ">naar binnen</option></select></label></div>";
  if (it.k === "uitgang") h += '<label for="e-b">Vrije breedte (m)<input id="e-b" type="number" step="0.1" min="0.5" value="' + it.breedte + '"></label>';
  h += '<button class="btn" id="e-del" type="button">Verwijderen</button></div>';
  ed.innerHTML = h;
  const upd = () => {
    it.naam = $("e-naam").value;
    if ($("e-w")) it.w = Math.max(0.1, +$("e-w").value || it.w);
    if ($("e-l")) it.l = Math.max(0.1, +$("e-l").value || it.l);
    if ($("e-r")) it.rot = +$("e-r").value || 0;
    if ($("e-o")) it.open = $("e-o").value;
    if ($("e-b")) it.breedte = Math.max(0.1, +$("e-b").value || it.breedte);
    if (k.f === "deur") klikAanWand(it);
    tekenPlan(); tekenControles(); bewaar();
  };
  ed.querySelectorAll("input,select").forEach((i) => i.addEventListener("change", upd));
  ed.querySelectorAll("input").forEach((i) => i.addEventListener("input", upd));
  $("e-del").addEventListener("click", () => {
    if (S.actief === "inplanting") S.I.items = S.I.items.filter((i) => i !== it); else S.G.items = S.G.items.filter((i) => i !== it);
    sel = null; allesTekenen(); bewaar();
  });
}

// ---------- Meetkunde ----------
function lokaal(lat, lng) { const c = S.I.center; return [(lng - c[1]) / mLng(c[0]), (lat - c[0]) / mLat()]; }
function binnenRect(p, it, extra) { // p in lokale meters (inplanting) of grondplanmeters
  const a = (-it.rot * Math.PI) / 180, dx = p[0] - it.cx, dy = p[1] - it.cy;
  const x = dx * Math.cos(a) - dy * Math.sin(a), y = dx * Math.sin(a) + dy * Math.cos(a), e = extra || 0;
  return Math.abs(x) <= it.w / 2 + e && Math.abs(y) <= it.l / 2 + e;
}
function rectI(it) { const [cx, cy] = lokaal(it.lat, it.lng); return { cx, cy, w: it.w, l: it.l, rot: it.rot }; }
function puntenIn(r, stap) { // rasterpunten binnen een (gedraaide) rechthoek
  const pts = [], a = (r.rot * Math.PI) / 180;
  for (let x = -r.w / 2; x <= r.w / 2 + 1e-6; x += stap) for (let y = -r.l / 2; y <= r.l / 2 + 1e-6; y += stap)
    pts.push([r.cx + x * Math.cos(a) - y * Math.sin(a), r.cy + x * Math.sin(a) + y * Math.cos(a)]);
  return pts;
}
function afstandTotRect(p, r) {
  const a = (-r.rot * Math.PI) / 180, dx = p[0] - r.cx, dy = p[1] - r.cy;
  const x = dx * Math.cos(a) - dy * Math.sin(a), y = dx * Math.sin(a) + dy * Math.cos(a);
  return Math.hypot(Math.max(0, Math.abs(x) - r.w / 2), Math.max(0, Math.abs(y) - r.l / 2));
}
function rectsOverlappen(r1, r2) { return puntenIn(r1, 0.5).some((p) => binnenRect(p, r2)) || puntenIn(r2, 0.5).some((p) => binnenRect(p, r1)); }

// ---------- Controles ----------
// {stap, ok: true|false|null (advies, blokkeert niet), t, n (norm met bron)}
function controles(plan) {
  const uit = [], C = (stap, ok, t, n) => uit.push({ stap, ok, t, n });
  const P = S.personen;
  if (plan === "inplanting") {
    const it = (k) => S.I.items.filter((i) => i.k === k);
    C(0, it("zone").length > 0, "Het terrein is aangeduid");
    C(1, S.I.items.some((i) => KAT_I[i.k].f === "rect" && !["zone", "doorgang"].includes(i.k)), "Alle opstellingen staan erop, met hun afmetingen");
    const nd = norm("doorgang_hulpdiensten");
    const dgMin = nd && nd.breedte_m;
    const dg = it("doorgang");
    C(2, dg.length > 0, "Doorgang voor de hulpdiensten aangeduid");
    if (dg.length) C(2, dgMin ? dg.every((d) => Math.min(d.w, d.l) >= dgMin) : null, dgMin ? "Doorgang minstens " + fmt(dgMin) + " m breed" + (nd.hoogte_m ? " (en " + fmt(nd.hoogte_m) + " m vrije hoogte)" : "") : "Breedte van de doorgang: geen norm gevonden, vraag ze na", nd);
    const hinder = dg.some((d) => { const rd = rectI(d); return S.I.items.some((o) => o !== d && KAT_I[o.k].f === "rect" && !["zone", "doorgang"].includes(o.k) && rectsOverlappen(rd, rectI(o))); });
    if (dg.length) C(2, !hinder, "Niets staat in de doorgang voor de hulpdiensten");
    if (it("zone").length) {
      const u = it("uitgang"), nu = aantalUitgangen(P);
      C(2, nu ? u.length >= nu.aantal : u.length >= 1, nu ? "Minstens " + nu.aantal + " nooduitgang" + (nu.aantal > 1 ? "en" : "") + " voor " + P + " personen" : "Nooduitgangen van het terrein aangeduid", nu && nu.bron);
      const cm = norm("breedte_per_persoon_cm"), bm = norm("breedte_min_m");
      if (u.length && cm) C(2, u.reduce((s, x) => s + x.breedte, 0) * 100 >= P * cm.waarde, "Samen minstens " + fmt((P * cm.waarde) / 100) + " m uitgangsbreedte (" + fmt(cm.waarde) + " cm per persoon)", cm);
      if (u.length && bm) C(2, u.every((x) => x.breedte >= bm.waarde), "Elke nooduitgang minstens " + fmt(bm.waarde) + " m breed", bm);
    }
    C(2, S.I.maten.length > 0, "Afstand tot de gebouwen errond gemeten met een maatlijn");
    C(3, it("blus").length > 0, "Blustoestellen aangeduid");
    const tenten = it("tent").map(rectI), stroom = it("stroom");
    C(1, !stroom.some((s) => tenten.some((t) => binnenRect(lokaal(s.lat, s.lng), t))), "De stroomgroep staat buiten de tent");
    const sa = norm("stroomgroep_afstand_m");
    if (sa && stroom.length && tenten.length) C(1, stroom.every((s) => tenten.every((t) => afstandTotRect(lokaal(s.lat, s.lng), t) >= sa.waarde)), "Stroomgroep minstens " + fmt(sa.waarde) + " m van de tent", sa);
  } else {
    const { l, b } = S.G, it = (k) => S.G.items.filter((i) => i.k === k), nood = it("nooduitgang"), deuren = [...it("deur"), ...nood];
    C(0, l > 0 && b > 0, "Binnenmaten ingevuld: " + fmt(l) + " × " + fmt(b) + " m");
    C(0, !!S.G.mat.trim(), "Soort ruimte en materiaal vermeld");
    const nu = aantalUitgangen(P);
    C(1, nu ? nood.length >= nu.aantal : nood.length >= 1, nu ? "Minstens " + nu.aantal + " nooduitgang" + (nu.aantal > 1 ? "en" : "") + " voor " + P + " personen" : "Nooduitgangen aangeduid", nu && nu.bron);
    const cm = norm("breedte_per_persoon_cm"), bm = norm("breedte_min_m");
    if (nood.length && cm) C(1, nood.reduce((s, x) => s + x.w, 0) * 100 >= P * cm.waarde, "Samen minstens " + fmt((P * cm.waarde) / 100) + " m uitgangsbreedte (" + fmt(cm.waarde) + " cm per persoon)", cm);
    if (nood.length && bm) C(1, nood.every((x) => x.w >= bm.waarde), "Elke nooduitgang minstens " + fmt(bm.waarde) + " m breed", bm);
    if (nood.length) C(1, nood.every((d) => d.open === "buiten"), "Nooduitgangen draaien naar buiten");
    const ea = norm("evacuatieafstand_max_m");
    if (ea && nood.length) {
      let slechtst = 0;
      for (let x = 0.5; x < l; x += 1) for (let y = 0.5; y < b; y += 1) slechtst = Math.max(slechtst, Math.min(...nood.map((d) => Math.hypot(d.x - x, d.y - y))));
      C(1, slechtst <= ea.waarde, "Van overal minder dan " + fmt(ea.waarde) + " m tot een nooduitgang (nu " + fmt(slechtst) + " m)", ea);
    }
    const voorDeur = (d) => { const a = (d.rot * Math.PI) / 180; return { cx: d.x - Math.sin(a) * -d.w / 2, cy: d.y + Math.cos(a) * -d.w / 2, w: d.w, l: d.w, rot: d.rot }; };
    const obst = S.G.items.filter((i) => KAT_G[i.k].f === "rect").map((o) => ({ cx: o.x, cy: o.y, w: o.w, l: o.l, rot: o.rot }));
    if (deuren.length) C(2, !deuren.some((d) => obst.some((o) => rectsOverlappen(voorDeur(d), o))), "Niets staat vlak voor een uitgang (eigen controle: vrije ruimte zo diep als de deur breed is)");
    C(2, !obst.some((o) => puntenIn(o, 0.5).some((p) => p[0] < 0 || p[1] < 0 || p[0] > l || p[1] > b)), "Alles staat binnen de ruimte");
    const bl = norm("blustoestellen"), opp = l * b;
    const nodig = bl && bl.per_m2 ? Math.max(bl.min || 1, Math.ceil(opp / bl.per_m2)) : 1;
    C(3, it("blus").length >= nodig, (bl && bl.per_m2 ? "Minstens " + nodig + " blustoestel" + (nodig > 1 ? "len" : "") + " (1 per " + fmt(bl.per_m2) + " m², ruimte " + fmt(opp) + " m²)" : "Blustoestellen aangeduid"), bl);
    if (nood.length) C(3, nood.every((d) => it("nood").some((n) => Math.hypot(n.x - d.x, n.y - d.y) <= 2)), "Noodverlichting bij elke nooduitgang");
    C(3, !it("stroom").some((s) => s.x > 0 && s.x < l && s.y > 0 && s.y < b), "Stroomvoorziening buiten de tijdelijke inrichting");
  }
  return uit;
}
function alleOk(plan) { return controles(plan).every((c) => c.ok !== false); }
function tekenControles() {
  const st = S.stap[S.actief], stap = STAPPEN[S.actief][st];
  const lijstC = controles(S.actief).filter((c) => stap.controle || c.stap === st);
  $("checks").innerHTML = lijstC.map((c) => {
    const cl = c.ok === true ? "ok" : c.ok === false ? "no" : "ad", ic = c.ok === true ? "✓" : c.ok === false ? "✗" : "!";
    return '<li class="' + cl + '"><span class="i">' + ic + "</span><span>" + esc(c.t) + (c.n ? "<small>" + esc(bronTekst(c.n)) + "</small>" : "") + "</span></li>";
  }).join("");
  $("checkwrap").hidden = !lijstC.length;
  for (const p of S.plannen) { const b = document.querySelector('#tabs [data-plan="' + p + '"]'); if (b) b.textContent = NAAM_PLAN[p] + (alleOk(p) ? " ✓" : ""); }
  if (stap.controle) tekenOpslaan();
}

// ---------- Stappen en werkbalk ----------
function tekenStap() {
  const st = S.stap[S.actief], stappen = STAPPEN[S.actief], stap = stappen[st];
  $("steps").innerHTML = stappen.map((x, i) => '<button type="button" title="' + esc(x.t) + '" class="' + (i < st ? "klaar" : i === st ? "nu" : "") + '" data-i="' + i + '"></button>').join("");
  $("steps").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => naarStap(+b.dataset.i)));
  $("stapnr").textContent = NAAM_PLAN[S.actief] + " · stap " + (st + 1) + " van " + stappen.length;
  $("staptitel").textContent = stap.t;
  $("stapuitleg").textContent = stap.u;
  $("terug").disabled = st === 0;
  $("verder").hidden = !!stap.controle;
  // velden
  let v = "";
  if (stap.veld === "terrein") v = '<div style="display:flex;flex-direction:column;gap:10px"><label for="f-adres">Adres<input id="f-adres" value="' + esc(S.d.adres || "") + '"></label><button class="btn" id="zoek" type="button">Zoek op de kaart</button><label for="f-pers">Personen tegelijk op het drukste moment<input id="f-pers" type="number" min="1" value="' + S.personen + '"></label></div>';
  if (stap.veld === "ruimte") v = '<div style="display:flex;flex-direction:column;gap:10px"><div class="r2"><label for="g-l">Lengte (m)<input id="g-l" type="number" min="2" step="0.5" value="' + S.G.l + '"></label><label for="g-b">Breedte (m)<input id="g-b" type="number" min="2" step="0.5" value="' + S.G.b + '"></label></div><label for="g-mat">Soort ruimte en materiaal<input id="g-mat" value="' + esc(S.G.mat) + '" placeholder="bv. tent met PVC-zeil, of zaal"></label><label for="g-pers">Personen tegelijk op het drukste moment<input id="g-pers" type="number" min="1" value="' + S.personen + '"></label></div>';
  $("stapvelden").innerHTML = v;
  if ($("zoek")) $("zoek").addEventListener("click", zoekAdres);
  if ($("f-adres")) $("f-adres").addEventListener("input", () => { S.d.adres = $("f-adres").value; bewaar(); });
  for (const id of ["f-pers", "g-pers"]) if ($(id)) $(id).addEventListener("input", () => { S.personen = Math.max(1, +$(id).value || 1); tekenControles(); bewaar(); });
  const gu = () => { S.G.l = Math.max(2, +$("g-l").value || S.G.l); S.G.b = Math.max(2, +$("g-b").value || S.G.b); S.G.mat = $("g-mat").value; S.G.items.filter((i) => KAT_G[i.k].f === "deur").forEach(klikAanWand); tekenPlan(); tekenControles(); bewaar(); };
  for (const id of ["g-l", "g-b", "g-mat"]) if ($(id)) $(id).addEventListener("input", gu);
  // werkbalk bij het plan
  let t = (stap.el || []).map((k) => '<button type="button" data-k="' + k + '"><span class="sw" style="background:' + KAT[S.actief][k].c + '"></span>' + esc(KAT[S.actief][k].n) + ' <span class="plus">+</span></button>').join("");
  if (stap.maat) t += '<button type="button" id="maat" class="' + (maatModus ? "aan" : "") + '">Maatlijn</button>';
  $("tools").innerHTML = t;
  $("tools").querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => voegToe(b.dataset.k)));
  if ($("maat")) $("maat").addEventListener("click", () => { maatModus = !maatModus; maatStart = null; banner(maatModus ? "Klik twee punten op de kaart." : null); $("maat").classList.toggle("aan", maatModus); });
  $("opslaanwrap").hidden = !stap.controle;
  $("lijstwrap").hidden = !!stap.controle;
}
function naarStap(i) { S.stap[S.actief] = Math.max(0, Math.min(STAPPEN[S.actief].length - 1, i)); sel = null; maatModus = false; banner(null); allesTekenen(); bewaar(); }
function tekenPlan() { if (S.actief === "inplanting") tekenKaart(); else tekenGrondplan(); }
function allesTekenen() { tekenStap(); tekenPlan(); tekenLijst(); tekenControles(); }
function wisselPlan(p) {
  S.actief = p; sel = null; maatModus = false; banner(null);
  document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.plan === p));
  $("map").hidden = p !== "inplanting"; $("gp").hidden = p !== "grondplan";
  if (p === "inplanting") { if (!map) initKaart(); setTimeout(() => map.invalidateSize(), 0); }
  allesTekenen(); bewaar();
}
function banner(t) { $("banner").hidden = !t; $("banner").textContent = t || ""; }
async function zoekAdres() {
  const q = ($("f-adres").value || "").trim() + (S.d.gemeente && !/\d{4}/.test($("f-adres").value) ? " " + S.d.gemeente : "");
  if (!q.trim()) return;
  $("msg").textContent = "Adres zoeken…";
  try {
    const r = await fetch("https://geo.api.vlaanderen.be/geolocation/v4/Location?q=" + encodeURIComponent(q) + "&c=1");
    const j = await r.json(), loc = j.LocationResult && j.LocationResult[0];
    if (!loc) throw new Error("niet gevonden");
    map.setView([loc.Location.Lat_WGS84, loc.Location.Lon_WGS84], 19);
    S.I.gezocht = true; $("msg").textContent = "Gevonden: " + loc.FormattedAddress; bewaar();
  } catch (e) { $("msg").textContent = "Adres niet gevonden. Verschuif de kaart zelf naar de juiste plaats."; }
}

// ---------- Plan op A3 (canvas → pdf) ----------
const DPI = 150, MM = DPI / 25.4, A3 = [420, 297], VAK = { x: 10, y: 10, w: 300, h: 262 };
async function maakBlad(plan) {
  const cv = document.createElement("canvas"); cv.width = Math.round(A3[0] * MM); cv.height = Math.round(A3[1] * MM);
  const g = cv.getContext("2d"), P = (mm) => mm * MM;
  await document.fonts.ready;
  g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
  let schaal, items, toMm;
  if (plan === "inplanting") {
    const pts = [];
    for (const it of S.I.items) { if (KAT_I[it.k].f === "rect") hoeken(it).forEach((h) => pts.push(lokaal(h[0], h[1]))); else pts.push(lokaal(it.lat, it.lng)); }
    for (const m of S.I.maten) { pts.push(lokaal(m.a[0], m.a[1])); pts.push(lokaal(m.b[0], m.b[1])); }
    if (!pts.length) pts.push([0, 0]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const ew = Math.max(30, Math.max(...xs) - Math.min(...xs) + 16), eh = Math.max(30, Math.max(...ys) - Math.min(...ys) + 16);
    schaal = [100, 200, 250, 500, 1000, 2000].find((s) => (ew * 1000) / s <= VAK.w && (eh * 1000) / s <= VAK.h) || 2000;
    const Wm = (VAK.w * schaal) / 1000, Hm = (VAK.h * schaal) / 1000;
    toMm = (p) => [VAK.x + ((p[0] - (cx - Wm / 2)) * 1000) / schaal, VAK.y + (((cy + Hm / 2) - p[1]) * 1000) / schaal];
    // basiskaart: middelpunt in EPSG:3857
    const c = S.I.center, R = 6378137, lat0 = (c[0] * Math.PI) / 180;
    const latC = c[0] + cy * mLat(), lngC = c[1] + cx * mLng(c[0]);
    const X = (R * lngC * Math.PI) / 180, Y = R * Math.log(Math.tan(Math.PI / 4 + (latC * Math.PI) / 360));
    const k = 1 / Math.cos(lat0), hw = (Wm / 2) * k, hh = (Hm / 2) * k;
    const wpx = Math.round(P(VAK.w)), hpx = Math.round(P(VAK.h));
    const url = "https://geo.api.vlaanderen.be/GRB-basiskaart/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=GRB_BSK&STYLES=&CRS=EPSG:3857&BBOX=" +
      [X - hw, Y - hh, X + hw, Y + hh].map((v) => v.toFixed(2)).join(",") + "&WIDTH=" + wpx + "&HEIGHT=" + hpx + "&FORMAT=image/png";
    try { const bm = await createImageBitmap(await (await fetch(url)).blob()); g.globalAlpha = 0.75; g.drawImage(bm, P(VAK.x), P(VAK.y), wpx, hpx); g.globalAlpha = 1; }
    catch (e) { g.fillStyle = "#f2f3f6"; g.fillRect(P(VAK.x), P(VAK.y), P(VAK.w), P(VAK.h)); }
    g.save(); g.beginPath(); g.rect(P(VAK.x), P(VAK.y), P(VAK.w), P(VAK.h)); g.clip();
    const volg = (it) => (it.k === "zone" ? 0 : it.k === "doorgang" ? 1 : 2);
    for (const it of [...S.I.items].sort((a, b) => volg(a) - volg(b))) {
      const k = KAT_I[it.k];
      if (k.f === "rect") {
        const h = hoeken(it).map((q) => toMm(lokaal(q[0], q[1])));
        g.beginPath(); h.forEach((q, i) => (i ? g.lineTo(P(q[0]), P(q[1])) : g.moveTo(P(q[0]), P(q[1])))); g.closePath();
        g.fillStyle = hexA(k.c, it.k === "zone" ? 0.06 : it.k === "doorgang" ? 0.18 : 0.4); g.fill();
        g.setLineDash(it.k === "zone" || it.k === "doorgang" ? [P(2), P(1.2)] : []); g.lineWidth = P(0.45); g.strokeStyle = k.c; g.stroke(); g.setLineDash([]);
        const m = toMm(lokaal(it.lat, it.lng)); label(g, P(m[0]), P(m[1]), (it.naam || k.n) + " " + fmt(it.w) + "×" + fmt(it.l) + " m", P(2.6));
      } else { const m = toMm(lokaal(it.lat, it.lng)); symbool(g, P(m[0]), P(m[1]), k, P(2.6)); if (it.k === "uitgang") label(g, P(m[0]), P(m[1] + 5), fmt(it.breedte) + " m", P(2.2)); }
    }
    for (const mt of S.I.maten) {
      const a = toMm(lokaal(mt.a[0], mt.a[1])), b = toMm(lokaal(mt.b[0], mt.b[1]));
      g.setLineDash([P(1), P(0.8)]); g.strokeStyle = "#111"; g.lineWidth = P(0.35); g.beginPath(); g.moveTo(P(a[0]), P(a[1])); g.lineTo(P(b[0]), P(b[1])); g.stroke(); g.setLineDash([]);
      label(g, P((a[0] + b[0]) / 2), P((a[1] + b[1]) / 2), fmt(map ? map.distance(mt.a, mt.b) : 0) + " m", P(2.4));
    }
    g.restore();
  } else {
    const { l, b } = S.G;
    schaal = [50, 100, 200, 500].find((s) => ((l + 4) * 1000) / s <= VAK.w && ((b + 4) * 1000) / s <= VAK.h) || 500;
    const ox = VAK.x + (VAK.w - (l * 1000) / schaal) / 2, oy = VAK.y + (VAK.h - (b * 1000) / schaal) / 2, u = 1000 / schaal;
    toMm = (p) => [ox + p[0] * u, oy + p[1] * u];
    g.strokeStyle = "#e4e6ee"; g.lineWidth = P(0.1);
    for (let x = 0; x <= l; x++) { g.beginPath(); g.moveTo(P(ox + x * u), P(oy)); g.lineTo(P(ox + x * u), P(oy + b * u)); g.stroke(); }
    for (let y = 0; y <= b; y++) { g.beginPath(); g.moveTo(P(ox), P(oy + y * u)); g.lineTo(P(ox + l * u), P(oy + y * u)); g.stroke(); }
    g.strokeStyle = "#1a1d2b"; g.lineWidth = P(0.8); g.strokeRect(P(ox), P(oy), P(l * u), P(b * u));
    tekst(g, fmt(l) + " m", P(ox + (l * u) / 2), P(oy - 3), P(3), "center");
    g.save(); g.translate(P(ox - 3), P(oy + (b * u) / 2)); g.rotate(-Math.PI / 2); tekst(g, fmt(b) + " m", 0, 0, P(3), "center"); g.restore();
    for (const it of S.G.items) {
      const k = KAT_G[it.k], c = toMm([it.x, it.y]);
      g.save(); g.translate(P(c[0]), P(c[1])); g.rotate((it.rot * Math.PI) / 180);
      if (k.f === "rect") {
        g.fillStyle = hexA(k.c, 0.35); g.fillRect(P((-it.w / 2) * u), P((-it.l / 2) * u), P(it.w * u), P(it.l * u));
        g.strokeStyle = k.c; g.lineWidth = P(0.4); g.strokeRect(P((-it.w / 2) * u), P((-it.l / 2) * u), P(it.w * u), P(it.l * u));
        g.restore(); label(g, P(c[0]), P(c[1]), it.naam || k.n, P(2.4)); continue;
      }
      if (k.f === "deur") {
        const r = it.w * u, d = it.open === "binnen" ? -1 : 1;
        g.fillStyle = "#fff"; g.fillRect(P(-r / 2), P(-0.6), P(r), P(1.2)); g.strokeStyle = k.c; g.lineWidth = P(0.4); g.strokeRect(P(-r / 2), P(-0.6), P(r), P(1.2));
        g.setLineDash([P(0.8), P(0.6)]); g.beginPath(); g.moveTo(P(-r / 2), 0); g.lineTo(P(-r / 2), P(d * r)); g.arc(P(-r / 2), 0, P(r), d > 0 ? Math.PI / 2 : -Math.PI / 2, 0, d < 0); g.stroke(); g.setLineDash([]);
        if (it.k === "nooduitgang") { g.fillStyle = "#1f9d55"; g.fillRect(P(-4), P(-d * 4.5 - 1.6), P(8), P(3.2)); g.rotate((-it.rot * Math.PI) / 180); tekst(g, "NOOD", 0, 0, 0, "center"); }
        g.restore();
        const lt = toMm([it.x + Math.sin((it.rot * Math.PI) / 180) * -(it.w + 0.6) * (it.open === "binnen" ? -1 : 1), it.y + Math.cos((it.rot * Math.PI) / 180) * (it.w + 0.6) * (it.open === "binnen" ? -1 : 1)]);
        label(g, P(lt[0]), P(lt[1]), fmt(it.w) + " m", P(2.2));
        if (it.k === "nooduitgang") { const nl = toMm([it.x + Math.sin((it.rot * Math.PI) / 180) * 0.9 * (it.open === "binnen" ? -1 : 1), it.y - Math.cos((it.rot * Math.PI) / 180) * 0.9 * (it.open === "binnen" ? -1 : 1)]); label(g, P(nl[0]), P(nl[1]), "NOOD", P(2.2), "#1f9d55", "#fff"); }
        continue;
      }
      g.restore(); symbool(g, P(c[0]), P(c[1]), k, P(2.6));
    }
  }
  // kader, schaalstok, noordpijl
  g.strokeStyle = "#1a1d2b"; g.lineWidth = P(0.35); g.strokeRect(P(VAK.x), P(VAK.y), P(VAK.w), P(VAK.h));
  schaalstok(g, P, schaal, VAK.x, VAK.y + VAK.h + 8);
  noordpijl(g, P, VAK.x + VAK.w - 10, VAK.y + 14);
  titelblok(g, P, plan, schaal);
  // watermerk
  g.save(); g.translate(cv.width / 2, cv.height / 2); g.rotate(-Math.PI / 9); g.fillStyle = "rgba(255,90,78,0.16)";
  g.font = "700 " + P(22) + "px 'Instrument Sans', Arial, sans-serif"; g.textAlign = "center"; g.fillText("ONTWERP – nog niet nagekeken", 0, 0); g.restore();
  return { canvas: cv, schaal };
}
function hexA(h, a) { const n = parseInt(h.slice(1), 16); return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")"; }
function tekst(g, t, x, y, size, align, kleur, gewicht) { if (size) g.font = (gewicht || "600") + " " + size + "px 'Instrument Sans', Arial, sans-serif"; g.fillStyle = kleur || "#fff"; g.textAlign = align || "left"; g.textBaseline = "middle"; g.fillText(t, x, y); }
function label(g, x, y, t, size, bg, kleur) {
  g.font = "600 " + size + "px 'Instrument Sans', Arial, sans-serif"; const w = g.measureText(t).width + size * 0.7, h = size * 1.45;
  g.fillStyle = bg || "rgba(255,255,255,0.92)"; g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = size * 0.06;
  g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, size * 0.25); g.fill(); g.stroke();
  g.fillStyle = kleur || "#1a1d2b"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, x, y + size * 0.05);
}
function symbool(g, x, y, k, r) {
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = k.c; g.fill(); g.lineWidth = r * 0.22; g.strokeStyle = "#fff"; g.stroke();
  tekst(g, k.s, x, y + r * 0.05, r * 1.1, "center", "#fff", "700");
}
function schaalstok(g, P, schaal, x, y) {
  const opties = [1, 2, 5, 10, 20, 25, 50, 100, 200], stapM = opties.find((m) => (m * 1000) / schaal >= 12) || 200, seg = (stapM * 1000) / schaal;
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? "#fff" : "#1a1d2b"; g.fillRect(P(x + i * seg), P(y), P(seg), P(2)); g.strokeStyle = "#1a1d2b"; g.lineWidth = P(0.25); g.strokeRect(P(x + i * seg), P(y), P(seg), P(2)); }
  for (let i = 0; i <= 4; i++) tekst(g, String(i * stapM), P(x + i * seg), P(y + 5), P(2.6), "center", "#1a1d2b", "500");
  tekst(g, "meter  ·  schaal 1/" + schaal + " op A3", P(x + 4 * seg + 6), P(y + 1), P(2.8), "left", "#1a1d2b", "600");
}
function noordpijl(g, P, x, y) {
  g.fillStyle = "#1a1d2b"; g.beginPath(); g.moveTo(P(x), P(y - 7)); g.lineTo(P(x + 3.5), P(y + 3)); g.lineTo(P(x), P(y + 1)); g.lineTo(P(x - 3.5), P(y + 3)); g.closePath(); g.fill();
  tekst(g, "N", P(x), P(y + 7), P(4), "center", "#1a1d2b", "700");
}
function titelblok(g, P, plan, schaal) {
  const x = 318, w = 92; let y = 10;
  g.strokeStyle = "#1a1d2b"; g.lineWidth = P(0.35); g.strokeRect(P(x), P(y), P(w), P(277));
  g.fillStyle = "#1a1d2b"; g.fillRect(P(x), P(y), P(w), P(22));
  tekst(g, NAAM_PLAN[plan], P(x + 5), P(y + 8), P(5.2), "left", "#fff", "700");
  tekst(g, S.d.evenement || "Evenement", P(x + 5), P(y + 16), P(3.4), "left", "#fff", "500");
  y += 30;
  const rij = (k, v) => { tekst(g, k, P(x + 5), P(y), P(2.6), "left", "#7d839a", "600"); y += 4.6; for (const r of breek(g, v || "–", P(3.2), P(w - 10))) { tekst(g, r, P(x + 5), P(y), P(3.2), "left", "#1a1d2b", "500"); y += 4.6; } y += 2.4; };
  rij("Organisator", S.d.organisator);
  rij("Plaats", [S.d.plek, S.d.adres || S.d.gemeente].filter(Boolean).join(", "));
  rij("Datum evenement", S.d.datum);
  rij("Personen tegelijk", String(S.personen));
  if (plan === "grondplan") rij("Ruimte", (S.G.mat || "") + " · " + fmt(S.G.l) + " × " + fmt(S.G.b) + " m");
  rij("Dossier", DEMO ? "demo" : AUTH.id);
  rij("Schaal", "1/" + schaal + " op A3 · noorden boven");
  rij("Opgemaakt", new Date().toLocaleDateString("nl-BE"));
  y += 2; tekst(g, "Legende", P(x + 5), P(y), P(3.4), "left", "#1a1d2b", "700"); y += 6;
  const gebruikt = [...new Set((plan === "inplanting" ? S.I.items : S.G.items).map((i) => i.k))];
  for (const kk of gebruikt) {
    const k = KAT[plan][kk];
    if (k.f === "pt") symbool(g, P(x + 7), P(y), k, P(1.8)); else { g.fillStyle = hexA(k.c, 0.45); g.fillRect(P(x + 5), P(y - 1.8), P(4), P(3.6)); g.strokeStyle = k.c; g.lineWidth = P(0.3); g.strokeRect(P(x + 5), P(y - 1.8), P(4), P(3.6)); }
    tekst(g, k.n, P(x + 12), P(y), P(3), "left", "#1a1d2b", "500"); y += 6;
  }
  if (plan === "inplanting" && S.I.maten.length) { g.setLineDash([P(1), P(0.8)]); g.strokeStyle = "#111"; g.beginPath(); g.moveTo(P(x + 5), P(y)); g.lineTo(P(x + 10), P(y)); g.stroke(); g.setLineDash([]); tekst(g, "Maatlijn (m)", P(x + 12), P(y), P(3), "left", "#1a1d2b", "500"); y += 6; }
  const voet = plan === "inplanting" ? ["Ondergrond: Grootschalig Referentie Bestand", "Vlaanderen, Digitaal Vlaanderen"] : [];
  voet.push("Getekend met de plantekenaar van", "evenementaanvragen.be");
  let fy = 283 - voet.length * 4; for (const r of voet) { tekst(g, r, P(x + 5), P(fy), P(2.4), "left", "#7d839a", "500"); fy += 4; }
}
function breek(g, t, size, max) {
  g.font = "500 " + size + "px 'Instrument Sans', Arial, sans-serif"; const w = String(t).split(" "), r = []; let lijn = "";
  for (const woord of w) { const p = lijn ? lijn + " " + woord : woord; if (g.measureText(p).width > max && lijn) { r.push(lijn); lijn = woord; } else lijn = p; }
  if (lijn) r.push(lijn); return r.slice(0, 3);
}

// ---------- Opslaan ----------
let voorbeeldUrl = null;
async function tekenOpslaan() {
  const ok = alleOk(S.actief), w = $("opslaanwrap");
  w.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px"><img class="voorbeeld" id="vb" alt="Voorbeeld van het plan op A3"><button class="btn primary" id="opslaan" type="button"' + (ok && !DEMO ? "" : " disabled") + ">Opslaan in mijn dossier</button>" +
    (DEMO ? '<p class="melding">In de demo kan je niet opslaan.</p>' : ok ? '<p class="melding">We kijken je plan na voor we het indienen.</p>' : '<p class="melding">Los eerst alles in het rood op. Je kan terug naar een stap via de balk bovenaan.</p>') + "</div>";
  const blad = await maakBlad(S.actief);
  voorbeeldUrl = blad.canvas.toDataURL("image/jpeg", 0.85);
  if ($("vb")) { $("vb").src = voorbeeldUrl; $("vb").onclick = () => { const d = document.createElement("div"); d.className = "groot"; d.innerHTML = '<img alt="">'; d.firstChild.src = voorbeeldUrl; d.onclick = () => d.remove(); document.body.appendChild(d); }; }
  if ($("opslaan")) $("opslaan").addEventListener("click", () => opslaan(blad.canvas));
}
async function opslaan(cv) {
  if (DEMO || !alleOk(S.actief)) return;
  const b = $("opslaan"); b.disabled = true; $("msg").textContent = "Bezig met opslaan…";
  try {
    const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
    pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 420, 297);
    const data = pdf.output("datauristring").split(",")[1];
    const plan = S.actief === "inplanting" ? { items: S.I.items, maten: S.I.maten, center: S.I.center } : { ruimte: { l: S.G.l, b: S.G.b, mat: S.G.mat }, items: S.G.items };
    const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ actie: "plan", id: AUTH.id, email: AUTH.email, soort: S.actief, personen: S.personen, pdf: data, plan, controles: controles(S.actief) }) });
    const j = await r.json(); if (!j.ok) throw new Error(j.error || "onbekende fout");
    $("msg").textContent = NAAM_PLAN[S.actief] + " staat in je dossier. We kijken het na en laten het je weten als er iets aan moet.";
  } catch (e) { $("msg").textContent = "Opslaan lukte niet (" + e.message + "). Probeer opnieuw."; b.disabled = false; }
}

// ---------- Start ----------
function start(d) {
  $("login").hidden = true; $("app").hidden = false;
  laad(d);
  $("dossierinfo").innerHTML = (DEMO ? '<span class="pill demo">Demo</span>' : '<span class="pill">' + esc(AUTH.id) + "</span>") + "<span>" + esc(d.evenement || "") + (d.gemeente ? " · " + esc(d.gemeente) : "") + "</span>";
  $("tabs").innerHTML = S.plannen.map((p) => '<button role="tab" type="button" data-plan="' + p + '">' + NAAM_PLAN[p] + "</button>").join("");
  $("tabs").hidden = S.plannen.length < 2;
  $("tabs").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => wisselPlan(b.dataset.plan)));
  $("terug").addEventListener("click", () => naarStap(S.stap[S.actief] - 1));
  $("verder").addEventListener("click", () => naarStap(S.stap[S.actief] + 1));
  window.addEventListener("resize", () => { if (S.actief === "grondplan") tekenGrondplan(); });
  wisselPlan(S.actief);
  if (S.actief === "inplanting" && !S.I.gezocht && S.d.adres) setTimeout(zoekAdres, 300);
}
const DEMO_DOSSIER = { evenement: "Lentefuif (demo)", gemeente: "Oostende", adres: "Wellingtonstraat 10, 8400 Oostende", datum: "zaterdag 17 april 2027", bezoekers: 300, situatie: "tent", tent: "20 x 10", organisator: "Jeugdhuis Voorbeeld" };
async function login(id, email) {
  $("l-err").hidden = true; $("l-go").disabled = true;
  try {
    const r = await fetch(ENDPOINT + "?plan=" + encodeURIComponent(id) + "&email=" + encodeURIComponent(email));
    const j = await r.json(); if (!j.ok) throw new Error(j.error);
    AUTH = { id, email }; try { sessionStorage.setItem("plantekenaar-login", JSON.stringify(AUTH)); } catch (e) {}
    start(j.dossier);
  } catch (e) { $("l-err").textContent = e.message || "Openen lukte niet."; $("l-err").hidden = false; $("l-go").disabled = false; }
}
fetch("/plan/normen.json").then((r) => r.json()).then((j) => { NORMEN = j; if (S) tekenControles(); }).catch(() => {});
const q = new URLSearchParams(location.search);
if (q.get("demo") !== null) { DEMO = true; start(DEMO_DOSSIER); }
else {
  $("login").hidden = false;
  if (q.get("id")) $("l-id").value = q.get("id");
  let opgeslagen = null; try { opgeslagen = JSON.parse(sessionStorage.getItem("plantekenaar-login") || "null"); } catch (e) {}
  if (opgeslagen && (!q.get("id") || q.get("id") === opgeslagen.id)) login(opgeslagen.id, opgeslagen.email);
  $("l-go").addEventListener("click", () => { const id = $("l-id").value.trim().toUpperCase(), em = $("l-mail").value.trim(); if (!id || !em) { $("l-err").textContent = "Vul je dossiernummer en e-mail in."; $("l-err").hidden = false; return; } login(id, em); });
  $("l-demo").addEventListener("click", () => { DEMO = true; history.replaceState(null, "", "?demo"); start(DEMO_DOSSIER); });
}
})();
