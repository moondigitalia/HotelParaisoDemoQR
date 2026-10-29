// Datos públicos de la página: configuración de la tienda y catálogo visible.
const { leerConfig, readJSON, send, DEFAULT_CONFIG } = require('./_lib');

module.exports = async (req, res) => {
  const config = await leerConfig();
  const cat = await readJSON('data/catalogo.json', null);
  // null = el dueño todavía no ha guardado nada: la página usa el catálogo de arranque
  const visibles = cat === null ? null : cat
    .filter((u) => !u.borrado && !u.oculto)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
  send(res, 200, { config, catalogo: visibles });
};
