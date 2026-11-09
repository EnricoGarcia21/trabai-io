const http = require('node:http');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const root = __dirname;

let cached9RouterKey = null;
function get9RouterApiKey() {
  if (cached9RouterKey) return cached9RouterKey;
  try {
    const { DatabaseSync } = require('node:sqlite');
    const dbPath = path.join(process.env.APPDATA || '', '9router', 'db', 'data.sqlite');
    if (fsSync.existsSync(dbPath)) {
      const db = new DatabaseSync(dbPath);
      const row = db.prepare('SELECT key FROM apiKeys WHERE isActive = 1 ORDER BY createdAt DESC LIMIT 1').get();
      if (row && row.key) {
        cached9RouterKey = row.key;
        return row.key;
      }
    }
  } catch (_) {}
  return 'sk-cb903db624680de0-f6w9ez-80933162';
}

const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

    // 1. Suporte a CORS Preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end();
      return;
    }

    // 2. Health check para o 9Router local (localhost:20128)
    if (pathname === '/api/health-9router') {
      const probeReq = http.request({
        hostname: '127.0.0.1',
        port: 20128,
        path: '/v1/models',
        method: 'GET',
        headers: { 'Authorization': req.headers['authorization'] || `Bearer ${get9RouterApiKey()}` },
        timeout: 1500
      }, probeRes => {
        let raw = '';
        probeRes.on('data', c => { raw += c; });
        probeRes.on('end', () => {
          let models = [];
          try {
            const parsed = JSON.parse(raw);
            models = (parsed.data || []).map(m => m.id);
          } catch (_) {}
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ status: 'online', statusCode: probeRes.statusCode, models }));
        });
      });

      probeReq.on('timeout', () => {
        probeReq.destroy();
        if (!res.headersSent) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ status: 'offline', error: 'timeout' }));
        }
      });

      probeReq.on('error', () => {
        if (!res.headersSent) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ status: 'offline', error: 'unreachable' }));
        }
      });

      probeReq.end();
      return;
    }

    // 3. Proxy transparente para o endpoint /v1/chat/completions do 9Router
    if (pathname === '/api/chat' && req.method === 'POST') {
      const chunks = [];
      let totalBytes = 0;
      const MAX_BYTES = 1024 * 1024; // 1MB limite seguro

      req.on('data', chunk => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_BYTES) {
          if (!res.headersSent) {
            res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'payload_too_large', message: 'Payload excede limite seguro de 1MB' }));
          }
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        if (totalBytes > MAX_BYTES) return;
        let bodyBuffer = Buffer.concat(chunks);

        // Garante stream: false para receber resposta JSON padrão
        try {
          const parsed = JSON.parse(bodyBuffer.toString('utf-8'));
          if (parsed.stream !== true) {
            parsed.stream = false;
          }
          bodyBuffer = Buffer.from(JSON.stringify(parsed), 'utf-8');
        } catch (_) {}

        let authHeader = req.headers['authorization'];
        if (!authHeader || authHeader === 'Bearer 9router-local' || authHeader === 'Bearer undefined') {
          authHeader = `Bearer ${get9RouterApiKey()}`;
        }

        let proxyReq;
        try {
          proxyReq = http.request({
            hostname: '127.0.0.1',
            port: 20128,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': bodyBuffer.length,
              'Authorization': authHeader
            },
            timeout: 45000
          }, proxyRes => {
            console.log(`[API /api/chat] 9Router respondeu com status ${proxyRes.statusCode}`);
            res.writeHead(proxyRes.statusCode, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*'
            });
            proxyRes.pipe(res);
          });
        } catch (errInit) {
          console.error('[API /api/chat] Erro ao iniciar proxy:', errInit.message);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'proxy_init_failed', message: errInit.message }));
          }
          return;
        }

        // Cancelamento imediato do upstream se o cliente fechar a conexão prematuramente
        res.on('close', () => {
          if (!res.writableEnded) {
            proxyReq.destroy();
          }
        });

        proxyReq.on('timeout', () => {
          proxyReq.destroy();
          console.warn('[API /api/chat] Timeout de 45s aguardando 9Router');
          if (!res.headersSent) {
            res.writeHead(504, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: 'timeout', message: '9Router demorou para responder (timeout de 45s)' }));
          }
        });

        proxyReq.on('error', err => {
          console.error('[API /api/chat] Erro de rede com 9Router:', err.message);
          if (!res.headersSent) {
            res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: '9router_offline', message: '9Router não está ativo em localhost:20128' }));
          }
        });

        proxyReq.write(bodyBuffer);
        proxyReq.end();
      });
      return;
    }

    // 4. Servidor estático seguro existente
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !['.html', '.css', '.js', '.mjs', '.json'].includes(path.extname(file))) {
      res.writeHead(403); res.end('Acesso negado'); return;
    }
    const contents = await fs.readFile(file);
    res.setHeader('Content-Type', {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    }[path.extname(file)]);
    res.end(contents);
  } catch {
    res.writeHead(404);
    res.end('Arquivo não encontrado');
  }
});

if (require.main === module) {
  server.listen(4173, '127.0.0.1', () => console.log('Painel: http://127.0.0.1:4173'));
}

module.exports = server;
