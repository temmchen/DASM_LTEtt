/* =====================================================================
   KI Labor DASM — Antestat
   - zufaellige Fragenauswahl (jede.r bekommt einen anderen Satz)
   - parametrische Rechenaufgaben mit individuellen Zahlen
   - Antworten werden nach Bestaetigung gesperrt (nicht aenderbar)
   - Protokollierung + PDF-Export mit Pruefcode (Manipulationsschutz)
   ===================================================================== */
'use strict';

const ANZAHL_FRAGEN = 10;

/* ---------- Hilfsfunktionen ---------- */
const rnd  = (a,b)=>a+Math.random()*(b-a);
const rint = (a,b)=>Math.floor(rnd(a,b+1));
const pick = arr=>arr[Math.floor(Math.random()*arr.length)];
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function fmt(x,dec=0){return Number(x).toLocaleString('de-DE',{minimumFractionDigits:dec,maximumFractionDigits:dec});}

/* Baut genau 4 numerische Optionen, dedupliziert, markiert die richtige */
function numOpt(correct, distract, unit, dec=0){
  const u = unit ? (' '+unit) : '';
  const key=v=>Number(v).toFixed(dec);
  const seen=new Set([key(correct)]);
  const opts=[{t:fmt(correct,dec)+u, ok:true}];
  for(const d of distract){
    if(opts.length>=4) break;
    if(d<=0||!isFinite(d)) continue;
    if(seen.has(key(d))) continue;
    seen.add(key(d));
    opts.push({t:fmt(d,dec)+u, ok:false});
  }
  let guard=0;
  while(opts.length<4 && guard++<60){
    const f=correct*rnd(0.45,1.7);
    if(seen.has(key(f))) continue;
    seen.add(key(f));
    opts.push({t:fmt(f,dec)+u, ok:false});
  }
  return shuffle(opts);
}

/* ===================================================================
   FRAGEN-GENERATOREN  (jeder liefert {frage, optionen, loesung})
   =================================================================== */

/* --- Rechenaufgaben (parametrisch -> individuelle Zahlen) --- */
function gSync(){
  const p=pick([1,2,3,4]), f=50, ns=60*f/p;
  return {
    frage:`Eine Drehstrom-Asynchronmaschine besitzt die Polpaarzahl <b>p = ${p}</b> und ist am `+
          `50-Hz-Netz angeschlossen. Wie groß ist die synchrone Drehzahl <b>n<sub>s</sub></b>?`,
    optionen:numOpt(ns,[ns/2, ns*2, 60*f*p, Math.abs(3000-ns)],'1/min',0),
    loesung:`n_s = f·60/p = 50·60/${p} = ${fmt(ns)} 1/min.`
  };
}
function gSlip(){
  const p=pick([1,2]), ns=60*50/p, s=pick([0.02,0.03,0.04,0.05,0.06,0.08]);
  const n=Math.round(ns*(1-s));
  const sReal=(ns-n)/ns*100;
  return {
    frage:`Das Drehfeld läuft mit <b>n<sub>s</sub> = ${fmt(ns)} 1/min</b>. Gemessen wird eine `+
          `Läuferdrehzahl von <b>n = ${fmt(n)} 1/min</b>. Wie groß ist der Schlupf <b>s</b>?`,
    optionen:numOpt(sReal,[ (ns-n)/n*100, n/ns*100, sReal/100, 100-sReal ],'%',1),
    loesung:`s = (n_s − n)/n_s = (${fmt(ns)} − ${fmt(n)})/${fmt(ns)} = ${fmt(sReal,1)} %.`
  };
}
function gDrehzahl(){
  const p=pick([1,2]), ns=60*50/p, s=pick([3,4,5,6,8]);
  const n=ns*(1-s/100);
  return {
    frage:`Eine Maschine mit <b>n<sub>s</sub> = ${fmt(ns)} 1/min</b> arbeitet mit dem Schlupf `+
          `<b>s = ${s} %</b>. Welche Läuferdrehzahl <b>n</b> stellt sich ein?`,
    optionen:numOpt(n,[ ns*(1+s/100), ns-s, ns*s/100 ],'1/min',0),
    loesung:`n = n_s·(1 − s) = ${fmt(ns)}·(1 − ${fmt(s/100,2)}) = ${fmt(n)} 1/min.`
  };
}
function gEta(){
  const Pzu=rint(150,220)*10, eta=pick([0.78,0.80,0.82,0.84,0.86]);
  const Pab=Math.round(Pzu*eta/10)*10, etaReal=Pab/Pzu*100;
  return {
    frage:`Eine Maschine nimmt <b>P<sub>zu</sub> = ${fmt(Pzu)} W</b> auf und gibt an der Welle `+
          `<b>P<sub>ab</sub> = ${fmt(Pab)} W</b> ab. Wie groß ist der Wirkungsgrad <b>η</b>?`,
    optionen:numOpt(etaReal,[ Pzu/Pab*100, (Pzu-Pab)/Pzu*100, etaReal+8 ],'%',1),
    loesung:`η = P_ab/P_zu = ${fmt(Pab)}/${fmt(Pzu)} = ${fmt(etaReal,1)} %.`
  };
}
function gPzu(){
  const U=400, I=Math.round(rnd(2.6,3.4)*10)/10, cos=pick([0.78,0.80,0.82,0.84]);
  const Pzu=Math.sqrt(3)*U*I*cos;
  return {
    frage:`Ein Drehstrommotor (U = 400 V verkettet) nimmt den Strom <b>I = ${fmt(I,1)} A</b> bei `+
          `<b>cos φ = ${fmt(cos,2)}</b> auf. Wie groß ist die aufgenommene Wirkleistung <b>P<sub>zu</sub></b>?`,
    optionen:numOpt(Pzu,[ U*I*cos, 3*U*I*cos, Math.sqrt(3)*U*I ],'W',0),
    loesung:`P_zu = √3·U·I·cos φ = 1,732·400·${fmt(I,1)}·${fmt(cos,2)} = ${fmt(Pzu)} W.`
  };
}
function gPab(){
  const M=Math.round(rnd(5,12)*10)/10, n=rint(140,147)*10;
  const Pab=M*2*Math.PI*n/60;
  return {
    frage:`An der Welle werden das Moment <b>M = ${fmt(M,1)} Nm</b> und die Drehzahl `+
          `<b>n = ${fmt(n)} 1/min</b> gemessen. Wie groß ist die abgegebene mechanische Leistung <b>P<sub>ab</sub></b>?`,
    optionen:numOpt(Pab,[ M*n, M*2*Math.PI*n, M*n/60 ],'W',0),
    loesung:`P_ab = M·2π·n/60 = ${fmt(M,1)}·2π·${fmt(n)}/60 = ${fmt(Pab)} W.`
  };
}
function gF2(){
  const f=50, s=pick([2,3,4,5,6,8,100]);
  const f2=s/100*f;
  const lab = s===100 ? 'beim Stillstand (s = 100 %)' : `mit dem Schlupf s = ${s} %`;
  return {
    frage:`Welche Frequenz <b>f<sub>2</sub></b> haben die Läuferströme einer 50-Hz-Maschine ${lab}?`,
    optionen:numOpt(f2,[ f, f/(s/100), f*s ],'Hz',2),
    loesung:`f_2 = s·f = ${fmt(s/100,2)}·50 = ${fmt(f2,2)} Hz.`
  };
}
function gNK(){
  const p=pick([1,2]), ns=60*50/p, sK=pick([0.20,0.25,0.30]);
  const nK=ns*(1-sK);
  return {
    frage:`Eine Maschine (<b>n<sub>s</sub> = ${fmt(ns)} 1/min</b>) hat den Kippschlupf `+
          `<b>s<sub>K</sub> = ${fmt(sK,2)}</b>. Bei welcher Drehzahl <b>n<sub>K</sub></b> liegt der Kipppunkt?`,
    optionen:numOpt(nK,[ ns*sK, ns*(1+sK), ns-sK ],'1/min',0),
    loesung:`n_K = n_s·(1 − s_K) = ${fmt(ns)}·(1 − ${fmt(sK,2)}) = ${fmt(nK)} 1/min.`
  };
}
function gMverh(){
  const MN=Math.round(rnd(8,12)*10)/10, v=pick([2.0,2.2,2.5,2.8]);
  const MK=Math.round(MN*v*10)/10;
  return {
    frage:`Eine Maschine hat das Nennmoment <b>M<sub>N</sub> = ${fmt(MN,1)} Nm</b> und das Kippmoment `+
          `<b>M<sub>K</sub> = ${fmt(MK,1)} Nm</b>. Wie groß ist das Verhältnis <b>M<sub>K</sub>/M<sub>N</sub></b>?`,
    optionen:numOpt(MK/MN,[ MN/MK, MK-MN, (MK+MN)/MN ],'',2),
    loesung:`M_K/M_N = ${fmt(MK,1)}/${fmt(MN,1)} = ${fmt(MK/MN,2)}.`
  };
}
function gMnenn(){
  const PN=pick([1100,1500,2200,3000]), nN=pick([1420,1430,1440,2850,950]);
  const MN=PN/(2*Math.PI*nN/60);
  return {
    frage:`Berechne aus <b>P<sub>N</sub> = ${fmt(PN)} W</b> und <b>n<sub>N</sub> = ${fmt(nN)} 1/min</b> `+
          `das Nennmoment <b>M<sub>N</sub></b>.`,
    optionen:numOpt(MN,[ PN/nN, PN*2*Math.PI*nN/60, PN/(2*Math.PI*nN) ],'Nm',1),
    loesung:`M_N = P_N/(2π·n_N/60) = ${fmt(PN)}/(2π·${fmt(nN)}/60) = ${fmt(MN,1)} Nm.`
  };
}

/* --- Verstaendnisfragen (feste Optionen, werden gemischt) --- */
function mcAsynchron(){return{
  frage:`Was bedeutet „asynchron" bei dieser Maschine?`,
  optionen:shuffle([
    {t:'Der Läufer dreht langsamer als das Drehfeld; nur durch diesen Unterschied entsteht ein Moment.',ok:true},
    {t:'Der Läufer dreht genau so schnell wie das Drehfeld.',ok:false},
    {t:'Die drei Phasen sind zeitlich nicht synchronisiert.',ok:false},
    {t:'Die Maschine läuft ausschließlich mit Gleichstrom.',ok:false}]),
  loesung:'Asynchron = nicht synchron: der Läufer eilt dem Feld nach. Diese Relativbewegung (Schlupf) erzeugt erst die Induktion und damit das Drehmoment.'};}

function mcStabil(){return{
  frage:`Welcher Bereich der Drehmoment-Drehzahl-Kennlinie ist der <b>stabile</b> Arbeitsbereich?`,
  optionen:shuffle([
    {t:'Zwischen Kipppunkt und synchroner Drehzahl: n_K < n < n_s.',ok:true},
    {t:'Zwischen Stillstand und Kipppunkt: 0 < n < n_K.',ok:false},
    {t:'Genau bei der synchronen Drehzahl n_s.',ok:false},
    {t:'Nur beim Anlauf bei n = 0.',ok:false}]),
  loesung:'Rechts vom Kipppunkt führt steigende Last zu sinkender Drehzahl und steigendem Moment → ein stabiles Gleichgewicht stellt sich ein.'};}

function mcKippR2(){return{
  frage:`Wie wirkt der Läuferwiderstand R<sub>2</sub>' auf Kippmoment und Kippschlupf?`,
  optionen:shuffle([
    {t:'Das Kippmoment M_K bleibt gleich, nur der Kippschlupf s_K verschiebt sich.',ok:true},
    {t:'Sowohl M_K als auch s_K steigen.',ok:false},
    {t:'M_K sinkt, s_K bleibt unverändert.',ok:false},
    {t:'R_2\' hat keinen Einfluss auf die Kennlinie.',ok:false}]),
  loesung:'M_K ist unabhängig von R_2\'. Ein größerer Läuferwiderstand verschiebt nur den Kipppunkt zu größerem Schlupf (z. B. Anlaufwiderstände beim Schleifringläufer).'};}

function mcSternDreieck(){return{
  frage:`Wozu dient die Stern-Dreieck-Anlaufschaltung?`,
  optionen:shuffle([
    {t:'Zur Begrenzung des hohen Anlaufstroms beim Einschalten größerer Maschinen.',ok:true},
    {t:'Zur Erhöhung der Nenndrehzahl.',ok:false},
    {t:'Zur Umkehr der Drehrichtung.',ok:false},
    {t:'Zur Verbesserung des Wirkungsgrades im Nennbetrieb.',ok:false}]),
  loesung:'In Sternschaltung liegt an jedem Strang nur die ~0,58-fache Spannung an → kleinerer Einschaltstrom. Nach dem Hochlauf wird auf Dreieck umgeschaltet.'};}

function mcKaefig(){return{
  frage:`Worin unterscheidet sich der Käfigläufer vom Schleifringläufer?`,
  optionen:shuffle([
    {t:'Der Käfigläufer hat kurzgeschlossene Leiterstäbe ohne Schleifringe; er ist robust und wartungsarm.',ok:true},
    {t:'Der Käfigläufer besitzt immer Permanentmagnete.',ok:false},
    {t:'Der Käfigläufer wird mit Gleichstrom erregt.',ok:false},
    {t:'Der Käfigläufer benötigt zwingend externe Anlaufwiderstände.',ok:false}]),
  loesung:'Der Käfigläufer (Standardbauform) hat kurzgeschlossene Stäbe. Der Schleifringläufer hat eine zugängliche Wicklung, über die sich Anlaufwiderstände schalten lassen.'};}

function mcPCu2(){return{
  frage:`In welchem Zusammenhang stehen Läufer-Kupferverluste P<sub>Cu2</sub> und Schlupf?`,
  optionen:shuffle([
    {t:'P_Cu2 = s · P_δ — die Läuferverluste sind direkt proportional zum Schlupf.',ok:true},
    {t:'P_Cu2 = P_δ / s.',ok:false},
    {t:'P_Cu2 ist unabhängig vom Schlupf.',ok:false},
    {t:'P_Cu2 = (1 − s) · P_δ.',ok:false}]),
  loesung:'Von der Luftspaltleistung P_δ wird der Anteil s·P_δ im Läufer verheizt, (1−s)·P_δ wird mechanisch. Großer Schlupf = große Läuferverluste = schlechter Wirkungsgrad.'};}

function mcUeberKipp(){return{
  frage:`Was passiert, wenn das Belastungsmoment das Kippmoment M<sub>K</sub> überschreitet?`,
  optionen:shuffle([
    {t:'Die Maschine „kippt": die Drehzahl bricht ein und der Läufer kommt zum Stillstand.',ok:true},
    {t:'Die Drehzahl steigt über die synchrone Drehzahl.',ok:false},
    {t:'Das Moment steigt weiter linear an.',ok:false},
    {t:'Der Wirkungsgrad erreicht sein Maximum.',ok:false}]),
  loesung:'Jenseits des Kipppunkts sinkt das Moment mit weiter fallender Drehzahl. Übersteigt die Last M_K, gibt es kein Gleichgewicht mehr → die Maschine bleibt stehen (Gefahr durch hohen Stillstandsstrom).'};}

function mcLeerlaufstrom(){return{
  frage:`Was bestimmt im Leerlauf hauptsächlich den aufgenommenen Ständerstrom?`,
  optionen:shuffle([
    {t:'Der Magnetisierungsstrom, der das Drehfeld aufbaut.',ok:true},
    {t:'Der hohe Anlaufstrom.',ok:false},
    {t:'Der Läuferstrom bei Nennlast.',ok:false},
    {t:'Es fließt im Leerlauf gar kein Strom.',ok:false}]),
  loesung:'Im Leerlauf wird fast nur Magnetisierungsstrom (stark induktiv) aufgenommen. Der Leerlaufstrom beträgt typisch 30–50 % des Nennstroms.'};}

function mcDrehrichtung(){return{
  frage:`Wie kehrt man die Drehrichtung einer Drehstrom-Asynchronmaschine um?`,
  optionen:shuffle([
    {t:'Zwei der drei Außenleiter (Phasen) vertauschen.',ok:true},
    {t:'Die Netzfrequenz halbieren.',ok:false},
    {t:'Den Sternpunkt auftrennen.',ok:false},
    {t:'Alle drei Phasen gleichzeitig vertauschen.',ok:false}]),
  loesung:'Vertauscht man zwei Phasen, dreht das Ständerdrehfeld in die Gegenrichtung – und mit ihm der Läufer. (Alle drei zu tauschen ändert nichts.)'};}

function mcSchlupfDef(){return{
  frage:`Welche Aussage zum Schlupf ist <b>richtig</b>?`,
  optionen:shuffle([
    {t:'Beim Stillstand ist s = 1, im idealen Synchronlauf wäre s = 0.',ok:true},
    {t:'Beim Stillstand ist s = 0.',ok:false},
    {t:'Der Schlupf ist im Nennbetrieb meist größer als 50 %.',ok:false},
    {t:'Der Schlupf hängt nur von der Netzspannung ab.',ok:false}]),
  loesung:'s = (n_s − n)/n_s. Stillstand n=0 → s=1; Synchronlauf n=n_s → s=0. Im Nennbetrieb nur wenige Prozent.'};}

function mcMaxEta(){return{
  frage:`Bei welcher Belastung erreicht die Maschine ihren besten Wirkungsgrad?`,
  optionen:shuffle([
    {t:'In der Nähe der Nennlast.',ok:true},
    {t:'Im Leerlauf.',ok:false},
    {t:'Genau am Kipppunkt.',ok:false},
    {t:'Bei blockiertem Läufer (Stillstand unter Spannung).',ok:false}]),
  loesung:'Im Leerlauf überwiegen die konstanten Verluste (Eisen, Reibung) → η klein. Das Optimum liegt nahe der Nennlast, danach steigen die stromabhängigen Verluste wieder stark.'};}

function mcDrehfeld(){return{
  frage:`Wovon hängt die synchrone Drehzahl (Drehfelddrehzahl) ab?`,
  optionen:shuffle([
    {t:'Nur von der Netzfrequenz f und der Polpaarzahl p.',ok:true},
    {t:'Von der Belastung der Maschine.',ok:false},
    {t:'Vom Läuferwiderstand.',ok:false},
    {t:'Von der Höhe des Schlupfes.',ok:false}]),
  loesung:'n_s = f·60/p. Sie ist eine reine Auslegungs-/Netzgröße und ändert sich im Betrieb nicht mit der Last.'};}

/* Liste aller Generatoren */
const GENERATOREN = [
  gSync, gSlip, gDrehzahl, gEta, gPzu, gPab, gF2, gNK, gMverh, gMnenn,
  mcAsynchron, mcStabil, mcKippR2, mcSternDreieck, mcKaefig, mcPCu2,
  mcUeberKipp, mcLeerlaufstrom, mcDrehrichtung, mcSchlupfDef, mcMaxEta, mcDrehfeld
];

/* ===================================================================
   ANTESTAT-ENGINE
   =================================================================== */
const State = {
  name:'', klasse:'', datum:'', setId:'', startZeit:null,
  fragen:[], aktuell:0, antworten:[], gesperrt:false
};

function genSetId(){
  const z='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s=''; for(let i=0;i<6;i++) s+=z[Math.floor(Math.random()*z.length)];
  return s;
}

/* ===================================================================
   FREISCHALTUNG  Antestat -> Versuch  (per localStorage)
   - Bestehen ab 60 %.   - Je Fehlversuch -10 Pruefstand-Punkte.
   - Nach 3 Fehlversuchen gilt der Versuch als NICHT bestanden.
   =================================================================== */
const DASM_KEY='dasm_antestat_v1';
const DASM_BESTEHEN=60;     // Prozent zum Bestehen
const DASM_MAX_FEHL=3;      // Fehlversuche bis "nicht bestanden"
function dasmLoad(){ try{ return JSON.parse(localStorage.getItem(DASM_KEY))||{}; }catch(e){ return {}; } }
function dasmSave(o){ try{ localStorage.setItem(DASM_KEY,JSON.stringify(o)); }catch(e){} }

/* Verbucht einen abgeschlossenen Antestat-Durchgang und gibt den Status zurueck. */
function antestatVerbuchen(proz){
  const st=dasmLoad();
  st.versuche=(st.versuche||0)+1;
  st.fehlversuche=st.fehlversuche||0;
  st.letzteProzent=proz;
  st.name=State.name; st.klasse=State.klasse; st.setId=State.setId;
  st.pruefcode=State.pruefcode; st.datum=State.datum; st.ts=Date.now();
  if(proz>=DASM_BESTEHEN){
    st.bestanden=true; st.gesperrt=false;
  } else if(!st.bestanden){
    st.fehlversuche++;
    st.abzug=Math.min(100,10*st.fehlversuche);
    if(st.fehlversuche>=DASM_MAX_FEHL) st.gesperrt=true;
  }
  dasmSave(st);
  return st;
}

/* Urteil + passende Buttons nach der Auswertung. */
function antestatVerdictRendern(st,proz){
  const box=document.getElementById('freischaltBox'); if(!box) return;
  const btnLab=document.getElementById('btnZumLabor');
  let cls,txt;
  if(proz>=DASM_BESTEHEN){
    cls='gut';
    txt='<span class="ic">✓</span><div><strong>Antestat bestanden ('+proz+' %).</strong> '
      +'Du bist für den Versuch freigeschaltet.'
      +(st.abzug?' Hinweis: aus '+st.fehlversuche+' Fehlversuch(en) startet der Prüfstand mit <strong>'+(100-st.abzug)+' Punkten</strong>.':'')
      +'</div>';
    if(btnLab) btnLab.classList.remove('versteckt');
  } else if(st.gesperrt){
    cls='warn';
    txt='<span class="ic">✗</span><div><strong>Dreimal nicht bestanden.</strong> '
      +'Der Versuch gilt als <strong>nicht bestanden</strong>. Wende dich an die Lehrkraft.</div>';
    if(btnLab) btnLab.classList.add('versteckt');
  } else {
    cls='warn';
    const rest=DASM_MAX_FEHL-st.fehlversuche;
    txt='<span class="ic">✗</span><div><strong>Nicht bestanden ('+proz+' %).</strong> '
      +'Mindestens 60 % nötig. Fehlversuch '+st.fehlversuche+' von '+DASM_MAX_FEHL
      +' — <strong>−10 Punkte</strong> für den Prüfstand. Noch '+rest+' Versuch(e). '
      +'<button class="btn sekundaer" style="margin-left:.4rem" onclick="location.reload()">Antestat wiederholen</button></div>';
    if(btnLab) btnLab.classList.add('versteckt');
  }
  box.className='box '+cls; box.style.marginTop='1rem'; box.innerHTML=txt;
  box.classList.remove('versteckt');
}

/* Status auf dem Startbildschirm (vor dem Test). */
function antestatStatusAnzeigen(){
  const el=document.getElementById('antestatStatus'); if(!el) return;
  const st=dasmLoad();
  if(!st.versuche){ el.classList.add('versteckt'); return; }
  let cls,txt;
  if(st.bestanden){
    cls='gut'; txt='<span class="ic">✓</span><div>Du hast den Antestat bereits bestanden — '
      +'du kannst direkt <a href="labor.html">zum Versuch</a>.</div>';
  } else if(st.gesperrt){
    cls='warn'; txt='<span class="ic">🔒</span><div>Dreimal nicht bestanden — der Versuch ist gesperrt. '
      +'Wende dich an die Lehrkraft.</div>';
  } else {
    cls='warn'; const rest=DASM_MAX_FEHL-st.fehlversuche;
    txt='<span class="ic">⚠️</span><div>Bisher '+st.fehlversuche+' Fehlversuch(e) — noch '+rest+' Versuch(e). '
      +'Pro Fehlversuch werden 10 Prüfstand-Punkte abgezogen.</div>';
  }
  el.className='box '+cls; el.style.marginTop='1rem'; el.innerHTML=txt; el.classList.remove('versteckt');
}
window.addEventListener('DOMContentLoaded', antestatStatusAnzeigen);

function quizBauen(){
  const gen=shuffle(GENERATOREN).slice(0,ANZAHL_FRAGEN);
  State.fragen = gen.map(g=>g());
  State.antworten = State.fragen.map(()=>({gewaehlt:null, ok:null}));
  State.aktuell = 0;
}

/* ---- Start ---- */
function antestatStarten(){
  const name=document.getElementById('inName').value.trim();
  const klasse=document.getElementById('inKlasse').value.trim();
  if(!name||!klasse){
    document.getElementById('startFehler').classList.remove('versteckt');
    return;
  }
  State.name=name; State.klasse=klasse;
  State.datum=new Date().toLocaleDateString('de-DE');
  State.setId=genSetId();
  State.startZeit=new Date();
  quizBauen();
  document.getElementById('startBox').classList.add('versteckt');
  document.getElementById('quizBox').classList.remove('versteckt');
  document.getElementById('kopfSet').textContent='Satz '+State.setId;
  document.getElementById('kopfSet').classList.remove('versteckt');
  frageZeichnen();
}

/* ---- Frage rendern ---- */
function frageZeichnen(){
  const i=State.aktuell, f=State.fragen[i], a=State.antworten[i];
  const total=State.fragen.length;

  document.getElementById('fortschrittText').textContent=`Frage ${i+1} von ${total}`;
  document.getElementById('fortschrittBalken').style.width=((i)/total*100)+'%';

  const wrap=document.getElementById('frageWrap');
  const gesperrt = a.gewaehlt!==null;

  let html=`<div class="frage-nr">Frage ${String(i+1).padStart(2,'0')} / ${total}
            ${gesperrt?'<span class="badge gruen" style="margin-left:.6rem">✓ gesperrt</span>':''}</div>
            <div class="frage-text">${f.frage}</div>
            <div class="optionen">`;
  f.optionen.forEach((opt,k)=>{
    const sel = a.gewaehlt===k;
    const dis = gesperrt ? 'disabled' : '';
    const cls = sel ? 'opt sel' : 'opt';
    html+=`<label class="${cls} ${gesperrt?'locked':''}">
             <input type="radio" name="opt" value="${k}" ${sel?'checked':''} ${dis}
               onchange="optionGewaehlt(${k})">
             <span class="opt-mark">${String.fromCharCode(65+k)}</span>
             <span class="opt-txt">${opt.t}</span>
           </label>`;
  });
  html+=`</div>`;
  wrap.innerHTML=html;

  // Buttons
  const btnConfirm=document.getElementById('btnBestaetigen');
  const btnNext=document.getElementById('btnWeiter');
  if(gesperrt){
    btnConfirm.classList.add('versteckt');
    btnNext.classList.remove('versteckt');
    btnNext.textContent = (i===total-1) ? 'Auswertung anzeigen →' : 'Nächste Frage →';
  }else{
    btnConfirm.classList.remove('versteckt');
    btnConfirm.disabled = (State._tempWahl===undefined || State._tempWahl===null);
    btnNext.classList.add('versteckt');
  }
}

let _tempWahl=null;
function optionGewaehlt(k){
  State._tempWahl=k;
  document.getElementById('btnBestaetigen').disabled=false;
  // visuelle Auswahl
  document.querySelectorAll('#frageWrap .opt').forEach((el,idx)=>{
    el.classList.toggle('sel', idx===k);
  });
}

/* ---- Antwort bestaetigen (sperren) ---- */
function antwortBestaetigen(){
  const i=State.aktuell;
  if(State._tempWahl===null||State._tempWahl===undefined) return;
  const k=State._tempWahl;
  State.antworten[i].gewaehlt=k;
  State.antworten[i].ok=State.fragen[i].optionen[k].ok;
  State._tempWahl=null;
  frageZeichnen(); // jetzt gesperrt
}

/* ---- Weiter ---- */
function weiter(){
  if(State.aktuell < State.fragen.length-1){
    State.aktuell++;
    State._tempWahl=null;
    frageZeichnen();
    window.scrollTo({top:0,behavior:'smooth'});
  }else{
    auswertungZeigen();
  }
}

/* ---- Auswertung ---- */
function punkteZaehlen(){
  let richtig=0;
  State.antworten.forEach(a=>{ if(a.ok) richtig++; });
  return richtig;
}

async function auswertungZeigen(){
  document.getElementById('quizBox').classList.add('versteckt');
  const box=document.getElementById('ergebnisBox');
  box.classList.remove('versteckt');
  const richtig=punkteZaehlen();
  const total=State.fragen.length;
  const proz=Math.round(richtig/total*100);
  const note = proz>=90?'sehr gut':proz>=75?'gut':proz>=60?'befriedigend':proz>=50?'ausreichend':'nicht bestanden';

  State.dauer=Math.round((new Date()-State.startZeit)/1000);
  State.pruefcode = await pruefcodeBerechnen();

  document.getElementById('ergPunkte').textContent=`${richtig} / ${total}`;
  document.getElementById('ergProzent').textContent=`${proz} %`;
  document.getElementById('ergNote').textContent=note;
  document.getElementById('ergRing').style.setProperty('--p', proz);
  document.getElementById('ergRing').style.setProperty('--col',
     proz>=60?'var(--messwert)':proz>=50?'var(--readout-am)':'var(--warnung)');

  // Detailliste
  let html='';
  State.fragen.forEach((f,i)=>{
    const a=State.antworten[i];
    const gew = a.gewaehlt!==null ? f.optionen[a.gewaehlt].t : '—';
    const korrekt = f.optionen.find(o=>o.ok).t;
    html+=`<div class="erg-item ${a.ok?'ok':'falsch'}">
      <div class="erg-head"><span class="erg-ic">${a.ok?'✓':'✗'}</span>
        <span>Frage ${i+1}</span></div>
      <div class="erg-q">${f.frage}</div>
      <div class="erg-row"><b>Deine Antwort:</b> ${gew}</div>
      ${a.ok?'':`<div class="erg-row korrekt"><b>Richtig wäre:</b> ${korrekt}</div>`}
      <div class="erg-loes">${f.loesung}</div>
    </div>`;
  });
  document.getElementById('ergDetail').innerHTML=html;
  document.getElementById('ergMeta').innerHTML=
    `Name: <b>${State.name}</b> · Klasse: <b>${State.klasse}</b> · `+
    `Datum: <b>${State.datum}</b> · Aufgabensatz: <b>${State.setId}</b> · `+
    `Prüfcode: <b class="mono">${State.pruefcode}</b>`;
  const _frei=antestatVerbuchen(proz);
  antestatVerdictRendern(_frei, proz);
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ---- Pruefcode (SHA-256 ueber kanonische Antwortzeichenfolge) ---- */
async function pruefcodeBerechnen(){
  const muster=State.antworten.map((a,i)=>{
    const k=a.gewaehlt; return `${i}:${k===null?'-':String.fromCharCode(65+k)}:${a.ok?1:0}`;
  }).join('|');
  const roh=`${State.name}#${State.klasse}#${State.setId}#${punkteZaehlen()}/${State.fragen.length}#${muster}`;
  try{
    const buf=await crypto.subtle.digest('SHA-256', new TextEncoder().encode(roh));
    const hex=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
    return hex.slice(0,16).toUpperCase().replace(/(.{4})/g,'$1 ').trim();
  }catch(e){
    // Fallback falls crypto.subtle nicht verfuegbar (z.B. file:// in altem Browser)
    let h=0; for(let i=0;i<roh.length;i++){h=(h*31+roh.charCodeAt(i))>>>0;}
    return ('00000000'+h.toString(16)).slice(-8).toUpperCase();
  }
}

/* ===================================================================
   PDF-EXPORT  (jsPDF)
   =================================================================== */
function pdfErstellen(){
  const { jsPDF } = window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  const W=210, M=16; let y=0;
  const richtig=punkteZaehlen(), total=State.fragen.length, proz=Math.round(richtig/total*100);
  const note = proz>=90?'sehr gut':proz>=75?'gut':proz>=60?'befriedigend':proz>=50?'ausreichend':'nicht bestanden';

  // Kopf
  doc.setFillColor(16,22,29); doc.rect(0,0,W,30,'F');
  doc.setFillColor(54,211,255); doc.circle(M+6,15,5,'S');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(15);
  doc.text('KI Labor DASM', M+16, 13);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(150,167,178);
  doc.text('Antestat - Drehstrom-Asynchronmaschine', M+16, 19);
  doc.setFontSize(8);
  doc.text('Lycee technique d\'Ettelbruck', W-M, 13, {align:'right'});
  doc.text('PROTOKOLL', W-M, 19, {align:'right'});
  y=40;

  // Schuelerdaten-Box
  doc.setDrawColor(212,218,224); doc.setFillColor(244,246,248);
  doc.roundedRect(M, y, W-2*M, 30, 2,2,'FD');
  doc.setTextColor(20,25,30); doc.setFont('helvetica','bold'); doc.setFontSize(10);
  const colX=[M+5, M+62, M+120];
  doc.text('Name:', colX[0], y+8); doc.text('Klasse:', colX[1], y+8); doc.text('Datum:', colX[2], y+8);
  doc.setFont('helvetica','normal');
  doc.text(State.name||'-', colX[0], y+14);
  doc.text(State.klasse||'-', colX[1], y+14);
  doc.text(State.datum||'-', colX[2], y+14);
  doc.setFont('helvetica','bold');
  doc.text('Aufgabensatz:', colX[0], y+23); doc.text('Bearbeitungszeit:', colX[1], y+23);
  doc.setFont('helvetica','normal');
  doc.text(State.setId, colX[0]+26, y+23);
  doc.text(fmtDauer(State.dauer), colX[1]+33, y+23);
  y+=37;

  // Ergebnisbalken
  const farbe = proz>=60?[31,157,85]:proz>=50?[255,176,32]:[224,86,27];
  doc.setFillColor(...farbe); doc.roundedRect(M, y, W-2*M, 16, 2,2,'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(12);
  doc.text(`Ergebnis: ${richtig} / ${total} richtig  (${proz} %)  -  ${note}`, M+5, y+10.5);
  y+=24;

  // Detailtabelle
  doc.setTextColor(20,25,30); doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text('Beantwortete Fragen', M, y); y+=2;
  doc.setDrawColor(212,218,224); doc.line(M,y+1,W-M,y+1); y+=6;

  doc.setFontSize(8.3);
  State.fragen.forEach((f,i)=>{
    const a=State.antworten[i];
    const frageTxt = stripHtml(f.frage);
    const gew = a.gewaehlt!==null ? stripHtml(f.optionen[a.gewaehlt].t) : '-';
    const korrekt = stripHtml(f.optionen.find(o=>o.ok).t);
    const loes = stripHtml(f.loesung);

    const qLines = doc.splitTextToSize(`${i+1}.  ${frageTxt}`, W-2*M-6);
    const aLine  = doc.splitTextToSize(`Antwort: ${gew}`, W-2*M-12);
    const kLine  = a.ok ? [] : doc.splitTextToSize(`Richtig: ${korrekt}`, W-2*M-12);
    const lLine  = doc.splitTextToSize(`Loesung: ${loes}`, W-2*M-12);
    const blockH = qLines.length*4 + aLine.length*4 + kLine.length*4 + lLine.length*3.6 + 7;

    if(y+blockH > 280){ doc.addPage(); y=20; }

    // Statusmarke
    doc.setFillColor(...(a.ok?[31,157,85]:[224,86,27]));
    doc.circle(M+1.5, y-1, 1.5, 'F');
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(6);
    doc.text(a.ok?'OK':'X', M+1.5, y-0.2, {align:'center'});

    doc.setTextColor(20,25,30); doc.setFont('helvetica','bold'); doc.setFontSize(8.3);
    doc.text(qLines, M+6, y); y+=qLines.length*4+1;
    doc.setFont('helvetica','normal'); doc.setTextColor(60,70,81);
    doc.text(aLine, M+8, y); y+=aLine.length*4;
    if(kLine.length){ doc.setTextColor(31,157,85); doc.text(kLine, M+8, y); y+=kLine.length*4; }
    doc.setTextColor(110,120,130); doc.setFontSize(7.6);
    doc.text(lLine, M+8, y); y+=lLine.length*3.6+5;
    doc.setFontSize(8.3);
  });

  // Pruefcode-Box + Abgabehinweis am Ende
  if(y>250){ doc.addPage(); y=20; }
  y+=2;
  doc.setDrawColor(180,190,200); doc.setFillColor(238,241,244);
  doc.roundedRect(M, y, W-2*M, 24, 2,2,'FD');
  doc.setTextColor(20,25,30); doc.setFont('helvetica','bold'); doc.setFontSize(9);
  doc.text('Pruefcode (Manipulationsschutz):', M+5, y+8);
  doc.setFont('courier','bold'); doc.setFontSize(12); doc.setTextColor(20,82,240);
  doc.text(State.pruefcode, M+5, y+15);
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(91,107,122);
  doc.text('Dieser Code wird aus deinen Antworten berechnet. Nachtraegliche Aenderungen am PDF', M+5, y+21);
  doc.text('machen den Code ungueltig. Bitte dieses PDF unveraendert an die Lehrkraft senden.', M+5, y+23.5);

  // Fusszeile auf jeder Seite
  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){
    doc.setPage(p);
    doc.setDrawColor(212,218,224); doc.line(M,289,W-M,289);
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(140,150,160);
    doc.text('KI Labor DASM - Antestat', M, 293);
    doc.text(`Satz ${State.setId} - ${State.pruefcode}`, W/2, 293, {align:'center'});
    doc.text(`Seite ${p}/${pages}`, W-M, 293, {align:'right'});
  }

  const dn = `Antestat_DASM_${sanitize(State.name)}_${State.setId}.pdf`;
  doc.save(dn);
  document.getElementById('pdfHinweis').classList.remove('versteckt');
}

/* ---- kleine Helfer ---- */
function stripHtml(s){
  const d=document.createElement('div'); d.innerHTML=s;
  return (d.textContent||d.innerText||'').replace(/\s+/g,' ').trim();
}
function sanitize(s){return (s||'Schueler').replace(/[^a-zA-Z0-9]/g,'_').slice(0,24);}
function fmtDauer(sek){ if(!sek&&sek!==0) return '-'; const m=Math.floor(sek/60), s=sek%60;
  return m>0?`${m} min ${s} s`:`${s} s`; }
