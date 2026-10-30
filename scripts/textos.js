// Genera api/_textos.js: la lista de TODOS los textos de la página que el dueño puede cambiar (todos menos el crédito de MOON)
// con su largo máximo. Se corre cada vez que cambia js/i18n.js (revision.py revisa que estén iguales).
global.window = {}; require('../js/i18n.js');
const es = window.I18N.es, FIJOS = ['pie'];
const lim = {}; Object.keys(es).filter((k) => FIJOS.indexOf(k) < 0).forEach((k) => { lim[k] = Math.max(30, Math.min(500, Math.round(String(es[k]).length * 2.5))); });
lim.hist_p = 900;   // la historia de la tienda puede ser larga
require('fs').writeFileSync(__dirname + '/../api/_textos.js', '// generado por scripts/textos.js: no se edita a mano\nmodule.exports = ' + JSON.stringify(lim) + ';\n');
console.log(Object.keys(lim).length, 'textos editables');
