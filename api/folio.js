// Folios: el cliente guarda su diseño (POST) y cualquiera con el link lo abre (GET con clave).
const { readJSON, writeJSON, list, body, send, rid } = require('./_lib');

async function siguienteNumero() {
  let n = 0, cursor;
  do {
    const r = await list({ prefix: 'folios/', cursor, limit: 1000 });
    r.blobs.forEach((b) => {
      const m = /folios\/M-(\d+)\.json$/.exec(b.pathname);
      if (m) n = Math.max(n, parseInt(m[1], 10));
    });
    cursor = r.hasMore ? r.cursor : null;
  } while (cursor);
  return n + 1;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const id = String(req.query.id || '').toUpperCase();
    const k = String(req.query.k || '');
    if (!/^M-\d{4,6}$/.test(id)) return send(res, 400, { error: 'folio' });
    const f = await readJSON('folios/' + id + '.json', null);
    if (!f || f.clave !== k) return send(res, 404, { error: 'no' });
    const out = Object.assign({}, f); delete out.clave; delete out.historial;
    return send(res, 200, out);
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'metodo' });
  const b = await body(req);
  const equipos = Array.isArray(b.equipos) ? b.equipos.slice(0, 12) : [];
  if (!equipos.length) return send(res, 400, { error: 'vacio' });
  const limpio = equipos.map((e) => ({
    nombre: String(e.nombre || '').slice(0, 60),
    diseno: e.diseno || {},
    vistas: { frente: String((e.vistas || {}).frente || ''), espalda: String((e.vistas || {}).espalda || '') },
    originales: (Array.isArray(e.originales) ? e.originales : []).slice(0, 12).map(String),
    avisos: (Array.isArray(e.avisos) ? e.avisos : []).slice(0, 12).map(String),
    jugadores: (Array.isArray(e.jugadores) ? e.jugadores : []).slice(0, 60).map((j) => ({
      nombre: String(j.nombre || '').slice(0, 30), numero: String(j.numero || '').slice(0, 3), talla: String(j.talla || '').slice(0, 12)
    }))
  }));
  let num = await siguienteNumero();
  const id = 'M-' + String(num).padStart(4, '0');
  const clave = rid(6);
  const folio = { id, clave, creado: new Date().toISOString(), estado: 'nuevo', idioma: String(b.idioma || 'es').slice(0, 5), equipos: limpio };
  await writeJSON('folios/' + id + '.json', folio);
  send(res, 200, { id, clave });
};
