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
        .sub { font-size: 1.1rem; color: #9aa0a6; margin-top: 12px; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="container">
        <h1>This is a Proxy server</h1>
        <p class="sub">Use the Panas Proxy App to connect your computer.<br>
        Your connection status is shown in the system tray.</p>
    </div>
</body>
</html>`;

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 200;
    res.end(LANDING_PAGE);
}
