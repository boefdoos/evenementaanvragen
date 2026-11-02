// Maakt van een <select> met gemeenten een zoekveld: typen en kiezen uit de suggesties (datalist).
// De select blijft verborgen de bron van waarheid (naam, waarde, change-events), zodat de rest van de pagina niets merkt.
function gemeenteZoeker(sel) {
  const inp = document.createElement("input");
  inp.type = "text"; inp.id = sel.id + "_zoek"; inp.autocomplete = "off"; inp.spellcheck = false;
  inp.setAttribute("autocapitalize", "words"); inp.setAttribute("enterkeyhint", "done");
  inp.placeholder = "Typ de naam van je gemeente";
  const dl = document.createElement("datalist");
  dl.id = sel.id + "_lijst"; inp.setAttribute("list", dl.id);
  sel.after(inp, dl);
  sel.hidden = true; sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");
  document.querySelectorAll('label[for="' + sel.id + '"]').forEach(l => { l.htmlFor = inp.id; });
  const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const namen = () => [...sel.options].map(o => o.value).filter(Boolean);
  // exact: enkel een volledige naam telt (tijdens het typen); anders ook één unieke naam die zo begint (bij verlaten).
  function kies(exact) {
    const v = norm(inp.value), lijst = namen();
    let m = lijst.find(n => norm(n) === v);
    if (!m && !exact && v) { const s = lijst.filter(n => norm(n).startsWith(v)); if (s.length === 1) m = s[0]; }
    if ((m || "") !== sel.value) { sel.value = m || ""; sel.dispatchEvent(new Event("change", { bubbles: true })); }
    if (m && !exact) inp.value = m;
  }
  inp.addEventListener("input", () => kies(true));
  inp.addEventListener("change", () => kies(false));
  inp.addEventListener("blur", () => kies(false));
  return {
    inp,
    vul() { dl.replaceChildren(...namen().map(n => new Option(n))); inp.value = sel.value; },
    sync() { inp.value = sel.value; }
  };
}
