"use strict";
(() => {
const STORAGE="pineda_power_huff_v1";
const BETS=[1,2,5,10,25,50,100];
const FRAME_NAMES=["","STRAW","WOOD","BRICK"];
const SYMBOLS={
  T:{label:"10",pay:[.15,.35,.8],w:10,kind:"rank"},
  J:{label:"J",pay:[.18,.45,1],w:9,kind:"rank"},
  Q:{label:"Q",pay:[.22,.55,1.2],w:8,kind:"rank"},
  K:{label:"K",pay:[.28,.7,1.5],w:7,kind:"rank"},
  A:{label:"A",pay:[.35,.9,1.9],w:7,kind:"rank"},
  TAPE:{label:"TAPE",pay:[.55,1.4,3],w:5,kind:"tool"},
  TOOL:{label:"TOOLBOX",pay:[.7,1.8,4],w:4.6,kind:"tool"},
  PG:{label:"PIG",pay:[1,2.8,7],w:3.1,kind:"pig"},
  PB:{label:"FOREMAN",pay:[1.4,4,10],w:2.4,kind:"pig"},
  WILD:{label:"WILD",pay:[2,6,18],w:1.5,kind:"wild"},
  HAT:{label:"HARD HAT",pay:[0,0,0],w:3.2,kind:"hat"},
  SAW:{label:"BUZZ SAW",pay:[0,0,0],w:1.5,kind:"saw"}
};
const PAY_IDS=["T","J","Q","K","A","TAPE","TOOL","PG","PB"];
const state={
  balance:2500,betIndex:3,lastWin:0,spins:0,paidSpins:0,totalWagered:0,totalWon:0,biggest:0,hits:0,
  autoLeft:0,turbo:false,sound:true,mode:"READY",grid:null,feature:null,pendingFree:null,pendingSaw:null
};
const dom={};
let spinTimers=[];
let reelIntervals=[];
let finalGrid=null;
let spinResolved=false;
let toastTimer=0;
let audioCtx=null;
const WHEEL=[
  {label:"MINI",type:"jackpot",jp:"mini",color:"#d64aa8",weight:22},
  {label:"BUZZ SAW",type:"feature",feature:"buzz",color:"#2798d5",weight:17},
  {label:"MAJOR",type:"jackpot",jp:"major",color:"#e64b34",weight:6},
  {label:"MEGA HAT",type:"feature",feature:"mega",color:"#f1b43c",weight:17},
  {label:"MANSION",type:"feature",feature:"mansion",color:"#9a4ac4",weight:10},
  {label:"MINOR",type:"jackpot",jp:"minor",color:"#46a544",weight:20},
  {label:"GRAND",type:"jackpot",jp:"grand",color:"#d74732",weight:2}
];

function $(id){return document.getElementById(id)}
function fmt(n){
  const v=Math.round((Number(n)||0)*100)/100;
  return Number.isInteger(v)?v.toLocaleString():v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
}
function bet(){return BETS[state.betIndex]}
function jackpots(){
  return {mini:bet()*10,minor:bet()*50,major:bet()*1000,grand:bet()*5000};
}
function save(){
  try{localStorage.setItem(STORAGE,JSON.stringify({
    balance:state.balance,betIndex:state.betIndex,lastWin:state.lastWin,spins:state.spins,paidSpins:state.paidSpins,
    totalWagered:state.totalWagered,totalWon:state.totalWon,biggest:state.biggest,hits:state.hits,
    turbo:state.turbo,sound:state.sound
  }))}catch{}
}
function load(){
  try{
    const s=JSON.parse(localStorage.getItem(STORAGE)||"null");
    if(!s)return;
    for(const k of ["balance","betIndex","lastWin","spins","paidSpins","totalWagered","totalWon","biggest","hits","turbo","sound"]){
      if(s[k]!==undefined)state[k]=s[k];
    }
  }catch{}
  if(!Number.isFinite(state.balance)||state.balance<0)state.balance=2500;
  if(!BETS[state.betIndex])state.betIndex=3;
}
function tone(freq,dur=.08,type="sine",vol=.055,delay=0){
  if(!state.sound)return;
  try{
    if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==="suspended")audioCtx.resume();
    const t=audioCtx.currentTime+delay,o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+dur+.03);
  }catch{}
}
function sfx(name,i=0){
  if(name==="spin"){tone(130,.2,"sawtooth",.035);return}
  if(name==="stop"){tone(205+i*38,.08,"triangle",.07);return}
  if(name==="hat"){tone(760,.08,"sine",.065);tone(1050,.1,"sine",.04,.025);return}
  if(name==="feature"){tone(180,.35,"sawtooth",.04);[420,560,720,920].forEach((f,j)=>tone(f,.3,"triangle",.06,.08+j*.07));return}
  if(name==="win"){[440,550,660].forEach((f,j)=>tone(f,.12,"triangle",.05,j*.05));return}
  if(name==="big"){[330,440,550,660,880,1100].forEach((f,j)=>tone(f,.25,"triangle",.06,j*.055))}
}
function later(fn,ms){const id=setTimeout(fn,ms);spinTimers.push(id);return id}
function clearSpinTimers(){
  spinTimers.forEach(clearTimeout);spinTimers=[];
  reelIntervals.forEach(clearInterval);reelIntervals=[];
}
function toast(msg){
  clearTimeout(toastTimer);dom.toast.textContent=msg;dom.toast.classList.add("show");
  toastTimer=setTimeout(()=>dom.toast.classList.remove("show"),1900);
}
function showRuntimeError(message){
  try{
    dom.runtimeError.hidden=false;
    dom.runtimeErrorText.textContent=String(message||"Unexpected browser error.");
  }catch{}
}
window.addEventListener("error",e=>showRuntimeError(e.message));
window.addEventListener("unhandledrejection",e=>showRuntimeError(e.reason?.message||e.reason||"Unhandled game error"));

function symbolPool(reel,inFeature){
  const ids=Object.keys(SYMBOLS).filter(id=>{
    if(inFeature&&id==="SAW")return false;
    if(id==="WILD"&&(reel===0||reel===4))return false;
    return true;
  });
  let total=0;
  for(const id of ids){
    let w=SYMBOLS[id].w;
    if(inFeature&&id==="HAT")w*=1.35;
    total+=w;
  }
  let pick=Math.random()*total;
  for(const id of ids){
    let w=SYMBOLS[id].w;
    if(inFeature&&id==="HAT")w*=1.35;
    pick-=w;if(pick<=0)return id;
  }
  return "T";
}
function rollGrid(inFeature=false){
  return Array.from({length:5},(_,c)=>Array.from({length:3},()=>symbolPool(c,inFeature)));
}
function positions(grid,id){
  const out=[];
  for(let c=0;c<5;c++)for(let r=0;r<3;r++)if(grid[c][r]===id)out.push(c*3+r);
  return out;
}
function count(grid,id){return positions(grid,id).length}

function svgPigGreen(){
return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="pgf" cx=".34" cy=".25"><stop offset="0" stop-color="#ffd9e2"/><stop offset=".55" stop-color="#f2aabc"/><stop offset="1" stop-color="#ca6f8b"/></radialGradient><linearGradient id="pgs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7bd05d"/><stop offset="1" stop-color="#2e7d35"/></linearGradient></defs><path d="M18 88c4-24 17-35 32-35 16 0 28 11 33 35Z" fill="url(#pgs)" stroke="#225e2a" stroke-width="3"/><path d="M24 82h53" stroke="#b9ee91" stroke-width="3" opacity=".65"/><circle cx="50" cy="42" r="27" fill="url(#pgf)" stroke="#a95070" stroke-width="3.5"/><path d="M30 31 22 16l19 9M70 31l8-15-19 9" fill="#db7896" stroke="#a95070" stroke-width="2.4"/><ellipse cx="50" cy="53" rx="16" ry="11" fill="#ffc8d6" stroke="#d77c98" stroke-width="2"/><ellipse cx="44" cy="53" rx="2.6" ry="3.3" fill="#7c4359"/><ellipse cx="56" cy="53" rx="2.6" ry="3.3" fill="#7c4359"/><circle cx="40" cy="41" r="3.4" fill="#16201e"/><circle cx="60" cy="41" r="3.4" fill="#16201e"/><circle cx="39" cy="40" r="1" fill="#fff"/><circle cx="59" cy="40" r="1" fill="#fff"/><path d="M31 27c7-15 30-17 39-4l-3 9H33Z" fill="#65c34f" stroke="#286f32" stroke-width="2.5"/><path d="M29 31h43" stroke="#95e26f" stroke-width="3"/><path d="M58 70h19c9 0 13 8 8 14H55Z" fill="#45a746" stroke="#28672b" stroke-width="3"/><circle cx="77" cy="76" r="7.5" fill="#b8e79b" stroke="#2e7130" stroke-width="2"/><circle cx="77" cy="76" r="2.5" fill="#3b7b37"/></svg>';
}
function svgPigBlue(){
return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="pbf" cx=".34" cy=".25"><stop offset="0" stop-color="#ffd8e1"/><stop offset=".56" stop-color="#efa6b9"/><stop offset="1" stop-color="#c76d88"/></radialGradient><linearGradient id="pbs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4e91dd"/><stop offset="1" stop-color="#275d9a"/></linearGradient></defs><path d="M17 88c5-23 17-35 33-35s28 12 34 35Z" fill="url(#pbs)" stroke="#1d4d82" stroke-width="3"/><path d="m34 61 16 10 16-10 9 27H25Z" fill="#d94a40" stroke="#8b2a2a" stroke-width="2.5"/><circle cx="50" cy="42" r="27" fill="url(#pbf)" stroke="#a95070" stroke-width="3.5"/><path d="M30 31 22 16l19 9M70 31l8-15-19 9" fill="#d87894" stroke="#a95070" stroke-width="2.4"/><ellipse cx="50" cy="53" rx="16" ry="11" fill="#ffc8d6" stroke="#d77c98" stroke-width="2"/><ellipse cx="44" cy="53" rx="2.6" ry="3.3" fill="#794057"/><ellipse cx="56" cy="53" rx="2.6" ry="3.3" fill="#794057"/><circle cx="40" cy="41" r="3.4" fill="#16201e"/><circle cx="60" cy="41" r="3.4" fill="#16201e"/><circle cx="39" cy="40" r="1" fill="#fff"/><circle cx="59" cy="40" r="1" fill="#fff"/><path d="M30 28c6-16 31-18 40-4v9H30Z" fill="#4389d6" stroke="#225b97" stroke-width="2.5"/><path d="M28 31h45" stroke="#7eb3ec" stroke-width="3"/><path d="M48 71h4v17h-4z" fill="#f4e4bc"/><circle cx="50" cy="77" r="3" fill="#2e588a"/></svg>';
}
function svgTape(){
return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffad49"/><stop offset=".52" stop-color="#e5722d"/><stop offset="1" stop-color="#8e3d1d"/></linearGradient><radialGradient id="tr" cx=".35" cy=".3"><stop offset="0" stop-color="#a77fc4"/><stop offset="1" stop-color="#55326e"/></radialGradient></defs><path d="M18 32 34 19h38l13 16v37L71 85H33L17 69Z" fill="url(#tg)" stroke="#6d2d16" stroke-width="4"/><path d="M25 35 38 25h31l9 11" fill="none" stroke="#ffc078" stroke-width="3" opacity=".8"/><circle cx="51" cy="52" r="21" fill="url(#tr)" stroke="#45265e" stroke-width="3"/><circle cx="51" cy="52" r="10" fill="#d8b7ec" stroke="#6b4682" stroke-width="2"/><path d="M82 61h15v8H82Z" fill="#f8dc54" stroke="#8e721f" stroke-width="2"/><path d="M86 65h8" stroke="#654f13" stroke-width="1.5"/><path d="M31 75h18" stroke="#7e351c" stroke-width="3" opacity=".7"/></svg>';
}
function svgTool(){
return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="tb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8c979"/><stop offset="1" stop-color="#9f7439"/></linearGradient></defs><path d="M18 45h64v38H18Z" fill="url(#tb)" stroke="#684a25" stroke-width="4"/><path d="M26 44c3-15 12-20 24-20s21 5 24 20" fill="none" stroke="#664725" stroke-width="6"/><path d="M19 58h63" stroke="#75532a" stroke-width="4"/><path d="m31 28 10 31" stroke="#edf3f5" stroke-width="6" stroke-linecap="round"/><path d="m67 21-18 37" stroke="#d84a3f" stroke-width="6" stroke-linecap="round"/><path d="M64 24 80 16" stroke="#bbc6ca" stroke-width="8" stroke-linecap="round"/><path d="m49 36 17 21" stroke="#5a8dbb" stroke-width="6" stroke-linecap="round"/><path d="M26 68h47" stroke="#cfab69" stroke-width="3" opacity=".8"/><rect x="46" y="61" width="9" height="10" rx="2" fill="#705026"/></svg>';
}
function svgHat(){
return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff48a"/><stop offset=".48" stop-color="#ffd64e"/><stop offset="1" stop-color="#d98713"/></linearGradient><radialGradient id="hp" cx=".35" cy=".3"><stop offset="0" stop-color="#ffd3dc"/><stop offset="1" stop-color="#e88ea7"/></radialGradient></defs><path d="M18 62c1-29 17-45 32-45 17 0 32 16 34 45Z" fill="url(#hg)" stroke="#8d510b" stroke-width="4"/><path d="M28 55c2-18 11-30 22-32" fill="none" stroke="#fff7ac" stroke-width="3" opacity=".8"/><rect x="11" y="60" width="78" height="13" rx="6.5" fill="#e69b1f" stroke="#8d510b" stroke-width="4"/><circle cx="50" cy="50" r="13" fill="url(#hp)" stroke="#c7738c" stroke-width="2"/><ellipse cx="50" cy="53" rx="7" ry="5" fill="#ffc0cf"/><circle cx="47" cy="53" r="1.5" fill="#8b4d61"/><circle cx="53" cy="53" r="1.5" fill="#8b4d61"/><circle cx="45" cy="47" r="1.5" fill="#202827"/><circle cx="55" cy="47" r="1.5" fill="#202827"/></svg>';
}
function svgSaw(){
return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="sg" cx=".34" cy=".28"><stop offset="0" stop-color="#f8fcfd"/><stop offset=".5" stop-color="#b8c5c9"/><stop offset="1" stop-color="#667275"/></radialGradient></defs><g transform="translate(50 50)"><path d="M0-39 8-31 18-36 22-25 34-23 29-11 40 0 29 11 34 23 22 25 18 36 8 31 0 39-8 31-18 36-22 25-34 23-29 11-40 0-29-11-34-23-22-25-18-36-8-31Z" fill="url(#sg)" stroke="#4d575a" stroke-width="3"/><circle r="23" fill="none" stroke="#edf4f5" stroke-width="3" opacity=".65"/><circle r="16" fill="#879397" stroke="#566164" stroke-width="3"/><circle r="8" fill="#f09a35" stroke="#874812" stroke-width="3"/><circle r="2.4" fill="#3a4042"/><path d="M-29 0h11M18 0h11M0-29v11M0 18v11" stroke="#dae3e5" stroke-width="2" opacity=".75"/></g></svg>';
}
function svgWolf(){
return '<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7f8790"/><stop offset="1" stop-color="#42474d"/></linearGradient></defs><path d="M15 29 35 36 50 15 65 36 85 29 77 56 68 77 50 88 32 77 23 56Z" fill="url(#wg)" stroke="#23272c" stroke-width="4"/><path d="M29 36 18 16l24 13M71 36l11-20-24 13" fill="#4d5158" stroke="#23272c" stroke-width="3"/><path d="m31 47 15 3-14 9M69 47l-15 3 14 9" fill="#c0f3ff" stroke="#213036" stroke-width="1.5"/><circle cx="39" cy="51" r="2" fill="#071014"/><circle cx="61" cy="51" r="2" fill="#071014"/><path d="m40 65 10 10 10-10" fill="#171a1d"/><path d="M36 71q14 10 28 0" fill="none" stroke="#24282b" stroke-width="3"/><path d="M32 39q18-11 36 0" fill="none" stroke="#aab0b6" stroke-width="2" opacity=".45"/></svg>';
}
function rankHTML(id){return '<div class="symbol"><div class="rank '+id.toLowerCase()+'">'+SYMBOLS[id].label+'</div></div>'}
function symbolHTML(id){
  if(SYMBOLS[id].kind==="rank")return rankHTML(id);
  const map={PG:svgPigGreen,PB:svgPigBlue,TAPE:svgTape,TOOL:svgTool,HAT:svgHat,SAW:svgSaw,WILD:svgWolf};
  return '<div class="symbol">'+map[id]()+'</div>';
}
function frameClass(level){return level===1?"frame-straw":level===2?"frame-wood":level===3?"frame-brick":""}
function currentFrames(){return state.feature?.frames||Array(15).fill(0)}
function renderGrid(grid,winCells=[]){
  state.grid=grid;
  const winSet=new Set(winCells.map(([c,r])=>c+"_"+r));
  const frames=currentFrames();
  dom.reels.innerHTML="";
  for(let c=0;c<5;c++){
    const reel=document.createElement("div");reel.className="reel";reel.dataset.reel=String(c);
    for(let r=0;r<3;r++){
      const idx=c*3+r,cell=document.createElement("div");
      cell.className="cell "+frameClass(frames[idx]);
      if(winSet.has(c+"_"+r))cell.classList.add("win");
      if(grid[c][r]==="SAW")cell.classList.add("scatter");
      cell.dataset.pos=String(idx);cell.dataset.symbol=grid[c][r];cell.innerHTML=symbolHTML(grid[c][r]);
      reel.appendChild(cell);
    }
    dom.reels.appendChild(reel);
  }
}
function updateReel(c,col,cls=""){
  const reel=dom.reels.children[c];if(!reel)return;
  reel.className="reel "+cls;
  const frames=currentFrames();
  [...reel.children].forEach((cell,r)=>{
    const idx=c*3+r;cell.className="cell "+frameClass(frames[idx]);cell.dataset.symbol=col[r];cell.innerHTML=symbolHTML(col[r]);
    if(col[r]==="SAW")cell.classList.add("scatter");
  });
}
function syncMeters(){
  const jp=jackpots();
  dom.balance.textContent=fmt(state.balance);dom.walletBalance.textContent=fmt(state.balance);dom.winValue.textContent=fmt(state.lastWin);dom.betValue.textContent=fmt(bet());
  dom.jpMini.textContent=fmt(jp.mini);dom.jpMinor.textContent=fmt(jp.minor);dom.jpMajor.textContent=fmt(jp.major);dom.jpGrand.textContent=fmt(jp.grand);
  dom.turboBtn.classList.toggle("active",state.turbo);dom.turboBtn.textContent=state.turbo?"TURBO ON":"TURBO";
  dom.autoBtn.classList.toggle("active",state.autoLeft>0);dom.autoBtn.textContent=state.autoLeft>0?"AUTO "+state.autoLeft:"AUTO";
  dom.betMinus.disabled=state.mode!=="READY";dom.betPlus.disabled=state.mode!=="READY";
  dom.spinBtn.disabled=!["READY","SPINNING","FEATURE"].includes(state.mode);
  dom.spinBtn.classList.toggle("stop",state.mode==="SPINNING");
  dom.spinLabel.textContent=state.mode==="SPINNING"?"STOP":state.mode==="FEATURE"&&state.feature?String(state.feature.spinsLeft)+" FREE":"SPIN";
  save();
}
function setStatus(text){dom.statusCopy.textContent=text}
function setFeatureLabel(text){
  dom.featureLabel.hidden=!text;dom.featureLabel.textContent=text||"";
}

function evaluateWays(grid){
  let total=0;const winCells=[];const winCellSet=new Set();
  for(const id of PAY_IDS){
    let ways=1,length=0;
    for(let c=0;c<5;c++){
      let matches=0;
      for(let r=0;r<3;r++)if(grid[c][r]===id||grid[c][r]==="WILD")matches++;
      if(matches===0)break;
      ways*=matches;length++;
    }
    if(length>=3){
      const mult=SYMBOLS[id].pay[length-3]||0;
      const win=bet()*mult*ways/20;
      total+=win;
      for(let c=0;c<length;c++)for(let r=0;r<3;r++)if(grid[c][r]===id||grid[c][r]==="WILD"){
        const key=c+"_"+r;if(!winCellSet.has(key)){winCellSet.add(key);winCells.push([c,r])}
      }
    }
  }
  return {win:Math.round(total*100)/100,cells:winCells};
}
function credit(amount,showBig=true){
  amount=Math.round((Number(amount)||0)*100)/100;if(amount<=0)return;
  state.balance+=amount;state.totalWon+=amount;state.lastWin=amount;state.biggest=Math.max(state.biggest,amount);state.hits++;
  if(showBig&&amount>=bet()*8){toast("BIG WIN • "+fmt(amount)+" credits");sfx("big")}else sfx("win");
  syncMeters();
}
function rollAndAnimate(){
  finalGrid=rollGrid(!!state.feature);spinResolved=false;clearSpinTimers();sfx("spin");
  const base=state.turbo?150:430,step=state.turbo?70:145;
  for(let c=0;c<5;c++){
    const reel=dom.reels.children[c];reel.classList.add("spinning");
    const id=setInterval(()=>updateReel(c,[symbolPool(c,!!state.feature),symbolPool(c,!!state.feature),symbolPool(c,!!state.feature)],"spinning"),state.turbo?48:72);
    reelIntervals[c]=id;
    later(()=>landReel(c),base+c*step);
  }
  if(!state.feature){
    later(()=>{
      const first3=finalGrid.slice(0,3).flat().filter(v=>v==="SAW").length;
      if(first3>=2){dom.anticipationGlow.classList.add("on");setStatus("Two Buzz Saws landed… watch the final reels!")}
    },base+step*2);
  }
}
function startSpin(){
  if(state.mode==="SPINNING"){quickStop();return}
  if(state.mode==="READY"){
    if(state.balance<bet()){toast("Not enough free-play credits.");return}
    state.balance-=bet();state.totalWagered+=bet();state.paidSpins++;state.spins++;state.lastWin=0;state.mode="SPINNING";
    syncMeters();setStatus("SPINNING…");rollAndAnimate();return;
  }
  if(state.mode==="FEATURE"&&state.feature){
    state.spins++;state.lastWin=0;state.mode="SPINNING";syncMeters();setStatus(FRAME_NAMES[Math.max(...state.feature.frames)]+" FRAMES • "+state.feature.spinsLeft+" free spins left");rollAndAnimate();
  }
}
function landReel(c){
  if(reelIntervals[c])clearInterval(reelIntervals[c]);
  updateReel(c,finalGrid[c],"landing");sfx("stop",c);
  if(c===4)later(resolveSpin,state.turbo?70:170);
}
function quickStop(){
  if(state.mode!=="SPINNING"||spinResolved||!finalGrid)return;
  clearSpinTimers();
  for(let c=0;c<5;c++)updateReel(c,finalGrid[c],"landing");
  later(resolveSpin,60);
}
function resolveSpin(){
  if(spinResolved)return;spinResolved=true;clearSpinTimers();dom.anticipationGlow.classList.remove("on");
  const result=evaluateWays(finalGrid);
  renderGrid(finalGrid,result.cells);
  if(result.win>0)credit(result.win,result.win>=bet()*8);else syncMeters();
  if(state.feature){resolveFeatureSpin(result);return}
  const hats=positions(finalGrid,"HAT"),saws=positions(finalGrid,"SAW");
  if(saws.length>=3&&hats.length>=6){
    state.pendingFree=hats.slice();state.pendingSaw=saws.slice();state.mode="WHEEL";syncMeters();setStatus("POWER WHEEL first — Free Spins are waiting behind it.");later(()=>startWheel(saws),state.turbo?280:720);return;
  }
  if(saws.length>=3){state.pendingSaw=saws.slice();state.mode="WHEEL";syncMeters();setStatus("3+ Buzz Saws • Power Wheel!");later(()=>startWheel(saws),state.turbo?280:720);return}
  if(hats.length>=6){state.mode="FEATURE";syncMeters();setStatus("6+ Hard Hats • 6 Free Spins!");later(()=>startFeature("free",hats),state.turbo?280:720);return}
  state.mode="READY";syncMeters();setStatus(result.win>0?"WAYS WIN • "+fmt(result.win)+" credits":"6+ Hard Hats = Free Spins • 3+ Buzz Saws = Power Wheel");scheduleAuto();
}
function scheduleAuto(){
  if(state.autoLeft>0&&state.mode==="READY"){state.autoLeft--;syncMeters();later(startSpin,state.turbo?180:560)}
}

function featureName(type){
  return type==="buzz"?"BUZZ SAW FEATURE":type==="mega"?"MEGA HAT FEATURE":type==="mansion"?"MANSION FEATURE":"FREE SPINS";
}
function startFeature(type,seedPositions=[]){
  clearSpinTimers();
  const frames=Array(15).fill(0);
  if(type==="free")seedPositions.forEach(p=>frames[p]=Math.max(frames[p],1));
  if(type==="buzz"){
    seedPositions.forEach(p=>{
      const c=Math.floor(p/3),r=p%3;
      for(let cc=c;cc<5;cc++)frames[cc*3+r]=Math.max(frames[cc*3+r],1);
    });
  }
  if(type==="mega"){
    const shapes=[[2,2],[3,3],[5,3]],shape=shapes[Math.floor(Math.random()*shapes.length)];
    const w=shape[0],h=shape[1],startC=Math.floor(Math.random()*(6-w)),startR=Math.floor(Math.random()*(4-h));
    for(let c=startC;c<startC+w;c++)for(let r=startR;r<startR+h;r++)frames[c*3+r]=1;
  }
  if(type==="mansion"){
    const picks=[...Array(15).keys()].sort(()=>Math.random()-.5).slice(0,5);
    picks.forEach(p=>frames[p]=3);seedPositions.forEach(p=>frames[p]=3);
  }
  state.feature={type,spinsLeft:6,total:6,frames,spinWin:0,houseWin:0};
  state.mode="FEATURE";setFeatureLabel(featureName(type));renderGrid(state.grid||rollGrid(true));syncMeters();sfx("feature");
  showIntro(featureName(type),type==="mansion"?"Brick Frames from the start":type==="mega"?"A giant Hard Hat seeds the grid":type==="buzz"?"Buzz Saws cut Straw Frames across the reels":"6 Free Spins • Hard Hats build the frames");
  later(()=>{hideIntro();startSpin()},state.turbo?650:1550);
}
function resolveFeatureSpin(result){
  const f=state.feature;if(!f)return;
  f.spinWin+=result.win;
  const hats=positions(finalGrid,"HAT");
  hats.forEach(p=>{
    if(f.type==="mansion")f.frames[p]=3;
    else f.frames[p]=Math.min(3,f.frames[p]+1);
  });
  if(hats.length>=3){f.spinsLeft++;f.total++;toast("+1 FREE SPIN");sfx("hat")}
  f.spinsLeft--;
  state.mode="FEATURE";renderGrid(finalGrid,result.cells);syncMeters();
  if(f.spinsLeft<=0){later(endFeature,state.turbo?320:800);return}
  setStatus(featureName(f.type)+" • "+f.spinsLeft+" spins left • "+hats.length+" hats this spin");
  later(startSpin,state.turbo?170:520);
}
function frameReward(level){
  const jp=jackpots(),r=Math.random();
  if(level===1){const m=[2,3,4,5,8][Math.floor(Math.random()*5)];return {label:m+"×",amount:bet()*m}}
  if(level===2){
    if(r<.05)return {label:"MINI",amount:jp.mini};
    const m=[5,8,10,12,15][Math.floor(Math.random()*5)];return {label:m+"×",amount:bet()*m}
  }
  if(level===3){
    if(r<.008)return {label:"GRAND",amount:jp.grand};
    if(r<.035)return {label:"MAJOR",amount:jp.major};
    if(r<.11)return {label:"MINOR",amount:jp.minor};
    if(r<.22)return {label:"MINI",amount:jp.mini};
    const m=[15,20,25,30,40,50][Math.floor(Math.random()*6)];return {label:m+"×",amount:bet()*m}
  }
  return {label:"",amount:0};
}
function endFeature(){
  const f=state.feature;if(!f)return;
  const rewards=f.frames.map(frameReward);
  showReveal(f.frames,rewards);
  let total=0;
  rewards.forEach(v=>total+=v.amount);
  f.houseWin=total;
  const finalTotal=Math.round((f.spinWin+f.houseWin)*100)/100;
  later(()=>{
    if(total>0)credit(total,total>=bet()*8);
    dom.revealTotal.textContent=fmt(finalTotal);
  },state.turbo?450:1100);
  later(()=>{
    hideReveal();
    state.feature=null;
    setFeatureLabel("");
    if(state.pendingFree){
      const pending=state.pendingFree.slice();state.pendingFree=null;state.pendingSaw=null;startFeature("free",pending);return;
    }
    state.mode="READY";syncMeters();setStatus("FEATURE COMPLETE • "+fmt(finalTotal)+" total credits");scheduleAuto();
  },state.turbo?1500:3600);
}
function showIntro(title,sub){
  dom.featureKicker.textContent=title;dom.featureTitle.textContent=title==="FREE SPINS"?"BUILD THE HOUSES":"BUILD IT BIGGER";dom.featureSub.textContent=sub;
  dom.freeOverlay.hidden=false;
}
function hideIntro(){dom.freeOverlay.hidden=true}
function showReveal(frames,rewards){
  dom.revealGrid.innerHTML="";
  frames.forEach((level,i)=>{
    const cell=document.createElement("div");cell.className="reveal-cell "+(level===1?"straw":level===2?"wood":level===3?"brick":"");cell.textContent=level?FRAME_NAMES[level]:"";
    dom.revealGrid.appendChild(cell);
    if(level)later(()=>{cell.classList.add("revealed");cell.textContent=rewards[i].label||FRAME_NAMES[level]},(state.turbo?25:85)*i);
  });
  dom.revealTotal.textContent="0";dom.revealOverlay.hidden=false;sfx("feature");
}
function hideReveal(){dom.revealOverlay.hidden=true}

function renderWheel(){
  const deg=360/WHEEL.length;
  dom.bigWheel.style.background="conic-gradient("+WHEEL.map((p,i)=>p.color+" "+(i*deg)+"deg "+((i+1)*deg)+"deg").join(",")+")";
  dom.wheelLabels.innerHTML="";
  WHEEL.forEach((p,i)=>{
    const label=document.createElement("div");label.className="wheel-label";label.textContent=p.label;
    const angle=(i+.5)*deg-90,rad=angle*Math.PI/180,radius=38;
    label.style.left=(50+Math.cos(rad)*radius)+"%";label.style.top=(50+Math.sin(rad)*radius)+"%";
    dom.wheelLabels.appendChild(label);
  });
}
function pickWheel(){
  let total=WHEEL.reduce((a,p)=>a+p.weight,0),pick=Math.random()*total;
  for(let i=0;i<WHEEL.length;i++){pick-=WHEEL[i].weight;if(pick<=0)return i}
  return 0;
}
function startWheel(seedSaws=[]){
  state.mode="WHEEL";syncMeters();renderWheel();dom.wheelOverlay.hidden=false;sfx("feature");
  const idx=pickWheel(),seg=360/WHEEL.length,target=360*6+(360-(idx+.5)*seg);
  dom.bigWheel.style.transition="none";dom.bigWheel.style.transform="rotate(0deg)";void dom.bigWheel.offsetWidth;
  dom.bigWheel.style.transition=(state.turbo?"1.45s":"3.8s")+" cubic-bezier(.12,.76,.12,1)";dom.bigWheel.style.transform="rotate("+target+"deg)";
  setTimeout(()=>awardWheel(WHEEL[idx],seedSaws),state.turbo?1600:4050);
}
function awardWheel(outcome,seedSaws){
  if(outcome.type==="jackpot"){
    const amount=jackpots()[outcome.jp];credit(amount,true);toast(outcome.label+" • "+fmt(amount)+" credits");
    setTimeout(()=>{
      dom.wheelOverlay.hidden=true;
      if(state.pendingFree){const p=state.pendingFree.slice();state.pendingFree=null;state.pendingSaw=null;startFeature("free",p);return}
      state.mode="READY";syncMeters();setStatus(outcome.label+" AWARDED • "+fmt(amount)+" credits");scheduleAuto();
    },state.turbo?520:1100);return;
  }
  dom.wheelOverlay.hidden=true;
  startFeature(outcome.feature,seedSaws||state.pendingSaw||[]);
}
function showModal(which){
  dom.backdrop.hidden=false;dom.rulesModal.hidden=true;dom.statsModal.hidden=true;
  if(which==="rules"){dom.rulesModal.hidden=false}else{renderStats();dom.statsModal.hidden=false}
}
function closeModal(){dom.backdrop.hidden=true;dom.rulesModal.hidden=true;dom.statsModal.hidden=true}
function renderStats(){
  const rtp=state.totalWagered>0?(state.totalWon/state.totalWagered*100).toFixed(1)+"%":"—";
  const hit=state.spins>0?(state.hits/state.spins*100).toFixed(1)+"%":"—";
  const rows=[["TOTAL SPINS",state.spins],["PAID SPINS",state.paidSpins],["TOTAL WAGERED",fmt(state.totalWagered)],["TOTAL WON",fmt(state.totalWon)],["SESSION RTP",rtp],["HIT RATE",hit],["BIGGEST WIN",fmt(state.biggest)],["BALANCE",fmt(state.balance)]];
  dom.statsGrid.innerHTML=rows.map(([k,v])=>'<div class="stat-card"><small>'+k+'</small><strong>'+v+'</strong></div>').join("");
}
function renderPaytable(){
  const rows=[["10",.15,.35,.8],["J",.18,.45,1],["Q",.22,.55,1.2],["K",.28,.7,1.5],["A",.35,.9,1.9],["Tape",.55,1.4,3],["Toolbox",.7,1.8,4],["Pig",1,2.8,7],["Foreman",1.4,4,10]];
  dom.paytable.innerHTML='<div class="pay-row"><b>SYMBOL</b><span>3</span><span>4</span><span>5</span></div>'+rows.map(r=>'<div class="pay-row"><b>'+r[0]+'</b><span>'+r[1]+'×</span><span>'+r[2]+'×</span><span>'+r[3]+'×</span></div>').join("");
}
function toggleAuto(){
  if(state.autoLeft>0){state.autoLeft=0;syncMeters();return}
  if(state.mode!=="READY"){toast("Start Auto from the base game.");return}
  state.autoLeft=24;syncMeters();startSpin();
}
function fullscreen(){try{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.()}catch{}}
function initEvents(){
  dom.spinBtn.addEventListener("click",()=>state.mode==="SPINNING"?quickStop():startSpin());
  dom.betMinus.addEventListener("click",()=>{if(state.mode!=="READY")return;state.betIndex=Math.max(0,state.betIndex-1);syncMeters()});
  dom.betPlus.addEventListener("click",()=>{if(state.mode!=="READY")return;state.betIndex=Math.min(BETS.length-1,state.betIndex+1);syncMeters()});
  dom.autoBtn.addEventListener("click",toggleAuto);
  dom.turboBtn.addEventListener("click",()=>{state.turbo=!state.turbo;syncMeters();toast(state.turbo?"Turbo on":"Turbo off")});
  dom.rulesBtn.addEventListener("click",()=>showModal("rules"));dom.featureInfo.addEventListener("click",()=>showModal("rules"));
  dom.statsBtn.addEventListener("click",()=>showModal("stats"));
  dom.soundBtn.addEventListener("click",()=>{state.sound=!state.sound;dom.soundBtn.textContent=state.sound?"◖":"×";save();toast(state.sound?"Sound on":"Muted")});
  dom.fullBtn.addEventListener("click",fullscreen);
  dom.brandHome.addEventListener("click",closeModal);
  dom.backdrop.addEventListener("click",closeModal);document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",closeModal));
  dom.reloadBtn.addEventListener("click",()=>location.reload());
  window.addEventListener("keydown",e=>{
    if(e.code==="Escape"){closeModal();return}
    if(e.code==="Space"&&!["BUTTON","INPUT"].includes(document.activeElement?.tagName)){e.preventDefault();state.mode==="SPINNING"?quickStop():startSpin()}
  });
}
function boot(){
  try{
    load();
    Object.assign(dom,{
      brandHome:$("brandHome"),rulesBtn:$("rulesBtn"),statsBtn:$("statsBtn"),soundBtn:$("soundBtn"),fullBtn:$("fullBtn"),
      walletBalance:$("walletBalance"),jpMinor:$("jpMinor"),jpGrand:$("jpGrand"),jpMajor:$("jpMajor"),jpMini:$("jpMini"),
      featureInfo:$("featureInfo"),reels:$("reels"),anticipationGlow:$("anticipationGlow"),featureLabel:$("featureLabel"),
      betMinus:$("betMinus"),spinBtn:$("spinBtn"),spinLabel:$("spinLabel"),betPlus:$("betPlus"),autoBtn:$("autoBtn"),turboBtn:$("turboBtn"),
      balance:$("balance"),winValue:$("winValue"),betValue:$("betValue"),statusCopy:$("statusCopy"),
      backdrop:$("modalBackdrop"),rulesModal:$("rulesModal"),statsModal:$("statsModal"),paytable:$("paytable"),statsGrid:$("statsGrid"),
      wheelOverlay:$("wheelOverlay"),bigWheel:$("bigWheel"),wheelLabels:$("wheelLabels"),
      freeOverlay:$("freeOverlay"),featureKicker:$("featureKicker"),featureTitle:$("featureTitle"),featureSub:$("featureSub"),
      revealOverlay:$("revealOverlay"),revealGrid:$("revealGrid"),revealTotal:$("revealTotal"),
      toast:$("toast"),runtimeError:$("runtimeError"),runtimeErrorText:$("runtimeErrorText"),reloadBtn:$("reloadBtn")
    });
    const required=["reels","spinBtn","balance","wheelOverlay","freeOverlay","revealOverlay","runtimeError"];
    required.forEach(k=>{if(!dom[k])throw new Error("Missing UI element: "+k)});
    state.grid=rollGrid(false);renderGrid(state.grid);renderWheel();renderPaytable();syncMeters();initEvents();
    setStatus("6+ Hard Hats = Free Spins • 3+ Buzz Saws = Power Wheel");
    dom.runtimeError.hidden=true;
    window.__gameReady=true;window.__game=state;window.__testFeature=(type)=>startFeature(type,positions(state.grid,"HAT"));
  }catch(err){
    console.error(err);showRuntimeError(err.stack||err.message||err);
  }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();