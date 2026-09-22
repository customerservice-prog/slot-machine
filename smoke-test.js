"use strict";
const fs=require("node:fs"),path=require("node:path"),{spawn}=require("node:child_process");
function assert(x,m){if(!x)throw new Error(m)}
const root=__dirname;
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"pineda-huff-v9.css"),"utf8");
const app=fs.readFileSync(path.join(root,"pineda-huff-v9.js"),"utf8");
const core=require(path.join(root,"game-core-v7.js"));
const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
const railway=JSON.parse(fs.readFileSync(path.join(root,"railway.json"),"utf8"));

[
 ["single cabinet",'class="game-cabinet"'],
 ["jackpots",'class="jackpots"'],
 ["wheel zone",'class="wheel-zone"'],
 ["v9 wheel image",'class="wheel-art-v9"'],
 ["reels",'id="reels"'],
 ["243 ways",'243'],
 ["hard hat trigger",'6+'],
 ["buzz saw trigger",'POWER WHEEL'],
 ["spin control",'id="spinBtn"'],
 ["bottom utilities",'class="utility-strip"'],
 ["runtime error",'id="runtimeError"'],
 ["feature wolf",'/assets/wolf-v4.svg']
].forEach(([name,needle])=>assert(html.includes(needle),name+" missing"));

assert(html.includes('/pineda-huff-v9.css'),"v9 stylesheet not pinned");
assert(html.includes('/pineda-huff-v9.js'),"v9 engine not pinned");
assert(html.includes('/game-core-v7.js'),"shared feature core missing");
assert(html.includes('/assets/wheel-v9.svg'),"v9 wheel art not referenced");
assert(html.includes('/assets/pineda-v4-logo.svg'),"logo art missing");
assert(!html.includes('class="top-utility"'),"old floating utility controls still present");

[
 "V9 VIEWPORT-LOCKED MACHINE GEOMETRY",
 "grid-template-rows:21.5% 24.5% 47.5% 6.5%",
 "aspect-ratio:433/461",
 "aspect-ratio:auto!important",
 "grid-template-rows:repeat(3,minmax(0,1fr))",
 ".machine-core:before",
 ".machine-core:after",
 ".feature-wolf img",
 ".reel-cabinet",
 ".symbol-art",
 "@keyframes symbolLand",
 ".game-cabinet.big-win",
 ".frame-straw",
 ".frame-wood",
 ".frame-brick",
 "@media(max-width:760px)"
].forEach(needle=>assert(css.includes(needle),"CSS check missing: "+needle));

["pig-green-v4.svg","pig-blue-v4.svg","hardhat-v4.svg","saw-v4.svg","toolbox-v4.svg","tape-v4.svg","wolf-v4.svg"].forEach(name=>{
  assert(app.includes(name),"symbol art "+name+" missing");
});

[
 "function evaluateWays",
 "function startFeature",
 "function resolveFeatureSpin",
 "function startWheel",
 "function awardWheel",
 "function frameReward",
 "function showReveal",
 "function showRuntimeError",
 "const ART=",
 "function symbolHTML",
 "window.__qa"
].forEach(name=>assert(app.includes(name),name+" missing"));
new Function(app);

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
assert(app.includes('function startFeature(type,seedPositions=[],spinCount=6)'),"default 6-spin feature missing");
assert(app.includes('spins:20'),"20-free-spin wheel award missing");
assert(app.includes('id==="WILD"&&(reel===0||reel===4)'),"wild reel restriction missing");

assert(pkg.scripts&&pkg.scripts.start==="node server.js","start script invalid");
assert(railway.deploy&&railway.deploy.healthcheckPath==="/health","Railway healthcheck missing");

async function verifyServer(){
 const port=32145;
 const child=spawn(process.execPath,["server.js"],{cwd:root,env:{...process.env,PORT:String(port)},stdio:["ignore","pipe","pipe"]});
 let err="";child.stderr.on("data",d=>err+=d.toString());
 try{
  let h;
  for(let i=0;i<40;i++){try{h=await fetch("http://127.0.0.1:"+port+"/health");if(h.ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  assert(h&&h.ok,"health endpoint failed "+err);
  for(const p of ["/","/game-core-v7.js","/pineda-huff-v9.css","/pineda-huff-v9.js","/assets/wheel-v9.svg","/assets/forest-v7.svg"]){
    const r=await fetch("http://127.0.0.1:"+port+p);
    assert(r.ok,p+" failed");
    const cache=r.headers.get("cache-control")||"";
    if(p.endsWith(".svg")) assert(cache.includes("immutable"),p+" should be immutable/versioned");
    else assert(cache.includes("no-store"),p+" must be no-store");
    const body=await r.text();assert(body.length>100,p+" unexpectedly empty");
  }
 }finally{child.kill("SIGTERM")}
}
verifyServer().then(()=>console.log("Smoke test passed")).catch(e=>{console.error(e.stack||e);process.exitCode=1});