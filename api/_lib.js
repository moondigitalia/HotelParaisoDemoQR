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

// crear sin pisar: si ya existe, falla (así dos clientes al mismo segundo nunca se quedan con el mismo folio)
async function crearJSON(pathname, obj) {
  return put(pathname, JSON.stringify(obj), {
    access: ACCESS, addRandomSuffix: false, allowOverwrite: false,
    contentType: 'application/json', cacheControlMaxAge: 60
  });
}

// respaldo antes de guardar: se guarda lo que había, con fecha; se quedan los 30 más nuevos de cada tipo
async function respaldar(tipo) {
  const actual = await readJSON('data/' + tipo + '.json', null);
  if (actual === null) return;
  await writeJSON('data/respaldos/' + tipo + '-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json', actual);
  try {
    const r = await list({ prefix: 'data/respaldos/' + tipo + '-', limit: 1000 });
    const viejos = r.blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1)).slice(30).map((b) => b.url);
    if (viejos.length) await del(viejos);
  } catch (e) { /* el respaldo nunca frena al dueño */ }
}

// código del panel: el maestro (guardado en Vercel, para recuperar) o el que el dueño puso desde su panel
const crypto = require('crypto');
function hashCodigo(pin) { return crypto.createHash('sha256').update('msport|' + String(pin || '')).digest('hex'); }
async function codigoValido(pin) {
  if (pinOk(pin)) return true;
  if (!pin) return false;
  const a = await readJSON('data/acceso.json', null);
  return !!(a && a.hash && a.hash === hashCodigo(pin));
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
  horario: [{ dias: [1, 2, 3, 4, 5], abre: '09:00', cierra: '19:00' }, { dias: [6], abre: '09:00', cierra: '18:00' }, { dias: [0], abre: '09:00', cierra: '16:30' }],
  direccion: 'Calle 19 #38, Cancún, Q.R.',
  lema: 'La tienda de las estrellas',
  tallas: ['Niño 6', 'Niño 8', 'Niño 10', 'Niño 12', 'Niño 14', 'Ch', 'M', 'G', 'XG', 'XXG'],
  categorias: ['Liga MX', 'Europa', 'Países'],
  maxEquipos: 10,
  sonido: 'si',
  sonidoUrl: '',
  sonidoVolumen: 50,
  textos: {},
  clientes: [],
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

// Config guardada + valores de arranque. Las carpetas viejas de la versión 2D (nunca editadas por el dueño)
// pasan solas a las nuevas: Liga MX, Liga europea, Mundial.
// (también las de arranque anteriores que el dueño nunca cambió: Liga MX, Liga europea, Mundial)
const VIEJAS = [['Clásicos', 'Diseños M Sport', 'Equipos de la casa'], ['Liga MX', 'Liga europea', 'Mundial']];
async function leerConfig() {
  const c = Object.assign({}, DEFAULT_CONFIG, await readJSON('data/config.json', {}));
  const cs = (c.categorias || []).slice().sort();
  if (VIEJAS.some((v) => { const o = v.slice().sort(); return cs.length === o.length && cs.every((x, i) => x === o[i]); })) c.categorias = DEFAULT_CONFIG.categorias.slice();
  return c;
}

module.exports = { leerConfig, put, list, del, readJSON, writeJSON, crearJSON, respaldar, codigoValido, hashCodigo, body, send, pinOk, DEFAULT_CONFIG, rid, ACCESS };
