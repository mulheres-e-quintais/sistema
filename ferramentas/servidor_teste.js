/* Servidor de teste parecido com o GitHub Pages (compacta com gzip e guarda 10 min no navegador).
   Uso: node ferramentas/servidor_teste.js [porta]   → abre o sistema em http://localhost:8766 */
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const raiz = path.join(__dirname, '..'); const porta = +process.argv[2] || 8766;
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xlsx': 'application/octet-stream' };
http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(raiz, path.normalize(p)); if (!f.startsWith(raiz)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, b) => {
    if (e) { r.writeHead(404); return r.end(); }
    const t = tipos[path.extname(f)] || 'application/octet-stream'; const h = { 'Content-Type': t, 'Cache-Control': 'max-age=600' };
    if (/text|javascript|json|svg|manifest/.test(t) && /gzip/.test(q.headers['accept-encoding'] || '')) { h['Content-Encoding'] = 'gzip'; b = zlib.gzipSync(b); }
    r.writeHead(200, h); r.end(b);
  });
}).listen(porta, () => console.log('http://localhost:' + porta));
