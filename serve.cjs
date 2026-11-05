const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = __dirname;
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !['.html', '.css', '.js', '.mjs', '.json'].includes(path.extname(file))) {
      res.writeHead(403); res.end('Acesso negado'); return;
    }
    const contents = await fs.readFile(file);
    res.setHeader('Content-Type', {'.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8'}[path.extname(file)]);
    res.end(contents);
  } catch { res.writeHead(404); res.end('Arquivo não encontrado'); }
});
if (require.main === module) {
  server.listen(4173, '127.0.0.1', () => console.log('Painel: http://127.0.0.1:4173'));
}
module.exports = server;
