"use strict";
const fs=require("node:fs"),path=require("node:path"),{spawn}=require("node:child_process");
function assert(x,m){if(!x)throw new Error(m)}
const root=__dirname;
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const css=fs.readFileSync(path.join(root,"styles.css"),"utf8");
const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
const rail=JSON.parse(fs.readFileSync(path.join(root,"railway.json"),"utf8"));
assert(html.includes('id="reels"'),"reel grid missing");
assert(html.includes('id="wheelPanel"'),"bonus wheel panel missing");
assert(html.includes('id="holdPanel"'),"hold-and-win panel missing");
assert(html.includes('id="buildBar0"'),"build meter missing");
assert(html.includes('/styles.css')&&html.includes('/app.js'),"split app assets missing");
assert(css.includes(".spin-btn")&&css.includes(".bonus-overlay")&&css.includes("@media(max-width:820px)"),"responsive premium UI missing");
assert(app.includes("function startFreeSpins"),"free spins logic missing");
assert(app.includes("function startWheel"),"wheel logic missing");
assert(app.includes("function startHoldWin"),"hold-and-win logic missing");
assert(app.includes("function handleBuild"),"build progression missing");
assert(app.includes("Free-play")||html.includes("Free-play"),"free-play disclosure missing");
new Function(app);
assert(pkg.scripts.start==="node server.js","production start script invalid");
assert(rail.deploy.healthcheckPath==="/health","healthcheck missing");
async function run(){
 const port=32145,child=spawn(process.execPath,["server.js"],{cwd:root,env:{...process.env,PORT:String(port)},stdio:["ignore","pipe","pipe"]});
 let err="";child.stderr.on("data",d=>err+=d);
 try{
  let health;
  for(let i=0;i<40;i++){try{health=await fetch("http://127.0.0.1:"+port+"/health");if(health.ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
  assert(health&&health.ok,"health endpoint failed "+err);
  for(const p of ["/","/styles.css","/app.js"]){const r=await fetch("http://127.0.0.1:"+port+p);assert(r.ok,p+" failed")}
 }finally{child.kill("SIGTERM")}
}
run().then(()=>console.log("Smoke test passed")).catch(e=>{console.error(e.stack||e);process.exitCode=1});