/* =====================================================================
   KI Labor DASM — Virtuelles Drehstrom-Asynchronlabor
   - Echtzeit-Physiksimulation (Gamma-Ersatzschaltbild, identisch zu den Bildern)
   - Belastung ueber virtuelle Bremse, Maschine sucht ihren Arbeitspunkt
   - Messpunkte aufnehmen -> Kennlinie M(n) live zeichnen
   - Fehlbedienung -> Punktabzug, Ereignisprotokoll
   - Auswertung (M_K, s_K, eta) + PDF-Export mit Pruefcode
   ===================================================================== */
'use strict';

/* ---------- Maschinenparameter (identisch zum Python-Modell) ---------- */
const P = {
  U:230, U_LL:400, f:50, p:2,
  R1:5.0, R2:4.5, X:15.0, Xh:150.0, RFe:3527.0, MR:0.25
};
const NS = 60*P.f/P.p;                 // 1500 1/min
const OMS = 2*Math.PI*NS/60;           // 157.08 rad/s
const SK = P.R2/Math.sqrt(P.R1*P.R1 + P.X*P.X);                 // ~0.285
const MK = 3*P.U*P.U/(2*OMS*(P.R1+Math.sqrt(P.R1*P.R1+P.X*P.X)));// ~24.27 Nm
const fmt=(x,d=0)=>Number(x).toLocaleString('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d});

/* ---------- Betriebspunkt fuer gegebenen Schlupf ---------- */
function betrieb(s){
  s=Math.max(s,1e-4);
  const ZrRe=P.R1+P.R2/s, ZrIm=P.X;
  const den=ZrRe*ZrRe+ZrIm*ZrIm;
  const I2re= P.U*ZrRe/den, I2im=-P.U*ZrIm/den;
  const I1re= I2re + P.U/P.RFe;
  const I1im= I2im - P.U/P.Xh;
  const I1=Math.hypot(I1re,I1im);
  const I2=Math.hypot(I2re,I2im);
  const cosphi=I1re/I1;
  const Pzu=3*P.U*I1re;
  const Pd=3*I2*I2*(P.R2/s);
  const M=Pd/OMS;                       // entwickeltes (Luftspalt-)Moment
  const Pcu1=3*I2*I2*P.R1;
  const Pcu2=s*Pd;
  const Pfe=3*P.U*P.U/P.RFe;
  const om=(1-s)*OMS;
  const Preib=P.MR*om;
  const Pab=(1-s)*Pd - Preib;           // Wellenleistung
  const Mw = om>1e-3 ? Pab/om : 0;      // Wellenmoment (Bremse misst dies)
  const eta = Pzu>1 ? Math.max(Pab/Pzu,0) : 0;
  return {s, n:NS*(1-s), I1, I2, cosphi, Pzu, Pd, M, Mw,
          Pcu1, Pcu2, Pfe, Preib, Pab, eta};
}
function Mdev(s){ s=Math.max(s,1e-4);
  const ZrRe=P.R1+P.R2/s, den=ZrRe*ZrRe+P.X*P.X;
  const I2sq=P.U*P.U/den; return 3*I2sq*(P.R2/s)/OMS; }

/* stabilen Schlupf fuer gefordertes (entwickeltes) Moment finden */
function stabilerSchlupf(Mziel){
  if(Mziel<=0) return 1e-4;
  if(Mziel>=MK) return SK;
  let lo=1e-4, hi=SK;
  for(let i=0;i<60;i++){ const mid=(lo+hi)/2; (Mdev(mid)<Mziel)?lo=mid:hi=mid; }
  return (lo+hi)/2;
}

/* ===================================================================
   ZUSTAND
   =================================================================== */
const L = {
  name:'', klasse:'', datum:'',
  laeuft:false, kipped:false, getrippt:false,
  bremse:0,                 // Sollmoment der Bremse [Nm] (Wellenmoment-Vorgabe)
  n:0,                      // animierte Drehzahl
  s:1,                      // aktueller Schlupf
  punkte:100,               // Pruefstand-Punkte
  messungen:[],             // aufgenommene Messpunkte
  ereignisse:[],            // Protokoll
  kipZaehler:0,
  stallZeit:0,              // s, wie lange gekippt
  startZeit:null,
  letzteLast0Warn:0,
  chart:null
};

/* ===================================================================
   START / ANMELDUNG
   =================================================================== */
/* ===================================================================
   ZUGANG  --  Versuch nur nach bestandenem Antestat (oder Lehrer-Passwort)
   =================================================================== */
const DASM_KEY='dasm_antestat_v1';
const DASM_PASSWORT='DASMBLETO';
let DASM_ZUGANG={erlaubt:false, abzug:0, lehrer:false};
function dasmLoad(){ try{ return JSON.parse(localStorage.getItem(DASM_KEY))||{}; }catch(e){ return {}; } }
function gateFreigeben(hinweis){
  document.getElementById('labGate')?.classList.add('versteckt');
  document.getElementById('labStartBox')?.classList.remove('versteckt');
  const b=document.getElementById('labFreiHinweis');
  if(b){ b.classList.remove('versteckt'); const d=b.querySelector('div'); if(d) d.innerHTML=hinweis; }
}
function gateInit(){
  const st=dasmLoad();
  if(st.bestanden){
    DASM_ZUGANG={erlaubt:true, abzug:st.abzug||0, lehrer:false};
    gateFreigeben('Antestat bestanden ('+(st.letzteProzent||'≥60')+' %). '
      +(st.abzug?'Start mit '+(100-st.abzug)+' Punkten ('+st.fehlversuche+' Fehlversuch(e)).':'Start mit 100 Punkten.'));
    return;
  }
  const gate=document.getElementById('labGate'), start=document.getElementById('labStartBox');
  if(!gate) return;            // Seite ohne Sperre -> nichts tun
  start?.classList.add('versteckt');
  gate.classList.remove('versteckt');
  const msg=document.getElementById('gateMsg');
  if(msg){
    if(st.gesperrt){
      msg.innerHTML='<strong>Versuch nicht bestanden.</strong> Der Antestat wurde dreimal nicht bestanden ('
        +(st.fehlversuche||3)+' Fehlversuche). Wende dich an die Lehrkraft.';
    } else if(st.versuche){
      msg.innerHTML='<strong>Antestat noch nicht bestanden.</strong> Du brauchst mindestens 60 %. Bisher '
        +(st.fehlversuche||0)+' Fehlversuch(e). Zurück zum <a href="antestat.html">Antestat</a>.';
    } else {
      msg.innerHTML='<strong>Zugang gesperrt.</strong> Bestehe zuerst den <a href="antestat.html">Antestat</a> '
        +'(mindestens 60 %), um den Versuch zu starten.';
    }
  }
}
function lehrerEntsperren(){
  const v=(document.getElementById('gatePass')?.value||'').trim();
  if(v===DASM_PASSWORT){
    DASM_ZUGANG={erlaubt:true, abzug:0, lehrer:true};
    gateFreigeben('🔓 Lehrer-Zugang aktiv (Passwort). Antestat übersprungen, voller Punktestand.');
  } else {
    document.getElementById('gatePassFehler')?.classList.remove('versteckt');
  }
}

function laborStarten(){
  if(!DASM_ZUGANG.erlaubt){ gateInit(); return; }
  const name=document.getElementById('labName').value.trim();
  const klasse=document.getElementById('labKlasse').value.trim();
  if(!name||!klasse){ document.getElementById('labStartFehler').classList.remove('versteckt'); return; }
  L.name=name; L.klasse=klasse; L.datum=new Date().toLocaleDateString('de-DE');
  L.startZeit=new Date();
  L.punkte=Math.max(0,100-(DASM_ZUGANG.abzug||0));
  document.getElementById('labStartBox').classList.add('versteckt');
  document.getElementById('laborBox').classList.remove('versteckt');
  chartInit();
  ereignis('Prüfstand betreten von '+name+' ('+klasse+')','info');
  if(DASM_ZUGANG.lehrer){ ereignis('Lehrer-Zugang: Antestat übersprungen.','info'); }
  else if(DASM_ZUGANG.abzug>0){ ereignis('Startpunkte 100 − '+DASM_ZUGANG.abzug+' (Antestat-Fehlversuche) = '+L.punkte+'.','warn'); }
  punkteAnzeigen?.();
  loop(performance.now());
}

/* ===================================================================
   STEUERUNG
   =================================================================== */
function maschineEin(){
  if(L.getrippt){ ereignis('Erst Motorschutz zurücksetzen (Reset).','warn'); return; }
  if(L.laeuft) return;
  // Anlauf unter zu hoher Last?
  const MneedStart = L.bremse + P.MR;
  if(MneedStart > MK*0.96){
    abzug(10,'Anlauf unter zu hoher Last versucht – Maschine kommt nicht hoch. Bremse vor dem Start lösen!');
    // kurzer Stall-Zucker
    L.laeuft=true; L.kipped=true; L.stallZeit=0;
    statusSetzen();
    return;
  }
  L.laeuft=true; L.kipped=false; L.stallZeit=0;
  ereignis('Netzschalter EIN – Maschine läuft hoch.','ok');
  statusSetzen();
}
function maschineAus(){
  if(!L.laeuft && !L.kipped) return;
  L.laeuft=false; L.kipped=false; L.stallZeit=0;
  ereignis('Netzschalter AUS – Maschine läuft aus.','info');
  statusSetzen();
}
function bremseGesetzt(v){
  L.bremse=Number(v);
  document.getElementById('bremseVal').textContent=fmt(L.bremse,1)+' Nm';
  const sl=document.getElementById('bremseSlider');
  sl.style.setProperty('--p',(L.bremse/27*100)+'%');
  // Last ohne Hochlauf?
  if(!L.laeuft && !L.kipped && L.bremse>2){
    const t=performance.now();
    if(t-L.letzteLast0Warn>1500){
      L.letzteLast0Warn=t;
      abzug(10,'Bremse belastet, obwohl die Maschine nicht läuft. Reihenfolge: erst einschalten, hochlaufen lassen, dann belasten.');
    }
  }
}
function motorschutzReset(){
  if(!L.getrippt) return;
  L.getrippt=false; L.kipped=false; L.laeuft=false; L.n=0; L.s=1;
  ereignis('Motorschutz zurückgesetzt. Maschine ist spannungsfrei.','info');
  statusSetzen();
}

/* ===================================================================
   DYNAMIK (pro Frame)
   =================================================================== */
let _last=performance.now();
function loop(now){
  const dt=Math.min((now-_last)/1000,0.05); _last=now;

  let zielN;
  if(L.getrippt){
    zielN=0;
  } else if(L.laeuft && !L.kipped){
    const Mneed=L.bremse+P.MR;
    if(Mneed>=MK*0.999){
      // kippen
      kippAusloesen();
      zielN=0;
    } else {
      const sEq=stabilerSchlupf(Mneed);
      zielN=NS*(1-sEq);
    }
  } else if(L.kipped){
    // gekippt: nur Erholung wenn Last deutlich unter Anlaufmoment
    if(L.bremse < Mdev(1)*0.85 - P.MR){
      L.kipped=false; ereignis('Maschine erholt sich – läuft wieder hoch.','ok'); statusSetzen();
      zielN=L.n;
    } else {
      zielN=0;
      L.stallZeit+=dt;
      if(L.stallZeit>4 && !L.getrippt){
        L.getrippt=true; L.kipped=false; L.laeuft=false;
        abzug(15,'Maschine zu lange im Kippzustand (Überstrom) – Motorschutz hat ausgelöst!');
        statusSetzen();
      }
    }
  } else {
    zielN=0; // ausgelaufen
  }

  // Drehzahl weich nachfuehren
  const k = (zielN>L.n) ? 2.6 : 4.5;          // Hochlauf etwas langsamer als Auslauf
  L.n += (zielN-L.n)*Math.min(k*dt,1);
  if(Math.abs(zielN-L.n)<0.5) L.n=zielN;
  L.s = Math.min(Math.max((NS-L.n)/NS,1e-4),1);

  instrumenteAktualisieren();
  maschineZeichnen(dt);
  requestAnimationFrame(loop);
}

function kippAusloesen(){
  if(L.kipped) return;
  L.kipped=true; L.kipZaehler++; L.stallZeit=0;
  if(L.kipZaehler===1){
    ereignis('⚠ KIPPPUNKT erreicht – Maschine gekippt! Das höchste Moment ist das Kippmoment. '+
             'Jetzt Bremse lösen, damit die Maschine wieder hochläuft.','warn');
  } else {
    abzug(8,'Erneutes Kippen der Maschine. Nähere dich dem Kipppunkt vorsichtiger.');
  }
  statusSetzen();
}

/* ===================================================================
   INSTRUMENTE
   =================================================================== */
function steadyState(){
  if(!L.laeuft||L.kipped||L.getrippt) return false;
  const Mneed=L.bremse+P.MR;
  if(Mneed>=MK) return false;
  const zielN=NS*(1-stabilerSchlupf(Mneed));
  return Math.abs(zielN-L.n)<1.5;
}
function instrumenteAktualisieren(){
  let b;
  if(L.kipped || L.getrippt){
    // Stillstand unter Spannung: hoher Strom, Anlaufmoment
    b=betrieb(1);
    setRead('iv_n',0,0); setRead('iv_M',b.Mw>0?b.Mw:Mdev(1),1);
    setRead('iv_I',b.I1,1,true); setRead('iv_U',L.getrippt?0:P.U_LL,0);
    setRead('iv_cos',b.cosphi,2); setRead('iv_s',100,1);
    setRead('iv_Pzu',L.getrippt?0:b.Pzu,0); setRead('iv_Pab',0,0); setRead('iv_eta',0,1);
    return;
  }
  if(!L.laeuft && L.n<1){
    ['iv_n','iv_M','iv_I','iv_U','iv_cos','iv_s','iv_Pzu','iv_Pab','iv_eta']
      .forEach(id=>setRead(id,0,0));
    return;
  }
  b=betrieb(L.s);
  setRead('iv_n',L.n,0);
  setRead('iv_M',Math.max(b.Mw,0),1);
  setRead('iv_I',b.I1,1,b.I1>1.4*3.21);
  setRead('iv_U',P.U_LL,0);
  setRead('iv_cos',b.cosphi,2);
  setRead('iv_s',L.s*100,1);
  setRead('iv_Pzu',b.Pzu,0);
  setRead('iv_Pab',Math.max(b.Pab,0),0);
  setRead('iv_eta',b.eta*100,1);
  // Live-Arbeitspunkt im Chart
  if(L.chart && steadyState()){
    L.chart.data.datasets[2].data=[{x:L.n, y:Math.max(b.Mw,0)}];
  } else if(L.chart){
    L.chart.data.datasets[2].data=[{x:L.n, y:Math.max(b.Mw,0)}];
  }
  if(L.chart) L.chart.update('none');
}
function setRead(id,val,dec,warn){
  const el=document.getElementById(id); if(!el) return;
  el.textContent=fmt(val,dec);
  el.classList.toggle('warn-read', !!warn);
}

/* ===================================================================
   STATUS-ANZEIGE
   =================================================================== */
function statusSetzen(){
  const el=document.getElementById('statusLampe');
  const wrap=document.getElementById('statusWrap');
  let txt,cls;
  if(L.getrippt){txt='MOTORSCHUTZ AUSGELÖST';cls='st-trip';}
  else if(L.kipped){txt='GEKIPPT – LAST LÖSEN';cls='st-kipp';}
  else if(L.laeuft){txt='BETRIEB';cls='st-run';}
  else {txt='AUSGESCHALTET';cls='st-off';}
  el.textContent=txt;
  wrap.className='status-wrap '+cls;
  // Buttons
  document.getElementById('btnEin').disabled=L.laeuft||L.kipped||L.getrippt;
  document.getElementById('btnAus').disabled=!(L.laeuft||L.kipped);
  document.getElementById('btnReset').disabled=!L.getrippt;
}

/* ===================================================================
   MESSPUNKT AUFNEHMEN
   =================================================================== */
function messpunktAufnehmen(){
  if(!L.laeuft || L.kipped || L.getrippt){
    ereignis('Messpunkt nur im stabilen Betrieb möglich.','warn'); return;
  }
  if(!steadyState()){
    ereignis('Bitte warten, bis sich die Drehzahl eingependelt hat, dann messen.','warn'); return;
  }
  const b=betrieb(L.s);
  // Doppelte Drehzahl vermeiden
  if(L.messungen.some(m=>Math.abs(m.n-L.n)<6)){
    ereignis('Bei dieser Drehzahl gibt es schon einen Messpunkt – Last ändern.','warn'); return;
  }
  const m={
    nr:L.messungen.length+1,
    U:P.U_LL, I:b.I1, n:L.n, s:L.s*100,
    M:Math.max(b.Mw,0), cos:b.cosphi,
    Pzu:b.Pzu, Pab:Math.max(b.Pab,0), eta:b.eta*100
  };
  L.messungen.push(m);
  tabelleAktualisieren();
  chartPunktHinzufuegen(m);
  ereignis(`Messpunkt ${m.nr} aufgenommen: n=${fmt(m.n)} 1/min, M=${fmt(m.M,1)} Nm, I=${fmt(m.I,1)} A.`,'ok');
}

function messpunktLoeschen(idx){
  L.messungen.splice(idx,1);
  L.messungen.forEach((m,i)=>m.nr=i+1);
  tabelleAktualisieren(); chartNeuAufbauen();
}

function tabelleAktualisieren(){
  const tb=document.getElementById('messTabelle');
  if(!L.messungen.length){
    tb.innerHTML='<tr><td colspan="9" class="txt" style="text-align:center;color:var(--stahl)">Noch keine Messpunkte – Maschine belasten und „Messpunkt aufnehmen".</td></tr>';
  }else{
    tb.innerHTML=L.messungen.map((m,i)=>`<tr>
      <td>${m.nr}</td><td>${fmt(m.U)}</td><td>${fmt(m.I,2)}</td>
      <td>${fmt(m.n)}</td><td>${fmt(m.s,1)}</td><td>${fmt(m.M,1)}</td>
      <td>${fmt(m.Pzu)}</td><td>${fmt(m.Pab)}</td>
      <td>${fmt(m.eta,1)} <button class="del" title="löschen" onclick="messpunktLoeschen(${i})">✕</button></td>
    </tr>`).join('');
  }
  document.getElementById('messAnzahl').textContent=L.messungen.length;
  const hoechst=L.messungen.reduce((a,m)=>Math.max(a,m.M),0);
  document.getElementById('hoechstMoment').textContent=fmt(hoechst,1)+' Nm';
}

/* ===================================================================
   BEWERTUNG / EREIGNISSE
   =================================================================== */
function abzug(pkt,grund){
  L.punkte=Math.max(0,L.punkte-pkt);
  ereignis(`−${pkt} Punkte: ${grund}`,'minus');
  punkteAnzeigen();
}
function punkteAnzeigen(){
  const el=document.getElementById('punkteVal');
  el.textContent=L.punkte;
  el.style.color = L.punkte>=80?'var(--readout-gn)':L.punkte>=50?'var(--readout-am)':'var(--warnung)';
}
function ereignis(txt,typ='info'){
  L.ereignisse.push({t:new Date(),txt,typ});
  const log=document.getElementById('ereignisLog');
  const zeit=new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const ic={info:'•',ok:'✓',warn:'⚠',minus:'−'}[typ]||'•';
  const div=document.createElement('div');
  div.className='ev ev-'+typ;
  div.innerHTML=`<span class="ev-t">${zeit}</span><span class="ev-ic">${ic}</span><span>${txt}</span>`;
  log.prepend(div);
}

/* ===================================================================
   CHART (Chart.js)
   =================================================================== */
function chartInit(){
  const ctx=document.getElementById('chartKennlinie').getContext('2d');
  L.chart=new Chart(ctx,{
    type:'scatter',
    data:{datasets:[
      { label:'Messpunkte M(n)', data:[], showLine:true,
        borderColor:'#1452f0', backgroundColor:'#1452f0',
        pointRadius:5, pointHoverRadius:7, borderWidth:2.5, tension:0.3, order:2 },
      { label:'theoretische Kennlinie', data:[], showLine:true,
        borderColor:'#c7d2e8', backgroundColor:'transparent',
        pointRadius:0, borderWidth:1.5, borderDash:[5,4], order:3, hidden:true },
      { label:'Arbeitspunkt', data:[], showLine:false,
        borderColor:'#e0561b', backgroundColor:'#e0561b',
        pointRadius:6, pointStyle:'rectRot', borderWidth:2, order:1 }
    ]},
    options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      scales:{
        x:{title:{display:true,text:'Drehzahl n in 1/min'},min:0,max:1550,
           grid:{color:'#e6eaee'}},
        y:{title:{display:true,text:'Wellenmoment M in Nm'},min:0,max:27,
           grid:{color:'#e6eaee'}}
      },
      plugins:{legend:{labels:{font:{family:'JetBrains Mono',size:11}}}}
    }
  });
}
function chartPunktHinzufuegen(m){
  const d=L.chart.data.datasets[0].data;
  d.push({x:m.n,y:m.M}); d.sort((a,b)=>a.x-b.x);
  L.chart.update('none');
}
function chartNeuAufbauen(){
  L.chart.data.datasets[0].data=L.messungen.map(m=>({x:m.n,y:m.M})).sort((a,b)=>a.x-b.x);
  L.chart.update('none');
}
function theoretischeKurveZeigen(){
  const ds=L.chart.data.datasets[1];
  if(ds.data.length===0){
    const pts=[];
    for(let s=SK; s>=0.001; s*=0.93){ const b=betrieb(s); pts.push({x:b.n,y:Math.max(b.Mw,0)}); }
    for(let s=SK; s<=1.0; s+=0.03){ const b=betrieb(s); pts.push({x:b.n,y:Math.max(b.Mw,0)}); }
    ds.data=pts.sort((a,b)=>a.x-b.x);
  }
  ds.hidden=!ds.hidden;
  document.getElementById('btnTheorie').classList.toggle('aktiv-btn',!ds.hidden);
  L.chart.update();
}

/* ===================================================================
   MASCHINEN-ANIMATION (kompaktes Drehfeld, vom echten Schlupf getrieben)
   =================================================================== */
let thF=0, thR=0;
function maschineZeichnen(dt){
  const cv=document.getElementById('maschineCanvas'); if(!cv) return;
  const ctx=cv.getContext('2d');
  if(!cv._init){ const DPR=Math.min(devicePixelRatio||1,2);
    cv.width=300*DPR; cv.height=300*DPR; ctx.scale(DPR,DPR); cv._init=true; }
  const W=300,H=300,cx=W/2,cy=H/2,R=104;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const laeuftFeld = (L.laeuft||L.kipped) && !L.getrippt;
  const wVis=2*Math.PI/3.2;
  if(!reduce){
    if(laeuftFeld) thF+=wVis*dt;
    thR+=wVis*(1-L.s)*dt;
  }
  ctx.clearRect(0,0,W,H);
  // Gehaeuse
  ctx.fillStyle='#0c1116';ctx.beginPath();ctx.arc(cx,cy,R+24,0,7);ctx.fill();
  ctx.lineWidth=18;ctx.strokeStyle='#1b2733';ctx.beginPath();ctx.arc(cx,cy,R+6,0,7);ctx.stroke();
  for(let i=0;i<24;i++){const a=i/24*2*Math.PI;ctx.strokeStyle='#243240';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*(R-2),cy+Math.sin(a)*(R-2));
    ctx.lineTo(cx+Math.cos(a)*(R+13),cy+Math.sin(a)*(R+13));ctx.stroke();}
  // Phasen U V W
  const ph=[{a:-90,c:'#36d3ff'},{a:30,c:'#3ee07a'},{a:150,c:'#ffb020'}];
  ph.forEach((p,k)=>{const cur=laeuftFeld?Math.cos(thF-k*2*Math.PI/3):0;const a=p.a*Math.PI/180;
    const bx=cx+Math.cos(a)*(R+6),by=cy+Math.sin(a)*(R+6);
    ctx.globalAlpha=0.22+0.55*Math.abs(cur);ctx.fillStyle=p.c;
    ctx.beginPath();ctx.arc(bx,by,9,0,7);ctx.fill();ctx.globalAlpha=1;});
  // Feld-Glow
  if(laeuftFeld){const g=ctx.createRadialGradient(cx,cy,0,cx,cy,R);
    g.addColorStop(0,'rgba(54,211,255,0.16)');g.addColorStop(1,'rgba(54,211,255,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,R-6,0,7);ctx.fill();}
  // Laeufer
  ctx.save();ctx.translate(cx,cy);ctx.rotate(thR);
  ctx.fillStyle='#0c1116';ctx.beginPath();ctx.arc(0,0,62,0,7);ctx.fill();
  ctx.strokeStyle='#3a4a58';ctx.lineWidth=2;ctx.stroke();
  const rl=58;const g2=ctx.createLinearGradient(-rl,0,rl,0);
  g2.addColorStop(0,'#ff8a3d');g2.addColorStop(.49,'#ffb020');g2.addColorStop(.51,'#5b6b7a');g2.addColorStop(1,'#39475533');
  ctx.fillStyle=g2;ctx.beginPath();ctx.roundRect(-rl,-15,2*rl,30,9);ctx.fill();
  ctx.fillStyle='#0c1116';ctx.font='800 13px Archivo';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('N',-rl*0.6,0);ctx.fillStyle='#cdd6df';ctx.fillText('S',rl*0.6,0);
  ctx.restore();
  // Feldvektor
  if(laeuftFeld){const fx=cx+Math.cos(thF)*(R-16),fy=cy+Math.sin(thF)*(R-16);
    ctx.strokeStyle='#36d3ff';ctx.fillStyle='#36d3ff';ctx.lineWidth=4;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(fx,fy);ctx.stroke();
    const ang=Math.atan2(fy-cy,fx-cx),h=12;
    ctx.beginPath();ctx.moveTo(fx,fy);
    ctx.lineTo(fx-h*Math.cos(ang-0.4),fy-h*Math.sin(ang-0.4));
    ctx.lineTo(fx-h*Math.cos(ang+0.4),fy-h*Math.sin(ang+0.4));ctx.closePath();ctx.fill();}
  ctx.fillStyle=laeuftFeld?'#36d3ff':'#46586a';ctx.beginPath();ctx.arc(cx,cy,5,0,7);ctx.fill();
  // Drehzahl-Label unten
  ctx.fillStyle='#9aa7b2';ctx.font='600 11px JetBrains Mono';ctx.textAlign='center';
  ctx.fillText('n = '+fmt(L.n)+' 1/min',cx,H-6);
}

/* ===================================================================
   AUSWERTUNG
   =================================================================== */
function auswertungAnzeigen(){
  if(L.messungen.length<4){
    ereignis('Für eine Auswertung mindestens 4 Messpunkte aufnehmen (besser 8–10, inkl. Kipppunkt).','warn');
    return;
  }
  const sec=document.getElementById('auswertung');
  sec.classList.remove('versteckt');
  // gemessene Kennwerte
  const MKmess=L.messungen.reduce((a,m)=>Math.max(a,m.M),0);
  const mKipp=L.messungen.find(m=>m.M===MKmess);
  const sKmess=mKipp? mKipp.s/100 : SK;
  const etaMax=L.messungen.reduce((a,m)=>Math.max(a,m.eta),0);
  const mEta=L.messungen.find(m=>m.eta===etaMax);

  setTxt('a_ns', fmt(NS)+' 1/min');
  setTxt('a_MK', fmt(MKmess,1)+' Nm');
  setTxt('a_nK', fmt(mKipp?mKipp.n:NS*(1-SK))+' 1/min');
  setTxt('a_sK', fmt(sKmess*100,1)+' %');
  setTxt('a_etaMax', fmt(etaMax,1)+' %');
  setTxt('a_etaP', mEta?fmt(mEta.Pab)+' W':'–');
  setTxt('a_punkte', L.punkte+' / 100');
  setTxt('a_MKtheo', fmt(MK,1)+' Nm');
  setTxt('a_sKtheo', fmt(SK*100,1)+' %');

  // Vergleichstext
  const abwM=Math.abs(MKmess-MK)/MK*100;
  document.getElementById('a_vergleich').innerHTML =
    `Dein gemessenes Kippmoment weicht um <b>${fmt(abwM,1)} %</b> vom berechneten Wert ab `+
    `(${fmt(MK,1)} Nm aus dem Ersatzschaltbild). Kleine Abweichungen sind normal: Die Bremse `+
    `misst das <i>Wellenmoment</i>, das um die Reibung kleiner ist als das berechnete Luftspaltmoment.`;

  if(L.chart){ theoretischeKurveZeigen(); if(L.chart.data.datasets[1].hidden) theoretischeKurveZeigen(); }
  punkteAnzeigen();
  sec.scrollIntoView({behavior:'smooth'});
}
function setTxt(id,t){const e=document.getElementById(id);if(e)e.textContent=t;}

/* ===================================================================
   PDF-EXPORT (Messprotokoll)
   =================================================================== */
function laborPdf(){
  if(L.messungen.length<4){ ereignis('Mindestens 4 Messpunkte nötig, bevor du das Protokoll erzeugst.','warn'); return; }
  const { jsPDF } = window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  const W=210, M=14; let y=0;
  const MKmess=L.messungen.reduce((a,m)=>Math.max(a,m.M),0);
  const mKipp=L.messungen.find(m=>m.M===MKmess);
  const etaMax=L.messungen.reduce((a,m)=>Math.max(a,m.eta),0);

  // Kopf
  doc.setFillColor(16,22,29);doc.rect(0,0,W,28,'F');
  doc.setDrawColor(54,211,255);doc.setLineWidth(0.8);doc.circle(M+6,14,5,'S');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(14);
  doc.text('KI Labor DASM',M+16,12);
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(150,167,178);
  doc.text('Messprotokoll - Belastungskennlinie & Kippmoment',M+16,18);
  doc.setFontSize(8);doc.text('Lycee technique d\'Ettelbruck',W-M,12,{align:'right'});
  doc.text('VERSUCH E-7',W-M,18,{align:'right'});
  y=36;

  // Schuelerdaten
  doc.setDrawColor(212,218,224);doc.setFillColor(244,246,248);
  doc.roundedRect(M,y,W-2*M,16,2,2,'FD');
  doc.setTextColor(20,25,30);doc.setFont('helvetica','bold');doc.setFontSize(9.5);
  doc.text('Name:',M+4,y+7);doc.text('Klasse:',M+70,y+7);doc.text('Datum:',M+125,y+7);
  doc.setFont('helvetica','normal');
  doc.text(L.name||'-',M+18,y+7);doc.text(L.klasse||'-',M+85,y+7);doc.text(L.datum||'-',M+140,y+7);
  doc.setFont('helvetica','bold');doc.text('Pruefstand-Punkte:',M+4,y+12.5);
  doc.setFont('helvetica','normal');
  doc.setTextColor(...(L.punkte>=80?[31,157,85]:L.punkte>=50?[200,140,0]:[224,86,27]));
  doc.text(L.punkte+' / 100',M+40,y+12.5);
  y+=22;

  // Maschinendaten
  doc.setTextColor(20,25,30);doc.setFont('helvetica','bold');doc.setFontSize(8);
  doc.text(`Versuchsmaschine: 3~ Asynchronmotor, Kaefiglaeufer - P_N=1,5 kW - U_N=400 V (Y) - p=2 - n_s=${fmt(NS)} 1/min`,M,y);
  y+=6;

  // Messtabelle
  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('Messwerte',M,y);y+=2;
  doc.line(M,y+1,W-M,y+1);y+=6;
  const heads=['Nr','U/V','I/A','n/(1/min)','s/%','M/Nm','P_zu/W','P_ab/W','eta/%'];
  const colW=[10,16,16,24,16,18,24,24,18];
  const tableW=colW.reduce((a,b)=>a+b,0);
  let x=M;
  // Kopfzeile als eigene Bande mit klarem Abstand zur ersten Messzeile
  const headTop=y-4.5, headH=7;
  doc.setFillColor(16,22,29);doc.rect(M,headTop,tableW,headH,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(7.5);
  heads.forEach((h,i)=>{doc.text(h,x+colW[i]/2,headTop+headH/2+1.1,{align:'center'});x+=colW[i];});
  y=headTop+headH+4;
  doc.setFont('courier','normal');doc.setFontSize(7.5);
  L.messungen.forEach((m,r)=>{
    if(y>250){doc.addPage();y=20;}
    x=M;
    if(r%2===0){doc.setFillColor(248,250,251);doc.rect(M,y-3.4,colW.reduce((a,b)=>a+b,0),5,'F');}
    doc.setTextColor(m.M===MKmess?224:30, m.M===MKmess?86:35, m.M===MKmess?27:40);
    if(m.M===MKmess)doc.setFont('courier','bold');else doc.setFont('courier','normal');
    const vals=[m.nr, fmt(m.U), fmt(m.I,2), fmt(m.n), fmt(m.s,1), fmt(m.M,1), fmt(m.Pzu), fmt(m.Pab), fmt(m.eta,1)];
    vals.forEach((v,i)=>{doc.text(String(v),x+colW[i]/2,y,{align:'center'});x+=colW[i];});
    y+=5;
  });
  y+=3;
  doc.setFont('helvetica','italic');doc.setFontSize(7);doc.setTextColor(110,120,130);
  doc.text('Rot hervorgehoben: hoechstes gemessenes Moment = Kippmoment.',M,y);y+=7;

  // Kennlinie als Bild
  if(L.chart){
    if(y>180){doc.addPage();y=20;}
    doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(20,25,30);
    doc.text('Aufgenommene Kennlinie M = f(n)',M,y);y+=3;
    try{
      const img=L.chart.toBase64Image('image/png',1);
      doc.addImage(img,'PNG',M,y,W-2*M,(W-2*M)*0.5);
      y+=(W-2*M)*0.5+5;
    }catch(e){ y+=2; }
  }

  // Ergebnisse
  if(y>250){doc.addPage();y=20;}
  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('Ermittelte Kennwerte',M,y);y+=2;
  doc.line(M,y+1,W-M,y+1);y+=6;
  doc.setFontSize(8.5);
  const erg=[
    ['Synchrone Drehzahl n_s', fmt(NS)+' 1/min'],
    ['Kippmoment M_K (gemessen)', fmt(MKmess,1)+' Nm'],
    ['Kippdrehzahl n_K', fmt(mKipp?mKipp.n:0)+' 1/min'],
    ['Kippschlupf s_K', fmt(mKipp?mKipp.s:0,1)+' %'],
    ['Bester Wirkungsgrad η_max', fmt(etaMax,1)+' %'],
    ['M_K (berechnet, Ersatzschaltbild)', fmt(MK,1)+' Nm'],
  ];
  erg.forEach(([k,v])=>{
    doc.setFont('helvetica','normal');doc.setTextColor(60,70,81);doc.text(k,M+2,y);
    doc.setFont('courier','bold');doc.setTextColor(20,25,30);doc.text(v,M+95,y);y+=5.5;
  });

  // Pruefcode
  y+=3; if(y>250){doc.addPage();y=20;}
  const code=laborPruefcode(MKmess);
  doc.setDrawColor(180,190,200);doc.setFillColor(238,241,244);
  doc.roundedRect(M,y,W-2*M,22,2,2,'FD');
  doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(20,25,30);
  doc.text('Pruefcode:',M+4,y+7);
  doc.setFont('courier','bold');doc.setFontSize(12);doc.setTextColor(20,82,240);
  doc.text(code,M+4,y+14);
  doc.setFont('helvetica','normal');doc.setFontSize(7.3);doc.setTextColor(91,107,122);
  doc.text('Aus Messwerten und Punktestand berechnet. PDF bitte unveraendert an die Lehrkraft senden.',M+4,y+19.5);

  // Fusszeilen
  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){doc.setPage(p);
    doc.setDrawColor(212,218,224);doc.line(M,289,W-M,289);
    doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(140,150,160);
    doc.text('KI Labor DASM - Messprotokoll',M,293);
    doc.text(code,W/2,293,{align:'center'});
    doc.text(`Seite ${p}/${pages}`,W-M,293,{align:'right'});
  }
  doc.save(`Messprotokoll_DASM_${(L.name||'Schueler').replace(/[^a-zA-Z0-9]/g,'_').slice(0,24)}.pdf`);
  ereignis('Messprotokoll als PDF erzeugt.','ok');
  document.getElementById('labPdfHinweis')?.classList.remove('versteckt');
}
function laborPruefcode(MKmess){
  const muster=L.messungen.map(m=>`${Math.round(m.n)},${m.M.toFixed(1)}`).join(';');
  const roh=`${L.name}#${L.klasse}#${L.messungen.length}#${MKmess.toFixed(1)}#${L.punkte}#${muster}`;
  let h=0; for(let i=0;i<roh.length;i++){h=(h*31+roh.charCodeAt(i))>>>0;}
  let h2=2166136261; for(let i=0;i<roh.length;i++){h2^=roh.charCodeAt(i);h2=(h2*16777619)>>>0;}
  return (('0000'+h.toString(16)).slice(-8)+('0000'+h2.toString(16)).slice(-8)).toUpperCase().replace(/(.{4})/g,'$1 ').trim();
}

/* ---- Initialwerte ---- */
window.addEventListener('DOMContentLoaded',()=>{
  punkteAnzeigen?.();
  gateInit();
});
