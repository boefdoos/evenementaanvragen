/* Begeleide plantekenaar – evenementaanvragen.be
 * Inplantingsplan op de basiskaart (GRB) en grondplan van een tent of zaal, in stappen.
 * Afwerken kan pas als alle controles in orde zijn. Het plan gaat als pdf (A3, op schaal) naar de bijlagenmap
 * van het dossier. Het plan is van de organisator; wij kijken het na vóór de indiening.
 * Beheermodus (?beheer=<sleutel>): Thomas corrigeert of tekent een plan; er komt een conceptmail naar de klant.
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
  // Sinds 9/11/2026, uit de vragen van Eaglebe (zie claude/eaglebe-oostende-9-11.md)
  od: { n: "Inname openbaar domein", c: "#c0399a", w: 20, l: 8, f: "rect" },
  bbq: { n: "Barbecue / kookplaats", c: "#b5462b", w: 2, l: 1, f: "rect" },
  springkasteel: { n: "Springkasteel / opblaasbaar", c: "#e46f9d", w: 6, l: 5, f: "rect" },
  fiets: { n: "Fietsenstalling", c: "#2f8f6b", w: 6, l: 2, f: "rect" },
  parkeerverbod: { n: "Parkeerverbod", c: "#3a5fb0", w: 20, l: 2.5, f: "rect" },
  luidspreker: { n: "Luidspreker", c: "#6a4c93", f: "pt", s: "L" },
  afval: { n: "Afval / container", c: "#5b6b3a", f: "pt", s: "A" },
};
// Vlakken die geen opstelling zijn (geen obstakel, mogen buiten het terrein liggen).
const GEEN_OPSTELLING = ["zone", "doorgang", "od", "parkeerverbod", "fiets"];
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
    { t: "Terrein", u: "Zoek het adres en duid het terrein van je evenement aan. Sleep het vlak naar de juiste plaats. Met het witte hoekpunt maak je het groter of kleiner, met het ronde punt erboven draai je het.", el: ["zone", "od"], veld: "terrein" },
    { t: "Opstelling", u: "Zet alles wat er komt op zijn plaats, met de echte maten. Sleep een vlak om het te verplaatsen. Klik het aan: met het hoekpunt verander je de maten, met het ronde punt draai je het. Je kan de maten ook links intypen.", el: ["tent", "podium", "bar", "toilet", "food", "stroom", "bbq", "springkasteel", "luidspreker", "afval", "fiets"] },
    { t: "Hulpdiensten en uitgangen", u: "Duid de vrije doorgang voor brandweer en ziekenwagen aan, de ingang en de nooduitgangen. Meet met een maatlijn de afstand tot de gebouwen errond.", el: ["doorgang", "ingang", "uitgang", "parkeerverbod"], maat: true },
    { t: "Veiligheid", u: "Duid de blustoestellen en de EHBO-post aan.", el: ["blus", "ehbo"] },
    { t: "Controle", u: "Alles in het groen? Dan kan je je plan afwerken. Het gaat zo bij je aanvraag.", controle: true },
  ],
  grondplan: [
    { t: "Ruimte", u: "Teken de vorm van de tent of zaal met de binnenmaten. Sleep een hoekpunt of een wand om de maten te veranderen, of klik een wand aan en typ de lengte. Is de zaal niet rechthoekig: klik een hoek aan en kies \"Hoek inspringen\", of splits een wand en sleep het middenstuk naar binnen of buiten.", el: [], veld: "ruimte" },
    { t: "Uitgangen", u: "Zet de deuren en nooduitgangen in de wanden. Ze klikken vast aan de dichtste wand, naast elkaar en nooit over elkaar. Kies bij elke deur de draairichting.", el: ["deur", "nooduitgang"] },
    { t: "Opstelling", u: "Zet podium, bar, dj en tafels op hun plaats. Hou de ruimte voor de uitgangen vrij. Wat over elkaar of buiten de ruimte staat, kleurt rood.", el: ["podium", "bar", "dj", "tafel"] },
    { t: "Veiligheid", u: "Duid de blustoestellen, de noodverlichting boven de uitgangen en de stroomaansluiting aan.", el: ["blus", "nood", "stroom"] },
    { t: "Controle", u: "Alles in het groen? Dan kan je je plan afwerken. Het gaat zo bij je aanvraag.", controle: true },
  ],
};

// ---------- Toestand ----------
let S = null, sel = null, uid = 1, DEMO = false, AUTH = null, NORMEN = null, BEHEER = false;
// Welke plannen dit dossier nodig heeft, met de reden. Zelfde regels als de agent (skill, stap 4 punt 7):
// inplantingsplan bij buiten, tent, openbaar domein, vanaf 500 bezoekers of als de gemeente het vraagt;
// grondplan bij een tent of zaal (bij een zaal vraagt de brandweer het meestal), of als de gemeente het vraagt.
let PLANNEN_GEMEENTE = {};
function nodigePlannen(d) {
  const sit = d.situatie || "tent", g = PLANNEN_GEMEENTE[d.gemeente] || {}, r = { inplanting: [], grondplan: [] };
  if (sit === "tent") { r.inplanting.push("tent"); r.grondplan.push("tent"); }
  if (sit === "buiten") r.inplanting.push("buiten");
  if (sit === "zaal") r.grondplan.push("zaal");
  if (/^(ja|deels)$/i.test(String(d.openbaar || ""))) r.inplanting.push("openbaar domein");
  if ((+d.bezoekers || 0) >= 500) r.inplanting.push("500 bezoekers of meer");
  if (g.inplanting) r.inplanting.push(d.gemeente + " vraagt het");
  if (g.grondplan && sit !== "buiten") r.grondplan.push(d.gemeente + " vraagt het");
  const plannen = ["inplanting", "grondplan"].filter((p) => r[p].length);
  return { plannen: plannen.length ? plannen : ["inplanting", "grondplan"], redenen: r, citaat: g };
}
function nieuweStaat(d) {
  const sit = d.situatie || "tent";
  const plannen = nodigePlannen(d).plannen;
  const tent = String(d.tent || "").match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  const tl = tent ? parseFloat(tent[1].replace(",", ".")) : 12, tb = tent ? parseFloat(tent[2].replace(",", ".")) : 6;
  return {
    d, plannen, actief: plannen[0], stap: { inplanting: 0, grondplan: 0 },
    personen: +d.bezoekers || 150,
    I: { center: [51.2265, 2.9085], zoom: 19, items: [], maten: [], tent: [tl, tb], gezocht: false },
    G: { l: sit === "zaal" ? 20 : tl, b: sit === "zaal" ? 12 : tb, mat: sit === "zaal" ? "" : "tent", items: [], pts: rechthoek(sit === "zaal" ? 20 : tl, sit === "zaal" ? 12 : tb), recht: true },
  };
}
const sleutel = () => "plantekenaar:" + (DEMO ? "demo" : (BEHEER ? "beheer:" : "") + AUTH.id);
function bewaar() { if (S) S.t = Date.now(); try { localStorage.setItem(sleutel(), JSON.stringify(S)); } catch (e) {} }
// Het laatst opgeslagen plan uit het dossier (bv. aangepast door ons, of op een ander toestel getekend).
function vanServer(s, laatste) {
  if (!laatste) return;
  const l = laatste.inplanting, g = laatste.grondplan;
  if (l && l.plan && Array.isArray(l.plan.items)) { s.I.items = l.plan.items; s.I.maten = l.plan.maten || []; if (l.plan.center) s.I.center = l.plan.center; s.I.gezocht = true; if (l.plan.innameHeelTerrein === false) s.I.odHeel = false; }
  if (g && g.plan && Array.isArray(g.plan.items)) { s.G.items = g.plan.items; if (g.plan.ruimte) { s.G.l = +g.plan.ruimte.l || s.G.l; s.G.b = +g.plan.ruimte.b || s.G.b; s.G.mat = g.plan.ruimte.mat || ""; s.G.pts = geldigeVorm(g.plan.ruimte.pts) || rechthoek(s.G.l, s.G.b); if (g.plan.ruimte.recht === false) s.G.recht = false; } }
  const p = (l && l.personen) || (g && g.personen); if (p) s.personen = +p || s.personen;
}
function laad(d) {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(sleutel()) || "null"); } catch (e) {}
  if (!(s && s.I && s.G)) s = null;
  const la = d.laatste || {}, serverT = Math.max((la.inplanting && la.inplanting.t) || 0, (la.grondplan && la.grondplan.t) || 0);
  if (!s || (serverT && serverT > (s.t || 0))) { const n = nieuweStaat(d); vanServer(n, la); if (s) { n.stap = s.stap; n.actief = s.actief; } s = n; }
  S = s;
  S.d = d;
  S.personen = Math.max(minPersonen(), +S.personen || 1);
  if (!geldigeVorm(S.G.pts)) S.G.pts = rechthoek(S.G.l, S.G.b); // plannen van vóór de vrije vorm
  if (S.G.recht === undefined) S.G.recht = true;
  normaliseer();
  uid = 1 + Math.max(0, ...S.I.items.map((i) => i.id), ...S.I.maten.map((i) => i.id), ...S.G.items.map((i) => i.id));
}

// Het aantal personen uit de aanvraag is het minimum: lager zou de eisen voor uitgangen versoepelen.
// In de beheermodus mag Thomas lager gaan (bv. als de aanvraag zelf fout was).
function minPersonen() { return BEHEER || DEMO ? 1 : Math.max(1, +(S && S.d && S.d.bezoekers) || 1); }

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
// Kleinste maat van een vlak. De doorgang voor de hulpdiensten kan niet smaller dan de norm (overal 4 m volgens
// normen.json, met bron); andere vlakken minstens 0,5 m.
function minZijde(it) {
  if (it.k !== "doorgang") return 0.5;
  const nd = norm("doorgang_hulpdiensten");
  return (nd && nd.breedte_m) || 0.5;
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
  // GRB-basiskaart als WMTS (voorgerenderde tegels: sneller en betrouwbaarder dan de WMS).
  const grb = L.tileLayer(GRB_WMTS, {
    maxZoom: 22, maxNativeZoom: 21,
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
  const volgorde = (it) => (it.k === "zone" ? 0 : it.k === "od" ? 1 : it.k === "doorgang" ? 2 : 3);
  for (const it of [...S.I.items].sort((a, b) => volgorde(a) - volgorde(b))) {
    const k = KAT_I[it.k];
    if (k.f === "rect") {
      const p = L.polygon(hoeken(it), {
        color: k.c, weight: sel === it.id ? 3 : 2,
        fillOpacity: it.k === "zone" ? 0.05 : ["doorgang", "od", "parkeerverbod"].includes(it.k) ? 0.15 : 0.35,
        dashArray: ["doorgang", "zone", "od", "parkeerverbod"].includes(it.k) ? "6 4" : null,
      }).on("click", (e) => { L.DomEvent.stop(e); if (maatModus) return kaartKlik(e); if (!versleept) kies(it.id); }).addTo(laag);
      polys[it.id] = p;
      vlakSleepbaar(p, it);
      const m = L.marker([it.lat, it.lng], { draggable: true, icon: L.divIcon({ className: "lbl", html: "<span>" + esc(it.naam || k.n) + " · " + fmt(it.w) + "×" + fmt(it.l) + " m</span>", iconSize: [0, 0] }) });
      m.on("dragstart", () => kies(it.id, true));
      m.on("drag", (e) => { const q = e.target.getLatLng(); it.lat = q.lat; it.lng = q.lng; polys[it.id].setLatLngs(hoeken(it)); });
      m.on("dragend", () => { allesTekenen(); bewaar(); });
      m.on("click", (e) => (maatModus ? kaartKlik(e) : kies(it.id)));
      m.addTo(laag);
      if (sel === it.id) grepen(it);
    } else {
      const m = L.marker([it.lat, it.lng], { draggable: true, icon: L.divIcon({ className: "sym", html: '<span style="background:' + k.c + '">' + esc(k.s) + "</span>", iconSize: [0, 0] }) });
      m.on("dragend", (e) => { const q = e.target.getLatLng(); it.lat = q.lat; it.lng = q.lng; allesTekenen(); bewaar(); });
      m.on("click", (e) => (maatModus ? kaartKlik(e) : kies(it.id)));
      m.addTo(laag);
    }
  }
  for (const mt of S.I.maten) {
    L.polyline([mt.a, mt.b], { color: "#111", weight: 2, dashArray: "3 4" }).addTo(laag);
    L.marker([(mt.a[0] + mt.b[0]) / 2, (mt.a[1] + mt.b[1]) / 2], { interactive: false, icon: L.divIcon({ className: "lbl", html: "<span>" + fmt(map.distance(mt.a, mt.b)) + " m</span>", iconSize: [0, 0] }) }).addTo(laag);
  }
}
// Een vlak verslepen door het zelf vast te pakken (muis en aanraking). Buiten de vlakken versleep je de kaart.
let versleept = false;
function metersVan(it, ll) { return [(ll.lng - it.lng) / mLng(it.lat), (ll.lat - it.lat) / mLat()]; }
function naarLatLng(it, x, y) { return [it.lat + y * mLat(), it.lng + x * mLng(it.lat)]; }
function vlakSleepbaar(poly, it) {
  const el = poly.getElement(); if (!el) return;
  el.style.cursor = "move";
  el.addEventListener("pointerdown", (ev) => {
    if (maatModus || ev.button > 0) return;
    ev.stopPropagation();
    map.dragging.disable();
    const start = map.mouseEventToLatLng(ev), van = [it.lat, it.lng];
    versleept = false;
    if (sel !== it.id) { sel = it.id; tekenLijst(); tekenStap(); }
    const beweeg = (e) => {
      const q = map.mouseEventToLatLng(e);
      if (!versleept && map.latLngToContainerPoint(q).distanceTo(map.latLngToContainerPoint(start)) < 3) return;
      versleept = true;
      it.lat = van[0] + (q.lat - start.lat); it.lng = van[1] + (q.lng - start.lng);
      poly.setLatLngs(hoeken(it));
    };
    const los = () => {
      document.removeEventListener("pointermove", beweeg); document.removeEventListener("pointerup", los); document.removeEventListener("pointercancel", los);
      map.dragging.enable();
      allesTekenen(); bewaar();
      setTimeout(() => { versleept = false; }, 0);
    };
    document.addEventListener("pointermove", beweeg); document.addEventListener("pointerup", los); document.addEventListener("pointercancel", los);
  });
}
// Greep in de hoek (grootte, tegenoverliggende hoek blijft staan) en draaigreep boven het gekozen vlak.
function greepIcoon(kl, titel) { return L.divIcon({ className: "greep " + kl, html: '<span title="' + titel + '"></span>', iconSize: [0, 0] }); }
function grepen(it) {
  const a = () => (it.rot * Math.PI) / 180;
  const rot = (x, y) => [x * Math.cos(a()) - y * Math.sin(a()), x * Math.sin(a()) + y * Math.cos(a())];
  const hoekPos = () => { const [x, y] = rot(it.w / 2, it.l / 2); return naarLatLng(it, x, y); };
  const draaiAf = () => it.l / 2 + Math.max(2, it.l * 0.2);
  const draaiPos = () => { const [x, y] = rot(0, draaiAf()); return naarLatLng(it, x, y); };
  const hoek = L.marker(hoekPos(), { draggable: true, icon: greepIcoon("maat", "Sleep om de maten te veranderen"), zIndexOffset: 1000 }).addTo(laag);
  const draai = L.marker(draaiPos(), { draggable: true, icon: greepIcoon("draai", "Sleep om te draaien"), zIndexOffset: 1000 }).addTo(laag);
  const lijn = L.polyline([[it.lat, it.lng], draaiPos()], { color: "#1a1d2b", weight: 1, dashArray: "2 3", interactive: false }).addTo(laag);
  let vast = null;
  hoek.on("dragstart", () => { const [x, y] = rot(-it.w / 2, -it.l / 2); vast = naarLatLng(it, x, y); vast = { lat: vast[0], lng: vast[1] }; });
  hoek.on("drag", (e) => {
    const q = e.target.getLatLng();
    const dx = (q.lng - vast.lng) / mLng(vast.lat), dy = (q.lat - vast.lat) / mLat();
    // terug naar het assenstelsel van het vlak
    const lx = dx * Math.cos(a()) + dy * Math.sin(a()), ly = -dx * Math.sin(a()) + dy * Math.cos(a());
    it.w = Math.max(minZijde(it), Math.round(lx * 10) / 10); it.l = Math.max(minZijde(it), Math.round(ly * 10) / 10);
    const [cx, cy] = rot(it.w / 2, it.l / 2);
    it.lat = vast.lat + cy * mLat(); it.lng = vast.lng + cx * mLng(vast.lat);
    polys[it.id].setLatLngs(hoeken(it)); draai.setLatLng(draaiPos()); lijn.setLatLngs([[it.lat, it.lng], draaiPos()]);
  });
  draai.on("drag", (e) => {
    const [vx, vy] = metersVan(it, e.target.getLatLng());
    let g = Math.round((Math.atan2(-vx, vy) * 180) / Math.PI);
    g = ((g % 360) + 360) % 360;
    // stevig vastklikken op 0/90/180/270°, zacht op elke 15°
    const r90 = Math.round(g / 90) * 90, r15 = Math.round(g / 15) * 15;
    if (Math.abs(r90 - g) <= 7) g = r90 % 360; else if (Math.abs(r15 - g) <= 2) g = r15 % 360;
    it.rot = g;
    polys[it.id].setLatLngs(hoeken(it)); hoek.setLatLng(hoekPos()); lijn.setLatLngs([[it.lat, it.lng], draaiPos()]);
  });
  for (const m of [hoek, draai]) m.on("dragend", () => { allesTekenen(); bewaar(); });
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
// De ruimte is een veelhoek (S.G.pts, hoekpunten in meter, linksboven op 0,0). S.G.l en S.G.b zijn de buitenmaten.
// "Rechte hoeken" (S.G.recht): bij het slepen van een hoekpunt schuiven de aangrenzende wanden mee, zodat
// horizontale en verticale wanden recht blijven. Uit = vrije vorm (bv. een schuine wand).
function rechthoek(l, b) { return [[0, 0], [l, 0], [l, b], [0, b]]; }
function geldigeVorm(p) { return Array.isArray(p) && p.length >= 3 && p.every((q) => Array.isArray(q) && isFinite(q[0]) && isFinite(q[1])) ? p.map((q) => [+q[0], +q[1]]) : null; }
const r2 = (n) => Math.round(n * 100) / 100;
function wandenG(p) { p = p || S.G.pts; return p.map((a, i) => [a, p[(i + 1) % p.length]]); }
function oppG(p) { p = p || S.G.pts; let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
function inVorm(q, p) { // even-oneven-regel
  p = p || S.G.pts; let binnen = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) binnen = !binnen;
  }
  return binnen;
}
function afstSeg(q, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2)) : 0;
  return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy);
}
function afstRand(q, p) { return Math.min(...wandenG(p).map(([a, b]) => afstSeg(q, a, b))); }
function binnenG(q, tol) { return inVorm(q) || afstRand(q) <= (tol || 0); }
function isRechthoek(p) {
  p = p || S.G.pts; if (p.length !== 4) return false;
  return wandenG(p).every(([a, b]) => Math.abs(a[0] - b[0]) < 1e-6 || Math.abs(a[1] - b[1]) < 1e-6);
}
function snijden(a, b, c, d) { // snijden de lijnstukken ab en cd elkaar (eindpunten niet meegerekend)?
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9));
}
// Een bruikbare vorm: elke wand minstens 0,5 m, geen wanden die elkaar kruisen, minstens 2 m².
function vormOk(p) {
  const w = wandenG(p);
  if (w.some(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.5)) return false;
  for (let i = 0; i < w.length; i++) for (let j = i + 2; j < w.length; j++) {
    if (i === 0 && j === w.length - 1) continue;
    if (snijden(w[i][0], w[i][1], w[j][0], w[j][1])) return false;
  }
  return oppG(p) >= 2;
}
// Linksboven op 0,0 zetten (elementen schuiven mee), punten op elkaar en punten midden op een rechte wand weghalen.
function normaliseer() {
  let p = S.G.pts.map((q) => [r2(q[0]), r2(q[1])]);
  p = p.filter((q, i) => { const v = p[(i - 1 + p.length) % p.length]; return Math.hypot(q[0] - v[0], q[1] - v[1]) > 1e-6; });
  let veranderd = true;
  while (veranderd && p.length > 3) {
    veranderd = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i - 1 + p.length) % p.length], q = p[i], c = p[(i + 1) % p.length];
      if (Math.abs((q[0] - a[0]) * (c[1] - a[1]) - (q[1] - a[1]) * (c[0] - a[0])) < 1e-6) { p.splice(i, 1); veranderd = true; break; }
    }
  }
  const mx = Math.min(...p.map((q) => q[0])), my = Math.min(...p.map((q) => q[1]));
  if (mx || my) { p = p.map((q) => [r2(q[0] - mx), r2(q[1] - my)]); for (const it of S.G.items) { it.x = r2(it.x - mx); it.y = r2(it.y - my); } }
  S.G.pts = p; S.G.l = Math.max(...p.map((q) => q[0])); S.G.b = Math.max(...p.map((q) => q[1]));
}
// Na een wijziging van de vorm: elke deur opnieuw in een wand, naast de andere deuren.
function deurenInWand() { for (const d of S.G.items.filter((i) => KAT_G[i.k].f === "deur")) klikAanWand(d); }

let vsel = null, vsleep = null; // gekozen hoekpunt of wand ({t: "v"|"e", i}) en slepen in de stap Ruimte
const vormStap = () => S.actief === "grondplan" && STAPPEN.grondplan[S.stap.grondplan].veld === "ruimte";
// Wat over elkaar of buiten de ruimte staat (rood in de tekening).
function conflicten() {
  const uit = new Set(), rects = S.G.items.filter((i) => KAT_G[i.k].f === "rect"), R = (o) => ({ cx: o.x, cy: o.y, w: o.w, l: o.l, rot: o.rot });
  for (const o of rects) if (puntenIn(R(o), 0.25).some((q) => !binnenG(q, 0.01))) uit.add(o.id);
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (rectsOverlappen(R(rects[i]), R(rects[j]), 0.05)) { uit.add(rects[i].id); uit.add(rects[j].id); }
  for (const d of S.G.items.filter((i) => KAT_G[i.k].f === "deur")) if (afstRand([d.x, d.y]) > 0.05) uit.add(d.id);
  return uit;
}
function tekenGrondplan() {
  const { l, b } = S.G, mg = 2, W = l + 2 * mg, H = b + 2 * mg, p = S.G.pts, vs = vormStap();
  const px = Math.max(14, Math.min(48, Math.floor(Math.min(($("gp").clientWidth - 48) / W, ($("gp").clientHeight - 110) / H))));
  const pad = "M " + p.map((q) => q[0] + " " + q[1]).join(" L ") + " Z";
  let s = '<svg id="gsvg" xmlns="http://www.w3.org/2000/svg" viewBox="' + -mg + " " + -mg + " " + W + " " + H + '" width="' + W * px + '" height="' + H * px + '" font-family="Instrument Sans, Arial, sans-serif">';
  s += '<defs><clipPath id="gclip"><path d="' + pad + '"/></clipPath></defs><g clip-path="url(#gclip)">';
  for (let x = 0; x <= l; x++) s += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + b + '" stroke="#e4e6ee" stroke-width="0.02"/>';
  for (let y = 0; y <= b; y++) s += '<line x1="0" y1="' + y + '" x2="' + l + '" y2="' + y + '" stroke="#e4e6ee" stroke-width="0.02"/>';
  s += "</g>";
  s += '<path d="' + pad + '" fill="none" stroke="#1a1d2b" stroke-width="0.15" stroke-linejoin="miter"/>';
  // maat van elke wand, aan de buitenkant
  wandenG().forEach(([a, c], i) => {
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 0.01) return;
    const ux = (c[0] - a[0]) / L, uy = (c[1] - a[1]) / L, mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2;
    let nx = uy, ny = -ux; if (inVorm([mx + nx * 0.05, my + ny * 0.05])) { nx = -nx; ny = -ny; }
    let hoek = (Math.atan2(uy, ux) * 180) / Math.PI; if (hoek > 90) hoek -= 180; if (hoek <= -90) hoek += 180;
    const tx = mx + nx * 0.6, ty = my + ny * 0.6 + 0.15;
    const gekozen = vs && vsel && vsel.t === "e" && vsel.i === i;
    s += '<text x="' + tx + '" y="' + ty + '" text-anchor="middle" font-size="0.42" font-weight="' + (gekozen ? 700 : 400) + '" fill="' + (gekozen ? "#d9480f" : "#1a1d2b") + '" transform="rotate(' + hoek + " " + tx + " " + (ty - 0.15) + ')">' + fmt(L) + " m</text>";
  });
  const bots = vs ? new Set() : conflicten();
  for (const it of S.G.items) s += svgItem(it, sel === it.id, bots.has(it.id), vs);
  if (vs) { // handvatten om de vorm te tekenen
    wandenG().forEach(([a, c], i) => {
      const gekozen = vsel && vsel.t === "e" && vsel.i === i;
      s += '<line data-e="' + i + '" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + c[0] + '" y2="' + c[1] + '" stroke="' + (gekozen ? "#d9480f" : "transparent") + '" stroke-width="' + (gekozen ? 0.2 : 0.6) + '" style="cursor:move"/>';
      if (!gekozen) s += '<line data-e="' + i + '" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + c[0] + '" y2="' + c[1] + '" stroke="transparent" stroke-width="0.6" style="cursor:move"/>';
    });
    p.forEach((q, i) => {
      const gekozen = vsel && vsel.t === "v" && vsel.i === i;
      s += '<circle data-v="' + i + '" cx="' + q[0] + '" cy="' + q[1] + '" r="' + (gekozen ? 0.38 : 0.3) + '" fill="' + (gekozen ? "#d9480f" : "#fff") + '" stroke="#d9480f" stroke-width="0.08" style="cursor:grab"/>';
    });
  }
  s += "</svg>";
  $("gp").innerHTML = s;
  const svg = $("gsvg");
  if (vs) {
    svg.querySelectorAll("[data-v]").forEach((c) => c.addEventListener("pointerdown", (e) => startVorm(e, "v", +c.dataset.v)));
    svg.querySelectorAll("[data-e]").forEach((c) => c.addEventListener("pointerdown", (e) => startVorm(e, "e", +c.dataset.e)));
    svg.addEventListener("pointerdown", (e) => { if (!e.target.closest("[data-v],[data-e]")) { vsel = null; tekenGrondplan(); tekenStap(); } });
  } else {
    svg.querySelectorAll("g[data-id]").forEach((g) => g.addEventListener("pointerdown", startSleep));
    svg.addEventListener("pointerdown", (e) => { if (!e.target.closest("g[data-id]")) kies(null); });
  }
}
function svgItem(it, gekozen, bots, stil) {
  const k = KAT_G[it.k], sw = gekozen ? 0.09 : 0.045, rand = bots ? "#e0392e" : k.c, streep = bots ? ' stroke-dasharray="0.25 0.15"' : "";
  let s = '<g data-id="' + it.id + '" transform="translate(' + it.x + " " + it.y + ") rotate(" + it.rot + ')" style="cursor:' + (stil ? "default" : "move") + (stil ? ";pointer-events:none;opacity:.55" : "") + '">';
  if (k.f === "rect") {
    s += '<rect x="' + -it.w / 2 + '" y="' + -it.l / 2 + '" width="' + it.w + '" height="' + it.l + '" fill="' + k.c + '" fill-opacity="0.3" stroke="' + rand + '" stroke-width="' + (bots ? 0.1 : sw) + '"' + streep + "/>";
    s += '<text y="0.15" text-anchor="middle" font-size="0.4" fill="#1a1d2b">' + esc(it.naam || k.n) + "</text>";
  } else if (k.f === "deur") {
    const r = it.w, dir = it.open === "binnen" ? -1 : 1; // lokaal: wand langs x, +y = buiten
    s += '<rect x="' + -r / 2 + '" y="-0.15" width="' + r + '" height="0.3" fill="#fff" stroke="' + rand + '" stroke-width="' + sw + '"/>';
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
function startVorm(e, t, i) {
  e.preventDefault(); e.stopPropagation();
  const q = svgPunt(e); vsel = { t, i }; vsleep = { t, i, p0: [q.x, q.y], basis: S.G.pts.map((x) => x.slice()), bewogen: false };
  tekenGrondplan(); tekenStap();
}
const snap = (v, st) => Math.round(v / st) * st;
// Nieuwe vorm tijdens het slepen van hoekpunt i naar q. Met rechte hoeken schuiven de buren mee.
function vormMetHoek(basis, i, q) {
  const p = basis.map((x) => x.slice()), n = p.length, oud = basis[i], st = S.G.recht ? 0.5 : 0.1;
  const nieuw = [r2(snap(q[0], st)), r2(snap(q[1], st))];
  if (S.G.recht) for (const j of [(i - 1 + n) % n, (i + 1) % n]) {
    const bu = basis[j];
    if (Math.abs(bu[1] - oud[1]) < 1e-6 && Math.abs(bu[0] - oud[0]) > 1e-6) p[j] = [bu[0], nieuw[1]];
    else if (Math.abs(bu[0] - oud[0]) < 1e-6 && Math.abs(bu[1] - oud[1]) > 1e-6) p[j] = [nieuw[0], bu[1]];
  }
  p[i] = nieuw; return p;
}
// Wand i evenwijdig verschuiven (loodrecht op de wand).
function vormMetWand(basis, i, d) {
  const p = basis.map((x) => x.slice()), n = p.length, a = basis[i], c = basis[(i + 1) % n];
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (!L) return p;
  const nx = (c[1] - a[1]) / L, ny = -(c[0] - a[0]) / L, st = S.G.recht ? 0.5 : 0.1;
  const v = snap(d[0] * nx + d[1] * ny, st);
  p[i] = [r2(a[0] + nx * v), r2(a[1] + ny * v)]; p[(i + 1) % n] = [r2(c[0] + nx * v), r2(c[1] + ny * v)];
  return p;
}
window.addEventListener("pointermove", (e) => {
  if (vsleep) {
    const q = svgPunt(e), nieuw = vsleep.t === "v" ? vormMetHoek(vsleep.basis, vsleep.i, [q.x, q.y]) : vormMetWand(vsleep.basis, vsleep.i, [q.x - vsleep.p0[0], q.y - vsleep.p0[1]]);
    if (vormOk(nieuw) && JSON.stringify(nieuw) !== JSON.stringify(S.G.pts)) { S.G.pts = nieuw; vsleep.bewogen = true; tekenGrondplan(); }
    return;
  }
  if (!sleep) return; const p = svgPunt(e);
  sleep.it.x = Math.round((p.x - sleep.dx) * 10) / 10; sleep.it.y = Math.round((p.y - sleep.dy) * 10) / 10;
  if (KAT_G[sleep.it.k].f === "deur") klikAanWand(sleep.it);
  const g = document.querySelector('g[data-id="' + sleep.it.id + '"]');
  if (g) g.setAttribute("transform", "translate(" + sleep.it.x + " " + sleep.it.y + ") rotate(" + sleep.it.rot + ")");
});
window.addEventListener("pointerup", () => {
  if (vsleep) { const b = vsleep.bewogen; vsleep = null; if (b) { vormGewijzigd(); return; } return; }
  if (sleep) { sleep = null; allesTekenen(); bewaar(); }
});
function vormGewijzigd() {
  const n = S.G.pts.length; normaliseer(); if (S.G.pts.length !== n) vsel = null;
  deurenInWand(); allesTekenen(); bewaar();
}
// Bewerkingen op de vorm (knoppen bij de stap Ruimte).
function vormZet(p) { if (!vormOk(p)) { $("msg").textContent = "Zo kruisen de wanden elkaar of wordt een wand korter dan 0,5 m. Probeer een andere maat."; return false; } $("msg").textContent = ""; S.G.pts = p; vormGewijzigd(); return true; }
function wandLengte(i, Lnieuw) {
  const p = S.G.pts.map((x) => x.slice()), n = p.length, a = p[i], c = p[(i + 1) % n];
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (!L || !(Lnieuw >= 0.5)) return;
  const ux = (c[0] - a[0]) / L, uy = (c[1] - a[1]) / L, dl = Lnieuw - L, j = (i + 1) % n, k = (i + 2) % n;
  const volgende = p[k], loodrecht = Math.abs((volgende[0] - c[0]) * ux + (volgende[1] - c[1]) * uy) < 1e-6;
  p[j] = [r2(c[0] + ux * dl), r2(c[1] + uy * dl)];
  if (S.G.recht && loodrecht && k !== i) p[k] = [r2(volgende[0] + ux * dl), r2(volgende[1] + uy * dl)]; // de volgende wand schuift mee
  vormZet(p);
}
function wandSplitsen(i) {
  const p = S.G.pts.map((x) => x.slice()), n = p.length, a = p[i], c = p[(i + 1) % n];
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 1.5) { $("msg").textContent = "Deze wand is te kort om te splitsen."; return; }
  const st = S.G.recht ? 0.5 : 0.1, t1 = Math.max(st, snap(L / 3, st)), t2 = Math.min(L - st, snap((2 * L) / 3, st));
  const ux = (c[0] - a[0]) / L, uy = (c[1] - a[1]) / L;
  const q1 = [r2(a[0] + ux * t1), r2(a[1] + uy * t1)], q2 = [r2(a[0] + ux * t2), r2(a[1] + uy * t2)];
  // Met rechte hoeken: elk splitspunt dubbel, zodat er bij het verschuiven van het middenstuk haaks op de wand
  // twee korte wanden ontstaan (een uitsprong of nis) in plaats van schuine wanden.
  if (S.G.recht) { p.splice(i + 1, 0, q1, q1.slice(), q2, q2.slice()); S.G.pts = p; vsel = { t: "e", i: i + 2 }; }
  else { p.splice(i + 1, 0, q1, q2); S.G.pts = p; vsel = { t: "e", i: i + 1 }; }
  deurenInWand(); allesTekenen(); bewaar(); // niet normaliseren: dan vallen de nieuwe punten weg
  $("msg").textContent = "Sleep het gemarkeerde middenstuk naar binnen of naar buiten.";
}
function hoekInspringen(i) {
  const p = S.G.pts.map((x) => x.slice()), n = p.length, a = p[(i - 1 + n) % n], v = p[i], c = p[(i + 1) % n];
  const La = Math.hypot(a[0] - v[0], a[1] - v[1]), Lc = Math.hypot(c[0] - v[0], c[1] - v[1]);
  const m = Math.min(2, snap(Math.min(La, Lc) / 3, 0.5)); if (m < 0.5) { $("msg").textContent = "De wanden bij deze hoek zijn te kort."; return; }
  const ua = [(a[0] - v[0]) / La, (a[1] - v[1]) / La], uc = [(c[0] - v[0]) / Lc, (c[1] - v[1]) / Lc];
  const v1 = [r2(v[0] + ua[0] * m), r2(v[1] + ua[1] * m)], v2 = [r2(v[0] + (ua[0] + uc[0]) * m), r2(v[1] + (ua[1] + uc[1]) * m)], v3 = [r2(v[0] + uc[0] * m), r2(v[1] + uc[1] * m)];
  p.splice(i, 1, v1, v2, v3);
  if (vormZet(p)) { vsel = { t: "v", i: i + 1 }; allesTekenen(); }
}
function hoekWeg(i) {
  if (S.G.pts.length <= 3) return;
  const p = S.G.pts.filter((_, j) => j !== i); if (vormZet(p)) { vsel = null; allesTekenen(); }
}
// Deuren hangen altijd in een wand: de dichtste vrije plek op een wand, nooit over een andere deur.
// Draaiing zo dat lokaal +x langs de wand loopt en +y naar buiten wijst.
function klikAanWand(it) {
  const h = it.w / 2, andere = S.G.items.filter((d) => d !== it && KAT_G[d.k].f === "deur");
  let best = null;
  for (const [a, b] of wandenG()) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < it.w + 0.1) continue;
    const ux = dx / L, uy = dy / L, t = (it.x - a[0]) * ux + (it.y - a[1]) * uy;
    let vrij = [[h + 0.05, L - h - 0.05]];
    for (const d of andere) {
      if (afstSeg([d.x, d.y], a, b) > 0.05) continue;
      const td = (d.x - a[0]) * ux + (d.y - a[1]) * uy, s0 = td - d.w / 2 - h - 0.1, s1 = td + d.w / 2 + h + 0.1;
      vrij = vrij.flatMap(([x, y]) => (s1 <= x || s0 >= y ? [[x, y]] : [...(s0 > x ? [[x, s0]] : []), ...(s1 < y ? [[s1, y]] : [])]));
    }
    for (const [x, y] of vrij) {
      if (y < x) continue;
      const tt = Math.min(y, Math.max(x, t)), qx = a[0] + ux * tt, qy = a[1] + uy * tt, dd = Math.hypot(qx - it.x, qy - it.y);
      if (!best || dd < best.d) best = { d: dd, x: qx, y: qy, ux, uy };
    }
  }
  if (!best) return false;
  let nx = best.uy, ny = -best.ux; if (inVorm([best.x + nx * 0.05, best.y + ny * 0.05])) { nx = -nx; ny = -ny; }
  it.x = r2(best.x); it.y = r2(best.y); it.rot = (((Math.round((Math.atan2(-nx, ny) * 180) / Math.PI)) % 360) + 360) % 360;
  return true;
}
// Een vrije plek voor een nieuw element: binnen de ruimte en niet op een ander element.
function vrijePlek(it) {
  const k = KAT_G[it.k], { l, b } = S.G, R = (o) => ({ cx: o.x, cy: o.y, w: o.w, l: o.l, rot: o.rot });
  const ander = S.G.items.filter((o) => o !== it);
  const past = (x, y) => {
    if (k.f === "rect") {
      const r = { cx: x, cy: y, w: it.w, l: it.l, rot: 0 };
      return puntenIn(r, 0.25).every((q) => inVorm(q)) && !ander.some((o) => KAT_G[o.k].f === "rect" && rectsOverlappen(r, R(o), 0.05));
    }
    return inVorm([x, y]) && afstRand([x, y]) >= 0.4 && !ander.some((o) => (KAT_G[o.k].f === "pt" && Math.hypot(o.x - x, o.y - y) < 0.9) || (KAT_G[o.k].f === "rect" && binnenRect([x, y], R(o), 0.3)));
  };
  const cx = S.G.pts.reduce((s, q) => s + q[0], 0) / S.G.pts.length, cy = S.G.pts.reduce((s, q) => s + q[1], 0) / S.G.pts.length;
  const kand = [];
  for (let x = 0.5; x < l; x += 0.5) for (let y = 0.5; y < b; y += 0.5) kand.push([x, y, Math.hypot(x - cx, y - cy)]);
  kand.sort((p1, p2) => p1[2] - p2[2]);
  const v = kand.find(([x, y]) => past(x, y));
  if (v) { it.x = v[0]; it.y = v[1]; return true; }
  it.x = r2(cx); it.y = r2(cy); return false;
}

// ---------- Elementen ----------
function lijst() { return S.actief === "inplanting" ? S.I.items : S.G.items; }
// Openbaar domein: bij "ja" is het hele terrein de inname (tenzij de klant dat uitvinkt), bij "deels" duidt de klant het stuk aan.
const isOD = () => /^(ja|deels)$/i.test(String((S && S.d && S.d.openbaar) || ""));
const odHeel = () => isOD() && /^ja$/i.test(String(S.d.openbaar)) && S.I.odHeel !== false;
function elVan(stap) { return (stap.el || []).filter((k) => !(["od", "parkeerverbod"].includes(k) && !isOD()) && !(k === "od" && odHeel())); }
// De inname van het openbaar domein zoals de browseragent ze in Eaglebe overneemt (lijn met buffer of zone).
function innames() {
  const v = odHeel() ? S.I.items.filter((i) => i.k === "zone") : S.I.items.filter((i) => i.k === "od");
  return v.map((it) => ({ lat: +it.lat.toFixed(7), lng: +it.lng.toFixed(7), lengte: it.w, breedte: it.l, draaiing: it.rot, hoeken: hoeken(it).map((h) => [+h[0].toFixed(7), +h[1].toFixed(7)]), m2: Math.round(it.w * it.l * 10) / 10 }));
}
const innameM2 = () => innames().reduce((t, x) => t + x.m2, 0);
function voegToe(k) {
  const kk = KAT[S.actief][k];
  if (S.actief === "inplanting") {
    const c = map.getCenter(), n = S.I.items.length, off = 4 * ((n % 5) - 2);
    const it = { id: uid++, k, naam: "", lat: c.lat + off * mLat(), lng: c.lng + off * mLng(c.lat), w: kk.w || 0, l: kk.l || 0, rot: 0 };
    if (k === "tent") { it.w = S.I.tent[0]; it.l = S.I.tent[1]; }
    if (k === "uitgang") it.breedte = kk.breedte;
    S.I.items.push(it);
  } else {
    const { l, b } = S.G;
    const it = { id: uid++, k, naam: "", x: l / 2, y: b, w: kk.w || 0, l: kk.l || 0, rot: 0 };
    if (kk.f === "deur") {
      it.open = "buiten";
      if (!klikAanWand(it)) { $("msg").textContent = "Er is geen vrije plek meer in de wanden voor nog een " + kk.n.toLowerCase() + " van " + fmt(it.w) + " m."; uid--; return; }
    } else if (!vrijePlek(it)) $("msg").textContent = "Er is geen vrije plek meer: het nieuwe element staat in het midden. Schuif het op zijn plaats.";
    S.G.items.push(it);
  }
  kies(uid - 1); bewaar();
}
function kies(id, stil) { sel = id; if (stil) { tekenLijst(); return; } allesTekenen(); }
function tekenLijst() {
  const st = STAPPEN[S.actief][S.stap[S.actief]];
  const toon = st.controle ? lijst() : lijst().filter((it) => (S.actief === "inplanting" ? elVan(st) : st.el || []).includes(it.k));
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
  if (k.f === "rect") h += '<div class="r3"><label for="e-w">Lengte (m)<input id="e-w" type="number" step="0.5" min="' + minZijde(it) + '" value="' + it.w + '"></label><label for="e-l">Breedte (m)<input id="e-l" type="number" step="0.5" min="' + minZijde(it) + '" value="' + it.l + '"></label><label for="e-r">Draaiing (°)<input id="e-r" type="number" step="5" value="' + it.rot + '"></label></div>';
  if (it.k === "doorgang" && minZijde(it) > 0.5) h += '<p class="hint" style="margin:0">Minstens ' + fmt(minZijde(it)) + ' m breed: dat vraagt de brandweer. Smaller kan niet.</p>';
  if (k.f === "deur") h += '<div class="r2"><label for="e-w">Breedte (m)<input id="e-w" type="number" step="0.1" min="0.6" value="' + it.w + '"></label><label for="e-o">Draait<select id="e-o"><option value="buiten"' + (it.open === "buiten" ? " selected" : "") + '>naar buiten</option><option value="binnen"' + (it.open === "binnen" ? " selected" : "") + ">naar binnen</option></select></label></div>";
  if (it.k === "uitgang") h += '<label for="e-b">Vrije breedte (m)<input id="e-b" type="number" step="0.1" min="0.5" value="' + it.breedte + '"></label>';
  h += '<div class="r2">' + (k.f === "rect" ? '<button class="btn" id="e-90" type="button" title="Sneltoets: R">Draai 90°</button>' : "") + '<button class="btn" id="e-del" type="button">Verwijderen</button></div></div>';
  ed.innerHTML = h;
  const upd = () => {
    it.naam = $("e-naam").value;
    const mz = k.f === "rect" ? minZijde(it) : 0.1;
    if ($("e-w")) it.w = Math.max(mz, +$("e-w").value || it.w);
    if ($("e-l")) it.l = Math.max(mz, +$("e-l").value || it.l);
    if ($("e-r")) it.rot = +$("e-r").value || 0;
    if ($("e-o")) it.open = $("e-o").value;
    if ($("e-b")) it.breedte = Math.max(0.1, +$("e-b").value || it.breedte);
    if (k.f === "deur") klikAanWand(it);
    tekenPlan(); tekenControles(); bewaar();
  };
  ed.querySelectorAll("input,select").forEach((i) => i.addEventListener("change", () => { upd(); if ($("e-w")) $("e-w").value = it.w; if ($("e-l")) $("e-l").value = it.l; }));
  ed.querySelectorAll("input").forEach((i) => i.addEventListener("input", upd));
  if ($("e-90")) $("e-90").addEventListener("click", () => draai90(it));
  $("e-del").addEventListener("click", () => {
    if (S.actief === "inplanting") S.I.items = S.I.items.filter((i) => i !== it); else S.G.items = S.G.items.filter((i) => i !== it);
    sel = null; allesTekenen(); bewaar();
  });
}

function draai90(it) {
  it.rot = (Math.floor((+it.rot || 0) / 90) * 90 + 90) % 360; // naar de volgende rechte hoek
  allesTekenen(); bewaar();
}
document.addEventListener("keydown", (e) => {
  if (!S || e.key.toLowerCase() !== "r" || e.metaKey || e.ctrlKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const it = lijst().find((i) => i.id === sel);
  if (it && KAT[S.actief][it.k].f === "rect") { e.preventDefault(); draai90(it); }
});

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
// marge m: vlakken die elkaar enkel raken (tot m meter) tellen niet als overlap.
function rectsOverlappen(r1, r2, m) { const st = m != null ? 0.25 : 0.5, e = -(m || 0); return puntenIn(r1, st).some((p) => binnenRect(p, r2, e)) || puntenIn(r2, st).some((p) => binnenRect(p, r1, e)); }

// Langste weg naar de dichtste nooduitgang, binnen de ruimte (rond hoeken heen bij een niet-bolle vorm).
function isBol(p) { let t = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], c = p[(i + 2) % p.length]; const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.abs(cr) < 1e-9) continue; if (!t) t = Math.sign(cr); else if (Math.sign(cr) !== t) return false; } return true; }
let evacMemo = { k: "", v: 0 };
function evacuatieAfstand(nood) {
  const key = JSON.stringify([S.G.pts, nood.map((d) => [d.x, d.y])]);
  if (evacMemo.k === key) return evacMemo.v;
  const p = S.G.pts, bol = isBol(p), V = bol ? [] : p;
  const zicht = (a, b) => { if (bol) return true; const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.ceil(L / 0.4)); for (let i = 1; i < n; i++) { const t = i / n; if (!binnenG([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], 0.02)) return false; } return true; };
  const D = nood.map((d) => { // Dijkstra over de hoekpunten
    const q = [d.x, d.y], dist = V.map((v) => (zicht(q, v) ? Math.hypot(v[0] - q[0], v[1] - q[1]) : Infinity)), klaar = V.map(() => false);
    for (let r = 0; r < V.length; r++) {
      let m = -1; for (let i = 0; i < V.length; i++) if (!klaar[i] && (m < 0 || dist[i] < dist[m])) m = i;
      if (m < 0 || dist[m] === Infinity) break; klaar[m] = true;
      for (let j = 0; j < V.length; j++) if (!klaar[j] && zicht(V[m], V[j])) dist[j] = Math.min(dist[j], dist[m] + Math.hypot(V[j][0] - V[m][0], V[j][1] - V[m][1]));
    }
    return { q, dist };
  });
  let slechtst = 0;
  for (let x = 0.5; x < S.G.l; x += 1) for (let y = 0.5; y < S.G.b; y += 1) {
    const q = [x, y]; if (!inVorm(q)) continue;
    let best = Infinity;
    for (const { q: dq, dist } of D) {
      if (zicht(q, dq)) best = Math.min(best, Math.hypot(dq[0] - x, dq[1] - y));
      else V.forEach((v, i) => { if (dist[i] < best && zicht(q, v)) best = Math.min(best, dist[i] + Math.hypot(v[0] - x, v[1] - y)); });
    }
    slechtst = Math.max(slechtst, best);
  }
  evacMemo = { k: key, v: slechtst }; return slechtst;
}

// ---------- Controles ----------
// {stap, ok: true|false|null (advies, blokkeert niet), t, n (norm met bron)}
function controles(plan) {
  const uit = [], C = (stap, ok, t, n) => uit.push({ stap, ok, t, n });
  const P = S.personen;
  if (plan === "inplanting") {
    const it = (k) => S.I.items.filter((i) => i.k === k);
    C(0, it("zone").length > 0, "Het terrein is aangeduid");
    if (it("zone").length && S.d.gemeente && !DEMO && S.I.kaartGemeente && S.I.kaartGemeente !== "?") C(0, zelfdeGemeente(S.I.kaartGemeente), "Het terrein ligt in " + S.d.gemeente + (zelfdeGemeente(S.I.kaartGemeente) ? "" : " (nu getekend in " + S.I.kaartGemeente + ")"));
    if (isOD()) {
      C(0, innames().length > 0, innames().length ? "De inname van het openbaar domein is aangeduid (" + fmt(innameM2()) + " m²)" : "Duid aan welk stuk op openbaar domein ligt (\"Inname openbaar domein\")");
      const od = it("od");
      if (od.length && it("zone").length && !odHeel()) C(0, od.every((o) => it("zone").some((z) => rectsOverlappen(rectI(o), rectI(z), 1))), "De inname van het openbaar domein sluit aan op het terrein");
    }
    C(1, S.I.items.some((i) => KAT_I[i.k].f === "rect" && !GEEN_OPSTELLING.includes(i.k)), "Alle opstellingen staan erop, met hun afmetingen");
    if (it("bbq").length) C(1, !it("bbq").some((b) => it("tent").some((t) => rectsOverlappen(rectI(b), rectI(t)))), "Barbecue en kookplaats staan buiten, niet in een tent");
    const nd = norm("doorgang_hulpdiensten");
    const dgMin = nd && nd.breedte_m;
    const dg = it("doorgang");
    C(2, dg.length > 0, "Doorgang voor de hulpdiensten aangeduid");
    if (dg.length) C(2, dgMin ? dg.every((d) => Math.min(d.w, d.l) >= dgMin) : null, dgMin ? "Doorgang minstens " + fmt(dgMin) + " m breed" + (nd.hoogte_m ? " (en " + fmt(nd.hoogte_m) + " m vrije hoogte)" : "") : "Breedte van de doorgang: geen norm gevonden, vraag ze na", nd);
    const hinder = dg.some((d) => { const rd = rectI(d); return S.I.items.some((o) => o !== d && KAT_I[o.k].f === "rect" && !GEEN_OPSTELLING.includes(o.k) && rectsOverlappen(rd, rectI(o))); });
    if (dg.length) C(2, !hinder, "Niets staat in de doorgang voor de hulpdiensten");
    if (GEBOUWEN.ringen) {
      if (dg.length) C(2, !dg.some((d) => opGebouw(rectI(d))), "De doorgang voor de hulpdiensten loopt niet door een gebouw (gebouwenkaart GRB)");
      const opst = S.I.items.filter((i) => KAT_I[i.k].f === "rect" && !GEEN_OPSTELLING.includes(i.k));
      // In een zaal staat de opstelling binnen een gebouw: daar enkel de doorgang controleren.
      if (opst.length && !/zaal/i.test(String(S.d.situatie || ""))) C(1, !opst.some((o) => opGebouw(rectI(o))), "Geen opstelling staat op een gebouw (gebouwenkaart GRB)");
    }
    if (it("zone").length) {
      const u = it("uitgang"), nu = aantalUitgangen(P);
      C(2, nu ? u.length >= nu.aantal : u.length >= 1, nu ? "Minstens " + nu.aantal + " nooduitgang" + (nu.aantal > 1 ? "en" : "") + " voor " + P + " personen" : "Nooduitgangen van het terrein aangeduid", nu && nu.bron);
      const cm = norm("breedte_per_persoon_cm"), bm = norm("breedte_min_m");
      if (u.length && cm) C(2, u.reduce((s, x) => s + x.breedte, 0) * 100 >= P * cm.waarde, "Samen minstens " + fmt((P * cm.waarde) / 100) + " m uitgangsbreedte (" + fmt(cm.waarde) + " cm per persoon)", cm);
      if (u.length && bm) C(2, u.every((x) => x.breedte >= bm.waarde), "Elke nooduitgang minstens " + fmt(bm.waarde) + " m breed", bm);
    }
    C(2, S.I.maten.length > 0, "Afstand tot de gebouwen errond gemeten met een maatlijn");
    C(3, it("blus").length > 0, "Blustoestellen aangeduid");
    // Waar staat alles? (eigen controles, geen norm: enkel of de tekening klopt)
    const zones = it("zone").map(rectI);
    if (zones.length) {
      const opTerrein = (p, e) => zones.some((z) => binnenRect(p, z, e || 0));
      const opst = S.I.items.filter((i) => KAT_I[i.k].f === "rect" && !GEEN_OPSTELLING.includes(i.k));
      const buiten = opst.filter((o) => !hoekenLokaal(rectI(o)).every((p) => opTerrein(p, 0.3)));
      C(1, !buiten.length, buiten.length ? "Staat niet (helemaal) op het terrein: " + [...new Set(buiten.map((o) => KAT_I[o.k].n.toLowerCase()))].join(", ") : "Alle opstellingen staan op het terrein");
      // Een nooduitgang hoort in de afsluiting van het terrein (een opening in de hekken) of in de wand van een tent.
      // Ligt hij nergens op zo'n rand, dan is het geen uitgang maar een punt midden in het publiek.
      const tenten = it("tent"), opRand = (x) => { const p = lokaal(x.lat, x.lng); return [...zones, ...tenten.map(rectI)].some((r) => randAfstand(p, r) <= 1.5); };
      const u = it("uitgang"), losU = u.filter((x) => !opRand(x));
      if (u.length) C(2, !losU.length, losU.length ? losU.length + " nooduitgang" + (losU.length > 1 ? "en liggen" : " ligt") + " niet in de afsluiting van het terrein" + (tenten.length ? " of in een tentwand" : "") + ". Zet ze op de rand, waar de mensen echt naar buiten kunnen" : "Nooduitgangen liggen in de afsluiting van het terrein" + (tenten.length ? " of in een tentwand" : ""));
      if (dg.length) C(2, dg.every((d) => puntenIn(rectI(d), 1).some((p) => !opTerrein(p, -0.5))), "De doorgang voor de hulpdiensten loopt tot aan de rand van het terrein");
      const b = it("blus");
      if (b.length) C(3, b.every((x) => opTerrein(lokaal(x.lat, x.lng), 1)), "Blustoestellen staan op het terrein");
      const bl = norm("blustoestellen");
      // Per tent: nodig = oppervlakte / norm, naar boven afgerond (612 m² bij 1 per 150 m² = 5). Toon het tekort zelf.
      const tekort = it("tent").map((t) => {
        const r = rectI(t), m2 = t.w * t.l, nodig = bl && bl.per_m2 ? Math.max(1, Math.ceil(m2 / bl.per_m2)) : 1;
        const er = b.filter((x) => binnenRect(lokaal(x.lat, x.lng), r, 0.5)).length;
        return er < nodig ? (t.naam || "Tent") + " " + fmt(t.w) + " × " + fmt(t.l) + " m (" + Math.round(m2) + " m²): " + nodig + " nodig, " + er + " getekend" : "";
      }).filter(Boolean);
      if (it("tent").length) C(3, !tekort.length, (bl && bl.per_m2 ? "In elke tent genoeg blustoestellen (1 per " + fmt(bl.per_m2) + " m², naar boven afgerond)" : "In elke tent een blustoestel") + (tekort.length ? ". " + tekort.join("; ") : ""), bl);
    }
    const tenten = it("tent").map(rectI), stroom = it("stroom");
    C(1, !stroom.some((s) => tenten.some((t) => binnenRect(lokaal(s.lat, s.lng), t))), "De stroomgroep staat buiten de tent");
    const sa = norm("stroomgroep_afstand_m");
    if (sa && stroom.length && tenten.length) C(1, stroom.every((s) => tenten.every((t) => afstandTotRect(lokaal(s.lat, s.lng), t) >= sa.waarde)), "Stroomgroep minstens " + fmt(sa.waarde) + " m van de tent", sa);
  } else {
    const { l, b } = S.G, it = (k) => S.G.items.filter((i) => i.k === k), nood = it("nooduitgang"), deuren = [...it("deur"), ...nood], opp = oppG();
    C(0, opp > 0 && vormOk(S.G.pts), "Vorm en binnenmaten ingevuld: " + fmt(opp) + " m²" + (isRechthoek() ? " (" + fmt(l) + " × " + fmt(b) + " m)" : ", " + S.G.pts.length + " wanden"));
    C(0, !!S.G.mat.trim(), "Soort ruimte en materiaal vermeld");
    const nu = aantalUitgangen(P);
    C(1, nu ? nood.length >= nu.aantal : nood.length >= 1, nu ? "Minstens " + nu.aantal + " nooduitgang" + (nu.aantal > 1 ? "en" : "") + " voor " + P + " personen" : "Nooduitgangen aangeduid", nu && nu.bron);
    const cm = norm("breedte_per_persoon_cm"), bm = norm("breedte_min_m");
    if (nood.length && cm) C(1, nood.reduce((s, x) => s + x.w, 0) * 100 >= P * cm.waarde, "Samen minstens " + fmt((P * cm.waarde) / 100) + " m uitgangsbreedte (" + fmt(cm.waarde) + " cm per persoon)", cm);
    if (nood.length && bm) C(1, nood.every((x) => x.w >= bm.waarde), "Elke nooduitgang minstens " + fmt(bm.waarde) + " m breed", bm);
    if (nood.length) C(1, nood.every((d) => d.open === "buiten"), "Nooduitgangen draaien naar buiten");
    if (deuren.length) {
      C(1, deuren.every((d) => afstRand([d.x, d.y]) <= 0.05), "Elke deur zit in een wand");
      const opElkaar = deuren.some((d, i) => deuren.some((e, j) => j > i && Math.hypot(d.x - e.x, d.y - e.y) < (d.w + e.w) / 2 - 0.01 && Math.abs(((d.rot - e.rot) % 180 + 180) % 180) < 1));
      C(1, !opElkaar, "Geen deuren over elkaar");
    }
    const ea = norm("evacuatieafstand_max_m");
    if (ea && nood.length) {
      const slechtst = evacuatieAfstand(nood);
      C(1, slechtst <= ea.waarde, "Van overal minder dan " + fmt(ea.waarde) + " m tot een nooduitgang, langs de wanden gemeten (nu " + fmt(slechtst) + " m)", ea);
    }
    const voorDeur = (d) => { const a = (d.rot * Math.PI) / 180; return { cx: d.x - Math.sin(a) * -d.w / 2, cy: d.y + Math.cos(a) * -d.w / 2, w: d.w, l: d.w, rot: d.rot }; };
    const obst = S.G.items.filter((i) => KAT_G[i.k].f === "rect").map((o) => ({ cx: o.x, cy: o.y, w: o.w, l: o.l, rot: o.rot }));
    if (deuren.length) C(2, !deuren.some((d) => obst.some((o) => rectsOverlappen(voorDeur(d), o))), "Niets staat vlak voor een uitgang (eigen controle: vrije ruimte zo diep als de deur breed is)");
    C(2, !obst.some((o, i) => obst.some((q, j) => j > i && rectsOverlappen(o, q, 0.05))), "Niets van de opstelling staat over elkaar");
    C(2, !obst.some((o) => puntenIn(o, 0.25).some((q) => !binnenG(q, 0.01))), "Alles staat binnen de ruimte");
    const bl = norm("blustoestellen");
    const nodig = bl && bl.per_m2 ? Math.max(bl.min || 1, Math.ceil(opp / bl.per_m2)) : 1;
    C(3, it("blus").length >= nodig, (bl && bl.per_m2 ? "Minstens " + nodig + " blustoestel" + (nodig > 1 ? "len" : "") + " (1 per " + fmt(bl.per_m2) + " m², ruimte " + fmt(opp) + " m²)" : "Blustoestellen aangeduid"), bl);
    if (nood.length) C(3, nood.every((d) => it("nood").some((n) => Math.hypot(n.x - d.x, n.y - d.y) <= 2)), "Noodverlichting bij elke nooduitgang");
    // Een tent is een tijdelijke inrichting: de stroomvoorziening staat erbuiten. In een zaal mag de aansluiting binnen.
    const isTent = S.d.situatie === "tent" || /tent/i.test(S.G.mat || "");
    if (isTent) C(3, !it("stroom").some((s) => inVorm([s.x, s.y]) && afstRand([s.x, s.y]) > 0.05), "Stroomvoorziening buiten de tent (tijdelijke inrichting)");
    if (it("blus").length) C(3, it("blus").every((x) => binnenG([x.x, x.y], 0.3)), "Blustoestellen staan in de ruimte");
    const tm = tentMaten();
    if (tm && isTent) C(0, isRechthoek() && zelfdeMaten([l, b], tm), "Rechthoekig, met de maten van de tent uit je aanvraag (" + fmt(tm[0]) + " × " + fmt(tm[1]) + " m)");
  }
  // Klopt het plan met wat je in de aanvraag invulde?
  for (const v of verwachtUitAanvraag(plan)) C(v.stap, v.ok, v.t);
  return uit;
}
// Eén regel met de cijfers die Thomas nodig heeft om snel na te kijken (in de melding [Plan]).
function kerncijfers(plan) {
  const P = S.personen, r = [];
  if (plan === "inplanting") {
    const it = (k) => S.I.items.filter((i) => i.k === k), m2 = it("zone").reduce((s, z) => s + z.w * z.l, 0);
    const u = it("uitgang"), dg = it("doorgang");
    r.push(P + " personen", "terrein " + fmt(m2) + " m²" + (m2 ? " (" + fmt(m2 / P) + " m² per persoon)" : ""),
      u.length + " nooduitgang(en), samen " + fmt(u.reduce((s, x) => s + (x.breedte || 0), 0)) + " m",
      dg.length ? "doorgang hulpdiensten " + fmt(Math.min(...dg.map((d) => Math.min(d.w, d.l)))) + " m breed" : "geen doorgang",
      it("tent").map((t) => "tent " + fmt(t.w) + " × " + fmt(t.l) + " m").join(", ") || "geen tent",
      it("blus").length + " blustoestel(len)");
    if (isOD()) r.push("inname openbaar domein " + fmt(innameM2()) + " m²" + (odHeel() ? " (het hele terrein)" : ""));
  } else {
    const it = (k) => S.G.items.filter((i) => i.k === k), n = it("nooduitgang");
    r.push(P + " personen", "ruimte " + fmt(oppG()) + " m²" + (isRechthoek() ? " (" + fmt(S.G.l) + " × " + fmt(S.G.b) + " m)" : " (" + S.G.pts.length + " wanden)") + " (" + fmt(oppG() / P) + " m² per persoon)",
      n.length + " nooduitgang(en), samen " + fmt(n.reduce((s, x) => s + x.w, 0)) + " m", it("deur").length + " andere deur(en)",
      it("blus").length + " blustoestel(len)", it("nood").length + " noodverlichting");
  }
  return r.join(" · ");
}

// ---------- Afstemming met de aanvraag ----------
function hoekenLokaal(r) {
  const a = (r.rot * Math.PI) / 180;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => { const x = (sx * r.w) / 2, y = (sy * r.l) / 2; return [r.cx + x * Math.cos(a) - y * Math.sin(a), r.cy + x * Math.sin(a) + y * Math.cos(a)]; });
}
function randAfstand(p, r) { // afstand tot de rand van een rechthoek, binnen of buiten
  const a = (-r.rot * Math.PI) / 180, dx = p[0] - r.cx, dy = p[1] - r.cy;
  const x = Math.abs(dx * Math.cos(a) - dy * Math.sin(a)), y = Math.abs(dx * Math.sin(a) + dy * Math.cos(a));
  return x <= r.w / 2 && y <= r.l / 2 ? Math.min(r.w / 2 - x, r.l / 2 - y) : afstandTotRect(p, r);
}
function tentMaten() {
  const m = String((S.d && S.d.tent) || "").match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  return m ? [parseFloat(m[1].replace(",", ".")), parseFloat(m[2].replace(",", "."))] : null;
}
function zelfdeMaten(a, b) { const t = 0.5; return (Math.abs(a[0] - b[0]) <= t && Math.abs(a[1] - b[1]) <= t) || (Math.abs(a[0] - b[1]) <= t && Math.abs(a[1] - b[0]) <= t); }
const ja = (v) => /^ja$/i.test(String(v || "").trim());
// Wat de aanvraag zegt, moet op een plan staan. Over beide plannen samen; getoond bij het plan waar het hoort.
function verwachtUitAanvraag(plan) {
  const d = (S && S.d && S.d.intake) || {}, uit = [];
  const heeft = (k) => S.I.items.some((i) => i.k === k) || S.G.items.some((i) => i.k === k);
  const metIn = S.plannen.includes("inplanting");
  if (plan === (metIn ? "inplanting" : "grondplan") && (ja(d.alcohol) || ja(d.sterke_drank)))
    uit.push({ stap: metIn ? 1 : 2, ok: heeft("bar"), t: "Een bar, want je schenkt drank (aanvraag)" });
  if (plan === "inplanting") {
    if (ja(d.toiletten)) uit.push({ stap: 1, ok: heeft("toilet"), t: "Extra toiletten, zoals in je aanvraag" });
    if (ja(d.stroomgroep)) uit.push({ stap: 1, ok: heeft("stroom"), t: "Een stroomgroep, zoals in je aanvraag" });
    if (ja(d.eten)) uit.push({ stap: 1, ok: heeft("food"), t: "Een foodtruck of stand, want er wordt eten bereid (aanvraag)" });
    const tm = tentMaten();
    if (S.d.situatie === "tent" || tm) {
      const tenten = S.I.items.filter((i) => i.k === "tent");
      uit.push({ stap: 1, ok: tenten.length > 0 && (!tm || tenten.some((t) => zelfdeMaten([t.w, t.l], tm))),
        t: tm ? "Een tent van " + fmt(tm[0]) + " × " + fmt(tm[1]) + " m, zoals in je aanvraag" : "Een tent, zoals in je aanvraag" });
    }
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
  if (stap.veld === "terrein") v = '<div style="display:flex;flex-direction:column;gap:10px"><label for="f-adres">Adres<input id="f-adres" list="f-adreslijst" autocomplete="off" placeholder="Straat en nummer, gemeente" value="' + esc(S.d.adres || "") + '"><datalist id="f-adreslijst"></datalist></label><button class="btn" id="zoek" type="button">Zoek op de kaart</button><label for="f-pers">Personen tegelijk op het drukste moment<input id="f-pers" type="number" min="' + minPersonen() + '" value="' + S.personen + '">' + (minPersonen() > 1 ? '<small>Minstens ' + minPersonen() + ', zoals in je aanvraag. Meer mag.</small>' : "") + '</label>' +
    (/^ja$/i.test(String(S.d.openbaar || "")) ? '<label for="f-odheel" style="display:flex;flex-direction:row;align-items:center;gap:8px;font-weight:500"><input id="f-odheel" type="checkbox"' + (odHeel() ? " checked" : "") + ' style="width:auto"> Mijn hele terrein ligt op straat, plein of in een park</label>' + (odHeel() ? "" : '<small>Duid dan met "Inname openbaar domein" aan welk stuk op openbaar domein ligt.</small>') : "") +
    (/^deels$/i.test(String(S.d.openbaar || "")) ? '<small>Een deel ligt op openbaar domein. Duid met "Inname openbaar domein" aan welk stuk op straat, stoep, plein of in een park ligt (bv. het terras of de bar op de stoep).</small>' : "") +
    (isOD() && innames().length ? '<small>Inname openbaar domein: <b>' + fmt(innameM2()) + " m²</b></small>" : "") + '</div>';
  if (stap.veld === "ruimte") {
    const rh = isRechthoek(), p = S.G.pts;
    let vh = rh
      ? '<div class="r2"><label for="g-l">Lengte (m)<input id="g-l" type="number" min="2" step="0.5" value="' + S.G.l + '"></label><label for="g-b">Breedte (m)<input id="g-b" type="number" min="2" step="0.5" value="' + S.G.b + '"></label></div>'
      : '<p class="hint" style="margin:0">Oppervlakte <b>' + fmt(oppG()) + " m²</b> · " + p.length + " wanden · buitenmaten " + fmt(S.G.l) + " × " + fmt(S.G.b) + " m</p>";
    if (vsel && vsel.t === "e" && wandenG()[vsel.i]) {
      const [a, c] = wandenG()[vsel.i];
      vh += '<div class="r2"><label for="g-wl">Lengte van deze wand (m)<input id="g-wl" type="number" min="0.5" step="0.1" value="' + r2(Math.hypot(c[0] - a[0], c[1] - a[1])) + '"></label><button class="btn" id="g-split" type="button" style="align-self:end">Wand opsplitsen</button></div>';
    } else if (vsel && vsel.t === "v" && p[vsel.i]) {
      vh += '<div class="r2"><button class="btn" id="g-insp" type="button">Hoek inspringen</button>' + (p.length > 3 ? '<button class="btn" id="g-weg" type="button">Hoekpunt weg</button>' : "") + "</div>";
    } else vh += '<p class="hint" style="margin:0">Klik een hoekpunt of een wand aan voor meer opties.</p>';
    vh += '<label for="g-recht" style="display:flex;flex-direction:row;align-items:center;gap:8px;font-weight:500"><input id="g-recht" type="checkbox"' + (S.G.recht ? " checked" : "") + ' style="width:auto"> Rechte hoeken behouden</label>';
    if (!rh) vh += '<button class="btn" id="g-rh" type="button">Terug naar een rechthoek</button>';
    v = '<div style="display:flex;flex-direction:column;gap:10px">' + vh + '<label for="g-mat">Soort ruimte en materiaal<input id="g-mat" value="' + esc(S.G.mat) + '" placeholder="bv. tent met PVC-zeil, of zaal"></label><label for="g-pers">Personen tegelijk op het drukste moment<input id="g-pers" type="number" min="' + minPersonen() + '" value="' + S.personen + '">' + (minPersonen() > 1 ? '<small>Minstens ' + minPersonen() + ', zoals in je aanvraag. Meer mag.</small>' : "") + '</label></div>';
  }
  $("stapvelden").innerHTML = v;
  if ($("zoek")) $("zoek").addEventListener("click", zoekAdres);
  if ($("f-odheel")) $("f-odheel").addEventListener("change", () => { S.I.odHeel = $("f-odheel").checked; allesTekenen(); bewaar(); });
  if ($("f-adres")) {
    $("f-adres").addEventListener("input", () => { S.d.adres = $("f-adres").value; bewaar(); adresSuggesties(); });
    $("f-adres").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); zoekAdres(); } });
  }
  for (const id of ["f-pers", "g-pers"]) if ($(id)) $(id).addEventListener("change", () => { S.personen = Math.max(minPersonen(), +$(id).value || 1); $(id).value = S.personen; tekenControles(); bewaar(); });
  const gu = () => { const l = Math.max(2, +$("g-l").value || S.G.l), b = Math.max(2, +$("g-b").value || S.G.b); S.G.pts = rechthoek(l, b); normaliseer(); deurenInWand(); tekenPlan(); tekenControles(); bewaar(); };
  for (const id of ["g-l", "g-b"]) if ($(id)) $(id).addEventListener("input", gu);
  if ($("g-mat")) $("g-mat").addEventListener("input", () => { S.G.mat = $("g-mat").value; tekenControles(); bewaar(); });
  if ($("g-wl")) $("g-wl").addEventListener("change", () => wandLengte(vsel.i, +$("g-wl").value));
  if ($("g-split")) $("g-split").addEventListener("click", () => wandSplitsen(vsel.i));
  if ($("g-insp")) $("g-insp").addEventListener("click", () => hoekInspringen(vsel.i));
  if ($("g-weg")) $("g-weg").addEventListener("click", () => hoekWeg(vsel.i));
  if ($("g-recht")) $("g-recht").addEventListener("change", () => { S.G.recht = $("g-recht").checked; bewaar(); });
  if ($("g-rh")) $("g-rh").addEventListener("click", () => { vsel = null; vormZet(rechthoek(S.G.l, S.G.b)); });
  // werkbalk bij het plan
  let t = (S.actief === "inplanting" ? elVan(stap) : stap.el || []).map((k) => '<button type="button" data-k="' + k + '"><span class="sw" style="background:' + KAT[S.actief][k].c + '"></span>' + esc(KAT[S.actief][k].n) + ' <span class="plus">+</span></button>').join("");
  if (stap.maat) t += '<button type="button" id="maat" class="' + (maatModus ? "aan" : "") + '">Maatlijn</button>';
  $("tools").innerHTML = t;
  $("tools").querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => voegToe(b.dataset.k)));
  if ($("maat")) $("maat").addEventListener("click", () => { maatModus = !maatModus; maatStart = null; banner(maatModus ? "Klik twee punten op de kaart." : null); $("maat").classList.toggle("aan", maatModus); });
  $("opslaanwrap").hidden = !stap.controle;
  $("lijstwrap").hidden = !!stap.controle;
}
function naarStap(i) { S.stap[S.actief] = Math.max(0, Math.min(STAPPEN[S.actief].length - 1, i)); sel = null; vsel = null; maatModus = false; banner(null); allesTekenen(); bewaar(); }
function tekenPlan() { if (S.actief === "inplanting") tekenKaart(); else tekenGrondplan(); }
function allesTekenen() { tekenStap(); tekenPlan(); tekenLijst(); tekenControles(); if (S.actief === "inplanting") { controleerGemeente(); laadGebouwen(); } }
function wisselPlan(p) {
  S.actief = p; sel = null; maatModus = false; banner(null);
  document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.plan === p));
  $("map").hidden = p !== "inplanting"; $("gp").hidden = p !== "grondplan";
  if (p === "inplanting") { if (!map) initKaart(); setTimeout(() => map.invalidateSize(), 0); }
  allesTekenen(); bewaar();
}
function banner(t) { $("banner").hidden = !t; $("banner").textContent = t || ""; }
// Adressen via Digitaal Vlaanderen. De zoekdienst is streng (de gemeente twee keer erin = niets gevonden),
// de suggestiedienst vergeeft meer. Daarom: suggesties tijdens het typen, en bij zoeken meerdere pogingen.
const GEO = "https://geo.api.vlaanderen.be/geolocation/v4/";
function metGemeente(v) {
  const gem = S.d.gemeente || "";
  return gem && !/\b\d{4}\b/.test(v) && v.toLowerCase().indexOf(gem.toLowerCase()) < 0 ? v + " " + gem : v;
}
async function suggesties(v, n) {
  const vraag = async (q) => { try { const j = await (await fetch(GEO + "Suggestion?c=" + n + "&q=" + encodeURIComponent(q))).json(); return j.SuggestionResult || []; } catch (e) { return []; } };
  const metGem = metGemeente(v), eerst = await vraag(metGem);
  const lijst = eerst.length || metGem === v ? eerst : await vraag(v);
  if (!S.d.gemeente || BEHEER) return lijst;
  return lijst.filter((x) => zelfdeGemeente(String(x).split(",").pop())); // enkel adressen in de gemeente van de aanvraag
}
function gemNorm(g) { return String(g || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b\d{4}\b/g, "").replace(/[^a-z]/gi, "").toLowerCase(); }
function zelfdeGemeente(g) { return !S.d.gemeente || gemNorm(g) === gemNorm(S.d.gemeente); }
// In welke gemeente ligt het getekende terrein? (omgekeerd zoeken op het midden van de terreinen)
let gemT = null;
function controleerGemeente() {
  clearTimeout(gemT);
  if (!S.d.gemeente || DEMO) return;
  gemT = setTimeout(async () => {
    const z = S.I.items.filter((i) => i.k === "zone");
    if (!z.length) { if (S.I.kaartGemeente) { S.I.kaartGemeente = ""; tekenControles(); } return; }
    const lat = z.reduce((a, i) => a + i.lat, 0) / z.length, lng = z.reduce((a, i) => a + i.lng, 0) / z.length;
    const sleutelG = lat.toFixed(4) + "," + lng.toFixed(4);
    if (S.I.kaartPunt === sleutelG && S.I.kaartGemeente) return;
    try {
      const j = await (await fetch(GEO + "Location?c=1&latlon=" + lat + "," + lng)).json();
      const g = j.LocationResult && j.LocationResult[0] && j.LocationResult[0].Municipality;
      S.I.kaartPunt = sleutelG; S.I.kaartGemeente = g || "?"; bewaar(); tekenControles();
    } catch (e) {}
  }, 600);
}
// Gebouwen uit het GRB (Digitaal Vlaanderen, laag GBG "gebouw aan de grond") rond het getekende plan, om te
// controleren dat de doorgang voor de hulpdiensten en de opstellingen niet op een gebouw liggen (5/11/2026).
const GRB_WFS = "https://geo.api.vlaanderen.be/GRB/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=GRB:GBG&outputFormat=application/json&srsName=EPSG:4326&count=1000&bbox=";
let gebT = null, GEBOUWEN = { sleutel: "", ringen: null };
function laadGebouwen() {
  clearTimeout(gebT);
  const its = S.I.items.filter((i) => KAT_I[i.k].f === "rect" && i.k !== "zone");
  if (!its.length) return;
  gebT = setTimeout(async () => {
    const lats = its.map((i) => i.lat), lngs = its.map((i) => i.lng), pad = 0.0006; // ruwweg 50 m marge
    const bb = [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad];
    const sleutel = bb.map((x) => x.toFixed(4)).join(",");
    if (GEBOUWEN.sleutel === sleutel && GEBOUWEN.ringen) return;
    try {
      const j = await (await fetch(GRB_WFS + bb.join(",") + ",urn:ogc:def:crs:OGC:1.3:CRS84")).json();
      const ringen = [];
      (j.features || []).forEach((f) => {
        const g = f.geometry || {}, polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
        polys.forEach((pl) => pl[0] && ringen.push(pl[0].map(([lng, lat]) => [lng, lat])));
      });
      GEBOUWEN = { sleutel, ringen }; tekenControles();
    } catch (e) { /* zonder gebouwenkaart geen controle; de rest werkt gewoon */ }
  }, 700);
}
function inRing(p, r) { // punt in veelhoek (lokale meters), even-oneven regel
  let binnen = false;
  for (let i = 0, k = r.length - 1; i < r.length; k = i++) {
    const [xi, yi] = r[i], [xk, yk] = r[k];
    if ((yi > p[1]) !== (yk > p[1]) && p[0] < ((xk - xi) * (p[1] - yi)) / (yk - yi) + xi) binnen = !binnen;
  }
  return binnen;
}
// Overlapt een rechthoek (lokale meters) een gebouw? Raster van punten in de rechthoek, plus hoekpunten van het gebouw.
// 0,5 m marge naar binnen, zodat tegen de gevel aan nog mag.
function opGebouw(r) {
  if (!GEBOUWEN.ringen || !GEBOUWEN.ringen.length) return false;
  const binnenR = { ...r, w: Math.max(0, r.w - 1), l: Math.max(0, r.l - 1) };
  const pts = puntenIn(binnenR, 1);
  return GEBOUWEN.ringen.some((ring) => {
    const rl = ring.map(([lng, lat]) => lokaal(lat, lng));
    return pts.some((p) => inRing(p, rl)) || rl.some((p) => binnenRect(p, binnenR));
  });
}
let sugT = null, sugLaatste = "";
function adresSuggesties() {
  clearTimeout(sugT);
  sugT = setTimeout(async () => {
    const v = ($("f-adres") && $("f-adres").value || "").trim();
    if (v.length < 3 || v === sugLaatste) return;
    sugLaatste = v;
    const lijst = await suggesties(v, 6), dl = $("f-adreslijst");
    if (!dl) return;
    dl.replaceChildren(...lijst.map((x) => new Option(x)));
    if (lijst.indexOf(v) >= 0) zoekAdres(); // een suggestie gekozen: meteen tonen
  }, 250);
}
async function locatie(q) {
  const j = await (await fetch(GEO + "Location?c=1&q=" + encodeURIComponent(q))).json();
  return (j.LocationResult && j.LocationResult[0]) || null;
}
async function zoekAdres() {
  const v = ($("f-adres").value || "").trim();
  if (!v) return;
  $("msg").textContent = "Adres zoeken…";
  try {
    let loc = await locatie(v);
    if (!loc && metGemeente(v) !== v) loc = await locatie(metGemeente(v));
    if (!loc) { const s = (await suggesties(v, 1))[0]; if (s) loc = await locatie(s); }
    if (!loc) throw new Error("niet gevonden");
    map.setView([loc.Location.Lat_WGS84, loc.Location.Lon_WGS84], 19);
    S.I.gezocht = true;
    $("msg").textContent = zelfdeGemeente(loc.Municipality) ? "Gevonden: " + loc.FormattedAddress : "Let op: " + loc.FormattedAddress + " ligt niet in " + S.d.gemeente + ", de gemeente van je aanvraag. Kies een adres in " + S.d.gemeente + ".";
    bewaar();
  } catch (e) { $("msg").textContent = "Adres niet gevonden. Verschuif de kaart zelf naar de juiste plaats."; }
}

// ---------- Basiskaart ----------
const GRB_WMTS = "https://geo.api.vlaanderen.be/GRB/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=grb_bsk&STYLE=&FORMAT=image/png&TILEMATRIXSET=GoogleMapsVL&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}";
const WEB_R = 20037508.342789;
async function tegel(z, x, y) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(GRB_WMTS.replace("{z}", z).replace("{x}", x).replace("{y}", y), { signal: ctl.signal });
    if (!r.ok || !/image/.test(r.headers.get("content-type") || "")) throw new Error("tegel");
    return await createImageBitmap(await r.blob());
  } finally { clearTimeout(t); }
}
// Kaartbeeld voor een gebied in EPSG:3857 (minX, minY, maxX, maxY), samengesteld uit WMTS-tegels.
async function grbBeeld(bbox, wpx, hpx) {
  const [x0, y0, x1, y1] = bbox, doel = (x1 - x0) / wpx;
  let z = 0; while (z < 21 && (2 * WEB_R) / 256 / 2 ** z > doel) z++;
  const res = (2 * WEB_R) / 256 / 2 ** z, n = 2 ** z;
  const c0 = Math.floor((x0 + WEB_R) / res / 256), c1 = Math.floor((x1 + WEB_R) / res / 256);
  const r0 = Math.floor((WEB_R - y1) / res / 256), r1 = Math.floor((WEB_R - y0) / res / 256);
  if ((c1 - c0 + 1) * (r1 - r0 + 1) > 200) throw new Error("te veel tegels");
  const cv = document.createElement("canvas"); cv.width = wpx; cv.height = hpx;
  const g = cv.getContext("2d"), sx = wpx / (x1 - x0), sy = hpx / (y1 - y0);
  const taken = [];
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) if (c >= 0 && r >= 0 && c < n && r < n) taken.push(tegel(z, c, r).then((bm) => {
    const tx = c * 256 * res - WEB_R, ty = WEB_R - r * 256 * res;
    g.drawImage(bm, (tx - x0) * sx, (y1 - ty) * sy, 256 * res * sx + 0.5, 256 * res * sy + 0.5);
  }));
  const uit = await Promise.allSettled(taken);
  if (!uit.some((u) => u.status === "fulfilled")) throw new Error("geen tegels");
  return cv;
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
    try { const bm = await grbBeeld([X - hw, Y - hh, X + hw, Y + hh], wpx, hpx); g.globalAlpha = 0.75; g.drawImage(bm, P(VAK.x), P(VAK.y), wpx, hpx); g.globalAlpha = 1; }
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
    const vormPad = () => { g.beginPath(); S.G.pts.forEach((q, i) => { const m = toMm(q); if (i) g.lineTo(P(m[0]), P(m[1])); else g.moveTo(P(m[0]), P(m[1])); }); g.closePath(); };
    g.save(); vormPad(); g.clip();
    g.strokeStyle = "#e4e6ee"; g.lineWidth = P(0.1);
    for (let x = 0; x <= l; x++) { g.beginPath(); g.moveTo(P(ox + x * u), P(oy)); g.lineTo(P(ox + x * u), P(oy + b * u)); g.stroke(); }
    for (let y = 0; y <= b; y++) { g.beginPath(); g.moveTo(P(ox), P(oy + y * u)); g.lineTo(P(ox + l * u), P(oy + y * u)); g.stroke(); }
    g.restore();
    g.strokeStyle = "#1a1d2b"; g.lineWidth = P(0.8); g.lineJoin = "miter"; vormPad(); g.stroke();
    // maat van elke wand, aan de buitenkant
    for (const [a, c] of wandenG()) {
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 0.01) continue;
      const ux = (c[0] - a[0]) / L, uy = (c[1] - a[1]) / L, mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2;
      let nx = uy, ny = -ux; if (inVorm([mx + nx * 0.05, my + ny * 0.05])) { nx = -nx; ny = -ny; }
      let hoek = Math.atan2(uy, ux); if (hoek > Math.PI / 2) hoek -= Math.PI; if (hoek <= -Math.PI / 2) hoek += Math.PI;
      const m = toMm([mx, my]);
      g.save(); g.translate(P(m[0] + nx * 3.2), P(m[1] + ny * 3.2)); g.rotate(hoek); tekst(g, fmt(L) + " m", 0, 0, P(3), "center", "#1a1d2b", "500"); g.restore();
    }
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
  // watermerk enkel in de demo
  if (DEMO) { g.save(); g.translate(cv.width / 2, cv.height / 2); g.rotate(-Math.PI / 9); g.fillStyle = "rgba(255,90,78,0.16)";
    g.font = "700 " + P(22) + "px 'Instrument Sans', Arial, sans-serif"; g.textAlign = "center"; g.fillText("DEMO – geen geldig plan", 0, 0); g.restore(); }
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
  if (plan === "grondplan") rij("Ruimte", (S.G.mat ? S.G.mat + " · " : "") + fmt(oppG()) + " m²" + (isRechthoek() ? " (" + fmt(S.G.l) + " × " + fmt(S.G.b) + " m)" : " (" + S.G.pts.length + " wanden, " + fmt(S.G.l) + " × " + fmt(S.G.b) + " m buitenmaten)"));
  rij("Dossier", DEMO ? "demo" : AUTH.id);
  rij("Schaal", "1/" + schaal + " op A3 · noorden boven");
  rij("Opgesteld door", BEHEER ? "evenementaanvragen.be, in opdracht van de organisator" : "de organisator");
  rij("Versie", new Date().toLocaleString("nl-BE", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }));
  y += 2; tekst(g, "Legende", P(x + 5), P(y), P(3.4), "left", "#1a1d2b", "700"); y += 6;
  const gebruikt = [...new Set((plan === "inplanting" ? S.I.items : S.G.items).map((i) => i.k))];
  for (const kk of gebruikt) {
    const k = KAT[plan][kk];
    if (k.f === "pt") symbool(g, P(x + 7), P(y), k, P(1.8)); else { g.fillStyle = hexA(k.c, 0.45); g.fillRect(P(x + 5), P(y - 1.8), P(4), P(3.6)); g.strokeStyle = k.c; g.lineWidth = P(0.3); g.strokeRect(P(x + 5), P(y - 1.8), P(4), P(3.6)); }
    tekst(g, k.n, P(x + 12), P(y), P(3), "left", "#1a1d2b", "500"); y += 6;
  }
  if (plan === "inplanting" && odHeel()) { tekst(g, "Het hele terrein is inname van het openbaar domein (" + fmt(innameM2()) + " m²)", P(x + 5), P(y), P(2.6), "left", "#1a1d2b", "500"); y += 6; }
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
  const knop = BEHEER ? "Aangepast plan opslaan" : "Plan afwerken";
  w.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px"><img class="voorbeeld" id="vb" alt="Voorbeeld van het plan op A3">' +
    (BEHEER ? '<label for="toel">Wat pasten we aan? (komt in de conceptmail aan de klant)<input id="toel" maxlength="500" placeholder="bv. tweede nooduitgang aan de achterkant toegevoegd"></label>' : "") +
    (!BEHEER && !DEMO && ok ? '<label class="check" for="verklaring"><input type="checkbox" id="verklaring"> <span>Dit plan toont hoe het er op de dag echt zal staan: de opstelling, de maten en de uitgangen.</span></label>' : "") +
    '<button class="btn primary" id="opslaan" type="button"' + (ok && !DEMO && BEHEER ? "" : " disabled") + ">" + knop + "</button>" +
    (DEMO ? "" : '<button class="btn" id="downloadpdf" type="button">Download als pdf</button>') +
    (DEMO ? '<p class="melding">In de demo kan je niet afwerken.</p>'
      : !ok ? '<p class="melding">Los eerst alles in het rood op. Je kan terug naar een stap via de balk bovenaan.</p>'
      : BEHEER ? '<p class="melding">De pdf komt in de dossiermap. Er staat daarna een conceptmail met het plan klaar voor de klant.</p>'
      : '<p class="melding">Je plan gaat in je dossier en zo bij je aanvraag. We kijken alles na voor we indienen. Je kan het daarna nog aanpassen.</p>') + "</div>";
  const blad = await maakBlad(S.actief);
  voorbeeldUrl = blad.canvas.toDataURL("image/jpeg", 0.85);
  if ($("vb")) { $("vb").src = voorbeeldUrl; $("vb").onclick = () => { const d = document.createElement("div"); d.className = "groot"; d.innerHTML = '<img alt="">'; d.firstChild.src = voorbeeldUrl; d.onclick = () => d.remove(); document.body.appendChild(d); }; }
  if ($("verklaring")) $("verklaring").addEventListener("change", () => { $("opslaan").disabled = !$("verklaring").checked; });
  if ($("opslaan")) $("opslaan").addEventListener("click", () => opslaan(blad.canvas));
  if ($("downloadpdf")) $("downloadpdf").addEventListener("click", () => downloadPdf(blad.canvas));
}
// Het plan als A3-pdf, zoals het in het dossier komt.
function maakPdf(cv) {
  const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 420, 297);
  return pdf;
}
// De klant mag zijn plan altijd zelf bekijken en bewaren (na betaling; niet in de demo).
function downloadPdf(cv) {
  if (DEMO) return;
  try { maakPdf(cv).save(NAAM_PLAN[S.actief] + " – " + (AUTH.id || "plan") + (alleOk(S.actief) ? "" : " – ontwerp") + ".pdf"); }
  catch (e) { $("msg").textContent = "Downloaden lukte niet (" + e.message + ")."; }
}
async function opslaan(cv) {
  if (DEMO || !alleOk(S.actief)) return;
  if (!BEHEER && !($("verklaring") && $("verklaring").checked)) { $("msg").textContent = "Vink eerst aan dat het plan klopt met hoe het er op de dag zal staan."; return; }
  const b = $("opslaan"); b.disabled = true; $("msg").textContent = "Bezig met opslaan…";
  try {
    const data = maakPdf(cv).output("datauristring").split(",")[1];
    const plan = S.actief === "inplanting" ? { items: S.I.items, maten: S.I.maten, center: S.I.center, inname: isOD() ? innames() : [], innameHeelTerrein: odHeel() } : { ruimte: { l: S.G.l, b: S.G.b, mat: S.G.mat, pts: S.G.pts, recht: S.G.recht, m2: Math.round(oppG() * 10) / 10 }, items: S.G.items };
    const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ actie: "plan", id: AUTH.id, email: AUTH.email, beheer: AUTH.beheer, soort: S.actief, personen: S.personen, pdf: data, plan, controles: controles(S.actief), toelichting: $("toel") ? $("toel").value : "", verklaring: !BEHEER, kerncijfers: kerncijfers(S.actief) }) });
    const j = await r.json(); if (!j.ok) throw new Error(j.error || "onbekende fout");
    bewaar();
    $("msg").textContent = BEHEER ? NAAM_PLAN[S.actief] + " staat in de dossiermap. De conceptmail aan de klant staat klaar in Gmail."
      : NAAM_PLAN[S.actief] + " is afgewerkt en staat in je dossier. Met \"Download als pdf\" bewaar je zelf een kopie." + (S.plannen.length > 1 && S.plannen.some((p) => p !== S.actief) ? " Vergeet het " + NAAM_PLAN[S.plannen.find((p) => p !== S.actief)].toLowerCase() + " niet." : "") + " Moet er nog iets aan, dan laten we het je weten.";
    b.disabled = false;
  } catch (e) { $("msg").textContent = "Afwerken lukte niet (" + e.message + "). Probeer opnieuw."; b.disabled = false; }
}

// ---------- Start ----------
async function start(d) {
  try { PLANNEN_GEMEENTE = await (await fetch("/plan/plannen.json")).json(); } catch (e) { PLANNEN_GEMEENTE = {}; }
  $("login").hidden = true; $("app").hidden = false;
  laad(d);
  const np = nodigePlannen(d);
  S.plannen = np.plannen; if (!S.plannen.includes(S.actief)) S.actief = S.plannen[0];
  $("nodig").innerHTML = "Nodig voor dit evenement: " + S.plannen.map((p) => "<b>" + NAAM_PLAN[p].toLowerCase() + "</b> (" + esc(np.redenen[p].join(", ")) + ")").join(" en ") + ".";
  $("nodig").title = S.plannen.filter((p) => np.citaat[p]).map((p) => d.gemeente + ": " + np.citaat[p]).join("\n");
  $("dossierinfo").innerHTML = (DEMO ? '<span class="pill demo">Demo</span>' : (BEHEER ? '<span class="pill demo">Beheer</span>' : "") + '<span class="pill">' + esc(AUTH.id) + "</span>") + "<span>" + esc(d.evenement || "") + (d.gemeente ? " · " + esc(d.gemeente) : "") + "</span>";
  $("tabs").innerHTML = S.plannen.map((p) => '<button role="tab" type="button" data-plan="' + p + '">' + NAAM_PLAN[p] + "</button>").join("");
  $("tabs").hidden = S.plannen.length < 2;
  $("tabs").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => wisselPlan(b.dataset.plan)));
  $("terug").addEventListener("click", () => naarStap(S.stap[S.actief] - 1));
  $("verder").addEventListener("click", () => naarStap(S.stap[S.actief] + 1));
  window.addEventListener("resize", () => { if (S.actief === "grondplan") tekenGrondplan(); });
  wisselPlan(S.actief);
  if (S.actief === "inplanting" && !S.I.gezocht && S.d.adres) setTimeout(zoekAdres, 300);
}
const DEMO_DOSSIER = { openbaar: "nee", evenement: "Lentefuif (demo)", gemeente: "Oostende", adres: "Wellingtonstraat 10, 8400 Oostende", datum: "zaterdag 17 april 2027", bezoekers: 300, situatie: "tent", tent: "20 x 10", organisator: "Jeugdhuis Voorbeeld" };
async function login(id, email) {
  $("l-err").hidden = true; $("l-go").disabled = true;
  try {
    const r = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(BEHEER ? { actie: "planopenen", id, beheer: BEHEERSLEUTEL } : { actie: "planopenen", id, email }) });
    const j = await r.json(); if (!j.ok) throw new Error(j.error);
    AUTH = BEHEER ? { id, beheer: BEHEERSLEUTEL } : { id, email };
    if (!BEHEER) try { sessionStorage.setItem("plantekenaar-login", JSON.stringify(AUTH)); } catch (e) {}
    start(j.dossier);
  } catch (e) { $("l-err").textContent = e.message || "Openen lukte niet."; $("l-err").hidden = false; $("l-go").disabled = false; }
}
fetch("/plan/normen.json").then((r) => r.json()).then((j) => { NORMEN = j; if (S) tekenControles(); }).catch(() => {});
const q = new URLSearchParams(location.search);
// Beheersleutel: uit de link halen, enkel in deze tab bewaren en meteen uit de adresbalk verwijderen.
let BEHEERSLEUTEL = null;
try { if (q.get("beheer")) sessionStorage.setItem("plantekenaar-beheer", q.get("beheer")); BEHEERSLEUTEL = sessionStorage.getItem("plantekenaar-beheer"); } catch (e) { BEHEERSLEUTEL = q.get("beheer"); }
if (q.get("beheer")) { q.delete("beheer"); history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "")); }
BEHEER = !!BEHEERSLEUTEL;
if (q.get("demo") !== null) { BEHEER = false; DEMO = true; start(DEMO_DOSSIER); }
else {
  $("login").hidden = false;
  if (BEHEER) { $("l-mail").closest("label").hidden = true; $("l-demo").hidden = true; document.querySelector("#login h1").textContent = "Beheer: plan openen"; document.querySelector("#login .uitleg").textContent = "Geef het dossiernummer. Je opent het laatst opgeslagen plan."; }
  if (q.get("id")) $("l-id").value = q.get("id");
  let opgeslagen = null; try { opgeslagen = JSON.parse(sessionStorage.getItem("plantekenaar-login") || "null"); } catch (e) {}
  if (!BEHEER && opgeslagen && (!q.get("id") || q.get("id") === opgeslagen.id)) login(opgeslagen.id, opgeslagen.email);
  $("l-go").addEventListener("click", () => { const id = $("l-id").value.trim().toUpperCase(), em = $("l-mail").value.trim(); if (!id || (!em && !BEHEER)) { $("l-err").textContent = "Vul je dossiernummer en e-mail in."; $("l-err").hidden = false; return; } login(id, em); });
  $("l-demo").addEventListener("click", () => { DEMO = true; history.replaceState(null, "", "?demo"); start(DEMO_DOSSIER); });
}
})();
