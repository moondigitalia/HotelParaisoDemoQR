// Guarda una imagen que sube el cliente o el dueño. Llega ya reducida desde el navegador.
const { put, body, send, rid } = require('./_lib');

const hits = new Map(); // freno básico por persona (por servidor activo)

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'metodo' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
  const now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (h.length >= 200) return send(res, 429, { error: 'limite' });
  h.push(now); hits.set(ip, h);

  const b = await body(req);
  const m = /^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(b.data || '');
  if (!m) return send(res, 400, { error: 'formato' });
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length > 4.2e6) return send(res, 413, { error: 'grande' });
  const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
  const carpeta = b.carpeta === 'catalogo' ? 'catalogo' : 'subidas';
  const blob = await put(carpeta + '/' + new Date().toISOString().slice(0, 10) + '-' + rid(10) + '.' + ext, buf, {
    access: 'public', contentType: m[1], addRandomSuffix: false, cacheControlMaxAge: 31536000
  });
  send(res, 200, { url: blob.url });
};
