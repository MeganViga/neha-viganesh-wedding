const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const STATE_FILE = path.join(__dirname, "state.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function defaultState() {
  return { neha: false, viganesh: false };
}

function loadState() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return {
      neha: Boolean(raw.neha),
      viganesh: Boolean(raw.viganesh),
    };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

let state = loadState();

function publicPayload() {
  return {
    neha: state.neha,
    viganesh: state.viganesh,
    married: state.neha && state.viganesh,
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...corsHeaders(), ...headers });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }
    const ext = path.extname(filePath);
    send(res, 200, data, {
      "Content-Type": MIME[ext] || "application/octet-stream",
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, publicPayload());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/yes") {
    try {
      const body = await readBody(req);
      const who = body.who === "neha" || body.who === "viganesh" ? body.who : null;
      if (!who) {
        sendJson(res, 400, { error: "who must be neha or viganesh" });
        return;
      }
      state[who] = true;
      saveState(state);
      sendJson(res, 200, publicPayload());
    } catch {
      sendJson(res, 400, { error: "Invalid JSON" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/reset") {
    state = defaultState();
    saveState(state);
    sendJson(res, 200, publicPayload());
    return;
  }

  if (req.method !== "GET") {
    send(res, 405, "Method not allowed");
    return;
  }

  if (url.pathname === "/styles.css" || url.pathname === "/app.js") {
    serveStatic(url.pathname, res);
    return;
  }

  serveStatic("/index.html", res);
});

function lanAddresses() {
  try {
    const nets = os.networkInterfaces();
    const addresses = [];
    for (const entries of Object.values(nets || {})) {
      for (const entry of entries || []) {
        if (entry.family === "IPv4" && !entry.internal) {
          addresses.push(entry.address);
        }
      }
    }
    return addresses;
  } catch {
    return [];
  }
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Neha & Viganesh wedding site is ready`);
  console.log(`  Home:            http://localhost:${PORT}/`);
  console.log(`  For Neha:        http://localhost:${PORT}/for-neha`);
  console.log(`  For Viganesh:    http://localhost:${PORT}/for-viganesh`);
  for (const ip of lanAddresses()) {
    console.log(`  On your network: http://${ip}:${PORT}/`);
  }
});
