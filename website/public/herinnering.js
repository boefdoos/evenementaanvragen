/* Herinnering onder de termijncheck (startpagina en gemeentepagina's), 17/11/2026.
   herinneringBlok(el, info): info = {gemeente, type, datum:"JJJJ-MM-DD", meerdaags:"ja"|"", deadline:Date} of null.
   Toont het blok enkel als de deadline nog minstens HER_MIN_DAGEN weg is (zelfde getallen als Herinnering.gs).
   De bezoeker bevestigt via een link in zijn mail (/herinnering?bevestig=…); pas dan staat de herinnering vast. */
var HER_ENDPOINT = "https://script.google.com/macros/s/AKfycbz-EAv8lTkB6Y5_yKjc9SWB5UrtYHjuUV_ffm4yqTiMgYR7XjiB0unzoneptmGkJYDuaQ/exec";
var HER_DAGEN_VOOR = 14, HER_MIN_DAGEN = 16;

function herinneringBlok(el, info) {
  if (!el) return;
  var iso = function (d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  var nu = new Date(); nu.setHours(0, 0, 0, 0);
  var dagen = info && info.deadline ? Math.round((new Date(info.deadline).setHours(0, 0, 0, 0) - nu) / 864e5) : -1;
  if (!info || dagen < HER_MIN_DAGEN) { el.hidden = true; el._info = null; return; }

  if (!el._klaar) {
    el.innerHTML =
      '<div class="her">' +
        '<p class="her-k">Nog niet klaar om aan te vragen?</p>' +
        '<p class="her-t"></p>' +
        '<form class="her-f" novalidate>' +
          '<input type="email" name="email" autocomplete="email" inputmode="email" placeholder="jouw@mailadres.be" aria-label="Je e-mailadres" required>' +
          '<input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="her-hp">' +
          '<button class="btn" type="submit">Herinner me</button>' +
        '</form>' +
        '<p class="her-m" role="status" aria-live="polite"></p>' +
      '</div>';
    var f = el.querySelector("form"), m = el.querySelector(".her-m"), knop = f.querySelector("button");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var i = el._info; if (!i) return;
      var email = f.email.value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) { m.className = "her-m fout"; m.textContent = "Dat e-mailadres klopt niet helemaal."; f.email.focus(); return; }
      knop.disabled = true; m.className = "her-m"; m.textContent = "Even geduld…";
      fetch(HER_ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ actie: "herinnering", email: email, website: f.website.value, gemeente: i.gemeente, type: i.type,
          datum: i.datum, meerdaags: i.meerdaags || "", deadline: iso(new Date(i.deadline)) }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.ok && j.status === "al_ingeschreven") { m.className = "her-m ok"; m.textContent = "Die herinnering staat al klaar. Je hoort van ons."; return; }
          if (j.ok) { m.className = "her-m ok"; m.textContent = "Bijna klaar: klik op de link in de mail die we je net stuurden. Niets gekregen? Kijk even bij je spam."; f.email.value = ""; return; }
          var uitleg = { "ongeldig e-mailadres": "Dat e-mailadres klopt niet helemaal.", "te kort dag": "Je deadline is te dichtbij voor een herinnering.", "even geduld": "Je vroeg al enkele herinneringen. Probeer het later opnieuw." }[j.error];
          throw new Error(uitleg || "Dat lukte niet. Probeer het later opnieuw, of mail ons: thomas@evenementaanvragen.be.");
        })
        .catch(function (err) { m.className = "her-m fout"; m.textContent = err && err.message && !/fetch|json|network/i.test(err.message) ? err.message : "Dat lukte niet. Probeer het later opnieuw."; })
        .then(function () { knop.disabled = false; });
    });
    el._klaar = true;
  }

  var sleutel = [info.gemeente, info.type, info.datum, info.meerdaags].join("|");
  if (el._sleutel !== sleutel) { var m2 = el.querySelector(".her-m"); m2.textContent = ""; m2.className = "her-m"; el._sleutel = sleutel; }
  var op = new Date(info.deadline); op.setDate(op.getDate() - HER_DAGEN_VOOR);
  var t = el.querySelector(".her-t");
  t.textContent = "We mailen je één keer, op " + op.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" }) +
    " (twee weken vóór je deadline), met een link naar onze dienst. ";
  var a = document.createElement("a"); a.href = "/privacy#herinnering"; a.textContent = "Privacy"; t.appendChild(a);
  el._info = info;
  el.hidden = false;
}
