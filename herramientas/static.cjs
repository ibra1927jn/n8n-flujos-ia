// Servidor estático mínimo para previsualizar la carpeta del proyecto (solo pruebas).
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(process.argv[2] || '.');
const PORT = Number(process.argv[3] || process.env.PORT || 8123);
const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };
http
  .createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const file = path.resolve(path.join(ROOT, rel === '/' ? 'guia.html' : rel));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('no'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('no encontrado: ' + rel); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  })
  .listen(PORT, '127.0.0.1', () => console.log(`sirviendo ${ROOT} en http://localhost:${PORT}`));
