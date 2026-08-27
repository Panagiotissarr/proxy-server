import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { hostname } from "node:os";
import fs from "node:fs";
import path from "node:path";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";

// Prefixes the front-end proxy engines route through.
const PROXY_PREFIXES = [
    "/panagiotis-navigator/scramjet/p/",
    "/panagiotis-navigator/uv/service/",
];

const LANDING_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panas Proxy Server</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #0f0f0f;
            color: #e0e0e0;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        }
        .container { text-align: center; padding: 40px; max-width: 500px; }
        h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: 8px; }
        .status { font-size: 1.3rem; margin-top: 16px; font-weight: 600; }
        .status.on { color: #48d162; }
        .status.off { color: #e05555; }
        .dot {
            display: inline-block;
            width: 10px; height: 10px;
            border-radius: 50%;
            margin-right: 8px;
            vertical-align: middle;
        }
        .dot.on { background: #48d162; }
        .dot.off { background: #e05555; }
    </style>
</head>
<body>
    <div class="container">
        <h1>This is a Proxy server</h1>
        <div class="status" id="status">
            <span class="dot off" id="dot"></span>
            <span id="label">Checking...</span>
        </div>
    </div>
    <script>
        const dot = document.getElementById('dot');
        const label = document.getElementById('label');
        const status = document.getElementById('status');
        async function check() {
            try {
                const r = await fetch('/api/health');
                const d = await r.json();
                if (d.connected) {
                    dot.className = 'dot on';
                    label.textContent = 'You are connected to Pana Proxy';
                    status.className = 'status on';
                } else {
                    dot.className = 'dot off';
                    label.textContent = 'You are disconnected';
                    status.className = 'status off';
                }
            } catch {
                dot.className = 'dot off';
                label.textContent = 'You are disconnected';
                status.className = 'status off';
            }
        }
        check();
        setInterval(check, 3000);
    </script>
</body>
</html>`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let publicPath = path.resolve(process.cwd(), "public");

if (!fs.existsSync(path.join(publicPath, "index.html"))) {
    console.error(`[Fatal] index.html not found at ${publicPath}`);
    process.exit(1);
}

console.log(`[Proxy Server] Serving static root: ${publicPath}`);

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
    allow_udp_streams: false,
    hostname_blacklist: [/example\.com/],
    dns_servers: ["1.1.1.3", "1.0.0.3"],
});

const fastify = Fastify({
    serverFactory: (handler) => {
        return createServer()
            .on("request", (req, res) => {
                res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
                res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
                handler(req, res);
            })
            .on("upgrade", (req, socket, head) => {
                if (req.url === "/wisp/") {
                    wisp.routeRequest(req, socket, head);
                } else {
                    socket.end();
                }
            });
    },
});

fastify.addHook("onRequest", (req, reply, done) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        return reply.status(200).send();
    }
    done();
});

fastify.register(fastifyStatic, {
    root: publicPath,
    decorateReply: true,
});

fastify.register(fastifyStatic, {
    root: scramjetPath,
    prefix: "/scram/",
    decorateReply: false,
});

fastify.register(fastifyStatic, {
    root: libcurlPath,
    prefix: "/libcurl/",
    decorateReply: false,
});

fastify.register(fastifyStatic, {
    root: baremuxPath,
    prefix: "/baremux/",
    decorateReply: false,
});

fastify.register(fastifyStatic, {
    root: uvPath,
    prefix: "/uv/",
    decorateReply: false,
});

fastify.get("/", (req, reply) => {
    return reply.type("text/html").send(LANDING_PAGE);
});

// In-memory state for connected clients
let connected = false;
let lastHeartbeat = 0;
const TIMEOUT = 30000;

fastify.post("/api/ping", (req, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    connected = true;
    lastHeartbeat = Date.now();
    return reply.send({ ok: true });
});

fastify.post("/api/disconnect", (req, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    connected = false;
    lastHeartbeat = 0;
    return reply.send({ ok: true });
});

fastify.get("/api/health", (req, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    if (connected && Date.now() - lastHeartbeat > TIMEOUT) {
        connected = false;
    }
    return reply.send({ connected });
});

fastify.get("/get-dynamic-sw.js", (req, reply) => {
    const swCode = req.query.code;
    if (!swCode) {
        return reply.code(400).type("text/plain").send("Missing code parameter");
    }
    return reply.type("application/javascript").send(swCode);
});

fastify.setNotFoundHandler((req, reply) => {
    if (PROXY_PREFIXES.some((p) => req.url.startsWith(p))) {
        return reply
            .code(503)
            .header("Retry-After", "1")
            .type("text/html")
            .send(
                "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" +
                "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
                "<title>Loading…</title>" +
                "<style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;" +
                "font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#282828;color:#9aa0a6}" +
                "</style></head><body><p>Preparing proxy…</p>" +
                "<script>setTimeout(function(){location.reload()},1000)</script>" +
                "</body></html>"
            );
    }
    return reply
        .code(404)
        .type("text/html")
        .send("<h1>404 Not Found</h1><p>The requested resource could not be found on this server.</p>");
});

fastify.server.on("listening", () => {
    const address = fastify.server.address();

    console.log("Panas Proxy Server listening on:");
    console.log(`\thttp://localhost:${address.port}`);
    console.log(`\thttp://${hostname()}:${address.port}`);
    console.log(
        `\thttp://${
            address.family === "IPv6" ? `[${address.address}]` : address.address
        }:${address.port}`
    );
    console.log("\nProxy endpoints:");
    console.log(`\tWisp WebSocket: ws://localhost:${address.port}/wisp/`);
    console.log(`\tScramjet: http://localhost:${address.port}/panagiotis-navigator/scramjet/p/`);
    console.log(`\tUltraviolet: http://localhost:${address.port}/panagiotis-navigator/uv/service/`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
    console.log("SIGTERM signal received: closing HTTP server");
    fastify.close();
    process.exit(0);
}

let port = parseInt(process.env.PORT || "");
if (isNaN(port)) port = 8080;

fastify.listen({
    port: port,
    host: "0.0.0.0",
});
