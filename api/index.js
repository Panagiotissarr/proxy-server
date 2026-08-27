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

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        return res.end();
    }

    const url = new URL(req.url, `https://${req.headers.host}`);
    const cookies = parseCookies(req);

    // GET /api/connect — tray app opens this URL to register
    if (url.pathname === '/api/connect') {
        res.setHeader('Set-Cookie', 'proxy_token=active; Path=/; Max-Age=86400; SameSite=Lax');
        res.setHeader('Content-Type', 'text/html');
        res.statusCode = 200;
        return res.end(LANDING_PAGE);
    }

    // GET /api/disconnect — tray app opens this URL to unregister
    if (url.pathname === '/api/disconnect') {
        res.setHeader('Set-Cookie', 'proxy_token=; Path=/; Max-Age=0; SameSite=Lax');
        res.setHeader('Content-Type', 'text/html');
        res.statusCode = 200;
        return res.end(LANDING_PAGE);
    }

    // GET /api/health — website polls this to check status
    if (url.pathname === '/api/health') {
        const connected = cookies.proxy_token === 'active';
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        return res.end(JSON.stringify({ connected }));
    }

    // Landing page
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.end(LANDING_PAGE);
}

function parseCookies(req) {
    const cookies = {};
    const header = req.headers.cookie || '';
    header.split(';').forEach(c => {
        const [key, ...val] = c.split('=');
        if (key) cookies[key.trim()] = decodeURIComponent(val.join('='));
    });
    return cookies;
}
