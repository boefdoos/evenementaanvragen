/* Rekenlogica Indienwijzer (zelfde als de Indienwijzer-pagina; pariteit met indienwijzer.py getest). Verwacht globale RULES. */
const TYPES = [["concert","Concert / muziekfestival"],["fuif","Fuif / bal"],["buurtfeest","Buurt- of straatfeest"],["eetfestijn","Eetfestijn"],["markt","Markt / beurs / rommelmarkt"],["braderij","Braderij"],["kermis","Kermis"],["stoet","Stoet / optocht / doortocht"],["sport","Sportactiviteit"],["wielerwedstrijd","Wielerwedstrijd"],["schoolfeest","Schoolfeest"],["tentoonstelling","Tentoonstelling"],["andere","Andere"]];
const UNIT = {d:["dag","dagen"],w:["week","weken"],m:["maand","maanden"],wd:["werkdag","werkdagen"]};
const $ = id => document.getElementById(id);

function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,da);}
const hcache={};
function holidays(y){ if(hcache[y]) return hcache[y]; const e=easter(y), add=(dt,n)=>{const x=new Date(dt);x.setDate(x.getDate()+n);return x};
  const list=[new Date(y,0,1),add(e,1),new Date(y,4,1),add(e,39),add(e,50),new Date(y,6,21),new Date(y,7,15),new Date(y,10,1),new Date(y,10,11),new Date(y,11,25)];
  return hcache[y]=new Set(list.map(key)); }
function key(d){return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate()}
function isWorkday(d){const w=d.getDay(); return w!==0&&w!==6&&!holidays(d.getFullYear()).has(key(d));}
function minusWorkdays(d,n){const x=new Date(d); let c=0; while(c<n){x.setDate(x.getDate()-1); if(isWorkday(x)) c++;} return x;}
function minus(d,n,unit){const x=new Date(d);
  if(unit==="d") x.setDate(x.getDate()-n);
  else if(unit==="w") x.setDate(x.getDate()-7*n);
  else if(unit==="m"){const day=x.getDate(); x.setDate(1); x.setMonth(x.getMonth()-n); const last=new Date(x.getFullYear(),x.getMonth()+1,0).getDate(); x.setDate(Math.min(day,last));}
  else if(unit==="wd") return minusWorkdays(d,n);
  return x;}
function label(n,u){return n+" "+UNIT[u][n===1?0:1]}

function evaluate(r, ev){
  if(r.status==="onbekend"||!r.base) return {unknown:true};
  const t = r.base[ev.type] ? ev.type : "*";
  const [bn,bu] = r.base[t];
  const cands=[{n:bn,u:bu,why:(t==="*"?"algemene termijn":"termijn voor dit type")}];
  const mog=[];
  for(const x of r.extra||[]){
    if(x.groot && !ev.groot){ if(!((x.types&&!x.types.includes(ev.type))||(x.minVisitors&&!(ev.visitors>=x.minVisitors))||(x.nieuw&&!ev.nieuw)||(x.openbaarDomein&&!ev.od)||(x.months&&!x.months.includes(ev.date.getMonth()+1)))) mog.push({n:x.n,u:x.unit,why:"groot evenement / grote impact",date:minus(ev.date,x.n,x.unit)}); }
    if(x.types && !x.types.includes(ev.type)) continue;
    if(x.minVisitors && !(ev.visitors>=x.minVisitors)) continue;
    if(x.groot && !ev.groot) continue;
    if(x.nieuw && !ev.nieuw) continue;
    if(x.openbaarDomein && !ev.od) continue;
    if(x.months && !x.months.includes(ev.date.getMonth()+1)) continue;
    const parts=[]; if(x.minVisitors) parts.push("vanaf "+x.minVisitors+" bezoekers"); if(x.groot) parts.push("groot evenement"); if(x.nieuw) parts.push("eerste editie"); if(x.openbaarDomein) parts.push("openbaar domein"); if(x.months) parts.push("periode "+x.months.map(m=>["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"][m-1]).join("–")); if(x.types) parts.push(x.types.join(", "));
    cands.push({n:x.n,u:x.unit,why:parts.join(", ")});
  }
  let best=null;
  for(const c of cands){c.date=minus(ev.date,c.n,c.u); if(!best||c.date<best.date) best=c;}
  const rec = minusWorkdays(best.date, ev.marge);
  const mogelijk=mog.filter(m=>m.date<best.date).sort((a,b)=>a.date-b.date)[0]||null;
  return {best, rec, cands, onzeker:r.status==="onzeker", mogelijk};
}
const FLAGTXT={muziek:"muziek boven 85 dB(A)",sterkeDrank:"sterke drank",alcohol:"alcohol schenken",verkeer:"parkeerverbod of verkeersmaatregelen",materiaal:"feestmateriaal van de gemeente",publiciteit:"publiciteit langs de weg",stroomgroep:"stroomgroep boven 150 kVA",subsidie:"toelage aanvragen",od:"openbaar domein"};
function check(als,ev){
  if(!als) return {ok:true,cond:false,q:[]};
  if(als.types && !als.types.includes(ev.type)) return {ok:false};
  if(als.minVisitors && !(ev.visitors>=als.minVisitors)) return {ok:false};
  const q=[];
  for(const k of Object.keys(FLAGTXT)){ if(!als[k]) continue; let v=ev.x[k]; if(k==="alcohol"&&ev.x.sterkeDrank===true) v=true; if(v===false) return {ok:false}; if(v==null) q.push(FLAGTXT[k]); }
  if(als.muziekOfDrank){ const vs=[ev.x.muziek,ev.x.sterkeDrank]; if(!vs.includes(true)){ if(vs.every(v=>v===false)) return {ok:false}; q.push("muziek of sterke drank"); } }
  if(als.vraag) q.push(als.vraag);
  return {ok:true,cond:q.length>0,q};
}
const MATNAAM={nadars:"nadars",heras:"werfhekken",tafels:"tafels",stoelen:"stoelen",banken:"bierbanken",podium:"podium",tent:"tenten",borden:"borden/signalisatie",vuilbakken:"vuilbakken",stroom:"stroomkast",water:"water",toiletten:"toiletten"};
function uitleenSpecial(r,ev,sp){const u=r.uitleen||{};
  if(!u.termijn_n||!u.termijn_unit||ev.x.materiaal===false) return;
  if(sp.some(s=>/materiaal|uitleen/i.test(s.wat)&&s.date)) return;
  const dv=new Date(ev.date); dv.setDate(dv.getDate()-1); // vanaf begin huur (levering of ophalen)
  const d=minus(dv,u.termijn_n,u.termijn_unit); const cond=ev.x.materiaal==null;
  sp.push({soort:"deadline",wat:"Materiaal aanvragen bij de uitleendienst",toel:u.aanvraag||"",cond,q:cond?"feestmateriaal van de gemeente":"",date:d,past:d<today(),term:label(u.termijn_n,u.termijn_unit)});
  sp.sort((a,b)=>(a.date?a.date.getTime():9e15)-(b.date?b.date.getTime():9e15));}
function koppel(r,ev,sp,res){const u=r.uitleen||{};
  if(u.koppeling!=="bij_evenementaanvraag"||ev.x.materiaal===false||!res||!res.best||res.aanname) return;
  const ed=res.best.date; let hit=false;
  for(const s of sp){ if(/materiaal|uitleen/i.test(s.wat)&&s.date){ hit=true; if(ed<s.date){s.date=ed; s.past=ed<today();} s.toel=((s.toel||"")+" Mee te voegen bij de evenementaanvraag, dus uiterlijk op de indiendatum.").trim(); } }
  if(!hit){ const cond=ev.x.materiaal==null; sp.push({soort:"deadline",wat:"Materiaal aanvragen (mee met de evenementaanvraag)",toel:u.aanvraag||"",cond,q:cond?"feestmateriaal van de gemeente":"",date:ed,past:ed<today()}); }
  sp.sort((a,b)=>(a.date?a.date.getTime():9e15)-(b.date?b.date.getTime():9e15));}
function fallback(r,ev){
  const pr=x=>x.provincie||"West-Vlaanderen", plat=r.platform||"onbekend";
  const tries=[];
  if(plat!=="onbekend") tries.push([x=>x.platform===plat&&pr(x)===pr(r),"op "+plat+" in de provincie "+pr(r)]);
  tries.push([x=>pr(x)===pr(r),"in de provincie "+pr(r)]);
  if(plat!=="onbekend") tries.push([x=>x.platform===plat,"op "+plat]);
  tries.push([x=>true,"in alle gemeenten in de regels"]);
  let same=[],scope=""; for(const [f,sc] of tries){ same=RULES.filter(x=>x!==r&&f(x)).map(x=>({x,res:evaluate(x,ev)})).filter(o=>!o.res.unknown); if(same.length){scope=sc;break;} }
  if(!same.length) return null;
  const w=same.reduce((a,b)=>b.res.best.date<a.res.best.date?b:a);
  const ms=same.filter(o=>o.res.mogelijk&&o.res.mogelijk.date<w.res.best.date);
  let mogelijk=null; if(ms.length){ const d=Math.min(...ms.map(o=>o.res.mogelijk.date.getTime())); const sel=ms.filter(o=>o.res.mogelijk.date.getTime()===d); mogelijk={...sel[0].res.mogelijk,gemeenten:sel.map(o=>o.x.gemeente).sort()}; }
  return {best:w.res.best,rec:minusWorkdays(w.res.best.date,ev.marge),cands:[w.res.best],onzeker:false,aanname:w.x.gemeente,scope,mogelijk};}
function specials(r,ev){
  const out=[];
  for(const b of r.bijzonder||[]){ const c=check(b.als,ev); if(!c.ok) continue;
    const it={soort:b.soort,wat:b.wat,toel:b.toelichting||"",cond:c.cond,q:(c.q||[]).join(" / ")}; let d=null;
    if(["deadline","venster","vroegst","laatste_wijziging"].includes(b.soort)){ let bas=ev.date; if(b.soort==="deadline"&&/materiaal|uitleen|ontlen/i.test(b.wat)){ bas=new Date(ev.date); bas.setDate(bas.getDate()-1); } d=minus(bas,b.n,b.unit); it.term=label(b.n,b.unit); }
    else if(b.soort==="vaste_datum"){ const cs=[]; for(const v of b.vast){ if(v.maanden.includes(ev.date.getMonth()+1)){ const [mm,dd]=v.md.split("-").map(Number); cs.push(new Date(ev.date.getFullYear()+v.jaar,mm-1,dd)); } } if(cs.length) d=new Date(Math.min(...cs)); }
    it.date=d; it.past=!!(d && d<today() && !["venster","vroegst"].includes(b.soort)); out.push(it); }
  out.sort((a,b)=>(a.date?a.date.getTime():9e15)-(b.date?b.date.getTime():9e15));
  return out;
}
const fmt = d => d.toLocaleDateString("nl-BE",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
const fmtLong = d => d.toLocaleDateString("nl-BE",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
function today(){const t=new Date(); t.setHours(0,0,0,0); return t;}
function state(res){ if(res.unknown) return "unk"; const t=today(); if(res.best.date<t) return "late"; if(res.rec<t) return "tight"; return res.onzeker?"unk":"ok"; }
const STXT={ok:"op tijd",tight:"binnen marge",late:"te laat",unk:"onzeker",ass:"aanname"};
function daysUntil(d){return Math.round((d-today())/86400000)}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}

