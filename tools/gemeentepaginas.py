#!/usr/bin/env python3
"""Genereert per gemeente een statische pagina website/<slug>/index.html uit website/regels.json.

Gebruik:
  python3 tools/gemeentepaginas.py Oostende        # één of meer gemeenten
  python3 tools/gemeentepaginas.py --alle          # alle gemeenten met status ok/onzeker

De stijl (<style> van website/index.html) wordt overgenomen, zodat de pagina's
dezelfde huisstijl hebben. Gemeenten met status 'onbekend' krijgen geen pagina:
zonder eigen gegevens zou het een lege kopie zijn (doorway page).
"""
import html, json, re, sys, unicodedata
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "website"
DOMEIN = "https://evenementaanvragen.be"

TYPES = {"*": "Evenementen in het algemeen", "concert": "Concert of festival", "fuif": "Fuif of bal",
         "buurtfeest": "Buurt- of straatfeest", "eetfestijn": "Eetfestijn", "markt": "Markt of rommelmarkt",
         "braderij": "Braderij", "kermis": "Kermis", "stoet": "Stoet of optocht", "sport": "Sportactiviteit",
         "wielerwedstrijd": "Wielerwedstrijd", "schoolfeest": "Schoolfeest", "tentoonstelling": "Tentoonstelling",
         "andere": "Andere"}
BUITEN_AANBOD = {"stoet", "wielerwedstrijd"}
UNIT = {"d": ("dag", "dagen"), "w": ("week", "weken"), "m": ("maand", "maanden"), "wd": ("werkdag", "werkdagen")}
MAT = {"nadars": "nadarafsluitingen", "heras": "werfhekken", "tafels": "tafels", "stoelen": "stoelen",
       "banken": "bierbanken", "podium": "podiumelementen", "tent": "tenten", "borden": "signalisatieborden",
       "vuilbakken": "vuilbakken", "stroom": "stroomkasten", "water": "wateraansluiting", "toiletten": "toiletten"}

e = lambda s: html.escape(str(s), quote=True)


def slug(naam):
    s = unicodedata.normalize("NFKD", naam).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def termijn(n, u):
    return f"{n} {UNIT[u][0 if n == 1 else 1]}"


def huisstijl():
    s = (SITE / "index.html").read_text(encoding="utf-8")
    return re.search(r"<style>\n/\* Rustig donker.*?</style>", s, re.S).group(0)


EXTRA_CSS = """<style>
/* Gemeentepagina: aanvulling op de huisstijl van de startpagina */
.crumbs{font-size:14px;color:var(--dim);padding-top:22px}
.crumbs a{color:var(--soft);text-decoration:none}.crumbs a:hover{color:var(--text)}
.feit{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 24px;padding:16px 0;border-bottom:1px solid var(--line);align-items:baseline}
.feit dt{color:var(--soft)}.feit dd{margin:0;font-weight:600;text-align:right}
.feit dd small{display:block;font-weight:400;color:var(--dim);font-size:13px}
dl.feiten{margin:28px 0 0;max-width:760px;border-top:1px solid var(--line)}
.twee{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:36px}
@media (max-width:800px){.twee{grid-template-columns:1fr}}
.vak{border-radius:20px;padding:26px;background:var(--card);border:1px solid var(--line);display:grid;gap:12px;align-content:start}
.vak p,.vak li{color:var(--soft);font-size:16px}
.vak ul{margin:0;padding-left:18px;display:grid;gap:6px}
.vak a{color:var(--text)}
.bron{margin-top:28px;font-size:14px;color:var(--dim);max-width:760px}
.bron a{color:var(--soft)}
.tag{font-size:12px;font-weight:600;color:var(--dim);border:1px solid var(--line-2);border-radius:999px;padding:2px 8px;margin-left:8px;white-space:nowrap}
.panel .vast{font:600 18px/1.3 var(--f-body);color:var(--text)}
</style>"""


def pagina(r):
    g = r["gemeente"]
    s = slug(g)
    base = r.get("base") or {}
    alg = base.get("*")
    alg_txt = termijn(*alg) if alg else None
    platform = r.get("platform") if r.get("platform") not in (None, "", "onbekend") else None
    kanaal = r.get("kanaal") or ""
    u = r.get("uitleen") or {}

    # --- kop en meta ---
    title = f"Evenement aanvragen in {g}: termijn en werkwijze"
    if alg_txt:
        desc = (f"Een evenement in {g}? Vraag het minstens {alg_txt} op voorhand aan"
                + (f" via {platform}" if platform else "") + ". Bereken je deadline en laat ons het dossier opmaken en indienen.")
    else:
        desc = f"Een evenement in {g}? Bereken je deadline en laat ons het dossier opmaken en indienen."
    lead = (f"In {e(g)} vraag je een evenement minstens <b>{e(alg_txt)}</b> op voorhand aan"
            + (f", {e(kanaal[0].lower() + kanaal[1:])}" if kanaal else "") + "." if alg_txt
            else f"Hier vind je hoe een evenementaanvraag in {e(g)} verloopt.")

    # --- termijnen ---
    rijen = []
    for k, (n, unit) in sorted(base.items(), key=lambda kv: (kv[0] != "*", kv[0])):
        tag = '<span class="tag">niet in ons aanbod</span>' if k in BUITEN_AANBOD else ""
        rijen.append(f'<div class="feit"><dt>{e(TYPES.get(k, k))}{tag}</dt><dd>{e(termijn(n, unit))} vooraf</dd></div>')
    for x in r.get("extra") or []:
        voorw = []
        if x.get("minVisitors"): voorw.append(f"vanaf {x['minVisitors']} bezoekers")
        if x.get("groot"): voorw.append("groot evenement")
        if x.get("nieuw"): voorw.append("eerste editie")
        if x.get("openbaarDomein"): voorw.append("op openbaar domein")
        if x.get("types"): voorw.append(", ".join(TYPES.get(t, t).lower() for t in x["types"]))
        rijen.append(f'<div class="feit"><dt>{e(", ".join(voorw).capitalize() or "Bijzonder geval")}</dt><dd>{e(termijn(x["n"], x["unit"]))} vooraf</dd></div>')
    for b in r.get("bijzonder") or []:
        if b.get("soort") in ("deadline", "vroegst") and b.get("n"):
            pre = ""
            rijen.append(f'<div class="feit"><dt>{e(b["wat"])}</dt><dd>{pre}{e(termijn(b["n"], b["unit"]))} vooraf</dd></div>')
    note = f'<p class="intro">{e(r["note"])}</p>' if r.get("note") else ""

    # --- hoe aanvragen ---
    hoe = []
    if kanaal: hoe.append(f"<li>{e(kanaal)}" + (f' (<a href="{e(r["link"])}" rel="noopener">naar het loket</a>)' if r.get("link") else "") + "</li>")
    if r.get("college"): hoe.append(f"<li>{e(r['college'])}</li>")
    if r.get("contact"): hoe.append(f"<li>Contact: {e(r['contact'])}</li>")

    # --- feestmateriaal ---
    mat = ""
    if u.get("uitleendienst") == "ja":
        items = [MAT[k] for k, v in (u.get("catalogus") or {}).items() if v == "ja" and k in MAT]
        part = {"ja": "Ook particulieren mogen lenen.", "nee": "Particulieren kunnen er niet lenen."}.get(u.get("particulieren_toegelaten"), "")
        li = []
        if items: li.append(f"<li>Onder meer {e(', '.join(items))}.</li>")
        if u.get("termijn"): li.append(f"<li>Aanvragen {e(u['termijn'])}.</li>")
        if part: li.append(f"<li>{e(part)}</li>")
        # Enkel het publieke deel: onderzoeksnotities ("niet vermeld", "onbekend") horen niet op de site.
        kosten = (u.get("kosten") or "").split(";")[0].strip()
        if kosten and not re.search(r"niet vermeld|onbekend", kosten, re.I): li.append(f"<li>{e(kosten)}.</li>")
        mat = (f'<div class="vak"><h3>Feestmateriaal lenen</h3><p>{e(g)} heeft een uitleendienst. Wij vragen het materiaal mee aan, met wat marge.</p>'
               f'<ul>{"".join(li)}</ul>' + (f'<p><a href="{e(u["link"])}" rel="noopener">Uitleendienst van {e(g)}</a></p>' if u.get("link") else "") + "</div>")

    bron = f'<p class="bron">Bron: <a href="{e(r["bron"])}" rel="noopener">website van {e(g)}</a>. Nagekeken door evenementaanvragen.be. De gemeente beslist altijd zelf; bij twijfel geldt wat zij publiceert.</p>' if r.get("bron") else ""

    ld = [
        {"@context": "https://schema.org", "@type": "Service", "name": f"Evenementaanvraag in {g}",
         "serviceType": "Opmaken en indienen van evenementaanvragen", "areaServed": {"@type": "City", "name": g},
         "provider": {"@type": "Organization", "name": "evenementaanvragen.be", "url": DOMEIN + "/"},
         "url": f"{DOMEIN}/{s}/", "offers": {"@type": "Offer", "price": "45", "priceCurrency": "EUR"}},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "evenementaanvragen.be", "item": DOMEIN + "/"},
            {"@type": "ListItem", "position": 2, "name": r.get("provincie", "West-Vlaanderen")},
            {"@type": "ListItem", "position": 3, "name": g, "item": f"{DOMEIN}/{s}/"}]},
    ]

    return s, f"""<!doctype html>
<html lang="nl-BE">
<head>
<meta charset="utf-8">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="canonical" href="{DOMEIN}/{s}/">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@600;800&family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
{huisstijl()}
{EXTRA_CSS}
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body>

<header class="top"><div class="wrap">
  <a class="mark" href="/" aria-label="evenementaanvragen.be, naar de startpagina">evenementaanvragen<b>.be</b></a>
  <nav class="menu" aria-label="Hoofdmenu">
    <a href="/#werkwijze">Werkwijze</a><a href="/#prijzen">Prijzen</a><a href="/#vragen">Vragen</a><a class="go" href="/aanvraag.html?gemeente={e(g)}">Start</a>
  </nav>
</div></header>

<main>
<div class="wrap"><p class="crumbs"><a href="/">Start</a> · {e(r.get("provincie", "West-Vlaanderen"))} · {e(g)}</p></div>

<section class="hero" style="padding-top:28px"><div class="wrap">
  <div>
    <h1>Evenement aanvragen in <span>{e(g)}</span></h1>
    <p class="lead">{lead}</p>
    <div class="cta">
      <a class="btn primary" href="/aanvraag.html?gemeente={e(g)}">Wij regelen het voor je <span class="arr" aria-hidden="true">→</span></a>
      <a class="btn" href="/#prijzen">Vanaf € 45</a>
    </div>
  </div>

  <aside class="panel" aria-labelledby="calc-t">
    <div class="k" id="calc-t">Hoeveel tijd heb je nog in {e(g)}?</div>
    <div id="c-out" aria-live="polite">
      <div class="count"><span class="num">–</span><span class="unit">dagen</span></div>
      <div class="deadline">Kies soort en datum</div>
    </div>
    <form class="fields" onsubmit="return false" aria-label="Termijncheck">
      <label for="c-type">Soort<select id="c-type"></select></label>
      <label for="c-datum">Datum<input id="c-datum" type="date"></label>
    </form>
  </aside>
</div></section>

<section class="blk" style="padding-top:56px"><div class="wrap">
  <div class="k">Termijnen in {e(g)}</div>
  <h2 style="margin-top:10px">Hoe lang op voorhand?</h2>
  <dl class="feiten">{"".join(rijen)}</dl>
  {note}
</div></section>

<section class="blk" style="padding-top:72px"><div class="wrap">
  <div class="k">Werkwijze bij de gemeente</div>
  <h2 style="margin-top:10px">Zo verloopt een aanvraag in {e(g)}</h2>
  <div class="twee">
    <div class="vak"><h3>Aanvragen</h3><ul>{"".join(hoe)}</ul></div>
    {mat or '<div class="vak"><h3>Wat wij doen</h3><p>Wij berekenen je deadline, maken het volledige dossier op met formulieren, bijlagen en bewonersbrief, en dienen het in. Jij blijft het aanspreekpunt van de gemeente.</p></div>'}
  </div>
  {bron}

  <div class="final">
    <div><h2>Geen zin in formulieren?</h2><p>Jij vult 10 minuten in, wij maken het dossier op en dienen het in bij {e(g)}.</p></div>
    <a class="btn primary" href="/aanvraag.html?gemeente={e(g)}">Start je aanvraag <span class="arr" aria-hidden="true">→</span></a>
  </div>
</div></section>
</main>

<footer class="foot"><div class="wrap">
  <div><b>evenementaanvragen.be</b>Troostberg<br>Zwanenlaan 45, 8400 Oostende<br>Ondernemingsnummer 0791.797.538</div>
  <div><b>Contact</b>thomas@evenementaanvragen.be</div>
  <div><b>Juridisch</b><a href="/voorwaarden.html">Algemene voorwaarden</a><br><a href="/privacy.html">Privacyverklaring</a><br>Vrijgesteld van btw (kleine onderneming)</div>
</div></footer>

<script>var RULES = [];</script>
<script src="/rekenlogica.js"></script>
<script src="/indienmoment.js"></script>
<script>
(function(){{
  const GEM = {json.dumps(g)};
  const typ=$("c-type"), dat=$("c-datum"), out=$("c-out");
  TYPES.forEach(([k,v])=>typ.appendChild(new Option(v,k)));
  typ.value="fuif";
  const t0=new Date(); t0.setDate(t0.getDate()+120); dat.value=t0.toISOString().slice(0,10);
  const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  function show(){{
    const r=RULES.find(x=>x.gemeente===GEM); if(!r||!dat.value) return;
    const buiten=buitenAanbod(typ.value,0);
    if(buiten){{out.innerHTML='<div class="count"><span class="num">–</span><span class="unit">dagen</span></div><div class="deadline">Niet in ons aanbod</div><p class="rule">'+esc(buiten)+'</p>';return;}}
    const ev={{gem:r.gemeente,type:typ.value,date:new Date(dat.value+"T00:00:00"),visitors:150,marge:5,groot:false,nieuw:false,od:false,x:{{}}}};
    let res=evaluate(r,ev); if(res.unknown){{const f=fallback(r,ev); if(f) res=f;}}
    if(res.unknown){{out.innerHTML='<div class="count"><span class="num">?</span><span class="unit">dagen</span></div><div class="deadline">Termijn nog niet gekend</div><p class="rule">Start je aanvraag, dan zoeken wij het voor je op.</p>';return;}}
    const o=indienOordeel(res), st={{laat:"late",twijfel:"tight",krap:"tight",ok:"ok",geschat:"ok"}}[o.soort];
    const d=daysUntil(res.best.date), voorbij=res.best.date<today();
    const txt={{laat:"te laat",twijfel:"onzeker",krap:"krap",ok:"op tijd",geschat:"schatting"}}[o.soort];
    out.innerHTML='<div class="count"><span class="num">'+(voorbij?"0":String(d))+'</span><span class="unit">'+(d===1?"dag":"dagen")+'<br>tot je deadline</span></div>'+
      '<div class="deadline">Uiterlijk '+esc(fmtLong(res.best.date))+'<span class="status'+(st==="late"?" late":"")+'">'+txt+'</span></div>'+
      '<p class="rule">'+(st==="late"?"Deadline voorbij.":esc(label(res.best.n,res.best.u))+" vooraf")+'</p>'+
      (st==="late"?'':'<a class="go-link" href="/aanvraag.html?gemeente='+encodeURIComponent(GEM)+'&type='+encodeURIComponent(typ.value)+'&datum='+iso(ev.date)+'">Wij dienen het in voor je →</a>');
  }}
  fetch("/regels.json").then(r=>r.json()).then(data=>{{RULES=data;show();}})
    .catch(()=>{{out.innerHTML='<div class="deadline">De termijnen konden niet laden.</div><p class="rule">Start gerust je aanvraag: wij rekenen het voor je uit.</p>';}});
  [typ,dat].forEach(el=>{{el.addEventListener("change",show);el.addEventListener("input",show)}});
}})();
</script>
</body>
</html>
"""


def main(args):
    regels = json.loads((SITE / "regels.json").read_text(encoding="utf-8"))
    if args == ["--alle"]:
        kies = [r for r in regels if r.get("status") != "onbekend"]
    else:
        kies = [r for r in regels if r["gemeente"] in args]
        if len(kies) != len(args):
            sys.exit("Onbekende gemeente: " + ", ".join(set(args) - {r["gemeente"] for r in kies}))
    for r in kies:
        s, inhoud = pagina(r)
        (SITE / s).mkdir(exist_ok=True)
        (SITE / s / "index.html").write_text(inhoud, encoding="utf-8")
        print(f"website/{s}/index.html")


if __name__ == "__main__":
    main(sys.argv[1:])
