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

// In-memory connected state (resets on cold start, which is fine — app re-connects on launch)
let connected = false;
let lastHeartbeat = 0;
const TIMEOUT = 30000; // 30s without heartbeat = disconnected

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        return res.end();
    }

    const url = new URL(req.url, `https://${req.headers.host}`);

    // POST /api/ping — tray app calls this every few seconds while connected
    if (url.pathname === '/api/ping' && req.method === 'POST') {
        connected = true;
        lastHeartbeat = Date.now();
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true }));
    }

    // POST /api/disconnect — tray app calls this on disconnect
    if (url.pathname === '/api/disconnect' && req.method === 'POST') {
        connected = false;
        lastHeartbeat = 0;
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        return res.end(JSON.stringify({ ok: true }));
    }

    // GET /api/health — website polls this
    if (url.pathname === '/api/health') {
        // Check timeout
        if (connected && Date.now() - lastHeartbeat > TIMEOUT) {
            connected = false;
        }
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        return res.end(JSON.stringify({ connected }));
    }

    // Landing page
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.end(LANDING_PAGE);
}
