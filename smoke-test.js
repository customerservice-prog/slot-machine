"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = __dirname;
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const railway = JSON.parse(fs.readFileSync(path.join(ROOT, "railway.json"), "utf8"));

assert(html.includes('id="d_spin"'), "Spin control is missing");
assert(html.includes('id="d_auto"'), "Autoplay control is missing");
assert(html.includes("function drawHoldWin"), "Hold & Win renderer is missing");
assert(html.includes("function startFreeSpins"), "Free Spins feature is missing");
assert(html.includes("function startWheel"), "Bonus Wheel feature is missing");
assert(html.includes("function checkVillageComplete"), "Village progression is missing");
assert(!html.includes("H!==window.innerHeight"), "Per-frame canvas resize regression detected");
assert(html.includes('if(G.state!=="READY") return; var i=BETS.indexOf(G.bet)'), "Bet changes are not locked during active play");
assert(pkg.scripts && pkg.scripts.start === "node server.js", "Production start script must use server.js");
assert(railway.deploy && railway.deploy.healthcheckPath === "/health", "Railway health check is missing");

const script = html.match(/<script>\s*([\s\S]*?)<\/script>/);
assert(script, "Game script block is missing");
new Function(script[1]);

async function verifyServer() {
  const port = 32145;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk.toString(); });

  try {
    let health;
    for (let i = 0; i < 30; i++) {
      try {
        health = await fetch(`http://127.0.0.1:${port}/health`);
        if (health.ok) break;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(health && health.ok, "Health endpoint did not become ready. " + stderr);
    const body = await health.json();
    assert(body.ok === true, "Health endpoint returned an invalid payload");

    const home = await fetch(`http://127.0.0.1:${port}/`);
    assert(home.ok, "Homepage request failed");
    const text = await home.text();
    assert(text.includes("<title>Pineda Power - Free Play</title>"), "Homepage served unexpected content");
  } finally {
    child.kill("SIGTERM");
  }
}

verifyServer()
  .then(() => console.log("Smoke test passed"))
  .catch(err => {
    console.error(err.stack || err);
    process.exitCode = 1;
  });
