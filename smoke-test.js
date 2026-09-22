"use strict";
const fs=require("node:fs"),path=require("node:path"),{spawn}=require("node:child_process");
function assert(x,m){if(!x)throw new Error(m)}
const root=__dirname;
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"pineda-huff-v2.css"),"utf8");
const app=fs.readFileSync(path.join(root,"pineda-huff-v2.js"),"utf8");
const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
const railway=JSON.parse(fs.readFileSync(path.join(root,"railway.json"),"utf8"));

[
 ['reel grid','id="reels"'],
 ['jackpot strip','id="jpGrand"'],
 ['wheel crown','class="wheel-crown"'],
 ['Hard Hat trigger','6+ Hard Hats'],
 ['Buzz Saw trigger','3+ Buzz Saws'],
 ['feature wheel','id="wheelOverlay"'],
 ['feature intro','id="freeOverlay"'],
 ['house reveal','id="revealOverlay"'],
 ['runtime error UI','id="runtimeError"']
].forEach(([name,needle])=>assert(html.includes(needle),name+" missing"));

assert(css.includes(".wheel-crown"),"Huff-style wheel crown missing");
assert(css.includes(".frame-straw")&&css.includes(".frame-wood")&&css.includes(".frame-brick"),"frame visuals missing");
assert(css.includes(".rank")&&css.includes(".forest-sky"),"bright forest reel design missing");
assert(css.includes("@media(max-width:900px)"),"responsive layout missing");

[
 "function evaluateWays",
 "function startFeature",
 "function resolveFeatureSpin",
 "function startWheel",
 "function awardWheel",
 "function frameReward",
 "function showReveal",
 "function showRuntimeError"
].forEach(name=>assert(app.includes(name),name+" missing"));

assert(app.includes('state.pendingFree'),"simultaneous wheel/free-spin sequencing missing");
assert(app.includes('spinsLeft:6'),"features must begin with 6 spins");
assert(app.includes('id==="WILD"&&(reel===0||reel===4)'),"Wild reel restriction missing");
new Function(app);

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
  for(const p of ["/","/pineda-huff-v2.css","/pineda-huff-v2.js"]){const r=await fetch("http://127.0.0.1:"+port+p);assert(r.ok,p+" failed");const text=await r.text();assert(text.length>100,p+" unexpectedly empty")}
 }finally{child.kill("SIGTERM")}
}
verifyServer().then(()=>console.log("Smoke test passed")).catch(e=>{console.error(e.stack||e);process.exitCode=1});