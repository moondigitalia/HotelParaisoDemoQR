// Panel del dueño. Todo pasa por aquí con su código.
const { leerConfig, readJSON, writeJSON, list, del, body, send, pinOk, DEFAULT_CONFIG } = require('./_lib');

const DIA = 864e5;
const fallos = new Map();

async function todosLosFolios() {
  const out = []; let cursor;
  do {
    const r = await list({ prefix: 'folios/', cursor, limit: 1000 });
    r.blobs.forEach((b) => { if (/\.json$/.test(b.pathname)) out.push(b.pathname); });
    cursor = r.hasMore ? r.cursor : null;
  } while (cursor);
  const folios = await Promise.all(out.map((p) => readJSON(p, null)));
  return folios.filter(Boolean).sort((a, b) => (a.creado < b.creado ? 1 : -1));
}

// Limpieza automática: papelera > 30 días y fotos sueltas > 6 meses que nadie usa.
async function limpiar(cat, folios) {
  const ahora = Date.now();
  const vivos = cat.filter((u) => !(u.borrado && ahora - u.borrado > 30 * DIA));
  if (vivos.length !== cat.length) await writeJSON('data/catalogo.json', vivos);
  try {
    const usadas = new Set(JSON.stringify([vivos, folios]).match(/https:[^"]+/g) || []);
    const r = await list({ prefix: 'subidas/', limit: 1000 });
    const viejas = r.blobs.filter((b) => ahora - new Date(b.uploadedAt).getTime() > 180 * DIA && !usadas.has(b.url)).map((b) => b.url);
    if (viejas.length) await del(viejas);
  } catch (e) { /* la limpieza nunca frena al dueño */ }
  return vivos;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'metodo' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
  const f = (fallos.get(ip) || []).filter((t) => Date.now() - t < 900e3);
  if (f.length >= 8) return send(res, 429, { error: 'espera' });
  const b = await body(req);
  if (!pinOk(b.pin)) { f.push(Date.now()); fallos.set(ip, f); return send(res, 401, { error: 'codigo' }); }

  const accion = b.accion;
  if (accion === 'todo') {
    const folios = await todosLosFolios();
    let cat = await readJSON('data/catalogo.json', null);
    if (cat !== null) cat = await limpiar(cat, folios);
    const config = await leerConfig();
    folios.forEach((x) => { delete x.historial; });
    return send(res, 200, { folios, catalogo: cat, config });
  }
  if (accion === 'estado') {
    const id = String(b.id || '');
    if (!/^M-\d{4,6}$/.test(id)) return send(res, 400, { error: 'folio' });
    const fo = await readJSON('folios/' + id + '.json', null);
    if (!fo) return send(res, 404, { error: 'no' });
    const est = ['nuevo', 'cotizado', 'produccion', 'entregado'];
    if (est.indexOf(b.estado) < 0) return send(res, 400, { error: 'estado' });
    fo.estado = b.estado;
    fo.historial = (fo.historial || []).concat([{ estado: b.estado, fecha: new Date().toISOString() }]);
    await writeJSON('folios/' + id + '.json', fo);
    return send(res, 200, { ok: true });
  }
  if (accion === 'catalogo') {
    if (!Array.isArray(b.catalogo)) return send(res, 400, { error: 'catalogo' });
    const cat = b.catalogo.slice(0, 400);
    await writeJSON('data/catalogo.json', cat);
    return send(res, 200, { ok: true });
  }
  if (accion === 'config') {
    const c = b.config || {};
    const limpio = {
      whatsapp: String(c.whatsapp || '').replace(/\D/g, '').slice(0, 15),
      horario: (Array.isArray(c.horario) ? c.horario : []).slice(0, 7).map((h) => ({
        dias: (Array.isArray(h.dias) ? h.dias : []).map(Number).filter((d) => d >= 0 && d <= 6),
        abre: /^\d{2}:\d{2}$/.test(h.abre) ? h.abre : '09:00',
        cierra: /^\d{2}:\d{2}$/.test(h.cierra) ? h.cierra : '19:00'
      })).filter((h) => h.dias.length),
      direccion: String(c.direccion || '').slice(0, 140),
      lema: String(c.lema || '').slice(0, 60),
      historia: String(c.historia || '').slice(0, 900),
      calificacion: String(c.calificacion || '').replace(/[^0-9.]/g, '').slice(0, 3),
      opiniones: String(c.opiniones || '').replace(/\D/g, '').slice(0, 6),
      tallas: (Array.isArray(c.tallas) ? c.tallas : []).map((t) => String(t).slice(0, 12)).filter(Boolean).slice(0, 30),
      categorias: (Array.isArray(c.categorias) ? c.categorias : []).map((t) => String(t).slice(0, 40)).filter(Boolean).slice(0, 20)
    };
    await writeJSON('data/config.json', limpio);
    return send(res, 200, { ok: true });
  }
  send(res, 400, { error: 'accion' });
};
