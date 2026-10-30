// Panel del dueño. Todo pasa por aquí con su código.
const { leerConfig, readJSON, writeJSON, list, del, body, send, codigoValido, hashCodigo, respaldar, DEFAULT_CONFIG } = require('./_lib');

const DIA = 864e5;
const fallos = new Map();

// Los folios más nuevos primero, de 150 en 150 (con los años pueden ser miles: el panel abre rápido igual)
const POR_PAGINA = 150;
async function folios(antesDe) {
  const nums = []; let cursor;
  do {
    const r = await list({ prefix: 'folios/', cursor, limit: 1000 });
    r.blobs.forEach((b) => { const m = /folios\/M-(\d+)\.json$/.exec(b.pathname); if (m) nums.push(parseInt(m[1], 10)); });
    cursor = r.hasMore ? r.cursor : null;
  } while (cursor);
  const lista = nums.filter((n) => !antesDe || n < antesDe).sort((a, b) => b - a);
  const pagina = lista.slice(0, POR_PAGINA);
  const leidos = await Promise.all(pagina.map((n) => readJSON('folios/M-' + String(n).padStart(4, '0') + '.json', null)));
  return { folios: leidos.filter(Boolean), mas: lista.length > POR_PAGINA };
}

// Limpieza automática: solo la papelera de más de 30 días. Las fotos de los clientes nunca se borran solas.
async function limpiar(cat) {
  const ahora = Date.now();
  const vivos = cat.filter((u) => !(u.borrado && ahora - u.borrado > 30 * DIA));
  if (vivos.length !== cat.length) await writeJSON('data/catalogo.json', vivos);
  return vivos;
}

const TEXTOS_EDITABLES = { intro_lema: 60, hero_k: 60, hero_t: 80, hero_p: 240, cat_t: 40, cat_p: 120, hist_k: 40, hist_t: 60, cifra_a: 6, hist_prendas: 90, cifra_b: 6, hist_folio: 90, eq_k: 60, eq_p: 160, como_t: 40, como_1: 50, como_2: 50, como_3: 50, visita_t: 40, escribenos: 40, como_llegar: 30 };
// una red social: un link completo o un @usuario (se guarda tal cual, sin espacios)
function red(v) { v = String(v || '').trim().replace(/\s+/g, ''); return /^[^"'<>]{1,200}$/.test(v) ? v : ''; }
module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'metodo' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'x';
  const f = (fallos.get(ip) || []).filter((t) => Date.now() - t < 900e3);
  if (f.length >= 8) return send(res, 429, { error: 'espera' });
  const b = await body(req);
  if (!(await codigoValido(b.pin))) { f.push(Date.now()); fallos.set(ip, f); return send(res, 401, { error: 'codigo' }); }

  const accion = b.accion;
  if (accion === 'todo') {
    const fo = await folios(0);
    let cat = await readJSON('data/catalogo.json', null);
    if (cat !== null) cat = await limpiar(cat);
    const config = await leerConfig();
    fo.folios.forEach((x) => { delete x.historial; });
    return send(res, 200, { folios: fo.folios, masFolios: fo.mas, catalogo: cat, config });
  }
  if (accion === 'folios') {
    const fo = await folios(parseInt(b.antesDe, 10) || 0);
    fo.folios.forEach((x) => { delete x.historial; });
    return send(res, 200, { folios: fo.folios, masFolios: fo.mas });
  }
  // buscar un folio por su número (el cliente lo manda por WhatsApp): aunque sea viejo, se encuentra
  if (accion === 'buscarFolio') {
    const n = parseInt(String(b.numero || '').replace(/\D/g, ''), 10);
    if (!n) return send(res, 400, { error: 'numero' });
    const id = 'M-' + String(n).padStart(4, '0');
    const fo = await readJSON('folios/' + id + '.json', null);
    if (fo) delete fo.historial;
    return send(res, 200, { folio: fo });
  }
  // cómo estaba antes: los últimos respaldos, y regresar a uno
  if (accion === 'respaldos') {
    const out = [];
    for (const tipo of ['catalogo', 'config']) {
      const r = await list({ prefix: 'data/respaldos/' + tipo + '-', limit: 1000 });
      r.blobs.forEach((x) => out.push({ path: x.pathname, tipo, fecha: x.uploadedAt }));
    }
    out.sort((a, b) => (a.path.slice(-29) < b.path.slice(-29) ? 1 : -1));
    return send(res, 200, { respaldos: out.slice(0, 40) });
  }
  if (accion === 'restaurar') {
    const m = /^data\/respaldos\/(catalogo|config)-[0-9TZ-]+\.json$/.exec(String(b.path || ''));
    if (!m) return send(res, 400, { error: 'respaldo' });
    const viejo = await readJSON(b.path, null);
    if (viejo === null) return send(res, 404, { error: 'no' });
    await respaldar(m[1]);
    await writeJSON('data/' + m[1] + '.json', viejo);
    return send(res, 200, { ok: true });
  }
  // el dueño cambia su código; el maestro (en Vercel) sigue sirviendo para recuperar el acceso
  if (accion === 'codigo') {
    const nuevo = String(b.nuevo || '').trim();
    if (nuevo.length < 4 || nuevo.length > 32) return send(res, 400, { error: 'corto' });
    await writeJSON('data/acceso.json', { hash: hashCodigo(nuevo), cambiado: new Date().toISOString() });
    return send(res, 200, { ok: true });
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
    await respaldar('catalogo');
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
      categorias: (Array.isArray(c.categorias) ? c.categorias : []).map((t) => String(t).slice(0, 40)).filter(Boolean).slice(0, 20),
      maxEquipos: Math.min(30, Math.max(1, parseInt(c.maxEquipos, 10) || 10)),
      sonido: c.sonido === 'no' ? 'no' : 'si',
      sonidoUrl: /^(https?:\/\/|\/)[^\s"'<>]{1,400}$/.test(String(c.sonidoUrl || '')) ? String(c.sonidoUrl) : '',
      sonidoVolumen: Math.min(100, Math.max(0, isFinite(parseFloat(c.sonidoVolumen)) ? Math.round(parseFloat(c.sonidoVolumen)) : 50)),
      // cualquier texto de la página que el dueño cambie (solo los que existen en la lista; vacío = el de siempre)
      textos: Object.keys(TEXTOS_EDITABLES).reduce((o, k) => { const v = String((c.textos || {})[k] || '').trim().slice(0, TEXTOS_EDITABLES[k]); if (v) o[k] = v; return o; }, {}),
      // equipos que visten M Sport: foto del uniforme que les hicieron, nombre y sus redes
      clientes: (Array.isArray(c.clientes) ? c.clientes : []).slice(0, 12).map((x) => ({
        id: String(x.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 16) || Math.random().toString(36).slice(2, 10),
        nombre: String(x.nombre || '').slice(0, 40),
        foto: /^(https?:\/\/|\/)[^\s"'<>]{1,400}$/.test(String(x.foto || '')) ? String(x.foto) : '',
        escudo: /^(https?:\/\/|\/)[^\s"'<>]{1,400}$/.test(String(x.escudo || '')) ? String(x.escudo) : '',
        uni: String(x.uni || '').replace(/[^a-z0-9-]/gi, '').slice(0, 60),
        ig: red(x.ig), fb: red(x.fb), tt: red(x.tt)
      })).filter((x) => x.nombre || x.foto || x.uni)
    };
    await respaldar('config');
    await writeJSON('data/config.json', limpio);
    return send(res, 200, { ok: true });
  }
  send(res, 400, { error: 'accion' });
};
