"use strict";
(() => {
const LINES=[
[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
[1,0,0,0,1],[1,2,2,2,1],[0,0,1,2,2],[2,2,1,0,0],[1,0,1,2,1],
[1,2,1,0,1],[0,1,1,1,0],[2,1,1,1,2],[0,1,0,1,0],[2,1,2,1,2],
[1,1,0,1,1],[1,1,2,1,1],[0,0,2,0,0],[2,2,0,2,2],[0,2,0,2,0]
];
const SYMBOLS={
T:{label:"10",weight:10,p:[.18,.4,.85],kind:"rank"},
J:{label:"J",weight:9,p:[.2,.45,1],kind:"rank"},
Q:{label:"Q",weight:8,p:[.25,.55,1.2],kind:"rank"},
K:{label:"K",weight:7,p:[.3,.7,1.5],kind:"rank"},
A:{label:"A",weight:7,p:[.35,.85,1.8],kind:"rank"},
STRAW:{label:"STRAW",weight:5,p:[.45,1.1,2.4],kind:"build"},
WOOD:{label:"TIMBER",weight:4,p:[.6,1.5,3.4],kind:"build"},
BRICK:{label:"BRICK",weight:3,p:[.85,2.2,5],kind:"build"},
PIG:{label:"ROYAL",weight:2.2,p:[1.2,3.2,8],kind:"premium"},
MANS:{label:"ESTATE",weight:1.8,p:[1.7,4.8,12],kind:"build"},
WILD:{label:"WILD",weight:1.6,p:[2.2,7,20],kind:"wild"},
SCAT:{label:"SAW",weight:1.7,p:[0,0,0],kind:"scatter"},
COIN:{label:"BONUS",weight:2.7,p:[0,0,0],kind:"coin"}
};
const IDS=Object.keys(SYMBOLS);
const BETS=[1,2,5,10,25,50,100];
const BUILD_NAMES=["FOUNDATION","STRAW","TIMBER","BRICK","ESTATE"];
const STORAGE="pineda_power_v5";
const state={
 balance:2500,betIndex:3,lastWin:0,spins:0,paidSpins:0,totalWagered:0,totalWon:0,biggest:0,
 autoLeft:0,turbo:false,sound:true,mode:"READY",freeLeft:0,freeTotal:0,freeWin:0,projects:[0,0,0],
 hits:0
};
let dom={};
let roundTimers=[];
let reelIntervals=[];
let finalGrid=null;
let roundResolved=false;
let audioCtx=null;
let toastTimer=0;
const WHEEL=[
 {label:"MINI",type:"cash",mult:10,color:"#3de35c",w:22},
 {label:"FREE SPINS",type:"free",color:"#4abed1",w:10},
 {label:"MINOR",type:"cash",mult:25,color:"#f0a24f",w:18},
 {label:"HOLD & WIN",type:"hold",color:"#6d9dff",w:11},
 {label:"BUILD BLAST",type:"build",color:"#cb81ff",w:11},
 {label:"MINI",type:"cash",mult:10,color:"#42d861",w:20},
 {label:"MAJOR",type:"cash",mult:100,color:"#4baef0",w:6},
 {label:"FREE SPINS",type:"free",color:"#45b9ca",w:10},
 {label:"MINOR",type:"cash",mult:25,color:"#e99748",w:18},
 {label:"GRAND",type:"cash",mult:500,color:"#63e777",w:2},
 {label:"HOLD & WIN",type:"hold",color:"#7b9cff",w:10},
 {label:"BUILD BLAST",type:"build",color:"#bd78ef",w:10}
];

function $(id){return document.getElementById(id)}
function money(n){
 const v=Math.round((Number(n)||0)*100)/100;
 return Number.isInteger(v)?v.toLocaleString():v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
}
function bet(){return BETS[state.betIndex]}
function save(){
 try{localStorage.setItem(STORAGE,JSON.stringify({
  balance:state.balance,betIndex:state.betIndex,lastWin:state.lastWin,spins:state.spins,paidSpins:state.paidSpins,
  totalWagered:state.totalWagered,totalWon:state.totalWon,biggest:state.biggest,autoLeft:0,turbo:state.turbo,
  sound:state.sound,projects:state.projects,hits:state.hits
 }))}catch{}
}
function load(){
 try{
  const s=JSON.parse(localStorage.getItem(STORAGE)||"null");
  if(!s)return;
  for(const k of ["balance","betIndex","lastWin","spins","paidSpins","totalWagered","totalWon","biggest","turbo","sound","hits"]){
   if(s[k]!==undefined)state[k]=s[k];
  }
  if(Array.isArray(s.projects)&&s.projects.length===3)state.projects=s.projects.map(v=>Math.max(0,Math.min(4,Number(v)||0)));
 }catch{}
 if(!BETS[state.betIndex])state.betIndex=3;
 if(state.balance<1)state.balance=2500;
}
function weightedSymbol(){
 let total=0;for(const id of IDS)total+=SYMBOLS[id].weight;
 let pick=Math.random()*total;
 for(const id of IDS){pick-=SYMBOLS[id].weight;if(pick<=0)return id}
 return "T";
}
function rollGrid(){
 return Array.from({length:5},()=>Array.from({length:3},weightedSymbol));
}
function tone(freq,dur=.08,type="sine",vol=.06,delay=0){
 if(!state.sound)return;
 try{
  if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  const t=audioCtx.currentTime+delay,o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+dur+.03);
 }catch{}
}
function sfx(name,i=0){
 if(name==="spin"){tone(125,.18,"sawtooth",.035);return}
 if(name==="stop"){tone(220+i*35,.07,"triangle",.07);return}
 if(name==="coin"){tone(820,.08,"sine",.08);tone(1240,.09,"sine",.045,.03);return}
 if(name==="big"){[330,440,550,660,880].forEach((f,j)=>tone(f,.22,"triangle",.07,j*.055));return}
 if(name==="feature"){tone(180,.4,"sawtooth",.04);[520,660,820].forEach((f,j)=>tone(f,.35,"triangle",.055,.1+j*.1));}
}
function clearRoundTimers(){
 roundTimers.forEach(clearTimeout);roundTimers=[];
 reelIntervals.forEach(clearInterval);reelIntervals=[];
}
function later(fn,ms){const id=setTimeout(fn,ms);roundTimers.push(id);return id}
function toast(msg){
 clearTimeout(toastTimer);dom.toast.textContent=msg;dom.toast.classList.add("show");
 toastTimer=setTimeout(()=>dom.toast.classList.remove("show"),1800);
}
function showModal(which){
 closeModals(false);
 dom.backdrop.hidden=false;
 const el=$(which);if(el)el.hidden=false;
 setActiveNav(which==="rulesModal"?"rules":which==="statsModal"?"stats":"game");
 if(which==="statsModal")renderStats();
}
function closeModals(resetNav=true){
 dom.backdrop.hidden=true;
 ["rulesModal","statsModal","menuModal"].forEach(id=>$(id).hidden=true);
 if(resetNav)setActiveNav("game");
}
function setActiveNav(name){
 document.querySelectorAll(".nav-pill,.rail-btn").forEach(b=>b.classList.remove("active"));
 if(name==="game"){["navGame2","railGame"].forEach(id=>$(id)?.classList.add("active"))}
 if(name==="rules"){["navRules","railRules"].forEach(id=>$(id)?.classList.add("active"))}
 if(name==="stats"){["navStats","railStats"].forEach(id=>$(id)?.classList.add("active"))}
}
function fullscreen(){
 try{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.()}catch{}
}

function symbolHTML(id){
 const s=SYMBOLS[id];
 if(s.kind==="rank")return '<div class="symbol"><div class="rank '+id.toLowerCase()+'">'+s.label+'</div></div>';
 const label='<span class="symbol-label">'+s.label+'</span>';
 if(id==="STRAW")return '<div class="symbol">'+svgStraw()+label+'</div>';
 if(id==="WOOD")return '<div class="symbol">'+svgWood()+label+'</div>';
 if(id==="BRICK")return '<div class="symbol">'+svgBrick()+label+'</div>';
 if(id==="PIG")return '<div class="symbol">'+svgPig()+label+'</div>';
 if(id==="MANS")return '<div class="symbol">'+svgEstate()+label+'</div>';
 if(id==="WILD")return '<div class="symbol">'+svgWolf()+label+'</div>';
 if(id==="SCAT")return '<div class="symbol">'+svgSaw()+label+'</div>';
 if(id==="COIN")return '<div class="symbol">'+svgCoin()+label+'</div>';
 return "";
}
function svgFrame(inner,c1="#294758",c2="#081720"){
 return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></linearGradient></defs><rect x="9" y="9" width="82" height="82" rx="18" fill="url(#g)" stroke="#6b8694" stroke-width="2"/>'+inner+'</svg>';
}
function svgStraw(){return svgFrame('<g stroke="#ffe084" stroke-width="5" stroke-linecap="round"><path d="M30 68 38 31"/><path d="M42 70 47 28"/><path d="M55 70 55 29"/><path d="M67 67 62 31"/></g><path d="M27 54h47" stroke="#b9812e" stroke-width="5" stroke-linecap="round"/>',"#806b2b","#2d2512")}
function svgWood(){return svgFrame('<g fill="#bb7845" stroke="#6a3b21" stroke-width="2"><rect x="23" y="31" width="54" height="12" rx="6"/><rect x="18" y="47" width="60" height="12" rx="6"/><rect x="25" y="63" width="52" height="12" rx="6"/></g><circle cx="70" cy="37" r="4" fill="#e2a267"/>',"#74472a","#281d17")}
function svgBrick(){return svgFrame('<g fill="#d76459" stroke="#743530" stroke-width="2"><rect x="21" y="27" width="26" height="16" rx="2"/><rect x="50" y="27" width="29" height="16" rx="2"/><rect x="15" y="46" width="31" height="16" rx="2"/><rect x="49" y="46" width="28" height="16" rx="2"/><rect x="22" y="65" width="25" height="14" rx="2"/><rect x="50" y="65" width="30" height="14" rx="2"/></g>',"#70332f","#261819")}
function svgPig(){return svgFrame('<path d="M30 37 23 22 40 31M70 37l7-15-17 9" fill="#dc7699"/><circle cx="50" cy="49" r="27" fill="#f2abc3" stroke="#c9678b" stroke-width="3"/><ellipse cx="50" cy="58" rx="16" ry="11" fill="#ffc7d8"/><circle cx="44" cy="58" r="2.6" fill="#7e3d57"/><circle cx="56" cy="58" r="2.6" fill="#7e3d57"/><circle cx="40" cy="46" r="3.4" fill="#151b20"/><circle cx="60" cy="46" r="3.4" fill="#151b20"/><path d="m31 32 8-14 11 10 11-10 8 14" fill="#efd06a" stroke="#9e792a" stroke-width="2"/>',"#6d354b","#20161d")}
function svgEstate(){return svgFrame('<path d="M20 47 50 21l30 26" fill="#efd068" stroke="#9f8030" stroke-width="3"/><rect x="25" y="45" width="50" height="34" rx="3" fill="#caa746"/><rect x="44" y="58" width="12" height="21" fill="#21303a"/><rect x="31" y="53" width="9" height="10" fill="#9fe5ed"/><rect x="60" y="53" width="9" height="10" fill="#9fe5ed"/>',"#725c24","#241d12")}
function svgWolf(){return svgFrame('<path d="M50 20 62 34 78 27 72 48 65 67 50 78 35 67 28 48 22 27 38 34Z" fill="#74dbe1" stroke="#d2fbff" stroke-width="2.5"/><path d="m35 47 12 3-11 7M65 47l-12 3 11 7" fill="#08171f"/><path d="m45 62 5 6 5-6" fill="#0b2530"/>',"#184a57","#071820")}
function svgSaw(){return svgFrame('<g transform="translate(50 48)"><path d="M0-31 6-24 15-29 18-20 29-18 24-8 32 0 24 8 29 18 18 20 15 29 6 24 0 31-6 24-15 29-18 20-29 18-24 8-32 0-24-8-29-18-18-20-15-29-6-24Z" fill="#bac9d0" stroke="#edf6f8" stroke-width="2"/><circle r="16" fill="#697b85"/><circle r="7" fill="#ff9253"/></g>',"#713923","#211817")}
function svgCoin(){return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="cg" cx=".35" cy=".3"><stop offset="0" stop-color="#fff2a4"/><stop offset=".48" stop-color="#f0c84f"/><stop offset="1" stop-color="#986318"/></radialGradient></defs><circle cx="50" cy="50" r="38" fill="url(#cg)" stroke="#ffe77f" stroke-width="4"/><circle cx="50" cy="50" r="26" fill="#142630" stroke="#d1aa40" stroke-width="2"/><text x="50" y="48" text-anchor="middle" fill="#f3cd53" font-size="12" font-family="Arial" font-weight="900">BONUS</text><text x="50" y="61" text-anchor="middle" fill="#eaf4f7" font-size="9" font-family="Arial" font-weight="800">COIN</text></svg>'}

function renderGrid(grid,winCells=[]){
 const wins=new Set(winCells.map(([c,r])=>c+"_"+r));
 dom.reels.innerHTML="";
 for(let c=0;c<5;c++){
  const reel=document.createElement("div");reel.className="reel";reel.dataset.reel=c;
  for(let r=0;r<3;r++){
   const cell=document.createElement("div");cell.className="cell"+(wins.has(c+"_"+r)?" win":"");
   cell.dataset.cell=c+"_"+r;cell.dataset.symbol=grid[c][r];
   if(grid[c][r]==="SCAT")cell.classList.add("scatter-hit");
   cell.innerHTML=symbolHTML(grid[c][r]);reel.appendChild(cell);
  }
  dom.reels.appendChild(reel);
 }
}
function randomColumn(){return [weightedSymbol(),weightedSymbol(),weightedSymbol()]}
function setReelColumn(i,col,cls=""){
 const reel=dom.reels.children[i];if(!reel)return;
 reel.className="reel "+cls;
 [...reel.children].forEach((cell,r)=>{cell.className="cell";cell.dataset.symbol=col[r];cell.innerHTML=symbolHTML(col[r])});
}
function renderProjects(){
 state.projects.forEach((level,i)=>{
  $("buildBar"+i).style.width=(level/4*100)+"%";
  $("buildLabel"+i).textContent=BUILD_NAMES[level]||"ESTATE";
  document.querySelector('[data-project="'+i+'"]').classList.toggle("complete",level>=4);
 });
}
function updateJackpots(){
 $("jpMini").textContent=money(bet()*10);
 $("jpMinor").textContent=money(bet()*25);
 $("jpMajor").textContent=money(bet()*100);
 $("jpGrand").textContent=money(bet()*500);
}
function sync(){
 dom.balance.textContent=money(state.balance);dom.topBalance.textContent=money(state.balance);dom.bet.textContent=money(bet());dom.lastWin.textContent=money(state.lastWin);
 dom.turbo.classList.toggle("active",state.turbo);dom.turbo.textContent=state.turbo?"TURBO ON":"TURBO";
 dom.auto.classList.toggle("active",state.autoLeft>0);dom.auto.textContent=state.autoLeft>0?"AUTO "+state.autoLeft:"AUTO";
 dom.menuSoundState.textContent=state.sound?"ON":"OFF";dom.railSound.querySelector("small").textContent=state.sound?"SOUND":"MUTED";
 const activeSpin=state.mode==="READY"||state.mode==="FREE"||state.mode==="SPINNING";
 dom.spin.disabled=!activeSpin;dom.betDown.disabled=state.mode!=="READY";dom.betUp.disabled=state.mode!=="READY";
 dom.spin.classList.toggle("stop",state.mode==="SPINNING");
 dom.spin.textContent=state.mode==="SPINNING"?"STOP":state.mode==="FREE"?"FREE "+state.freeLeft:"SPIN";
 dom.modeBadge.classList.toggle("feature",state.mode==="FREE"||state.mode==="HOLD"||state.mode==="WHEEL");
 dom.modeBadge.textContent=state.mode==="FREE"?"FREE SPINS":state.mode==="HOLD"?"HOLD & WIN":state.mode==="WHEEL"?"BONUS WHEEL":"BASE GAME";
 renderProjects();updateJackpots();save();
}
function setStatus(text,msg){
 dom.statusText.textContent=text; if(msg!==undefined)dom.sessionMessage.textContent=msg;
}
function evaluate(grid){
 let total=0,cells=[];
 for(const line of LINES){
  const rowSymbols=line.map((r,c)=>grid[c][r]);
  let base=rowSymbols.find(id=>id!=="WILD"&&id!=="SCAT"&&id!=="COIN")||"WILD";
  if(base==="SCAT"||base==="COIN")continue;
  let count=0;
  for(const id of rowSymbols){if(id===base||id==="WILD")count++;else break}
  if(count>=3){
   const mult=SYMBOLS[base].p[count-3]||0;
   const win=bet()*mult/4;
   total+=win;for(let c=0;c<count;c++)cells.push([c,line[c]]);
  }
 }
 return {win:Math.round(total*100)/100,cells};
}
function count(grid,id){let n=0;grid.forEach(col=>col.forEach(v=>{if(v===id)n++}));return n}
function countBuild(grid){let n=0;grid.forEach(col=>col.forEach(v=>{if(["STRAW","WOOD","BRICK","MANS"].includes(v))n++}));return n}

function startSpin(){
 if(state.mode==="SPINNING"){quickStop();return}
 if(!["READY","FREE"].includes(state.mode))return;
 const isFree=state.mode==="FREE";
 if(!isFree){
  if(state.balance<bet()){toast("Not enough free-play credits. Use Menu → Refill.");return}
  state.balance-=bet();state.totalWagered+=bet();state.paidSpins++;
 }
 state.spins++;state.mode="SPINNING";state.lastWin=0;sync();setStatus("SPINNING","Watch for 3+ Saws or 6+ Bonus Coins");
 finalGrid=rollGrid();roundResolved=false;clearRoundTimers();sfx("spin");
 const baseDelay=state.turbo?190:480,step=state.turbo?80:165;
 for(let i=0;i<5;i++){
  const reel=dom.reels.children[i];reel.classList.add("spinning");
  const int=setInterval(()=>setReelColumn(i,randomColumn(),"spinning"),state.turbo?52:78);reelIntervals.push(int);
  later(()=>landReel(i),baseDelay+i*step);
 }
 const sc0=finalGrid.slice(0,3).flat().filter(v=>v==="SCAT").length;
 if(sc0>=2){later(()=>{dom.anticipation.classList.add("on");dom.reels.children[3]?.classList.add("anticipate");dom.reels.children[4]?.classList.add("anticipate");setStatus("ANTICIPATION","Two Saws are already in view…")},baseDelay+step*2)}
}
function landReel(i){
 const int=reelIntervals[i];if(int)clearInterval(int);
 setReelColumn(i,finalGrid[i],"landing");sfx("stop",i);
 if(i===4)later(resolveRound,state.turbo?80:180);
}
function quickStop(){
 if(state.mode!=="SPINNING"||roundResolved)return;
 clearRoundTimers();reelIntervals.forEach(clearInterval);reelIntervals=[];
 for(let i=0;i<5;i++)setReelColumn(i,finalGrid[i],"landing");
 later(resolveRound,80);
}
function creditWin(amount,cells=[],splash=true){
 amount=Math.round((amount||0)*100)/100;if(amount<=0)return;
 state.balance+=amount;state.totalWon+=amount;state.lastWin=amount;state.biggest=Math.max(state.biggest,amount);state.hits++;
 renderGrid(finalGrid||rollGrid(),cells);sync();
 if(splash&&amount>=bet()*5)showWin(amount);
}
function showWin(amount){
 const m=amount/bet();dom.winTier.textContent=m>=100?"EPIC WIN":m>=50?"MEGA WIN":m>=20?"SUPER WIN":m>=10?"BIG WIN":"NICE WIN";
 dom.winAmount.textContent=money(amount);dom.winSplash.classList.add("show");sfx("big");
 setTimeout(()=>dom.winSplash.classList.remove("show"),state.turbo?700:1500);
}
function handleBuild(grid,isFree){
 const n=countBuild(grid);if(n<2)return;
 const upgrades=n>=5?2:1;
 for(let u=0;u<upgrades*(isFree?2:1);u++){
  let min=Math.min(...state.projects),idx=state.projects.indexOf(min);
  if(state.projects[idx]<4)state.projects[idx]++;
 }
 renderProjects();
 if(state.projects.every(v=>v>=4)){
  const award=bet()*50;state.projects=[0,0,0];creditWin(award,[],true);toast("BUILD COMPLETE • +"+money(award)+" credits");
 }
}
function resolveRound(){
 if(roundResolved)return;roundResolved=true;clearRoundTimers();dom.anticipation.classList.remove("on");[...dom.reels.children].forEach(r=>r.classList.remove("anticipate","spinning"));
 const result=evaluate(finalGrid),scat=count(finalGrid,"SCAT"),coins=count(finalGrid,"COIN");
 const wasFree=state.freeLeft>0;
 handleBuild(finalGrid,wasFree);
 if(result.win>0)creditWin(result.win,result.cells,result.win>=bet()*5);else renderGrid(finalGrid);
 if(wasFree){
  state.freeWin+=result.win;state.freeLeft--;
  if(scat>=3){state.freeLeft+=3;state.freeTotal+=3;toast("+3 FREE SPINS")}
  if(state.freeLeft<=0){endFreeSpins();return}
  state.mode="FREE";sync();setStatus("FREE SPINS",state.freeLeft+" spins remaining • Feature total "+money(state.freeWin));later(startSpin,state.turbo?220:650);return;
 }
 if(coins>=6){state.mode="HOLD";sync();setStatus("FEATURE TRIGGERED","6+ Bonus Coins • Hold & Win");later(()=>startHoldWin(coins),state.turbo?300:750);return}
 if(scat>=3){state.mode="WHEEL";sync();setStatus("FEATURE TRIGGERED","3+ Buzz Saws • Power Wheel");later(startWheel,state.turbo?300:750);return}
 state.mode="READY";sync();setStatus("READY",result.win>0?"Line win "+money(result.win)+" credits":"6+ Bonus Coins trigger Hold & Win • 3+ Saws trigger the Bonus Wheel");scheduleAuto();
}
function scheduleAuto(){
 if(state.autoLeft>0&&state.mode==="READY"){state.autoLeft--;sync();later(startSpin,state.turbo?220:650)}
}
function startFreeSpins(n=8){
 clearRoundTimers();state.freeLeft=n;state.freeTotal=n;state.freeWin=0;state.mode="FREE";sync();sfx("feature");
 showFeature("FREE SPINS",n+" spins awarded","POWER FEATURE");
 setTimeout(()=>{hideBonus();setStatus("FREE SPINS",n+" spins remaining • Build upgrades count double");startSpin()},state.turbo?700:1700);
}
function endFreeSpins(){
 state.mode="READY";sync();showFeature("FEATURE COMPLETE",money(state.freeWin)+" credits won","FREE SPINS");
 setTimeout(()=>{hideBonus();setStatus("READY","Free Spins complete • "+money(state.freeWin)+" credits won");scheduleAuto()},state.turbo?850:1900);
}
function showFeature(title,sub,kicker){
 dom.bonusOverlay.hidden=false;dom.featurePanel.hidden=false;dom.wheelPanel.hidden=true;dom.holdPanel.hidden=true;
 dom.featureTitle.textContent=title;dom.featureSubtitle.textContent=sub;dom.featureKicker.textContent=kicker||"FEATURE";
}
function hideBonus(){dom.bonusOverlay.hidden=true;dom.featurePanel.hidden=true;dom.wheelPanel.hidden=true;dom.holdPanel.hidden=true}

function renderWheel(){
 const deg=360/WHEEL.length;
 dom.wheelDisc.style.background="conic-gradient("+WHEEL.map((p,i)=>p.color+" "+(i*deg)+"deg "+((i+1)*deg)+"deg").join(",")+")";
 dom.wheelLabels.innerHTML="";
 WHEEL.forEach((p,i)=>{
  const el=document.createElement("div");el.className="wheel-label";el.textContent=p.label;
  const a=(i+.5)*deg-90,rad=a*Math.PI/180,r=40;
  el.style.left=(50+Math.cos(rad)*r)+"%";el.style.top=(50+Math.sin(rad)*r)+"%";el.style.transform="translate(-50%,-50%) rotate("+a+"deg)";
  dom.wheelLabels.appendChild(el);
 });
}
function weightedPrize(){
 let total=WHEEL.reduce((a,p)=>a+p.w,0),pick=Math.random()*total;
 for(let i=0;i<WHEEL.length;i++){pick-=WHEEL[i].w;if(pick<=0)return i}
 return 0;
}
function startWheel(){
 clearRoundTimers();state.mode="WHEEL";sync();dom.bonusOverlay.hidden=false;dom.wheelPanel.hidden=false;dom.holdPanel.hidden=true;dom.featurePanel.hidden=true;sfx("feature");
 const idx=weightedPrize(),seg=360/WHEEL.length;
 dom.wheelDisc.style.transition="none";dom.wheelDisc.style.transform="rotate(0deg)";void dom.wheelDisc.offsetWidth;
 const target=360*6+(360-(idx+.5)*seg);
 dom.wheelDisc.style.transition=(state.turbo?"1.6s":"4.1s")+" cubic-bezier(.1,.72,.12,1)";
 dom.wheelDisc.style.transform="rotate("+target+"deg)";
 setTimeout(()=>awardWheel(WHEEL[idx]),state.turbo?1750:4300);
}
function awardWheel(p){
 if(p.type==="cash"){
  const amount=bet()*p.mult;creditWin(amount,[],true);toast(p.label+" • +"+money(amount)+" credits");
  setTimeout(()=>{hideBonus();state.mode="READY";sync();scheduleAuto()},state.turbo?600:1200);return;
 }
 if(p.type==="free"){dom.wheelPanel.hidden=true;startFreeSpins(8);return}
 if(p.type==="hold"){dom.wheelPanel.hidden=true;startHoldWin(6);return}
 if(p.type==="build"){
  state.projects=state.projects.map(v=>Math.min(4,v+2));renderProjects();
  if(state.projects.every(v=>v>=4)){const amt=bet()*50;state.projects=[0,0,0];creditWin(amt,[],true)}
  toast("BUILD BLAST • +2 levels on every lot");
  setTimeout(()=>{hideBonus();state.mode="READY";sync();scheduleAuto()},state.turbo?700:1400);
 }
}
function coinValue(){
 const r=Math.random();
 if(r<.01)return {label:"GRAND",amount:bet()*500,jp:true};
 if(r<.03)return {label:"MAJOR",amount:bet()*100,jp:true};
 if(r<.08)return {label:"MINOR",amount:bet()*25,jp:true};
 if(r<.16)return {label:"MINI",amount:bet()*10,jp:true};
 const m=[1,1,1,2,2,3,5,5,10,15][Math.floor(Math.random()*10)];
 return {label:m+"×",amount:bet()*m,jp:false};
}
let hold={coins:[],respins:3};
function startHoldWin(seed=6){
 clearRoundTimers();state.mode="HOLD";sync();dom.bonusOverlay.hidden=false;dom.holdPanel.hidden=false;dom.wheelPanel.hidden=true;dom.featurePanel.hidden=true;sfx("feature");
 const slots=[...Array(15).keys()].sort(()=>Math.random()-.5).slice(0,Math.min(8,seed));
 hold={coins:slots.map(pos=>({pos,val:coinValue()})),respins:3};renderHold();setStatus("HOLD & WIN","New coins reset respins to 3");
 setTimeout(holdRespin,state.turbo?450:1100);
}
function renderHold(){
 const map=new Map(hold.coins.map(c=>[c.pos,c.val]));dom.holdGrid.innerHTML="";
 for(let i=0;i<15;i++){
  const cell=document.createElement("div");cell.className="hold-cell";
  if(map.has(i)){const v=map.get(i),coin=document.createElement("div");coin.className="hold-coin"+(v.jp?" jp":"");coin.textContent=v.label;cell.appendChild(coin)}
  dom.holdGrid.appendChild(cell);
 }
 const total=hold.coins.reduce((a,c)=>a+c.val.amount,0);dom.holdRespins.textContent=hold.respins;dom.holdCollected.textContent=hold.coins.length+"/15";dom.holdValue.textContent=money(total);
}
function holdRespin(){
 if(state.mode!=="HOLD")return;
 const occupied=new Set(hold.coins.map(c=>c.pos)),added=[];
 for(let i=0;i<15;i++){if(!occupied.has(i)&&Math.random()<.13){const val=coinValue();hold.coins.push({pos:i,val});added.push(i);sfx("coin")}}
 if(added.length)hold.respins=3;else hold.respins--;
 renderHold();
 if(hold.coins.length===15){setTimeout(()=>finishHold(true),state.turbo?350:800);return}
 if(hold.respins<=0){setTimeout(()=>finishHold(false),state.turbo?350:800);return}
 setTimeout(holdRespin,state.turbo?420:1050);
}
function finishHold(full){
 let total=hold.coins.reduce((a,c)=>a+c.val.amount,0);if(full)total+=bet()*500;
 state.balance+=total;state.totalWon+=total;state.lastWin=total;state.biggest=Math.max(state.biggest,total);state.hits++;sync();showWin(total);
 setStatus("HOLD & WIN COMPLETE",(full?"FULL GRID • ":"")+money(total)+" credits");
 setTimeout(()=>{hideBonus();state.mode="READY";sync();scheduleAuto()},state.turbo?900:1800);
}

function renderStats(){
 const rtp=state.totalWagered>0?(state.totalWon/state.totalWagered*100).toFixed(1)+"%":"—";
 const hit=state.spins>0?(state.hits/state.spins*100).toFixed(1)+"%":"—";
 const rows=[
 ["TOTAL SPINS",money(state.spins)],["PAID SPINS",money(state.paidSpins)],["TOTAL WAGERED",money(state.totalWagered)],
 ["TOTAL WON",money(state.totalWon)],["SESSION RTP",rtp],["HIT RATE",hit],["BIGGEST WIN",money(state.biggest)],["BALANCE",money(state.balance)]
 ];
 dom.statsGrid.innerHTML=rows.map(([k,v])=>'<div class="stat-card"><small>'+k+'</small><strong>'+v+'</strong></div>').join("");
}
function renderPaytable(){
 const ids=["T","J","Q","K","A","STRAW","WOOD","BRICK","PIG","MANS","WILD"];
 dom.paytable.innerHTML='<div class="pay-row"><b>SYMBOL</b><span>3</span><span>4</span><span>5</span></div>'+
 ids.map(id=>'<div class="pay-row"><b>'+SYMBOLS[id].label+'</b>'+SYMBOLS[id].p.map(v=>'<span>'+v+'×</span>').join("")+'</div>').join("");
}
function toggleAuto(){
 if(state.autoLeft>0){state.autoLeft=0;sync();return}
 if(state.mode!=="READY"){toast("Autoplay can be started from the base game.");return}
 state.autoLeft=24;sync();startSpin();
}
function initEvents(){
 const goGame=()=>{closeModals();setActiveNav("game")};
 ["navGame","navGame2","railGame"].forEach(id=>$(id).addEventListener("click",goGame));
 ["navRules","railRules"].forEach(id=>$(id).addEventListener("click",()=>showModal("rulesModal")));
 ["navStats","railStats"].forEach(id=>$(id).addEventListener("click",()=>showModal("statsModal")));
 dom.railSound.addEventListener("click",()=>{state.sound=!state.sound;sync();toast(state.sound?"Sound on":"Sound muted")});
 $("railFull").addEventListener("click",fullscreen);
 dom.spin.addEventListener("click",()=>{if(state.mode==="SPINNING")quickStop();else startSpin()});
 dom.betDown.addEventListener("click",()=>{if(state.mode!=="READY")return;state.betIndex=Math.max(0,state.betIndex-1);sync()});
 dom.betUp.addEventListener("click",()=>{if(state.mode!=="READY")return;state.betIndex=Math.min(BETS.length-1,state.betIndex+1);sync()});
 dom.auto.addEventListener("click",toggleAuto);
 dom.turbo.addEventListener("click",()=>{state.turbo=!state.turbo;sync();toast(state.turbo?"Turbo on":"Turbo off")});
 $("btnMenu").addEventListener("click",()=>showModal("menuModal"));
 $("menuRules").addEventListener("click",()=>showModal("rulesModal"));
 $("menuStats").addEventListener("click",()=>showModal("statsModal"));
 $("menuSound").addEventListener("click",()=>{state.sound=!state.sound;sync()});
 $("menuRefill").addEventListener("click",()=>{state.balance+=2500;sync();toast("+2,500 free-play credits")});
 document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModals()));
 dom.backdrop.addEventListener("click",()=>closeModals());
 $("testWheel").addEventListener("click",()=>{closeModals();state.mode="WHEEL";sync();startWheel()});
 $("testHold").addEventListener("click",()=>{closeModals();startHoldWin(6)});
 $("testFree").addEventListener("click",()=>{closeModals();startFreeSpins(8)});
 window.addEventListener("keydown",e=>{
  if(e.code==="Escape"){if(!dom.bonusOverlay.hidden)return;closeModals();return}
  if(e.code==="Space"&&!["INPUT","BUTTON","SUMMARY"].includes(document.activeElement?.tagName)){e.preventDefault();if(state.mode==="SPINNING")quickStop();else startSpin()}
 });
}
function boot(){
 load();
 dom={
  reels:$("reels"),balance:$("balance"),topBalance:$("topBalance"),bet:$("bet"),lastWin:$("lastWin"),spin:$("spin"),
  betDown:$("betDown"),betUp:$("betUp"),auto:$("auto"),turbo:$("turbo"),modeBadge:$("modeBadge"),
  statusText:$("statusText"),sessionMessage:$("sessionMessage"),anticipation:$("anticipation"),toast:$("toast"),
  winSplash:$("winSplash"),winTier:$("winTier"),winAmount:$("winAmount"),backdrop:$("modalBackdrop"),
  statsGrid:$("statsGrid"),menuSoundState:$("menuSoundState"),railSound:$("railSound"),
  bonusOverlay:$("bonusOverlay"),wheelPanel:$("wheelPanel"),wheelDisc:$("wheelDisc"),wheelLabels:$("wheelLabels"),
  holdPanel:$("holdPanel"),holdGrid:$("holdGrid"),holdRespins:$("holdRespins"),holdCollected:$("holdCollected"),holdValue:$("holdValue"),
  featurePanel:$("featurePanel"),featureKicker:$("featureKicker"),featureTitle:$("featureTitle"),featureSubtitle:$("featureSubtitle")
 };
 renderGrid(rollGrid());renderWheel();renderPaytable();renderProjects();initEvents();sync();setStatus("READY","6+ Bonus Coins trigger Hold & Win • 3+ Saws trigger the Power Wheel");
 window.__gameReady=true;window.__game=state;
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();