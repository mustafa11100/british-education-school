const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PUBLIC_PORT = Number(process.env.PORT || 8080);
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 8081);
const ROOT = __dirname;

const backend = spawn(process.execPath, [
  "-r",
  path.join(ROOT, "enhanced.js"),
  path.join(ROOT, "server.js")
], {
  env: { ...process.env, PORT: String(BACKEND_PORT) },
  stdio: "inherit"
});

backend.on("error", (error) => console.error("Backend process error:", error));
backend.on("exit", (code, signal) => {
  console.error(`Backend stopped. code=${code} signal=${signal}`);
  process.exit(code || 1);
});

function serveFile(res, filePath) {
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Page not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    const types = { ".html":"text/html; charset=utf-8", ".js":"application/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".svg":"image/svg+xml", ".ico":"image/x-icon", ".webp":"image/webp" };
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "Cache-Control":"no-cache" });
    fs.createReadStream(filePath).pipe(res);
  });
}

function proxyApi(req, res) {
  let requestPath = req.url;
  if (requestPath === "/api/login") requestPath = "/api/auth/login";
  if (requestPath === "/api/me") requestPath = "/api/auth/me";
  const request = http.request({ hostname:"127.0.0.1", port:BACKEND_PORT, path:requestPath, method:req.method, headers:{...req.headers,host:`127.0.0.1:${BACKEND_PORT}`} }, backendRes => {
    res.writeHead(backendRes.statusCode || 502, backendRes.headers);
    backendRes.pipe(res);
  });
  request.on("error", error => {
    console.error("API proxy error:", error.message);
    if (!res.headersSent) res.writeHead(502, {"Content-Type":"application/json; charset=utf-8"});
    res.end(JSON.stringify({success:false,message:"الخادم الداخلي غير جاهز حالياً"}));
  });
  req.pipe(request);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) return proxyApi(req, res);
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch { res.writeHead(400); return res.end("Bad request"); }
  if (pathname === "/" || pathname === "/index.html") return serveFile(res, path.join(ROOT, "index.html"));
  const relative = pathname.replace(/^\/+/, "");
  const filePath = path.resolve(ROOT, relative);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end("Forbidden"); }
  serveFile(res, filePath);
});

server.listen(PUBLIC_PORT, "0.0.0.0", () => {
  console.log(`🚀 Web server listening on port ${PUBLIC_PORT}`);
  console.log(`🔗 Backend running internally on port ${BACKEND_PORT}`);
});

function shutdown() { server.close(() => {}); backend.kill("SIGTERM"); }
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
