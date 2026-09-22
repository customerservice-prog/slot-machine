"use strict";
(() => {
const CORE=window.PinedaCore;
if(!CORE) throw new Error("PinedaCore failed to load");
CORE.selfTest();
const STORAGE="pineda_power_huff_v1";
const BETS=[1,2,5,10,25,50,100];
const FRAME_NAMES=["","STRAW","WOOD","BRICK"];
const SYMBOLS={
  T:{label:"10",pay:[.15,.35,.8],w:8,kind:"rank"},
  J:{label:"J",pay:[.18,.45,1],w:7,kind:"rank"},
  Q:{label:"Q",pay:[.22,.55,1.2],w:6.5,kind:"rank"},
  K:{label:"K",pay:[.28,.7,1.5],w:6,kind:"rank"},
  A:{label:"A",pay:[.35,.9,1.9],w:6,kind:"rank"},
  TAPE:{label:"TAPE",pay:[.55,1.4,3],w:6,kind:"tool"},
  TOOL:{label:"TOOLBOX",pay:[.7,1.8,4],w:5.5,kind:"tool"},
  PG:{label:"PIG",pay:[1,2.8,7],w:4.2,kind:"pig"},
  PB:{label:"FOREMAN",pay:[1.4,4,10],w:3.3,kind:"pig"},
  WILD:{label:"WILD",pay:[2,6,18],w:1.6,kind:"wild"},
  HAT:{label:"HARD HAT",pay:[0,0,0],w:3.4,kind:"hat"},
  SAW:{label:"BUZZ SAW",pay:[0,0,0],w:1.7,kind:"saw"}
};
const PAY_IDS=["T","J","Q","K","A","TAPE","TOOL","PG","PB"];
const PAY_TABLE=Object.fromEntries(PAY_IDS.map(id=>[id,SYMBOLS[id].pay]));
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
  {label:"MINI",type:"jackpot",jp:"mini",color:"#d64aa8",weight:18},
  {label:"BUZZ SAW",type:"feature",feature:"buzz",color:"#2798d5",weight:15},
  {label:"20 FREE",type:"free",spins:20,color:"#43a94a",weight:13},
  {label:"MEGA HAT",type:"feature",feature:"mega",color:"#f1b43c",weight:15},
  {label:"MANSION",type:"feature",feature:"mansion",color:"#9a4ac4",weight:10},
  {label:"MINOR",type:"jackpot",jp:"minor",color:"#46a544",weight:16},
  {label:"MAJOR",type:"jackpot",jp:"major",color:"#e64b34",weight:6},
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
function positions(grid,id){return CORE.positions(grid,id)}
function count(grid,id){return positions(grid,id).length}

const ART={
  PG:"/assets/pig-green-v10.svg",
  PB:"/assets/pig-blue-v10.svg",
  TAPE:"/assets/tape-v10.svg",
  TOOL:"/assets/toolbox-v10.svg",
  HAT:"/assets/hardhat-v4.svg",
  SAW:"/assets/saw-v4.svg",
  WILD:"/assets/wolf-v10.svg"
};
function rankHTML(id){
  return '<div class="symbol rank-symbol"><div class="rank '+id.toLowerCase()+'">'+SYMBOLS[id].label+'</div><span class="rank-shine"></span></div>';
}
function symbolHTML(id){
  if(SYMBOLS[id].kind==="rank") return rankHTML(id);
  const src=ART[id];
  const extra=id==="HAT"?" hat-symbol":id==="SAW"?" saw-symbol":id==="WILD"?" wild-symbol":"";
  return '<div class="symbol art-symbol'+extra+'"><img class="symbol-art" src="'+src+'" alt="" draggable="false"><span class="symbol-sheen"></span></div>';
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

function featureHudMeta(type){
  return type==="buzz"?{label:"BUZZ SAW FEATURE",icon:"/assets/saw-v4.svg"}:
    type==="mega"?{label:"MEGA HAT FEATURE",icon:"/assets/hardhat-v4.svg"}:
    type==="mansion"?{label:"MANSION FEATURE",icon:"/assets/pig-blue-v10.svg"}:
    {label:"FREE SPINS",icon:"/assets/hardhat-v4.svg"};
}
function showFeatureHud(type){
  const m=featureHudMeta(type);
  if(dom.featureModeBanner){dom.featureModeBanner.hidden=false;dom.featureBannerText.textContent=m.label;dom.featureBannerIcon.src=m.icon}
  if(dom.bonusWinPanel){dom.bonusWinPanel.hidden=false;dom.bonusWinValue.textContent="0"}
  document.querySelector(".cabinet-meter")?.classList.add("feature-running");
}
function updateFeatureHud(amount){
  if(dom.bonusWinValue)dom.bonusWinValue.textContent=fmt(amount||0);
}
function hideFeatureHud(){
  if(dom.featureModeBanner)dom.featureModeBanner.hidden=true;
  if(dom.bonusWinPanel)dom.bonusWinPanel.hidden=true;
  document.querySelector(".cabinet-meter")?.classList.remove("feature-running");
}

function evaluateWays(grid){
  return CORE.evaluateWays(grid,bet(),PAY_TABLE);
}
function credit(amount,showBig=true){
  amount=Math.round((Number(amount)||0)*100)/100;if(amount<=0)return;
  state.balance+=amount;state.totalWon+=amount;state.lastWin=amount;state.biggest=Math.max(state.biggest,amount);state.hits++;
  if(showBig&&amount>=bet()*8){
    toast("BIG WIN • "+fmt(amount)+" credits");sfx("big");
    document.querySelector(".game-cabinet")?.classList.add("big-win");
    setTimeout(()=>document.querySelector(".game-cabinet")?.classList.remove("big-win"),state.turbo?500:1200);
  }else sfx("win");
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
      if(first3>=2){
        dom.anticipationGlow.classList.add("on");
        dom.reels.children[3]?.classList.add("anticipate");
        dom.reels.children[4]?.classList.add("anticipate");
        setStatus("Two Buzz Saws landed… watch the final reels!");
      }
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
  updateReel(c,finalGrid[c],"landing land-"+c);sfx("stop",c);
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
  [...dom.reels.children].forEach(r=>r.classList.remove("anticipate"));
  const result=evaluateWays(finalGrid);
  renderGrid(finalGrid,result.cells);
  if(result.win>0)credit(result.win,result.win>=bet()*8);else syncMeters();
  if(state.feature){resolveFeatureSpin(result);return}
  const triggers=CORE.classifyTriggers(finalGrid),hats=triggers.hats,saws=triggers.saws;
  if(triggers.wheel&&triggers.free){
    state.pendingFree=hats.slice();state.pendingSaw=saws.slice();state.mode="WHEEL";syncMeters();setStatus("POWER WHEEL first — Free Spins are waiting behind it.");later(()=>startWheel(saws),state.turbo?280:720);return;
  }
  if(triggers.wheel){state.pendingSaw=saws.slice();state.mode="WHEEL";syncMeters();setStatus("3+ Buzz Saws • Power Wheel!");later(()=>startWheel(saws),state.turbo?280:720);return}
  if(triggers.free){state.mode="FEATURE";syncMeters();setStatus("6+ Hard Hats • 6 Free Spins!");later(()=>startFeature("free",hats,6),state.turbo?280:720);return}
  state.mode="READY";syncMeters();setStatus(result.win>0?"WAYS WIN • "+fmt(result.win)+" credits":"6+ Hard Hats = Free Spins • 3+ Buzz Saws = Power Wheel");scheduleAuto();
}
function scheduleAuto(){
  if(state.autoLeft>0&&state.mode==="READY"){state.autoLeft--;syncMeters();later(startSpin,state.turbo?180:560)}
}

function featureName(type){
  return type==="buzz"?"BUZZ SAW FEATURE":type==="mega"?"MEGA HAT FEATURE":type==="mansion"?"MANSION FEATURE":"FREE SPINS";
}
function startFeature(type,seedPositions=[],spinCount=6){
  clearSpinTimers();
  const frames=CORE.createFeatureFrames(type,seedPositions);
  state.feature={type,spinsLeft:spinCount,total:spinCount,frames,spinWin:0,houseWin:0};
  document.querySelector(".game-cabinet")?.setAttribute("data-feature",type);
  showFeatureHud(type);
  state.mode="FEATURE";setFeatureLabel(featureName(type));renderGrid(state.grid||rollGrid(true));syncMeters();sfx("feature");
  const intro=type==="mansion"?"Brick Frames from the start":type==="mega"?"A giant Hard Hat seeds the grid":type==="buzz"?"Buzz Saws cut Straw Frames across the reels":spinCount+" Free Spins • Hard Hats build the frames";
  showIntro(featureName(type),intro);
  later(()=>{hideIntro();startSpin()},state.turbo?650:1550);
}
function resolveFeatureSpin(result){
  const f=state.feature;if(!f)return;
  f.spinWin+=result.win;
  updateFeatureHud(f.spinWin+f.houseWin);
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
  return CORE.frameReward(level,bet(),jackpots());
}
function endFeature(){
  const f=state.feature;if(!f)return;
  const rewards=f.frames.map(frameReward);
  showReveal(f.frames,rewards);
  let total=0;
  rewards.forEach(v=>total+=v.amount);
  f.houseWin=total;
  const finalTotal=Math.round((f.spinWin+f.houseWin)*100)/100;
  updateFeatureHud(finalTotal);
  later(()=>{
    if(total>0)credit(total,total>=bet()*8);
    let n=0,steps=state.turbo?8:28,step=Math.max(1,finalTotal/steps);
    const counter=setInterval(()=>{n=Math.min(finalTotal,n+step);dom.revealTotal.textContent=fmt(n);if(n>=finalTotal)clearInterval(counter)},state.turbo?18:35);
  },state.turbo?450:1100);
  later(()=>{
    hideReveal();
    state.feature=null;
    document.querySelector(".game-cabinet")?.removeAttribute("data-feature");
    hideFeatureHud();
    setFeatureLabel("");
    if(state.pendingFree){
      const pending=state.pendingFree.slice();state.pendingFree=null;state.pendingSaw=null;startFeature("free",pending);return;
    }
    state.mode="READY";syncMeters();setStatus("FEATURE COMPLETE • "+fmt(finalTotal)+" total credits");scheduleAuto();
  },state.turbo?1500:3600);
}
function showIntro(title,sub){
  const type=state.feature?.type||"free";
  const art=document.querySelector(".feature-wolf img");
  if(art){
    art.src=type==="buzz"?"/assets/saw-v4.svg":
      type==="mega"?"/assets/hardhat-v4.svg":
      type==="mansion"?"/assets/pig-blue-v10.svg":
      "/assets/wolf-v10.svg";
  }
  dom.featureKicker.textContent=type==="free"?"FREE SPINS":title;
  dom.featureTitle.textContent=
    type==="buzz"?"CUT THE FRAMES":
    type==="mega"?"MEGA HAT BUILD":
    type==="mansion"?"BRICK MANSION":
    "BUILD THE HOUSES";
  dom.featureSub.textContent=sub;
  dom.freeOverlay.dataset.feature=type;
  dom.freeOverlay.hidden=false;
  requestAnimationFrame(()=>dom.freeOverlay.classList.add("active"));
}
function hideIntro(){dom.freeOverlay.classList.remove("active");dom.freeOverlay.hidden=true}
function showReveal(frames,rewards){
  dom.revealGrid.innerHTML="";
  frames.forEach((level,i)=>{
    const cell=document.createElement("div");cell.className="reveal-cell "+(level===1?"straw":level===2?"wood":level===3?"brick":"");cell.textContent=level?FRAME_NAMES[level]:"";
    dom.revealGrid.appendChild(cell);
    if(level)later(()=>{cell.classList.add("revealed");cell.textContent=rewards[i].label||FRAME_NAMES[level]},(state.turbo?25:85)*i);
  });
  dom.revealTotal.textContent="0";dom.revealOverlay.hidden=false;requestAnimationFrame(()=>dom.revealOverlay.classList.add("active"));sfx("feature");
}
function hideReveal(){dom.revealOverlay.classList.remove("active");dom.revealOverlay.hidden=true}

function wheelIcon(prize){
  if(prize.type==="free")return "/assets/hardhat-v4.svg";
  if(prize.feature==="buzz")return "/assets/saw-v4.svg";
  if(prize.feature==="mega")return "/assets/hardhat-v4.svg";
  if(prize.feature==="mansion")return "/assets/pig-blue-v10.svg";
  if(prize.jp==="grand")return "/assets/pig-blue-v10.svg";
  if(prize.jp==="major")return "/assets/wolf-v10.svg";
  if(prize.jp==="minor")return "/assets/toolbox-v10.svg";
  return "/assets/tape-v10.svg";
}
function renderWheel(){
  const deg=360/WHEEL.length;
  dom.bigWheel.style.background="conic-gradient("+WHEEL.map((p,i)=>p.color+" "+(i*deg)+"deg "+((i+1)*deg)+"deg").join(",")+")";
  dom.wheelLabels.innerHTML="";
  WHEEL.forEach((p,i)=>{
    const label=document.createElement("div");
    label.className="wheel-label";
    label.innerHTML='<img src="'+wheelIcon(p)+'" alt=""><b>'+p.label+'</b>';
    const angle=(i+.5)*deg-90,rad=angle*Math.PI/180,radius=38;
    label.style.left=(50+Math.cos(rad)*radius)+"%";
    label.style.top=(50+Math.sin(rad)*radius)+"%";
    label.style.transform="translate(-50%,-50%)";
    dom.wheelLabels.appendChild(label);
  });
  const result=document.getElementById("wheelResult");
  if(result){result.hidden=true;result.classList.remove("show")}
}
function pickWheel(){
  let total=WHEEL.reduce((a,p)=>a+p.weight,0),pick=Math.random()*total;
  for(let i=0;i<WHEEL.length;i++){pick-=WHEEL[i].weight;if(pick<=0)return i}
  return 0;
}
function startWheel(seedSaws=[]){
  state.mode="WHEEL";
  syncMeters();
  renderWheel();
  dom.wheelOverlay.hidden=false;
  dom.wheelOverlay.classList.add("active");
  sfx("feature");
  const idx=pickWheel(),seg=360/WHEEL.length,target=360*6+(360-(idx+.5)*seg);
  dom.bigWheel.classList.remove("settled");
  dom.bigWheel.style.transition="none";
  dom.bigWheel.style.transform="rotate(0deg)";
  void dom.bigWheel.offsetWidth;
  dom.bigWheel.style.transition=(state.turbo?"1.45s":"4.35s")+" cubic-bezier(.08,.72,.08,1)";
  dom.bigWheel.style.transform="rotate("+target+"deg)";
  setTimeout(()=>{dom.bigWheel.classList.add("settled");awardWheel(WHEEL[idx],seedSaws)},state.turbo?1600:4500);
}
function showWheelResult(outcome,value){
  const box=document.getElementById("wheelResult");
  const label=document.getElementById("wheelResultLabel");
  const val=document.getElementById("wheelResultValue");
  if(!box||!label||!val)return;
  label.textContent=outcome.label;
  val.textContent=value||(
    outcome.type==="free"?(outcome.spins||20)+" FREE SPINS":
    outcome.type==="feature"?"FEATURE ACTIVATED":"JACKPOT"
  );
  box.hidden=false;
  requestAnimationFrame(()=>box.classList.add("show"));
}
function awardWheel(outcome,seedSaws){
  if(outcome.type==="jackpot"){
    const amount=jackpots()[outcome.jp];
    showWheelResult(outcome,fmt(amount)+" CREDITS");
    sfx("big");
    setTimeout(()=>{
      credit(amount,true);
      dom.wheelOverlay.hidden=true;
      dom.wheelOverlay.classList.remove("active");
      if(state.pendingFree){
        const p=state.pendingFree.slice();
        state.pendingFree=null;state.pendingSaw=null;
        startFeature("free",p,6);
        return;
      }
      state.mode="READY";syncMeters();setStatus(outcome.label+" AWARDED • "+fmt(amount)+" credits");scheduleAuto();
    },state.turbo?650:1500);
    return;
  }
  showWheelResult(outcome,outcome.type==="free"?(outcome.spins||20)+" FREE SPINS":"FEATURE ACTIVATED");
  setTimeout(()=>{
    dom.wheelOverlay.hidden=true;
    dom.wheelOverlay.classList.remove("active");
    if(outcome.type==="free"){
      startFeature("free",[],outcome.spins||20);
      return;
    }
    startFeature(outcome.feature,seedSaws||state.pendingSaw||[],6);
  },state.turbo?650:1500);
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
  dom.creditPlus?.addEventListener("click",()=>{state.balance+=2500;syncMeters();toast("+2,500 free-play credits")});
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
      toast:$("toast"),runtimeError:$("runtimeError"),runtimeErrorText:$("runtimeErrorText"),reloadBtn:$("reloadBtn"),
      featureModeBanner:$("featureModeBanner"),featureBannerText:$("featureBannerText"),featureBannerIcon:$("featureBannerIcon"),
      bonusWinPanel:$("bonusWinPanel"),bonusWinValue:$("bonusWinValue"),creditPlus:$("creditPlus")
    });
    const required=["reels","spinBtn","balance","wheelOverlay","freeOverlay","revealOverlay","runtimeError"];
    required.forEach(k=>{if(!dom[k])throw new Error("Missing UI element: "+k)});
    state.grid=[
      ["PG","PB","TOOL"],
      ["TAPE","J","SAW"],
      ["TOOL","Q","TAPE"],
      ["PB","HAT","Q"],
      ["SAW","TAPE","TOOL"]
    ];
    renderGrid(state.grid);renderWheel();renderPaytable();syncMeters();initEvents();
    setStatus("6+ Hard Hats = Free Spins • 3+ Buzz Saws = Power Wheel");
    dom.runtimeError.hidden=true;
    window.__gameReady=true;
    window.__game=state;
    window.__testFeature=(type)=>startFeature(type,positions(state.grid,"HAT"));
    window.__qa={
      spin:()=>startSpin(),
      stop:()=>quickStop(),
      wheel:()=>startWheel([]),
      feature:(type="free",spins=6)=>startFeature(type,positions(state.grid,"HAT"),spins),
      state:()=>JSON.parse(JSON.stringify(state)),
      coreSelfTest:()=>CORE.selfTest()
    };
  }catch(err){
    console.error(err);showRuntimeError(err.stack||err.message||err);
  }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();