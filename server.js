"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function baseHeaders(contentType, cacheControl) {
  return {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin"
  };
}

function sendFile(req, res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, baseHeaders("text/plain; charset=utf-8", "no-store"));
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const cache = [".html", ".css", ".js", ".json"].includes(ext) ? "no-store, max-age=0" : "public, max-age=86400, immutable";
    res.writeHead(200, baseHeaders(type, cache));

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      if (!res.headersSent) res.writeHead(500, baseHeaders("text/plain; charset=utf-8", "no-store"));
      res.end("Server error");
    });
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { ...baseHeaders("text/plain; charset=utf-8", "no-store"), Allow: "GET, HEAD" });
    res.end("Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname);
  } catch {
    res.writeHead(400, baseHeaders("text/plain; charset=utf-8", "no-store"));
    res.end("Bad request");
    return;
  }

  if (pathname === "/health") {
    res.writeHead(200, baseHeaders("application/json; charset=utf-8", "no-store"));
    res.end(JSON.stringify({ ok: true, service: "pineda-power-free-play" }));
    return;
  }

  const routeMap = {
    "/": "index.html",
    "/game/pineda-power": "game.html",
    "/game/pineda-power/": "game.html"
  };
  const relative = routeMap[pathname] || pathname.replace(/^\/+/, "");
  const resolved = path.resolve(ROOT, relative);
  const rootPrefix = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;

  if (resolved !== path.join(ROOT, "index.html") && !resolved.startsWith(rootPrefix)) {
    res.writeHead(403, baseHeaders("text/plain; charset=utf-8", "no-store"));
    res.end("Forbidden");
    return;
  }

  fs.stat(resolved, (err, stat) => {
    if (!err && stat.isFile()) {
      sendFile(req, res, resolved);
      return;
    }
    sendFile(req, res, path.join(ROOT, "index.html"));
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Pineda Power listening on http://${HOST}:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
