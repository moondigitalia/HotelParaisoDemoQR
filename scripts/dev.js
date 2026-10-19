// Servidor local de pruebas: archivos estáticos + /api con un almacenamiento falso en disco.
const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
const ROOT = path.join(__dirname, '..'), BLOB = path.join(__dirname, '.blob');
fs.mkdirSync(BLOB, { recursive: true });
const PORT = +process.env.PORT || 5055;
const fake = {
  put: async (p, data, o) => { const f = path.join(BLOB, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); return { url: 'http://localhost:' + PORT + '/_blob/' + p, pathname: p }; },
  get: async (p) => { const f = path.join(BLOB, p); if (!fs.existsSync(f)) return null; const { Readable } = require('stream'); return { stream: Readable.toWeb(fs.createReadStream(f)) }; },
  list: async ({ prefix }) => { const d = path.join(BLOB, prefix); const out = []; if (fs.existsSync(d)) for (const n of fs.readdirSync(d)) { const st = fs.statSync(path.join(d, n)); out.push({ pathname: prefix + n, url: 'http://localhost:' + PORT + '/_blob/' + prefix + n, uploadedAt: st.mtime }); } return { blobs: out, hasMore: false }; },
  del: async () => {}
};
require.cache[require.resolve('/tmp/claude-0/blobtest/node_modules/@vercel/blob')] = { exports: fake, loaded: true, id: 'x' };
const Module = require('module'); const orig = Module._resolveFilename;
Module._resolveFilename = function (r, ...a) { if (r === '@vercel/blob') return require.resolve('/tmp/claude-0/blobtest/node_modules/@vercel/blob'); return orig.call(this, r, ...a); };
process.env.ADMIN_PIN = process.env.ADMIN_PIN || '4719';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  if (u.pathname.startsWith('/api/')) {
    const fn = require(path.join(ROOT, 'api', u.pathname.slice(5) + '.js'));
    req.query = u.query;
    try { await fn(req, res); } catch (e) { console.error(e); res.statusCode = 500; res.end('err'); }
    return;
  }
  let f = u.pathname.startsWith('/_blob/') ? path.join(BLOB, u.pathname.slice(7)) : path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('404'); }
  res.setHeader('Content-Type', TYPES[path.extname(f)] || 'application/octet-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log('dev ' + PORT));
