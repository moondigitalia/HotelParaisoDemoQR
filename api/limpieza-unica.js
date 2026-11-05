// TEMPORAL (se quita en cuanto se usa): borra los pedidos de prueba y el uniforme de prueba "Tiburones Rojos 1998".
const { readJSON, writeJSON, list, del, send, respaldar } = require('./_lib');
module.exports = async (req, res) => {
  if (String((req.query || {}).t || '') !== 'c82b4da6b506d9ce77516dffda34c2aa') return send(res, 404, { error: 'no' });
  const urls = []; let cursor;
  do { const r = await list({ prefix: 'folios/', cursor, limit: 1000 }); r.blobs.forEach((b) => urls.push(b.url)); cursor = r.hasMore ? r.cursor : null; } while (cursor);
  if (urls.length) await del(urls);
  let cat = await readJSON('data/catalogo.json', null), quitados = 0;
  if (Array.isArray(cat)) { const antes = cat.length; await respaldar('catalogo'); cat = cat.filter((u) => u.id !== 'umvuie6pp'); quitados = antes - cat.length; await writeJSON('data/catalogo.json', cat); }
  send(res, 200, { foliosBorrados: urls.length, uniformesQuitados: quitados });
};
