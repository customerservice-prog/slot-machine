"use strict";
const fs=require("node:fs"),path=require("node:path"),{spawn}=require("node:child_process");
function assert(x,m){if(!x)throw new Error(m)}
const root=__dirname;
const lobby=fs.readFileSync(path.join(root,"index.html"),"utf8");
const game=fs.readFileSync(path.join(root,"game.html"),"utf8");
const casinoCss=fs.readFileSync(path.join(root,"casino.css"),"utf8");
const casinoJs=fs.readFileSync(path.join(root,"casino.js"),"utf8");
const gameShell=fs.readFileSync(path.join(root,"game-shell.css"),"utf8");
const gameCss=fs.readFileSync(path.join(root,"pineda-huff-v12.css"),"utf8");
const gameJs=fs.readFileSync(path.join(root,"pineda-huff-v12.js"),"utf8");
const core=require(path.join(root,"game-core-v7.js"));
const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
const railway=JSON.parse(fs.readFileSync(path.join(root,"railway.json"),"utf8"));

[
 ["casino header",'class="casino-header"'],
 ["casino sidebar",'class="casino-sidebar"'],
 ["featured hero",'class="hero"'],
 ["Pineda Power card",'data-game="pineda-power"'],
 ["coming soon games",'COMING SOON'],
 ["lobby search",'id="gameSearch"'],
 ["free-play disclosure",'NO CASH VALUE']
].forEach(([name,needle])=>assert(lobby.includes(needle),name+" missing"));

[
 ["game shell",'class="game-page"'],
 ["game toolbar",'class="game-toolbar"'],
 ["slot cabinet",'class="game-cabinet"'],
 ["reels",'id="reels"'],
 ["spin control",'id="spinBtn"'],
 ["rules",'id="rulesModal"'],
 ["wheel overlay",'id="wheelOverlay"'],
 ["wheel result",'id="wheelResult"'],
 ["feature mode banner",'id="featureModeBanner"'],
 ["bonus win panel",'id="bonusWinPanel"'],
 ["credit plus",'id="creditPlus"'],
 ["feature intro",'id="freeOverlay"'],
 ["feature reveal",'id="revealOverlay"'],
 ["related games",'class="related-wrap"'],
 ["v11 css",'/pineda-huff-v12.css'],
 ["v11 js",'/pineda-huff-v12.js'],
 ["casino css",'/casino.css'],
 ["game shell css",'/game-shell.css']
].forEach(([name,needle])=>assert(game.includes(needle),name+" missing"));

[
 ".casino-header",".casino-sidebar",".hero",".game-grid",".game-card",".search-wrap",".header-balance",".credit-plus",".brand-crown"
].forEach(needle=>assert(casinoCss.includes(needle),"casino CSS missing "+needle));
[
 "data-filter","pineda_recent_game","pineda_power_huff_v1","Coming soon"
].forEach(needle=>assert(casinoJs.includes(needle),"casino JS missing "+needle));
[
 ".game-page-main",".game-toolbar",".game-viewport",".related-grid"
].forEach(needle=>assert(gameShell.includes(needle),"game shell CSS missing "+needle));

[
 "V11 CINEMATIC FEATURE ROUND","V12 TARGET SIDE-BY-SIDE COMPOSITION",".wheel-result",".wheel-label img",".feature-wolf img",".reveal-cell.revealed",".feature-mode-banner",".bonus-win-panel",
 "V10 VISUAL DENSITY + SIGNAGE PASS","V9 VIEWPORT-LOCKED MACHINE GEOMETRY",
 "grid-template-rows:21.5% 24.5% 47.5% 6.5%","grid-template-rows:repeat(3,minmax(0,1fr))"
].forEach(needle=>assert(gameCss.includes(needle),"game CSS missing "+needle));

[
 "function startSpin","function resolveSpin","function startFeature","function startWheel","function awardWheel",
 "function showWheelResult","function showIntro","function showReveal","showFeatureHud","updateFeatureHud","hideFeatureHud","window.__qa",
 "pig-green-v10.svg","pig-blue-v10.svg","toolbox-v10.svg","tape-v10.svg","wolf-v10.svg"
].forEach(needle=>assert(gameJs.includes(needle),"game JS missing "+needle));

new Function(casinoJs);
new Function(gameJs);
assert(core.selfTest()===true,"core self-test failed");

const triggerGrid=[
 ["HAT","HAT","SAW"],["HAT","HAT","SAW"],["HAT","HAT","SAW"],["A","K","Q"],["J","T","A"]
];
const trig=core.classifyTriggers(triggerGrid);
assert(trig.hats.length===6&&trig.free,"6+ Hard Hat trigger failed");
assert(trig.saws.length===3&&trig.wheel,"3+ Buzz Saw trigger failed");
for(const type of ["free","buzz","mega","mansion"]){
 const frames=core.createFeatureFrames(type,[0,3,6],()=>.2);
 assert(Array.isArray(frames)&&frames.length===15,type+" feature frame creation failed");
}
assert(gameJs.includes('spins:20'),"20 Free Spins wheel result missing");
assert(gameJs.includes('id==="WILD"&&(reel===0||reel===4)'),"Wild reel restriction missing");
assert(pkg.scripts&&pkg.scripts.start==="node server.js","start script invalid");
assert(railway.deploy&&railway.deploy.healthcheckPath==="/health","Railway healthcheck missing");

async function verifyServer(){
 const port=32145;
 const child=spawn(process.execPath,["server.js"],{cwd:root,env:{...process.env,PORT:String(port)},stdio:["ignore","pipe","pipe"]});
 let err="";child.stderr.on("data",d=>err+=d.toString());
 try{
  let h;
  for(let i=0;i<50;i++){
   try{h=await fetch("http://127.0.0.1:"+port+"/health");if(h.ok)break}catch{}
   await new Promise(r=>setTimeout(r,100));
  }
  assert(h&&h.ok,"health endpoint failed "+err);

  const checks=[
   ["/","Pineda Casino"],
   ["/game/pineda-power","Pineda Power"],
   ["/casino.css",".casino-header"],
   ["/casino.js","pineda_recent_game"],
   ["/game-shell.css",".game-page-main"],
   ["/game-core-v7.js","classifyTriggers"],
   ["/pineda-huff-v12.css","V11 CINEMATIC FEATURE ROUND"],
   ["/pineda-huff-v12.js","showWheelResult"],
   ["/assets/wheel-v10.svg","svg"],
   ["/assets/forest-v10.svg","svg"]
  ];
  for(const [p,needle] of checks){
   const r=await fetch("http://127.0.0.1:"+port+p);
   assert(r.ok,p+" failed");
   const body=await r.text();
   assert(body.includes(needle),p+" content mismatch");
   const cache=r.headers.get("cache-control")||"";
   if(p.endsWith(".svg"))assert(cache.includes("immutable"),p+" should be immutable/versioned");
   else assert(cache.includes("no-store"),p+" must be no-store");
  }
 }finally{child.kill("SIGTERM")}
}
verifyServer().then(()=>console.log("Casino platform smoke test passed")).catch(e=>{console.error(e.stack||e);process.exitCode=1});