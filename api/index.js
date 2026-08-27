import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
};

const PROXY_PREFIXES = [
    '/panagiotis-navigator/scramjet/p/',
    '/panagiotis-navigator/uv/service/',
];

function serveFile(res, filePath) {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;
    const ext = extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const content = readFileSync(filePath);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.statusCode = 200;
    res.end(content);
    return true;
}

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}

export default function handler(req, res) {
    setCors(res);

    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        return res.end();
    }

    const url = new URL(req.url, `https://${req.headers.host}`);
    const pathname = url.pathname;

    // Dynamic service worker endpoint
    if (pathname === '/get-dynamic-sw.js') {
        const swCode = url.searchParams.get('code');
        if (!swCode) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'text/plain');
            return res.end('Missing code parameter');
        }
        res.setHeader('Content-Type', 'application/javascript');
        res.statusCode = 200;
        return res.end(swCode);
    }

    // Proxy prefix paths - on Vercel, WebSocket upgrade is not supported
    if (PROXY_PREFIXES.some(p => pathname.startsWith(p))) {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Retry-After', '1');
        res.statusCode = 503;
        return res.end(
            '<!DOCTYPE html><html><head><meta charset="utf-8">' +
            '<meta name="viewport" content="width=device-width, initial-scale=1">' +
            '<title>Loading...</title>' +
            '<style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;' +
            'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#282828;color:#9aa0a6}' +
            '</style></head><body><p>WebSocket proxy not available on Vercel. Run locally with <code>npm start</code> for full proxy support.</p>' +
            '<script>setTimeout(function(){location.href="/"},2000)</script>' +
            '</body></html>'
        );
    }

    // Try serving from public/
    const publicPath = join(ROOT, 'public', pathname === '/' ? 'index.html' : pathname);
    if (serveFile(res, publicPath)) return;

    // Try serving proxy engine assets from node_modules
    const assetMappings = [
        { prefix: '/scram/', pkg: '@mercuryworkshop/scramjet', subdir: '' },
        { prefix: '/libcurl/', pkg: '@mercuryworkshop/libcurl-transport', subdir: '' },
        { prefix: '/baremux/', pkg: '@mercuryworkshop/bare-mux', subdir: 'node' },
        { prefix: '/uv/', pkg: '@titaniumnetwork-dev/ultraviolet', subdir: '' },
    ];

    for (const mapping of assetMappings) {
        if (pathname.startsWith(mapping.prefix)) {
            const relPath = pathname.slice(mapping.prefix.length);
            const pkgDir = join(ROOT, 'node_modules', mapping.pkg, mapping.subdir);
            const filePath = join(pkgDir, relPath);
            if (serveFile(res, filePath)) return;
        }
    }

    // Root fallback - serve index.html
    if (pathname === '/') {
        const indexPath = join(ROOT, 'public', 'index.html');
        if (existsSync(indexPath)) {
            const html = readFileSync(indexPath, 'utf8');
            res.setHeader('Content-Type', 'text/html');
            res.statusCode = 200;
            return res.end(html);
        }
    }

    // 404
    res.setHeader('Content-Type', 'text/html');
    res.statusCode = 404;
    res.end('<h1>404 Not Found</h1><p>The requested resource could not be found on this server.</p>');
}
