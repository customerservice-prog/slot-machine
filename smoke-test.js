"use strict";
const fs=require("node:fs"),path=require("node:path"),{spawn}=require("node:child_process");
function assert(x,m){if(!x)throw new Error(m)}
const root=__dirname;
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"pineda-huff-v6.css"),"utf8");
const app=fs.readFileSync(path.join(root,"pineda-huff-v6.js"),"utf8");
const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
const railway=JSON.parse(fs.readFileSync(path.join(root,"railway.json"),"utf8"));

[
 ["single cabinet",'class="game-cabinet"'],
 ["jackpots",'class="jackpots"'],
 ["integrated wheel",'class="wheel-zone"'],
 ["wolf art",'class="wolf-character"'],
 ["reels",'id="reels"'],
 ["243 ways",'243'],
 ["hard hat trigger",'6+'],
 ["buzz saw trigger",'POWER WHEEL'],
 ["spin control",'id="spinBtn"'],
 ["runtime error",'id="runtimeError"']
].forEach(([name,needle])=>assert(html.includes(needle),name+" missing"));

assert(html.includes('/pineda-huff-v6.css'),"v3 stylesheet not pinned");
assert(html.includes('/pineda-huff-v6.js'),"v3 engine not pinned");
assert(css.includes(".game-cabinet"),"cabinet CSS missing");
assert(css.includes("V6 SCREENSHOT-MATCH GEOMETRY"),"v5 reference-proportion CSS missing");
assert(css.includes("aspect-ratio:433/461"),"exact 433:461 reference cabinet ratio missing");
assert(css.includes("width:930px"),"reference-scale wheel missing");
assert(css.includes("height:930px"),"wheel must be a true circle, not an ellipse");
assert(css.includes("height:255px"),"clipped wheel viewport height missing");
assert(css.includes("grid-template-columns:47px minmax(0,1fr) 57px"),"compact side rails missing");
assert(css.includes("aspect-ratio:5/3"),"5x3 reel proportion missing");
assert(html.includes('class="utility-strip"'),"utility controls were not moved into bottom HUD");
assert(!html.includes('class="top-utility"'),"old floating utility controls still present");
assert(html.includes("/assets/pineda-v4-logo.svg"),"v4 logo art missing");
assert(html.includes("/assets/wolf-v4.svg"),"v4 wolf cabinet art missing");
["pig-green-v4.svg","pig-blue-v4.svg","hardhat-v4.svg","saw-v4.svg","toolbox-v4.svg","tape-v4.svg"].forEach(name=>{
  assert(app.includes(name),"v4 symbol art "+name+" missing");
});
assert(css.includes(".wheel-half"),"wheel art missing");
assert(css.includes(".symbol-art"),"illustrated symbol styling missing");
assert(css.includes("@keyframes symbolLand"),"symbol landing motion missing");
assert(css.includes(".game-cabinet.big-win"),"big win cabinet effect missing");
assert(css.includes(".reel-cabinet"),"reel cabinet missing");
assert(css.includes(".wolf-character"),"wolf character missing");
assert(css.includes(".frame-straw")&&css.includes(".frame-wood")&&css.includes(".frame-brick"),"frame visuals missing");
assert(css.includes("@media(max-width:760px)"),"mobile layout missing");

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
 "symbol-art",
 "window.__qa"
].forEach(name=>assert(app.includes(name),name+" missing"));

assert(app.includes('hats.length>=6'),"6+ Hard Hat trigger missing");
assert(app.includes('saws.length>=3'),"3+ Buzz Saw trigger missing");
assert(app.includes('spinsLeft:6'),"6-spin feature missing");
assert(app.includes('id==="WILD"&&(reel===0||reel===4)'),"wild reel rule missing");
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
  for(const p of ["/","/pineda-huff-v6.css","/pineda-huff-v6.js"]){
    const r=await fetch("http://127.0.0.1:"+port+p);
    assert(r.ok,p+" failed");
    assert((r.headers.get("cache-control")||"").includes("no-store"),p+" must be no-store");
    const body=await r.text();assert(body.length>100,p+" unexpectedly empty");
  }
 }finally{child.kill("SIGTERM")}
}
verifyServer().then(()=>console.log("Smoke test passed")).catch(e=>{console.error(e.stack||e);process.exitCode=1});