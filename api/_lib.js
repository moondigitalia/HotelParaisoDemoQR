const { put, get, list, del } = require('@vercel/blob');

const ACCESS = 'public';

async function readJSON(pathname, fallback) {
  try {
    const r = await get(pathname, { access: ACCESS, useCache: false });
    if (!r || !r.stream) return fallback;
    const text = await new Response(r.stream).text();
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}

async function writeJSON(pathname, obj) {
  return put(pathname, JSON.stringify(obj), {
    access: ACCESS, addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json', cacheControlMaxAge: 60
  });
}

function body(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((res) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 6e6) req.destroy(); });
    req.on('end', () => { try { res(JSON.parse(s || '{}')); } catch (e) { res({}); } });
  });
}

function send(res, code, data) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function pinOk(pin) {
  const real = process.env.ADMIN_PIN || '';
  return real.length > 0 && String(pin || '') === real;
}

const DEFAULT_CONFIG = {
  whatsapp: '',
  horario: 'Lun–Vie 9:00–19:00 · Sáb 9:00–18:00 · Dom 9:00–16:30',
  direccion: 'Calle 19 #38, Cancún, Q.R.',
  lema: 'La tienda de las estrellas',
  tallas: ['Niño 6', 'Niño 8', 'Niño 10', 'Niño 12', 'Niño 14', 'Ch', 'M', 'G', 'XG', 'XXG'],
  categorias: ['Equipos de la casa', 'Diseños M Sport', 'Clásicos'],
  historia: '',
  calificacion: '4.3',
  opiniones: '150'
};

function rid(n) {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  const r = require('crypto').randomBytes(n);
  for (let i = 0; i < n; i++) s += a[r[i] % a.length];
  return s;
}

module.exports = { put, list, del, readJSON, writeJSON, body, send, pinOk, DEFAULT_CONFIG, rid, ACCESS };
