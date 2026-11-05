(function () {
  'use strict';
  // la vista de "Página" dentro del panel es la misma página, cargada en modo editar: ahí el panel no existe
  // (si no, dejar picado el logo de esa vista abría un panel dentro del panel, sin fin)
  if (/[?&]editar=1/.test(location.search) && window.parent !== window) { var pn0 = document.getElementById('panel'); if (pn0) pn0.remove(); return; }
  var A = window.APP, T = A.T, esc = A.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var panel = $('#panel');
  var P = { pin: null, tab: 'folios', folios: [], catalogo: [], config: {}, editando: null, detalle: null };
  var DIA = 864e5;
  var ESTADOS = ['nuevo', 'cotizado', 'produccion', 'entregado'];
  // el panel es del dueño: siempre en español, aunque su celular esté en otro idioma
  function ES(k) { return (window.I18N.es || {})[k] || k; }
  var ses = {
    get: function () { try { return sessionStorage.getItem('msport:pin'); } catch (e) { return null; } },
    set: function (v) { try { sessionStorage.setItem('msport:pin', v); } catch (e) { /* nada */ } }
  };

  function api(accion, extra) {
    var b = Object.assign({ pin: P.pin, accion: accion }, extra || {});
    return fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || 'error'); e.code = r.status; throw e; } return j; }); });
  }

  // con el panel abierto, en Android (Chrome) el teclado achica la pantalla del panel en vez de taparla:
  // así lo que escribes y tu página quedan arriba del teclado, sin espacio en blanco. El iPhone lo hace con su propia medida.
  var metaVp = document.querySelector('meta[name=viewport]'), vpBase = metaVp ? metaVp.getAttribute('content') : '';
  function tecladoAchica(si) { if (metaVp) metaVp.setAttribute('content', si ? vpBase + ',interactive-widget=resizes-content' : vpBase); }
  function abrir() {
    if (panel.hidden) window.FIJAR.on(); panel.hidden = false; tecladoAchica(true);
    P.pin = P.pin || ses.get();
    if (P.pin) cargar(); else pantallaPin();
  }
  function cerrar() {
    if (!panel.hidden) window.FIJAR.off(); panel.hidden = true; tecladoAchica(false);
    if (location.hash === '#panel') history.replaceState(null, '', location.pathname + location.search);
  }

  // el marco de todo el panel: arriba una barra delgada (volver o logo, el nombre del cuarto, y a la derecha lo que toque),
  // en medio lo que se ve y cambia (solo eso se mueve si es largo) y abajo la barra fija de los 4 cuartos
  var FLECHA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  // el panel se vuelve a pintar entero, menos la vista de la página (un iframe): si se quitara y se pusiera, se recargaría
  function ponerHTML(h) {
    var cap = P.capaPag;
    if (!cap || cap.parentNode !== panel) { panel.innerHTML = h; return; }
    Array.prototype.slice.call(panel.childNodes).forEach(function (n) { if (n !== cap) panel.removeChild(n); });
    panel.insertAdjacentHTML('afterbegin', h);
  }
  /* ---------- una sola regla para todo el panel: nada se corta de golpe ----------
     Cualquier parte que se desliza (de arriba abajo o de lado) se desvanece justo donde hay algo escondido, y deja de
     desvanecerse al llegar al final. Si lo único que sobra es el margen de abajo (unos pixeles), se quita ese margen:
     nunca queda un "scroll chiquito" que no lleva a nada. */
  function bordes(el) {
    var cs = getComputedStyle(el), y = /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight - el.clientHeight > 1, x = /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth - el.clientWidth > 1;
    if (!x && !y) { el.removeAttribute('data-vig'); el.classList.remove('f-arr', 'f-aba', 'f-izq', 'f-der'); return; }
    el.setAttribute('data-vig', y ? 'y' : 'x');
    el.classList.toggle('f-arr', y && el.scrollTop > 2);
    el.classList.toggle('f-aba', y && el.scrollTop + el.clientHeight < el.scrollHeight - 2);
    el.classList.toggle('f-izq', !y && x && el.scrollLeft > 2);
    el.classList.toggle('f-der', !y && x && el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }
  function vigilarBordes() {
    var todos = panel.querySelectorAll('.pn *');
    for (var i = 0; i < todos.length; i++) {
      var el = todos[i], cs = getComputedStyle(el);
      if (!/(auto|scroll)/.test(cs.overflowY + cs.overflowX) || !el.offsetParent) continue;
      bordes(el);
    }
  }
  panel.addEventListener('scroll', function (e) { var t = e.target; if (t && t.nodeType === 1 && t.hasAttribute('data-vig')) bordes(t); }, true);
  window.addEventListener('resize', function () { setTimeout(vigilarBordes, 60); });
  // cualquier cambio en el panel (se abre una hoja, se escoge una pieza, sale un recuadro) vuelve a revisar los bordes
  var vigPend = false;
  if (window.MutationObserver) new MutationObserver(function () { if (vigPend) return; vigPend = true; (window.requestAnimationFrame || setTimeout)(function () { vigPend = false; vigilarBordes(); }); }).observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  function marco(contenido, cfg) {
    cfg = cfg || {};
    return '<div class="pn' + (cfg.barra ? ' con-barra' : '') + (cfg.clase ? ' ' + cfg.clase : '') + '"><header class="pn-top">' +
      // dos botones que nunca se confunden: "Regresar" (vuelve un paso, adentro de algo) y "Salir del panel" (te saca del panel)
      (cfg.atras ? '<button type="button" class="pn-atras pn-txt-b" data-atras>' + FLECHA + '<span>Regresar</span></button>' : '<button type="button" class="pn-salir-b pn-txt-b" data-pn-cerrar><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/></svg><span>Salir del panel</span></button>') +
      '<b>' + esc(cfg.titulo == null ? 'Panel M Sport' : cfg.titulo) + '</b><span class="pn-top-der">' + (cfg.der || '') + '</span>' +
      ''+ '</header>' +
      '<div class="pn-cuerpo">' + contenido + '</div>' + (cfg.barra || '') + '</div>';
  }
  var ICON = {
    folios: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
    uniformes: '<path d="M8 3l-5 4 2 4 3-1v11h8V10l3 1 2-4-5-4c-1 2-2.5 3-4 3S9 5 8 3Z"/>',
    pagina: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
    datos: '<path d="M4 10l1.5-6h13L20 10M4 10v10h16V10M4 10h16M10 20v-5h4v5"/>',
    mas: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    engrane: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'
  };
  function icono(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + '</svg>'; }
  function pantallaPin(error) {
    ponerHTML(marco('<form class="pn-pin" id="pn-pin"><h2>Hola</h2><p>Escribe tu código para entrar a tu panel.</p>' +
      '<input class="campo pn-codigo" id="pn-codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="8" aria-label="Código">' +
      (error ? '<p class="pn-error">' + esc(error) + '</p>' : '') +
      '<button class="btn btn-oro btn-xl" type="submit">Entrar</button></form>'));
    enlazarMarco();
    var inp = $('#pn-codigo'); setTimeout(function () { inp.focus(); }, 60);
    $('#pn-pin').addEventListener('submit', function (e) {
      e.preventDefault(); P.pin = inp.value.trim(); cargar();
    });
  }
  function cargar() {
    ponerHTML(marco('<p class="pn-cargando">Cargando tu panel…</p>')); enlazarMarco();
    api('todo').then(function (j) {
      ses.set(P.pin);
      P.folios = j.folios || []; P.masFolios = !!j.masFolios; P.catalogo = (Array.isArray(j.catalogo) && j.catalogo.some(function (u) { return u.tipo === '3d'; })) ? (A.completarCatalogo ? A.completarCatalogo(j.catalogo) : j.catalogo) : A.clone(window.CATALOGO_BASE); P.config = j.config || {};
      pintar();
      setTimeout(migrarCirculos, 5000);
    }).catch(function (e) {
      ses.set(''); var pin = P.pin; P.pin = null;
      pantallaPin(e.code === 401 && pin ? 'Ese código no es correcto. Inténtalo otra vez.' : e.code === 429 ? 'Demasiados intentos. Espera unos minutos.' : 'No hay conexión en este momento. Inténtalo otra vez.');
    });
  }
  function enlazarMarco() {
    $$('[data-pn-cerrar]', panel).forEach(function (b) { b.addEventListener('click', cerrar); });
  }

  // vuelve a dibujar el panel sin brincar: se queda donde estabas, o va al lugar que se le pida
  // vuelve a dibujar el panel sin brincar: se queda donde estabas, o va al lugar que se le pida
  var CUARTO = { folios: 'Pedidos', uniformes: 'Uniformes', pagina: 'Tu página', datos: 'Tu tienda', ajustes: 'Ajustes', papelera: 'Papelera', claves: 'Palabras clave' };
  function pintar(irA) {
    var cu0 = $('.pn-cuerpo', panel), antes = cu0 ? cu0.scrollTop : 0;
    var nuevos = P.folios.filter(function (f) { return f.estado === 'nuevo'; }).length;
    // dentro de algo (un folio, un equipo, el estudio de un uniforme, la papelera, ajustes): arriba "volver" y sin barra de abajo
    var dentro = (P.tab === 'folios' && P.detalle !== null) || (P.tab === 'uniformes' && (P.editando || P.equipo)) || P.tab === 'papelera' || P.tab === 'ajustes' || P.tab === 'claves';
    var h = '';
    if (P.tab === 'folios') h += P.detalle !== null ? vistaDetalle() : vistaFolios();
    if (P.tab === 'uniformes') h += P.editando ? vistaEditor() : vistaUniformes();
    if (P.tab === 'datos' || P.tab === 'pagina' || P.tab === 'ajustes') h += vistaDatos();
    if (P.tab === 'papelera') h += vistaPapelera();
    if (P.tab === 'claves') h += vistaClaves();
    // en el estudio el nombre del uniforme ya se ve abajo ("Equipo y diseño"): arriba solo Regresar y Guardar, sin texto cortado
    var titulo = (P.tab === 'uniformes' && P.editando) || (P.tab === 'claves' && P.clave) ? '' : P.tab === 'uniformes' && P.equipo ? ((equipoDe(arbol(), P.equipo) || {}).nombre || 'Equipo') : P.tab === 'folios' && P.detalle !== null ? 'Pedido' : CUARTO[P.tab];
    var ETIQ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="8.5" r="1.4"/></svg>';
    var der = P.tab === 'uniformes' && !P.editando && !P.equipo ? '<button type="button" class="pn-redondo" data-ir="claves" aria-label="Palabras clave">' + ETIQ + '</button>' : P.tab === 'folios' && P.detalle === null && P.folios.length ? '<button type="button" class="pn-redondo' + (P.buscando ? ' on' : '') + '" data-lupa aria-label="Buscar un pedido por su número"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></button>' : P.tab === 'datos' ? '<span class="pn-pg-estado" id="pg-estado"></span><button type="button" class="pn-redondo" data-ir="ajustes" aria-label="Más de tu tienda: tallas, sonido y código">' + icono('mas') + '</button>' : P.tab === 'pagina' ? '<span class="pn-pg-estado" id="pg-estado"></span><button type="button" class="pn-redondo" data-pg-mas aria-label="Más de tu página: calificación y equipos que visten M Sport">' + icono('mas') + '</button>' : '';
    var barra = dentro ? '' : '<nav class="pn-barra" aria-label="Panel">' + [['folios', 'Pedidos'], ['uniformes', 'Uniformes'], ['pagina', 'Página'], ['datos', 'Tienda']].map(function (t) {
      return '<button type="button" class="pn-barra-b' + (P.tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '"><span class="pn-barra-i">' + icono(t[0]) + '</span><span>' + t[1] + '</span>' + (t[0] === 'folios' && nuevos ? '<i>' + nuevos + '</i>' : '') + '</button>';
    }).join('') + '</nav>';
    ponerHTML(marco(h, { titulo: titulo, atras: dentro, der: der, barra: barra, clase: P.tab === 'uniformes' && P.editando ? 'estudio' : P.tab === 'claves' && P.clave ? 'claves-ed' : P.tab === 'pagina' ? 'pagina' : P.tab === 'folios' && P.detalle === null ? 'folios' : P.tab === 'datos' ? 'tienda' : '' })); enlazarMarco();
    var pubE = $('.pn-cuerpo .pn-publicar', panel); if (pubE) $('.pn-top-der', panel).appendChild(pubE);   // en el estudio, Publicar/Guardar va arriba en la barra, nunca encima del uniforme
    var cu1 = $('.pn-cuerpo', panel); if (cu1) cu1.scrollTop = irA == null ? antes : irA;
    colocarCapa();
    vigilarBordes();
    $$('[data-tab]', panel).forEach(function (b) { b.addEventListener('click', function () { P.tab = b.getAttribute('data-tab'); P.editando = null; P.detalle = null; P.equipo = null; P.tSel = ''; pintar(0); }); });
    var lu = $('[data-lupa]', panel); if (lu) lu.addEventListener('click', function () { P.buscando = !P.buscando; pintar(0); var bf = $('#pn-bf', panel); if (bf) bf.focus(); });
    $$('[data-ir]', panel).forEach(function (b) { b.addEventListener('click', function () { P.tab = b.getAttribute('data-ir'); pintar(0); }); });
    // "volver" de arriba: hace lo mismo que el volver de cada vista
    var at = $('[data-atras]', panel);
    if (at) at.addEventListener('click', function () {
      var v = $('.pn-cuerpo [data-volver], .pn-cuerpo [data-volver-eq]', panel);
      if (v) return v.click();
      if (P.tab === 'claves' && P.clave) { P.clave = null; return pintar(0); }   // de una palabra regresa a la lista de palabras
      P.tab = P.tab === 'papelera' || P.tab === 'claves' ? 'uniformes' : 'datos'; pintar(0);
    });
    ({ folios: P.detalle !== null ? enlazarDetalle : enlazarFolios, uniformes: P.editando ? enlazarEditor : enlazarUniformes, datos: enlazarDatos, pagina: enlazarDatos, ajustes: enlazarDatos, papelera: enlazarPapelera, claves: enlazarClaves })[P.tab]();
  }

  /* ---------- palabras clave ----------
     Para que te encuentren con la lupa. Arriba escribes una palabra; abajo, todas las que ya tienes (cada una dice en cuántos
     uniformes va). Al tocar una (o al agregar una nueva) se ven todos tus uniformes en círculos: tocas en cuáles va y Guardar.
     Una sola pieza a la vez, sin recuadros adentro de recuadros; escoger solo cambia el aro (nada se mueve). */
  function clavesDe(u) { return String((u.etiquetas && u.etiquetas.otros) || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  function igual(a, b) { return normal(a) === normal(b); }
  function unisClaves() { return P.catalogo.filter(function (u) { return u.tipo === '3d' && !u.borrado; }); }
  function todasClaves() {
    var m = {}; unisClaves().forEach(function (u) { clavesDe(u).forEach(function (k) { var n = normal(k); if (!m[n]) m[n] = { txt: k, n: 0 }; m[n].n++; }); });
    return Object.keys(m).sort().map(function (n) { return m[n]; });
  }
  function vistaClaves() {
    if (P.clave) {
      var c = P.clave;
      return '<div class="pn-cl pn-cl-ed">' +
        '<div class="pn-cl-fila"><label class="etq" for="cl-txt">Palabra</label>' + (c.orig ? '<button type="button" class="pn-cl-quitar" data-cl-quitar>Quitar palabra</button>' : '') + '</div><input class="campo pn-cl-txt" id="cl-txt" maxlength="30" autocomplete="off" enterkeyhint="done" value="' + esc(c.txt) + '">' +
        '<p class="pn-cl-preg">¿En qué uniformes va?</p>' +
        '<div class="pn-cl-unis" data-vig="x">' + unisClaves().map(function (u) {
          var img = u.circulo || u.silueta;
          return '<button type="button" class="pn-cl-uni' + (c.sel[u.id] ? ' on' : '') + '" data-cl-uni="' + esc(u.id) + '" aria-pressed="' + (c.sel[u.id] ? 'true' : 'false') + '"><span class="pn-cl-cara">' + (img ? '<span style="background-image:url(\'' + esc(img) + '\')"></span>' : '<img src="' + esc(u.mini || '') + '" alt="">') + '<i aria-hidden="true">✓</i></span><small>' + esc(nombreAuto(u) || u.nombre || '') + '</small></button>';
        }).join('') + '</div>' +
        '<button type="button" class="pn-nuevo pn-cl-guardar" data-cl-guardar>Guardar</button></div>';
    }
    var l = todasClaves();
    return '<div class="pn-cl">' +
      '<div class="pn-cl-nueva"><input class="campo" id="cl-nueva" maxlength="30" autocomplete="off" enterkeyhint="next" placeholder="Escribe una palabra" aria-label="Palabra clave nueva"><button type="button" class="pn-nuevo" data-cl-agregar>Agregar</button></div>' +
      '<p class="pn-ctl-ayuda">' + (l.length ? '☝ Toca una palabra para ver en qué uniformes va, cambiarla o quitarla.' : 'Todavía no tienes palabras clave. Escribe una arriba: la gente la podrá buscar con la lupa.') + '</p>' +
      '<div class="pn-cl-lista" data-vig="y">' + l.map(function (k) { return '<button type="button" class="pn-cl-k" data-cl-k="' + esc(k.txt) + '">' + esc(k.txt) + '<small>' + k.n + '</small></button>'; }).join('') + '</div></div>';
  }
  function abrirClave(txt, nueva) {
    var sel = {}; if (!nueva) unisClaves().forEach(function (u) { if (clavesDe(u).some(function (k) { return igual(k, txt); })) sel[u.id] = true; });
    P.clave = { orig: nueva ? '' : txt, txt: txt, sel: sel }; pintar(0);
  }
  function guardarClaves(quitar) {
    var c = P.clave, t = ($('#cl-txt', panel) || {}).value; t = String(t || c.txt).trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
    if (!t && !quitar) { A.toast('Escribe la palabra.'); return; }
    unisClaves().forEach(function (u) {
      var l = clavesDe(u).filter(function (k) { return !(c.orig && igual(k, c.orig)) && !igual(k, t); });
      if (!quitar && c.sel[u.id]) l.push(t);
      u.etiquetas = u.etiquetas || { colores: [], pais: '' }; u.etiquetas.otros = l.join(', ');
    });
    api('catalogo', { catalogo: P.catalogo }).then(function () { A.toast(quitar ? 'Palabra quitada' : 'Guardado'); P.clave = null; pintar(0); return A.cargarTienda(); }).catch(function () { A.toast('No se pudo guardar. Revisa tu internet e inténtalo otra vez.'); });
  }
  function enlazarClaves() {
    var nv = $('#cl-nueva', panel);
    var agregar = function () { var t = nv.value.trim().replace(/,/g, ' ').replace(/\s+/g, ' '); if (!t) { nv.focus(); return; } var ya = todasClaves().filter(function (k) { return igual(k.txt, t); })[0]; abrirClave(ya ? ya.txt : t, !ya); };
    if (nv) { $('[data-cl-agregar]', panel).addEventListener('click', agregar); nv.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }); }
    $$('[data-cl-k]', panel).forEach(function (b) { b.addEventListener('click', function () { abrirClave(b.getAttribute('data-cl-k')); }); });
    $$('[data-cl-uni]', panel).forEach(function (b) { b.addEventListener('click', function () { var id = b.getAttribute('data-cl-uni'), on = !P.clave.sel[id]; if (on) P.clave.sel[id] = true; else delete P.clave.sel[id]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); });
    var tx = $('#cl-txt', panel); if (tx) tx.addEventListener('input', function () { P.clave.txt = tx.value; });
    var g = $('[data-cl-guardar]', panel); if (g) { var td = $('.pn-top-der', panel); if (td) td.appendChild(g); g.addEventListener('click', function () { guardarClaves(false); }); }   // Guardar arriba, siempre a la vista (como en el estudio)
    var q = $('[data-cl-quitar]', panel); if (q) q.addEventListener('click', function () { guardarClaves(true); });
  }

  /* ---------- folios ----------
     La lista es de tarjetas que se tocan completas (sin menús adentro que se roben el toque).
     Al abrir un folio se ve primero lo que importa para cotizar: cuántos uniformes, de qué tallas y cómo es cada uno. */
  function cuantos(e) { return (e.jugadores && e.jugadores.length) || 1; }
  function totalDe(f) { return f.equipos.reduce(function (s, e) { return s + cuantos(e); }, 0); }
  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
  function tallasDe(lista) {
    var m = {}, orden = (P.config.tallas || []).slice();
    lista.forEach(function (j) { var t = (j.talla || '').trim() || 'Sin talla'; m[t] = (m[t] || 0) + 1; });
    return Object.keys(m).sort(function (a, b) { var x = orden.indexOf(a), y = orden.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); })
      .map(function (t) { return '<span class="pn-talla' + (t === 'Sin talla' ? ' falta' : '') + '"><b>' + esc(t) + '</b> × ' + m[t] + '</span>'; }).join('');
  }
  function vistaFolios() {
    if (!P.folios.length) return '<div class="pn-vacio"><h3>Aún no hay folios</h3><p>Cuando un cliente arme su uniforme y toque "Cotizar por WhatsApp", aparece aquí con su número.</p></div>';
    var buscar = '<form class="pn-buscar-folio" data-buscar-folio><input class="campo" id="pn-bf" inputmode="numeric" placeholder="Número de folio, ej. 47" maxlength="8" autocomplete="off"><button type="submit" class="btn btn-oro">Buscar</button></form>';
    // arriba, un círculo por estado con cuántos hay (los nuevos primero); se toca uno y abajo salen solo esos
    var cuenta = {}; P.folios.forEach(function (f) { cuenta[f.estado] = (cuenta[f.estado] || 0) + 1; });
    if (!P.filtroFolio || P.filtroFolio === 'todos') P.filtroFolio = cuenta.nuevo ? 'nuevo' : (ESTADOS.filter(function (e) { return cuenta[e]; })[0] || 'nuevo');
    var NOMS = { nuevo: 'Nuevos', cotizado: 'Cotizados', produccion: 'En producción', entregado: 'Entregados' };
    var filtros = '<div class="pn-circulos">' + ESTADOS.map(function (e) {
      return '<button type="button" class="pn-circulo ' + e + (P.filtroFolio === e ? ' on' : '') + '" data-filtro-folio="' + e + '"><b>' + (cuenta[e] || 0) + '</b><span>' + NOMS[e] + '</span></button>';
    }).join('') + '</div>';
    if (!P.buscando) buscar = '';
    var lista = P.folios.map(function (f, i) { return [f, i]; }).filter(function (p) { return p[0].estado === P.filtroFolio; });
    if (!lista.length) return buscar + filtros + '<p class="pn-nada">No hay pedidos ' + NOMS[P.filtroFolio].toLowerCase() + ' ahorita.</p>';
    // todos en una lista compacta (un renglón por pedido, agrupados por día) que se desliza solo aquí adentro;
    // abajo una píldora dice cuántos faltan y al tocarla baja: siempre se nota que hay más
    var hoy = new Date(), ayer = new Date(Date.now() - 864e5), dia = function (d) { return d.toDateString() === hoy.toDateString() ? 'Hoy' : d.toDateString() === ayer.toDateString() ? 'Ayer' : d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }); };
    var antes = '', filas = lista.map(function (p) {
      var f = p[0], i = p[1], d = new Date(f.creado), n = totalDe(f), cab = dia(d), h = '';
      if (cab !== antes) { antes = cab; h += '<div class="pn-dia-cab">' + esc(cab) + '</div>'; }
      var e0 = f.equipos[0] || {}, j0 = (e0.jugadores || [])[0] || {}, quien = e0.nombre && e0.nombre !== 'Mi equipo' ? e0.nombre : ((j0.nombre || '') + (j0.numero ? ' ' + j0.numero : '')).trim();
      var hora = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
      return h + '<button type="button" class="pn-folio pn-fol1" data-folio="' + i + '"><img src="' + esc(e0.vistas ? e0.vistas.frente : '') + '" alt="">' +
        '<b>' + esc(String(f.id).replace(/^M-0*/, '')) + '</b><span class="pn-fol1-t"><span>' + esc([String(e0.base || '').split(' · ')[0], quien].filter(Boolean).join(' · ') || 'Uniforme') + '</span>' +
        '<small>' + plural(n, 'uniforme', 'uniformes') + ' · ' + esc(hora) + '</small></span></button>';
    }).join('');
    return buscar + filtros + '<div class="pn-folios-caja"><div class="pn-lista-folios" id="pn-lf">' + filas + (P.masFolios ? '<button type="button" class="btn btn-linea pn-mas-viejos" data-mas-folios>Ver los más antiguos</button>' : '') + '</div>' +
      '<button type="button" class="pn-mas-abajo" id="pn-mas-abajo" hidden></button></div>';
  }
  // la píldora de abajo: cuántos pedidos quedan abajo; tocarla baja una pantalla
  function vigilarLista() {
    var l = $('#pn-lf', panel), b = $('#pn-mas-abajo', panel); if (!l || !b) return;
    function ver() {
      var r = l.getBoundingClientRect(), n = 0;
      $$('.pn-fol1', l).forEach(function (x) { if (x.getBoundingClientRect().top > r.bottom - 10) n++; });
      b.hidden = !n; if (n) b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' + n + (n === 1 ? ' más abajo' : ' más abajo');
      l.classList.toggle('hay-mas', !!n);
    }
    l.addEventListener('scroll', ver, { passive: true });
    b.addEventListener('click', function () { l.scrollTo({ top: l.scrollTop + l.clientHeight * 0.85, behavior: 'smooth' }); });
    if (P.scrollFolios) l.scrollTop = P.scrollFolios;
    ver();
  }
  function cambiarEstado(f, est) {
    var antes = f.estado; f.estado = est;
    api('estado', { id: f.id, estado: est }).then(function () { A.toast('Folio ' + f.id + ': ' + ES('est_' + est)); })
      .catch(function () { f.estado = antes; A.toast('No se guardó. Inténtalo otra vez.'); pintar(); });
  }
  function enlazarFolios() {
    $$('[data-filtro-folio]', panel).forEach(function (b) { b.addEventListener('click', function () { P.filtroFolio = b.getAttribute('data-filtro-folio'); P.scrollFolios = 0; pintar(0); }); });
    vigilarLista();
    $$('[data-folio]', panel).forEach(function (b) { b.addEventListener('click', function () { var lf = $('#pn-lf', panel); P.scrollFolios = lf ? lf.scrollTop : 0; P.scrollLista = $('.pn-cuerpo', panel).scrollTop; P.detalle = +b.getAttribute('data-folio'); pintar(0); }); });
    var bf = $('[data-buscar-folio]', panel);
    if (bf) bf.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = parseInt($('#pn-bf').value.replace(/\D/g, ''), 10); if (!n) { A.toast('Escribe el número del folio. Ej. 47'); return; }
      var id = 'M-' + String(n).padStart(4, '0'), k = P.folios.findIndex(function (f) { return f.id === id; });
      var abrir = function (i) { P.scrollLista = $('.pn-cuerpo', panel).scrollTop; P.detalle = i; pintar(0); };
      if (k >= 0) return abrir(k);
      api('buscarFolio', { numero: n }).then(function (j) {
        if (!j.folio) { A.toast('No existe el folio ' + id + '. Revisa el número.'); return; }
        P.folios.push(j.folio); abrir(P.folios.length - 1);
      }).catch(function () { A.toast('No se pudo buscar. Revisa tu internet.'); });
    });
    var mas = $('[data-mas-folios]', panel);
    if (mas) mas.addEventListener('click', function () {
      var ult = P.folios[P.folios.length - 1], n = ult ? parseInt(String(ult.id).slice(2), 10) : 0;
      mas.disabled = true; mas.textContent = 'Cargando…';
      api('folios', { antesDe: n }).then(function (j) { P.folios = P.folios.concat(j.folios || []); P.masFolios = !!j.masFolios; pintar(); })
        .catch(function () { A.toast('No se pudo cargar. Inténtalo otra vez.'); pintar(); });
    });
  }
  function bolita(c) { return c ? '<i class="pn-bolita" style="background:' + esc(c) + '"></i>' : ''; }
  var LUGAR = { 'pecho-izq': 'Pecho izquierdo', 'pecho-der': 'Pecho derecho', centro: 'Centro del pecho', espalda: 'Nuca', 'manga-izq': 'Manga izquierda', 'manga-der': 'Manga derecha', pecho: 'Pecho', 'espalda-p': 'Espalda (abajo del número)' };
  var TAMANO = ['más chico', 'chico', 'normal', 'grande', 'más grande'];
  function tela(r, delCatalogo) {
    if (!r) return 'Igual que el frente';
    if (r.tipo === 'img') return delCatalogo ? 'La del diseño' : 'Foto del cliente';
    if (r.tipo === 'color') return bolita(r.color) + 'Color liso';
    return 'Estampado del catálogo';
  }
  function comoEs(e) {
    var d = e.diseno || {}, filas = [];
    if (d.taco) {
      // pedido hecho con el catálogo 3D
      filas.push(['Uniforme', esc(e.base || '—')]);
      filas.push(['Manga', d.manga === 'larga' ? 'Larga' : 'Corta']);
      filas.push(['Nombre y número', bolita(d.colorTexto) + esc([d.nombre, d.numero].filter(Boolean).join(' · ') || 'Sin nombre')]);
      return '<dl class="pn-como">' + filas.map(function (f) { return '<dt>' + f[0] + '</dt><dd>' + f[1] + '</dd>'; }).join('') + '</dl>';
    }
    filas.push(['Diseño', esc(e.base || (d.foto ? 'Del catálogo' : 'Armado desde cero'))]);
    if (!d.foto) {
      filas.push(['Manga', d.manga === 'larga' ? 'Larga' : 'Corta']);
      filas.push(['Tela del frente', tela(d.relleno, !!e.base)]);
      filas.push(['Tela de la espalda', tela(d.rellenoEspalda, !!e.base)]);
      filas.push(['Cuello', bolita(d.cuello) || '—']);
      filas.push(['Costados', d.costados ? bolita(d.costados) : 'Sin costados']);
      var sh = d.short || {};
      filas.push(['Short', sh.mismo ? 'Igual que la playera' : bolita(sh.color || '#FFFFFF') + 'Color liso']);
      filas.push(['Número en el short', d.numeroShort ? 'Sí' : 'No']);
      (d.logos || []).forEach(function (g) { filas.push(['Logo del equipo', esc((LUGAR[g.pos] || g.pos) + ' · ' + TAMANO[g.tam == null ? 2 : g.tam])]); });
      var ps = window.Kit && window.Kit.patros ? window.Kit.patros(d) : [];
      if (ps.length) filas.push(['Patrocinadores', ps.map(function (p, i) { return (i + 1) + '. ' + esc((p.pos === 'espalda' ? LUGAR['espalda-p'] : LUGAR[p.pos] || p.pos) + ' · ' + TAMANO[p.tam]); }).join('<br>')]);
    }
    filas.push(['Nombre y número', bolita(d.colorTexto)]);
    return '<dl class="pn-como">' + filas.map(function (f) { return '<dt>' + f[0] + '</dt><dd>' + f[1] + '</dd>'; }).join('') + '</dl>';
  }
  function vistaDetalle() {
    var f = P.folios[P.detalle], n = totalDe(f), todos = [];
    f.equipos.forEach(function (e) { (e.jugadores && e.jugadores.length ? e.jugadores : [{}]).forEach(function (j) { todos.push(j); }); });
    var fecha = new Date(f.creado).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    var h = '<button type="button" class="link-x" data-volver>← Volver a todos los folios</button>' +
      '<div class="pn-det-top"><h3 class="pn-h">' + esc(f.id) + '</h3><small>' + esc(fecha) + '</small></div>' +
      '<div class="pn-resumen"><div class="pn-total"><b>' + n + '</b><span>' + (n === 1 ? 'uniforme' : 'uniformes') + (f.equipos.length > 1 ? '<br>en ' + f.equipos.length + ' equipos' : '') + '</span></div>' +
      '<div class="pn-tallas"><span class="etq">Tallas</span><div>' + tallasDe(todos) + '</div></div></div>' +
      '<span class="etq">Estado del pedido</span><div class="pn-estados">' + ESTADOS.map(function (e) { return '<button type="button" class="chip' + (f.estado === e ? ' on' : '') + '" data-est="' + e + '">' + esc(ES('est_' + e)) + '</button>'; }).join('') + '</div>';
    f.equipos.forEach(function (e, i) {
      var jug = e.jugadores || [];
      h += '<section class="pn-eq"><h4>' + (f.equipos.length > 1 ? 'Equipo ' + (i + 1) + ': ' : '') + esc(e.nombre) + ' <small>· ' + plural(cuantos(e), 'uniforme', 'uniformes') + '</small></h4>' +
        '<div class="pn-eq-cuerpo"><div class="pn-vistas"><figure><img src="' + esc(e.vistas.frente) + '" alt="Frente"><figcaption>Frente</figcaption></figure><figure><img src="' + esc(e.vistas.espalda) + '" alt="Espalda"><figcaption>Espalda</figcaption></figure></div>' +
        '<div>' + comoEs(e) + '</div></div>';
      if (jug.length) {
        h += '<table class="tabla pn-tabla"><thead><tr><th>#</th><th>Nombre</th><th>Número</th><th>Talla</th></tr></thead><tbody>' +
          jug.map(function (j, k) { return '<tr><td>' + (k + 1) + '</td><td>' + (esc(j.nombre) || '<span class="falta">Sin nombre</span>') + '</td><td>' + (esc(j.numero) || '—') + '</td><td>' + (esc(j.talla) || '<span class="falta">Falta</span>') + '</td></tr>'; }).join('') + '</tbody></table>';
      }
      var arch = (e.archivos && e.archivos.length) ? e.archivos : (e.originales || []).map(function (u, k) { return { que: 'Archivo ' + (k + 1), url: u }; });
      if (arch.length) h += '<span class="etq">Archivos originales para imprimir</span><div class="pn-archivos">' + arch.map(function (a) { return '<a class="btn btn-linea btn-chico" href="' + esc(a.url) + '" target="_blank" rel="noopener">' + esc(a.que) + '</a>'; }).join('') + '</div>';
      if (e.avisos && e.avisos.length) h += '<p class="nota">Ojo: el cliente subió fotos con avisos (' + esc(e.avisos.map(function (a) { return a.replace(':chica', ': pequeña').replace(':borrosa', ': movida'); }).join(', ')) + '). Pídele una mejor por WhatsApp si hace falta.</p>';
      h += '</section>';
    });
    return h;
  }
  function enlazarDetalle() {
    var f = P.folios[P.detalle];
    $('[data-volver]', panel).addEventListener('click', function () { P.detalle = null; pintar(P.scrollLista || 0); });
    $$('[data-est]', panel).forEach(function (b) { b.addEventListener('click', function () { cambiarEstado(f, b.getAttribute('data-est')); $$('[data-est]', panel).forEach(function (x) { x.classList.toggle('on', x === b); }); }); });
  }

  /* ---------- uniformes ---------- */
  function ordenados() { return P.catalogo.filter(function (u) { return !u.borrado && u.tipo === '3d'; }).sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); }); }
  /* ---------- uniformes: secciones → equipos → versiones ----------
     Todo lo que se ve en la página se cambia aquí: el nombre y el orden de las secciones, a qué sección va cada
     equipo, su nombre, su escudo y el orden de sus versiones (local, visitante…). Un equipo es uno solo aunque
     tenga varias versiones: lo que se cambia en el equipo lo toman todas. */
  function claveEq(u) { return String((u.etiquetas && u.etiquetas.equipo) || u.nombre || u.id).trim().toLowerCase(); }
  function arbol() {
    var secs = (P.config.categorias || []).slice(), grupos = secs.map(function (s) { return { sec: s, equipos: [] }; }), sin = { sec: '', equipos: [] }, eqs = {};
    ordenados().forEach(function (u) {
      var k = claveEq(u), e = eqs[k];
      if (!e) {
        var i = secs.indexOf(u.categoria), g = i >= 0 ? grupos[i] : sin;
        e = eqs[k] = { clave: k, nombre: String((u.etiquetas && u.etiquetas.equipo) || u.nombre || '').trim(), escudo: '', sec: g.sec, items: [] };
        g.equipos.push(e);
      }
      e.items.push(u); if (!e.escudo && u.escudo) e.escudo = u.escudo;
    });
    grupos.push(sin);
    return grupos;
  }
  function equipoDe(gr, clave) { var r = null; gr.forEach(function (g) { g.equipos.forEach(function (e) { if (e.clave === clave) r = e; }); }); return r; }
  // deja todo parejo: cada versión con la sección, el nombre y el escudo de su equipo, y el orden de la página
  function renumerar(gr) {
    var n = 0;
    gr.forEach(function (g) { g.equipos.forEach(function (e) { e.items.forEach(function (u) {
      u.orden = ++n; u.categoria = g.sec; u.etiquetas = u.etiquetas || { colores: [], pais: '' }; u.etiquetas.equipo = e.nombre; if (e.escudo) u.escudo = e.escudo;
    }); }); });
  }
  function guardarArbol(gr, msg) { renumerar(gr); pintar(); return guardarCatalogo(msg); }
  function guardarConfig(msg) {
    P.respaldos = null;
    return api('config', { config: P.config }).then(function () { if (msg) A.toast(msg); return A.cargarTienda(); })
      .then(function () { A.pintarDatos(); A.pintarCatalogo(); })
      .catch(function () { A.toast('No se guardó. Revisa tu conexión e inténtalo otra vez.'); });
  }
  function visibleEq(e) { return e.items.some(function (u) { return !u.oculto; }); }
  function vistaUniformes() {
    if (P.equipo) return vistaEquipo();
    var gr = arbol(), secs = P.config.categorias || [], max = +P.config.maxEquipos || 10;
    var vis = gr.reduce(function (s, g) { return s + g.equipos.filter(visibleEq).length; }, 0);
    // una fila de escudos por sección, que se desliza con el dedo (siempre se asoma uno a la orilla si hay más)
    return '<div class="pn-uni-cab"><p class="pn-ctl-ayuda">☝ Toca un equipo para ver y cambiar sus uniformes.</p><button type="button" class="pn-nuevo" data-nuevo-eq><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Nuevo</button></div>' +
      gr.map(function (g, si) {
        var real = si < secs.length;
        if (!real && !g.equipos.length) return '';
        return '<section class="pn-sec"><div class="pn-sec-cab">' +
          (real ? '<input class="campo pn-sec-nom" data-sec-nom="' + si + '" value="' + esc(g.sec) + '" maxlength="40" enterkeyhint="done" aria-label="Nombre de la sección">' +
            '<span class="pn-orden fila"><button type="button" class="icon-btn" data-sec-mueve="-1" data-si="' + si + '" aria-label="Subir sección"' + (si === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button type="button" class="icon-btn" data-sec-mueve="1" data-si="' + si + '" aria-label="Bajar sección"' + (si === secs.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<button type="button" class="icon-btn" data-sec-quita="' + si + '" aria-label="Quitar sección">×</button></span>'
            : '<b class="pn-sec-sin">Sin sección <small>(no se ven en el paso de elegir equipo; pásalos a una sección)</small></b>') + '</div>' +
          (g.equipos.length ? '<div class="pn-fila-esc">' + g.equipos.map(function (e) { return escudoEquipo(e); }).join('') + '</div>' : '<p class="nota">Esta sección no tiene equipos. Para pasar uno aquí, ábrelo y elige esta sección.</p>') +
          '</section>';
      }).join('') +
      '<div class="subir"><button type="button" class="btn btn-linea" data-sec-nueva>+ Nueva sección</button></div>' +
      (function () { var n = P.catalogo.filter(function (u) { return u.borrado; }).length; return '<div class="subir"><button type="button" class="pn-papelera-b" data-ir="papelera">' + icono('uniformes').replace('</svg>', '') + '</svg>Papelera' + (n ? ' · ' + n : '') + '</button></div>'; })();
  }
  function escudoEquipo(e) {
    var oculto = !visibleEq(e);
    var incompletos = e.items.filter(function (u) { var f = u.fotos || {}; return (u.tipo || '3d') === '3d' && (!f.frente || !f.espalda || !f.short); }).length;
    var cara = e.escudo ? '<img src="' + esc(e.escudo) + '" alt="">' : '<img class="sin" src="' + esc((e.items[0] || {}).mini || '') + '" alt="">';
    return '<button type="button" class="pn-esc-b' + (oculto ? ' apagado' : '') + '" data-eq="' + esc(e.clave) + '"><span class="pn-esc-c' + (e.escudo ? '' : ' sin-escudo') + '">' + cara +
      (incompletos ? '<i class="pn-esc-falta" aria-label="Le faltan fotos">!</i>' : e.items.length > 1 ? '<i class="pn-esc-n">' + e.items.length + '</i>' : '') + '</span><b>' + esc(e.nombre || 'Sin nombre') + '</b>' + (oculto ? '<small>Oculto</small>' : '') + '</button>';
  }
  function filaEquipo(e, si, ei, n) {
    var oculto = !visibleEq(e);
    // los que no tienen las tres fotos (frente, espalda y short) se avisan aquí para que el dueño sepa cuál abrir
    var incompletos = e.items.filter(function (u) { var f = u.fotos || {}; return (u.tipo || '3d') === '3d' && (!f.frente || !f.espalda || !f.short); }).length;
    var cara = e.escudo ? '<span class="pn-esc"><img src="' + esc(e.escudo) + '" alt=""></span>' : '<img class="pn-th" src="' + esc((e.items[0] || {}).mini || '') + '" alt="">';
    return '<div class="pn-fila pn-uni' + (oculto ? ' apagado' : '') + '"><button type="button" class="pn-abrir" data-eq="' + esc(e.clave) + '">' + cara +
      '<span class="pn-info"><b>' + esc(e.nombre || 'Sin nombre') + '</b><small>' + (e.items.length === 1 ? '1 uniforme' : e.items.length + ' uniformes') + (oculto ? ' · oculto' : '') + (incompletos ? ' · <span class="falta">' + (incompletos === 1 ? 'a 1 le falta foto' : 'a ' + incompletos + ' les faltan fotos') + '</span>' : '') + '</small></span><span class="pn-ir" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></span></button>' +
      '<span class="pn-orden"><button type="button" class="icon-btn" data-eq-mueve="-1" data-si="' + si + '" data-ei="' + ei + '" aria-label="Subir equipo"' + (ei === 0 ? ' disabled' : '') + '>↑</button>' +
      '<button type="button" class="icon-btn" data-eq-mueve="1" data-si="' + si + '" data-ei="' + ei + '" aria-label="Bajar equipo"' + (ei === n - 1 ? ' disabled' : '') + '>↓</button></span></div>';
  }
  // un botón que pide un segundo toque antes de hacer algo que no se deshace solo (sin ventanas de "¿estás seguro?")
  function dobleToque(b, texto, accion) {
    b.addEventListener('click', function () {
      if (b.getAttribute('data-armado')) { accion(); return; }
      b.setAttribute('data-armado', '1'); var antes = b.innerHTML; b.innerHTML = texto; b.classList.add('pn-peligro');
      setTimeout(function () { if (document.body.contains(b)) { b.removeAttribute('data-armado'); b.innerHTML = antes; } }, 3500);
    });
  }
  function enlazarUniformes() {
    if (P.equipo) return enlazarEquipo();
    var secs = P.config.categorias = P.config.categorias || [];
    $('[data-nuevo-eq]', panel).addEventListener('click', function () { P.scrollLista = $('.pn-cuerpo', panel).scrollTop; nuevoUniforme(null); });
    var vz = $('[data-voz]', panel); if (vz) vz.addEventListener('click', narrar);
    $$('[data-eq]', panel).forEach(function (b) { b.addEventListener('click', function () { P.scrollLista = $('.pn-cuerpo', panel).scrollTop; P.equipo = b.getAttribute('data-eq'); pintar(0); }); });
    $$('[data-eq-mueve]', panel).forEach(function (b) {
      b.addEventListener('click', function () {
        var gr = arbol(), l = gr[+b.getAttribute('data-si')].equipos, i = +b.getAttribute('data-ei'), j = i + +b.getAttribute('data-eq-mueve');
        var t = l[i]; l[i] = l[j]; l[j] = t; guardarArbol(gr, 'Orden guardado');
      });
    });
    $$('[data-sec-mueve]', panel).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.getAttribute('data-si'), j = i + +b.getAttribute('data-sec-mueve'), t = secs[i]; secs[i] = secs[j]; secs[j] = t;
        guardarConfig().then(function () { guardarArbol(arbol(), 'Orden de secciones guardado'); });
      });
    });
    $$('[data-sec-nom]', panel).forEach(function (inp) {
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
      inp.addEventListener('change', function () {
        var i = +inp.getAttribute('data-sec-nom'), viejo = secs[i], nuevo = inp.value.trim().replace(/\s+/g, ' ');
        if (!nuevo || nuevo === viejo) { inp.value = viejo; return; }
        if (secs.some(function (s, k) { return k !== i && s.toLowerCase() === nuevo.toLowerCase(); })) { A.toast('Ya hay una sección con ese nombre.'); inp.value = viejo; return; }
        P.catalogo.forEach(function (u) { if (u.categoria === viejo) u.categoria = nuevo; });   // sus equipos se van con ella
        secs[i] = nuevo; guardarConfig().then(function () { guardarArbol(arbol(), 'Sección guardada'); });
      });
    });
    $$('[data-sec-quita]', panel).forEach(function (b) {
      dobleToque(b, '¿Quitar?', function () {
        var i = +b.getAttribute('data-sec-quita'), viejo = secs[i];
        P.catalogo.forEach(function (u) { if (u.categoria === viejo) u.categoria = ''; });
        secs.splice(i, 1); guardarConfig().then(function () { guardarArbol(arbol(), 'Sección quitada. Sus equipos quedaron en "Sin sección".'); });
      });
    });
    $('[data-sec-nueva]', panel).addEventListener('click', function () {
      var n = 1; while (secs.indexOf('Sección ' + n) >= 0) n++;
      secs.push('Sección ' + n);
      guardarConfig('Sección nueva: cámbiale el nombre').then(function () { pintar(); var l = $$('[data-sec-nom]', panel), x = l[l.length - 1]; if (x) { x.focus(); x.select(); } });
    });
  }
  // uniforme nuevo; si viene de un equipo, ya trae su nombre, sección y escudo
  function nuevoUniforme(e) {
    pvVista = 'frente'; P.editando = { id: 'u' + Date.now().toString(36), nombre: '', categoria: e ? e.sec : ((P.config.categorias || [])[0] || ''), tipo: '3d', fotos: { frente: '', espalda: '', short: '' }, colorShort: '', colorCalceta: '', colorTexto: '#111111',
      etiquetas: { colores: [], pais: '', equipo: e ? e.nombre : '' }, escudo: e ? e.escudo : '', manga: 'corta', nuevo: true, equipoNuevo: !e };
    pintar(0);
  }
  function vistaEquipo() {
    var gr = arbol(), e = equipoDe(gr, P.equipo), secs = P.config.categorias || [];
    if (!e) { P.equipo = null; return vistaUniformes(); }
    var oculto = !visibleEq(e);
    var si = -1, ei = -1; gr.forEach(function (g, a) { g.equipos.forEach(function (x, b) { if (x.clave === e.clave) { si = a; ei = b; } }); });
    var n = si >= 0 ? gr[si].equipos.length : 0;
    var orden = si >= 0 && n > 1 ? '<div class="pn-eq-lugar"><span class="etq">Lugar en su fila</span><div class="pn-orden-eq"><button type="button" class="pn-redondo" data-eq-mueve="-1" data-si="' + si + '" data-ei="' + ei + '" aria-label="Más a la izquierda"' + (ei === 0 ? ' disabled' : '') + '>' + FLECHA + '</button><b>' + (ei + 1) + ' de ' + n + '</b><button type="button" class="pn-redondo" data-eq-mueve="1" data-si="' + si + '" data-ei="' + ei + '" aria-label="Más a la derecha"' + (ei === n - 1 ? ' disabled' : '') + '>' + FLECHA.replace('M15 6l-6 6 6 6', 'M9 6l6 6-6 6') + '</button></div></div>' : '';
    // arriba, todo junto y sin aire: su escudo, su nombre, su sección y su lugar en la fila
    return '<button type="button" class="link-x" data-volver-eq hidden>Volver</button><div class="pn-form">' +
      '<div class="pn-eq-cab"><div class="pn-eq-esc"><label class="pn-escudo" aria-label="Cambiar escudo"><span class="pn-escudo-img">' + (e.escudo ? '<img src="' + esc(e.escudo) + '" alt="">' : '<b>+</b>') + '</span><input type="file" accept="image/*,.heic,.heif" data-escudo-eq></label>' +
      (e.escudo ? '<button type="button" class="pn-eq-acomodar" data-esc-acomodar aria-label="Acomodar escudo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg></button>' : '') + '</div>' +
      '<div class="pn-eq-datos"><label class="etq" for="eq-nombre">Nombre del equipo</label><input class="campo" id="eq-nombre" maxlength="40" value="' + esc(e.nombre) + '">' +
      '<label class="etq" for="eq-sec">Sección</label><select class="campo" id="eq-sec">' + secs.map(function (s) { return '<option' + (s === e.sec ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '<option value=""' + (e.sec ? '' : ' selected') + '>Sin sección</option></select></div></div>' + orden +
      '<div class="grupo"><span class="etq">Sus uniformes <small>(toca uno para cambiarlo)</small></span><div class="pn-lista">' + e.items.map(function (u, i) {
        return '<div class="pn-fila pn-uni' + (u.oculto ? ' apagado' : '') + '"><button type="button" class="pn-abrir" data-edit="' + esc(u.id) + '"><img class="pn-th" src="' + esc(u.mini || '') + '" alt="">' +
          '<span class="pn-info"><b>' + esc(u.version || u.nombre) + '</b><small>' + esc(u.nombre) + (u.oculto ? ' · oculto' : '') + '</small></span><span class="pn-editar">✎ Editar</span></button>' +
          (e.items.length < 2 ? '' : '<span class="pn-orden"><button type="button" class="icon-btn" data-ver-mueve="-1" data-i="' + i + '" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="icon-btn" data-ver-mueve="1" data-i="' + i + '" aria-label="Bajar"' + (i === e.items.length - 1 ? ' disabled' : '') + '>↓</button></span>') + '</div>';
      }).join('') + '</div><button type="button" class="btn btn-linea" data-ver-nueva>+ Otro diseño de este equipo</button></div>' +
      '<div class="pn-eq-pie">' +
      '<button type="button" class="chip' + (oculto ? ' on' : '') + '" data-eq-oculto>' + (oculto ? 'Oculto · tocar para mostrar' : 'Ocultar de la página') + '</button>' +
      '<button type="button" class="chip" data-eq-papelera>A la papelera</button></div>' +
      '<div class="subir pn-publicar listo"><button type="button" class="btn btn-oro btn-xl" data-eq-guardar>Guardar</button></div></div>';
  }
  function enlazarEquipo() {
    var gr = arbol(), e = equipoDe(gr, P.equipo); if (!e) return;
    $('[data-volver-eq]', panel).addEventListener('click', function () { P.equipo = null; pintar(P.scrollLista || 0); });
    $$('[data-eq-mueve]', panel).forEach(function (b) {
      b.addEventListener('click', function () {
        var g2 = arbol(), l = g2[+b.getAttribute('data-si')].equipos, i = +b.getAttribute('data-ei'), j = i + +b.getAttribute('data-eq-mueve');
        var t = l[i]; l[i] = l[j]; l[j] = t; guardarArbol(g2, 'Orden guardado');
      });
    });
    $$('[data-edit]', panel).forEach(function (b) { b.addEventListener('click', function () { pvVista = 'frente'; P.editando = A.clone(porId(b.getAttribute('data-edit'))); pintar(0); }); });
    $$('[data-ver-mueve]', panel).forEach(function (b) {
      b.addEventListener('click', function () { var g2 = arbol(), e2 = equipoDe(g2, P.equipo), i = +b.getAttribute('data-i'), j = i + +b.getAttribute('data-ver-mueve'), t = e2.items[i]; e2.items[i] = e2.items[j]; e2.items[j] = t; guardarArbol(g2, 'Orden guardado'); });
    });
    $('[data-ver-nueva]', panel).addEventListener('click', function () { nuevoUniforme(e); });
    var escA = $('[data-esc-acomodar]', panel);
    if (escA) escA.addEventListener('click', function () { reacomodar(e.escudo, 'escudo').then(function (url) { e.escudo = url; var box = $('.pn-escudo-img', panel); if (box) box.innerHTML = '<img src="' + esc(url) + '" alt="">'; A.toast('Escudo acomodado. Toca Guardar.'); }).catch(function (x) { if (!x || !x.cancelado) A.toast('No se pudo. Inténtalo otra vez.'); }); });
    var inEsc = $('[data-escudo-eq]', panel);
    inEsc.addEventListener('change', function () {
      var file = inEsc.files && inEsc.files[0]; if (!file) return;
      subirEscudo(file).then(function (url) { e.escudo = url; var box = $('.pn-escudo-img', panel); if (box) box.innerHTML = '<img src="' + esc(url) + '" alt="">'; });
    });
    $('[data-eq-oculto]', panel).addEventListener('click', function () {
      var ocultar = visibleEq(e); e.items.forEach(function (u) { u.oculto = ocultar; }); guardarArbol(gr, ocultar ? 'Equipo oculto en la página' : 'Equipo visible en la página');
    });
    dobleToque($('[data-eq-papelera]', panel), '¿Seguro? Toca otra vez', function () {
      var ahora = Date.now(); e.items.forEach(function (u) { u.borrado = ahora; }); P.equipo = null; pintar(P.scrollLista || 0);
      guardarCatalogo('El equipo se fue a la papelera. Lo puedes recuperar durante 30 días.');
    });
    $('[data-eq-guardar]', panel).addEventListener('click', function () {
      var nom = $('#eq-nombre').value.trim().replace(/\s+/g, ' ');
      if (!nom) { A.toast('Ponle nombre al equipo.'); $('#eq-nombre').focus(); return; }
      var otro = equipoDe(gr, nom.toLowerCase());
      if (otro && otro !== e) { A.toast('Ya hay un equipo que se llama así.'); return; }
      var sec = $('#eq-sec').value, g0 = null, g1 = null;
      gr.forEach(function (g) { if (g.equipos.indexOf(e) >= 0) g0 = g; if (g.sec === sec) g1 = g; });
      if (g1 && g0 !== g1) { g0.equipos.splice(g0.equipos.indexOf(e), 1); g1.equipos.push(e); }   // pasa al final de su nueva sección
      e.nombre = nom; P.equipo = nom.toLowerCase();
      guardarArbol(gr, 'Equipo guardado');
    });
  }
  function conTiempo(pr, ms) { return Promise.race([pr, new Promise(function (ok) { setTimeout(function () { ok(null); }, ms); })]); }
  // una cortina sobre el panel mientras publica, y el aviso de "Publicado" al terminar
  function cortina(texto, listo) {
    var c = $('.pn-cortina', panel);
    if (!texto) { if (c) { c.classList.add('se-va'); setTimeout(function () { c.remove(); }, 300); } return; }
    if (!c) { c = document.createElement('div'); c.className = 'pn-cortina'; panel.appendChild(c); }
    c.className = 'pn-cortina' + (listo ? ' listo' : '');
    c.innerHTML = (listo ? '<i class="pn-palomita">✓</i>' : '<i class="pn-gira"></i>') + '<b>' + esc(texto.replace(/^✓ /, '')) + '</b>';
  }
  function guardarCatalogo(msg) {
    ordenados().forEach(function (u, i) { u.orden = i + 1; });
    P.respaldos = null;
    return api('catalogo', { catalogo: P.catalogo }).then(function () {
      if (msg) A.toast(msg);
      return A.cargarTienda().then(function () { A.pintarCatalogo(); });
    }).catch(function () { A.toast('No se guardó. Revisa tu conexión e inténtalo otra vez.'); });
  }
  function porId(id) { return P.catalogo.filter(function (u) { return u.id === id; })[0]; }
  function narrar() {
    var txt = 'Para subir un uniforme nuevo, toca el botón amarillo que dice nuevo uniforme. Escribe su nombre y elige la categoría. ' +
      'Luego sube dos fotos: la del frente y la de la espalda. Extiende la playera en el suelo, tómala de frente y con buena luz, sin que salga tu mano. ' +
      'Si no tienes el uniforme contigo, pídele a tu proveedor esas dos fotos. Antes de publicar, revisa cómo se ve con nombre y número. Si te gusta, toca publicar y listo.';
    if (!('speechSynthesis' in window)) { A.toast('Tu navegador no puede leer en voz alta.'); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(txt); u.lang = 'es-MX'; u.rate = 1;
    var v = speechSynthesis.getVoices().filter(function (x) { return /^es/i.test(x.lang); })[0]; if (v) u.voice = v;
    speechSynthesis.speak(u);
  }

  /* editor de uniforme: el dueño sube sus fotos reales y la página las pone en 3D sola */
  var COLORES_N = [['blanco', '#f4f4f4'], ['negro', '#151515'], ['gris', '#8a8d93'], ['rojo', '#d7262e'], ['naranja', '#ff8a3d'], ['amarillo', '#ffc61a'], ['dorado', '#c9a227'], ['verde', '#14804a'], ['celeste', '#7fd6e6'], ['azul', '#1f2e7a'], ['morado', '#6b2fb3'], ['rosa', '#f6588a']];
  var TELAS = ['#f3f3f5', '#151515', '#1f2e7a', '#d7262e', '#14804a', '#ffc61a', '#6b2fb3', '#7fd6e6'];
  var LETRAS_P = ['#111111', '#FFFFFF', '#1F2E7A', '#FFC61A', '#D7262E'];
  // colores a un toque y, al final, cualquier color (el de la foto, el que sea): nunca se queda corto
  // colores del panel: una sola barra con todos los colores de uniforme; se desliza el dedo y la muestra cambia en vivo
  var PN_BARRA = ['#ffffff', '#b9bec8', '#ffd400', '#c9a23a', '#ff8a00', '#ff2a2a', '#8e1b24', '#f6588a', '#7b3fe4', '#1f4fd1', '#1c2a6b', '#7cc6f0', '#16b0b5', '#3ccf4e', '#0d6b34', '#141518'];
  function rgbH(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function colorEn(k) {
    k = Math.max(0, Math.min(1, k)); var n = PN_BARRA.length - 1, x = k * n, i = Math.min(n - 1, Math.floor(x)), t = x - i, a = rgbH(PN_BARRA[i]), b = rgbH(PN_BARRA[i + 1]);
    return hexDe(a.map(function (v, j) { return v + (b[j] - v) * t; }));
  }
  function lugarDe(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return 0.5; var c = rgbH(hex), mejor = 1e9, k = 0.5;
    for (var i = 0; i <= 300; i++) { var q = rgbH(colorEn(i / 300)), d = Math.abs(q[0] - c[0]) + Math.abs(q[1] - c[1]) + Math.abs(q[2] - c[2]); if (d < mejor) { mejor = d; k = i / 300; } }
    return k;
  }
  function bolitas(campo, valor) {
    var hay = /^#[0-9a-f]{6}$/i.test(valor || ''), k = lugarDe(valor);
    return '<div class="pn-colbar" data-barra-campo="' + campo + '"><span class="pn-barra-muestra"' + (hay ? ' style="background:' + valor + '"' : '') + '></span>' +
      '<div class="barra-color" role="slider" tabindex="0" aria-label="Color" style="background:linear-gradient(90deg,' + PN_BARRA.map(function (c, i) { return c + ' ' + (i * 100 / (PN_BARRA.length - 1)) + '%'; }).join(',') + ')">' +
      '<i class="barra-pulgar" style="left:' + (k * 100) + '%;' + (hay ? 'background:' + valor : 'opacity:.55') + '"></i></div></div>';
  }
  // en vivo: al deslizar cambia la muestra (y el 3D poco a poco); al soltar se guarda el color
  function enlazarBarras(alMover, alSoltar) {
    $$('[data-barra-campo]', panel).forEach(function (cj) {
      var campo = cj.getAttribute('data-barra-campo'), barra = $('.barra-color', cj), pul = $('.barra-pulgar', cj), mu = $('.pn-barra-muestra', cj), id = null, x0 = 0, w = 1, col = null;
      function mover(k) { k = Math.max(0, Math.min(1, k)); col = colorEn(k); pul.style.left = (k * 100) + '%'; pul.style.background = col; pul.style.opacity = ''; mu.style.background = col; if (alMover) alMover(campo, col); }
      barra.addEventListener('pointerdown', function (e) { var r = barra.getBoundingClientRect(); x0 = r.left; w = r.width; id = e.pointerId; try { barra.setPointerCapture(id); } catch (_) {} barra.classList.add('tocando'); mover((e.clientX - x0) / w); });
      barra.addEventListener('pointermove', function (e) { if (e.pointerId === id) mover((e.clientX - x0) / w); });
      function soltar(e) { if (e.pointerId !== id) return; id = null; barra.classList.remove('tocando'); if (col && alSoltar) alSoltar(campo, col); }
      barra.addEventListener('pointerup', soltar); barra.addEventListener('pointercancel', soltar);
      barra.addEventListener('keydown', function (e) { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); mover(parseFloat(pul.style.left) / 100 + (e.key === 'ArrowRight' ? 0.02 : -0.02)); if (alSoltar) alSoltar(campo, col); });
    });
  }
  function hexDe(rgb) { return '#' + rgb.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); }
  function equipoHTML(u, cats) {
    var eqs = []; arbol().forEach(function (g) { g.equipos.forEach(function (x) { eqs.push(x); }); });
    var k = claveEq(u), existe = !u.equipoNuevo && eqs.some(function (x) { return x.clave === k; }) && (u.etiquetas || {}).equipo;
    return '<div class="grupo"><label for="ed-eq">Equipo</label><select class="campo" id="ed-eq">' + eqs.map(function (x) { return '<option value="' + esc(x.clave) + '"' + (existe && x.clave === k ? ' selected' : '') + '>' + esc(x.nombre) + '</option>'; }).join('') +
      '<option value="__nuevo"' + (existe ? '' : ' selected') + '>+ Equipo nuevo…</option></select></div>' +
      '<div class="pn-eq-nuevo"' + (existe ? ' hidden' : '') + '><div class="fila2"><div class="grupo"><label for="ed-equipo">Nombre del equipo nuevo</label><input class="campo" id="ed-equipo" maxlength="40" value="' + esc(existe ? '' : ((u.etiquetas || {}).equipo || '')) + '" placeholder="Ej. Chivas"></div>' +
      '<div class="grupo"><span class="etq">Escudo <small>(opcional)</small></span><label class="pn-escudo"><span class="pn-escudo-img">' + (u.escudo ? '<img src="' + esc(u.escudo) + '" alt="">' : '<b>+</b>') + '</span><input type="file" accept="image/*,.heic,.heif" data-escudo></label></div></div>' +
      '<div class="grupo"><label for="ed-cat">Sección</label><select class="campo" id="ed-cat">' + cats.map(function (c) { return '<option' + (c === u.categoria ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '<option value=""' + (u.categoria ? '' : ' selected') + '>Sin sección</option></select></div></div>';
  }
  function nombreAuto(u) { var eq = (u.etiquetas || {}).equipo || '', v = (u.version || '').trim(); return eq ? eq + (v ? ' · ' + v : '') : ''; }
  function vistaEditor() {
    var u = P.editando, cats = P.config.categorias || [], f = u.fotos, e = u.etiquetas || (u.etiquetas = { colores: [], pais: '', equipo: '' });
    function boton(lado, texto, opcional) {
      return '<label class="pn-foto' + (f[lado] ? ' lista' : '') + '"><span class="pn-foto-img">' + (f[lado] ? '<img src="' + esc(f[lado]) + '" alt="">' : '<b>+</b>') + '</span><span>' + texto + (opcional ? ' <small>(opcional)</small>' : '') + '</span><input type="file" accept="image/*,.heic,.heif" multiple data-foto="' + lado + '"></label>';
    }
    // arriba lo único que hace falta: fotos → cómo se ve → equipo y versión → Publicar. Lo demás ya viene listo, en "Más opciones"
    var angosto = window.innerWidth <= 980;   // en celular la vista 3D va justo debajo de las fotos; en compu, a un lado
    var prev = '<div class="pn-prev3d"' + (f.frente ? '' : ' hidden') + '><canvas id="ed-3d" class="ed-3d"></canvas></div>';
    // EL ESTUDIO: una sola pantalla sin bajar. En medio el 3D (es el control: se toca una pieza); abajo una franja con lo de
    // esa pieza; lo demás (equipo y versión, más opciones, calcetas) sale en una hoja desde abajo solo cuando se pide.
    var faltaLado = !f.frente ? 'frente' : !f.espalda ? 'espalda' : !f.short ? 'short' : '';
    var NOMF = { frente: 'el frente', espalda: 'la espalda', short: 'el short' };
    var vacio = f.frente ? '' : '<button type="button" class="pn-est-vacio" data-subir="frente"><span class="pn-est-cam"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/></svg></span><b>Sube la foto del frente</b><small>Playera extendida, de frente, con buena luz. Si viene con el short, lo separamos solo.</small></button>';
    var h = '<button type="button" class="link-x" data-volver>← Volver</button>' +
      '<div class="pn-estudio"><div class="pn-est-3d">' + prev + vacio + '</div>' +
      '<div id="ed-aviso"></div>' +
      '<div class="pn-est-franja"><div class="pn-ctl" id="pn-ctl">' + franjaInicio(u, faltaLado, NOMF) + '</div></div>' +
      '<div class="pn-est-oculto" aria-hidden="true"><div class="pn-fotos">' + boton('frente', 'Frente') + boton('espalda', 'Espalda') + boton('short', 'Short') + boton('mangaI', 'Manga izquierda', true) + boton('mangaD', 'Manga derecha', true) + '</div></div>' +
      '<div class="pn-hoja" data-hoja="datos" hidden><div class="pn-hoja-in"><div class="pn-hoja-cab"><b>Equipo y diseño</b><button type="button" class="pn-ctl-listo" data-hoja-cerrar>Listo</button></div><div class="pn-hoja-cuerpo pn-form">' +
      
      // el equipo se escoge de la lista (un error de dedo no parte al equipo en dos); si es nuevo, aquí mismo se le pone sección y escudo
      equipoHTML(u, cats) +
      // el diseño se nombra libre (un equipo puede tener 6 o 10: "Local 2024", "Retro 98", "Portero"…); el nombre en la página cambia solo
      '<div class="grupo"><label for="ed-version">Nombre del diseño</label><input class="campo" id="ed-version" maxlength="30" value="' + esc(u.version || '') + '" placeholder="Ej. Local 2024, Retro 98, Portero"></div>' +
      // para la lupa de los conocedores: año, liga y palabras clave
      '<div class="fila2"><div class="grupo"><label for="ed-anio">Año</label><input class="campo" id="ed-anio" inputmode="numeric" maxlength="9" value="' + esc(e.anio || '') + '" placeholder="Ej. 2024"></div>' +
      '<div class="grupo"><label for="ed-liga">Liga o torneo</label><input class="campo" id="ed-liga" maxlength="40" value="' + esc(e.liga || '') + '" placeholder="Ej. Liga MX"></div></div>' +
      '<div class="grupo"><label for="ed-otros">Palabras clave <small>(para que te encuentren)</small></label><input class="campo" id="ed-otros" maxlength="120" value="' + esc(e.otros || '') + '" placeholder="Ej. retro, mundial, campeón, portero"></div>' +
            '<div class="pn-mas-op" data-mas-op>' +
      '<div class="grupo"><label for="ed-nombre">Nombre en la página <small>(vacío = equipo y diseño)</small></label><input class="campo" id="ed-nombre" maxlength="50" value="' + esc(u.nombre) + '" placeholder="' + esc(nombreAuto(u) || 'Ej. México · Local') + '"></div>' +
      '<div class="grupo"><label for="ed-pais">País</label><input class="campo" id="ed-pais" maxlength="40" value="' + esc(e.pais) + '" placeholder="Ej. México"></div>' +
      '<div class="grupo"><span class="etq">Manga con la que se ve primero <small>(el cliente puede cambiarla)</small></span><div class="chips llenar"><button type="button" class="chip' + (u.manga !== 'larga' ? ' on' : '') + '" data-mg="corta">Corta</button><button type="button" class="chip' + (u.manga === 'larga' ? ' on' : '') + '" data-mg="larga">Larga</button></div></div>' +
      '<div class="grupo"><span class="etq">Color de nombre y número</span>' + bolitas('tx', u.colorTexto) + '</div>' +
      '<div class="grupo"><span class="etq">Número chico en el short</span><div class="chips llenar"><button type="button" class="chip' + (u.numeroShort ? ' on' : '') + '" data-ns="1">Sí</button><button type="button" class="chip' + (!u.numeroShort ? ' on' : '') + '" data-ns="0">No</button></div></div>' +
      '<div class="grupo"><span class="etq">Colores para el buscador <small>(se marcan solos con la foto)</small></span><div class="pn-tags">' + COLORES_N.map(function (c) { return '<button type="button" class="chip' + (e.colores.indexOf(c[0]) >= 0 ? ' on' : '') + '" data-col="' + c[0] + '"><i class="pn-bolita" style="background:' + c[1] + '"></i>' + c[0] + '</button>'; }).join('') + '</div></div>' +
      (f.frente && !/^data:/.test(f.frente) ? '<div class="grupo"><span class="etq">Misma playera, otro color <small>(desliza hasta el color y suelta: se hace la copia)</small></span>' + bolitas('oc', '') + '</div>' : '') +
      '</div>' +
      (u.nuevo ? '' : '<div class="grupo"><span class="etq">En la página</span><div class="pn-switches">' +
        '<button type="button" class="chip' + (u.destacado ? ' on' : '') + '" data-sw="destacado">★ ' + (u.destacado ? 'Destacado' : 'Destacar') + '</button>' +
        '<button type="button" class="chip' + (u.oculto ? ' on' : '') + '" data-sw="oculto">' + (u.oculto ? 'Oculto · tocar para mostrar' : 'Ocultar') + '</button>' +
        '<button type="button" class="chip pn-peligro" data-papelera>Mandar a la papelera</button></div></div>') +
      '</div></div></div>' +
      // calcetas: sus controles viven guardados aquí y se pasan a la franja de abajo al tocar las calcetas (nada tapa el uniforme)
      '<div class="pn-calc-guarda" hidden><div class="pn-calc-ctl">' +
      '<div class="pn-calc-fila"><span class="etq">Color</span>' + bolitas('ca', u.colorCalceta) + '</div>' +
      '<div class="pn-calc-fila"><span class="etq">Franja de arriba</span><div class="pn-franja"><button type="button" class="chip' + (!u.colorFranja ? ' on' : '') + '" data-fr="">Sin franja</button>' + bolitas('fr', u.colorFranja) + '</div></div>' +
      '</div></div>';
    // las tres fotos siempre: la espalda trae su propio diseño (no se inventa volteando el frente) y el short lleva logo y a veces diseño
    var listo = f.frente && f.espalda && f.short && !/^data:/.test(f.frente + f.espalda + f.short);
    h += '<div class="pn-publicar' + (listo ? ' listo' : '') + '"><button type="button" class="btn btn-oro" data-publicar' + (listo ? '' : ' disabled') + '>' + (u.nuevo ? 'Publicar' : 'Guardar') + '</button></div></div>';
    return h;
  }
  // la franja de abajo cuando no hay pieza escogida: qué falta (con su botón) o la ayuda, y "Equipo y diseño"
  // el molde, a la vista en el estudio (no escondido): 3 pasos numerados, sin palabras técnicas
  function bloqueMolde() {
    var v = window.VERSION || '1';
    return '<div class="pn-molde"><b class="pn-molde-t">¿Lo quieres hacer con ChatGPT u otro generador de imágenes?</b><ol class="pn-molde-pasos">' +
      '<li><span>Descarga el molde</span><span class="pn-molde-b"><a class="chip" href="/assets/molde/molde-corta.png?v=' + v + '" download="molde-m-sport-manga-corta.png">Manga corta</a><a class="chip" href="/assets/molde/molde-larga.png?v=' + v + '" download="molde-m-sport-manga-larga.png">Manga larga</a></span></li>' +
      '<li><span>Dáselo al generador con tus fotos y estas instrucciones</span><span class="pn-molde-b"><button type="button" class="chip" data-molde-texto>Copiar instrucciones</button></span></li>' +
      '<li><span>Sube aquí lo que te dio</span><span class="pn-molde-b"><label class="chip pn-molde-subir">Subir molde lleno<input type="file" accept="image/*,.heic,.heif" data-molde class="pn-est-oculto"></label></span></li>' +
      '</ol></div>';
  }
  // sus botones se atienden una sola vez para todo el panel (el estudio se vuelve a dibujar a cada rato)
  var moldeListo = false;
  function enlazarMolde() {
    if (moldeListo) return; moldeListo = true;
    panel.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-molde-texto]'); if (b) copiarTexto(TEXTO_MOLDE).then(function () { A.toast('Instrucciones copiadas: pégalas en el generador junto con el molde y tus fotos'); }); });
    panel.addEventListener('change', function (e) { var mo = e.target; if (!mo.matches || !mo.matches('[data-molde]')) return; var f = mo.files && mo.files[0]; mo.value = ''; if (f) leerMolde(f); });
  }
  function franjaInicio(u, faltaLado, NOMF) {
    enlazarMolde();
    var f = u.fotos || {};
    var lados = '<div class="pn-est-lados" role="tablist"><button type="button" class="vista' + (pvVista !== 'espalda' ? ' on' : '') + '" data-pv="frente">Frente</button><button type="button" class="vista' + (pvVista === 'espalda' ? ' on' : '') + '" data-pv="espalda">Espalda</button></div>';
    var nombre = esc(nombreAuto(u) || u.nombre || 'Sin equipo todavía');
    var cab = '<button type="button" class="pn-est-equipo" data-hoja-ir="datos"><span><small>Equipo y diseño</small><b>' + nombre + '</b></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>';
    if (!f.frente) return cab + bloqueMolde();
    if (faltaLado) return lados + '<button type="button" class="pn-est-falta" data-subir="' + faltaLado + '"><span class="pn-est-cam"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/></svg></span><span><b>Falta la foto ' + ({ frente: 'del frente', espalda: 'de la espalda', short: 'del short' })[faltaLado] + '</b><small>Tócalo para subirla</small></span></button>' + cab;
    // Frente / Espalda vive aquí abajo, nunca encima del uniforme
    return lados + '<p class="pn-ctl-ayuda">☝ Toca una pieza del uniforme para acomodarla o cambiar su foto.</p>' + cab + bloqueMolde();
  }
  var mEditor = null, pvVista = 'frente';
  // borrador: el dueño pinta con el dedo lo que no es de la playera (etiqueta colgando, gancho, mancha) y se rellena
  // con lo que lo rodea: si alrededor hay tela, queda tela; si alrededor no hay nada (arriba del cuello), queda transparente
  function rellenar(c, m) {
    var W = c.width, H = c.height, g = c.getContext('2d'), img = g.getImageData(0, 0, W, H), d = img.data, n = W * H;
    var pr = new Float32Array(n * 4), falta = new Uint8Array(n), pend = [], k;
    for (k = 0; k < n; k++) { var a = d[k * 4 + 3] / 255; pr[k * 4] = d[k * 4] * a; pr[k * 4 + 1] = d[k * 4 + 1] * a; pr[k * 4 + 2] = d[k * 4 + 2] * a; pr[k * 4 + 3] = a; if (m[k]) { falta[k] = 1; pend.push(k); } }
    var V = [-1, 1, -W, W, -W - 1, -W + 1, W - 1, W + 1];
    while (pend.length) {   // de la orilla hacia adentro: cada vuelta llena el anillo que ya tiene vecinos conocidos
      var listos = [], sig = [];
      pend.forEach(function (k2) {
        var x = k2 % W, t = [0, 0, 0, 0], c2 = 0;
        V.forEach(function (v) { var j = k2 + v, xj = j % W; if (j < 0 || j >= n || Math.abs(xj - x) > 1 || falta[j]) return; t[0] += pr[j * 4]; t[1] += pr[j * 4 + 1]; t[2] += pr[j * 4 + 2]; t[3] += pr[j * 4 + 3]; c2++; });
        if (c2) listos.push([k2, t, c2]); else sig.push(k2);
      });
      if (!listos.length) break;
      listos.forEach(function (l) { var j = l[0]; for (var q = 0; q < 4; q++) pr[j * 4 + q] = l[1][q] / l[2]; falta[j] = 0; });
      pend = sig;
    }
    for (var vuelta = 0; vuelta < 3; vuelta++) for (k = 0; k < n; k++) if (m[k]) {   // se suaviza solo lo pintado, para que no queden rayas
      var x = k % W, t2 = [0, 0, 0, 0], c3 = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var xx = x + dx, j2 = k + dy * W + dx; if (xx < 0 || xx >= W || j2 < 0 || j2 >= n) continue; for (var q2 = 0; q2 < 4; q2++) t2[q2] += pr[j2 * 4 + q2]; c3++; }
      for (var q3 = 0; q3 < 4; q3++) pr[k * 4 + q3] = t2[q3] / c3;
    }
    for (k = 0; k < n; k++) if (m[k]) { var al = pr[k * 4 + 3]; if (al < 0.5) { d[k * 4 + 3] = 0; continue; } d[k * 4] = pr[k * 4] / al; d[k * 4 + 1] = pr[k * 4 + 1] / al; d[k * 4 + 2] = pr[k * 4 + 2] / al; d[k * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
    var x0 = W, y0 = H, x1 = -1, y1 = -1;   // se ajusta el cuadro a la prenda (si se quitó algo de la orilla, como un gancho)
    for (k = 0; k < n; k++) if (d[k * 4 + 3] > 40) { var xk = k % W, yk = (k - xk) / W; if (xk < x0) x0 = xk; if (xk > x1) x1 = xk; if (yk < y0) y0 = yk; if (yk > y1) y1 = yk; }
    if (x1 < 0 || (x0 === 0 && y0 === 0 && x1 === W - 1 && y1 === H - 1)) return c;
    var o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d').drawImage(c, -x0, -y0); return o;
  }
  // acomodar: la foto se mueve y cambia de tamaño sobre el uniforme en 3D, con botones grandes (dejarlos apretados repite)
  /* ---------- tocar el uniforme para editarlo ----------
     El 3D es el control: se toca una pieza (playera de frente o de espalda, short, nombre o número), esa pieza brilla y lo demás
     se apaga, y abajo salen sus controles: mover, tamaño (y ancho en nombre y número), cambiar su foto o quitarle algo. */
  var pnSel = '', NOM_PIEZA = { frente: 'Playera · frente', espalda: 'Playera · espalda', short: 'Short', nombre: 'Nombre', numero: 'Número', calcetas: 'Calcetas', mangaI: 'Manga izquierda', mangaD: 'Manga derecha' };
  function tocarPieza(e) {
    if (!mEditor || !mEditor.m || !mEditor.m.piezaEn) return;
    var p = mEditor.m.piezaEn(e.clientX, e.clientY);
    // tocar el fondo (no una pieza) con nada escogido abre los fondos; si algo estaba escogido, solo lo suelta
    elegirPieza(p || (pnSel ? '' : 'fondo'));
  }
  // las hojas que salen desde abajo (equipo y versión, calcetas): una a la vez, se cierran con "Listo" o tocando fuera
  function abrirHoja(k) {
    $$('.pn-hoja', panel).forEach(function (h) { h.hidden = h.getAttribute('data-hoja') !== k; });
  }
  function enlazarEstudio() {
    var ctl = $('#pn-ctl', panel), est = $('.pn-estudio', panel); if (!est) return;
    est.addEventListener('click', function (e) {
      var t = e.target.closest('[data-hoja-ir],[data-subir],[data-hoja-cerrar]'); if (!t) { if (e.target.classList && e.target.classList.contains('pn-hoja')) abrirHoja(''); return; }
      if (t.hasAttribute('data-hoja-cerrar')) { abrirHoja(''); return pintarCtl(); }
      if (t.hasAttribute('data-hoja-ir')) return abrirHoja(t.getAttribute('data-hoja-ir'));
      var inp = $('[data-foto="' + t.getAttribute('data-subir') + '"]', panel); if (inp) inp.click();
    });
  }
  function elegirPieza(p) {
    var m = mEditor && mEditor.m; if (!m) return;
    pnSel = p; m.seleccionar(p === 'fondo' ? '' : p);
    // la manga: el 3D gira hacia su lado (izquierda o derecha); las demás piezas, de frente o de espalda
    var lado = p === 'mangaI' || p === 'mangaD' ? p : p === 'espalda' || p === 'nombre' || p === 'numero' ? 'espalda' : p && p !== 'fondo' ? 'frente' : null;
    if (lado && lado !== pvVista) { pvVista = lado; m.vista(lado); $$('[data-pv]', panel).forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-pv') === lado); }); }
    pintarCtl();
  }
  function pintarCtl() {
    var ctl = $('#pn-ctl', panel), u = P.editando; if (!ctl || !u) return;
    var cc = $('.pn-calc-ctl', panel), guarda = $('.pn-calc-guarda', panel);
    if (cc && guarda && cc.parentNode !== guarda) guarda.appendChild(cc);   // antes de volver a pintar, los controles de calcetas regresan a su lugar
    if (pnSel === 'calcetas') {
      ctl.innerHTML = '<div class="pn-ctl-tit"><span class="pn-ctl-pieza"><i></i>Calcetas</span><button type="button" class="pn-ctl-listo" data-ctl="listo">Listo</button></div>';
      if (cc) ctl.appendChild(cc);
      var li = $('[data-ctl="listo"]', ctl); if (li) li.addEventListener('click', function () { elegirPieza(''); });
      return;
    }
    if (pnSel === 'fondo') {
      // el fondo del uniforme, desde el estudio: el mismo de la página (al escogerlo cambia aquí, en la página y se guarda)
      var act = P.config.fondo || '';
      ctl.innerHTML = '<div class="pn-ctl-tit"><span class="pn-ctl-pieza"><i></i>Fondo</span><button type="button" class="pn-ctl-listo" data-ctl="listo">Listo</button></div>' +
        '<div class="pn-fondos">' + FONDOS.map(function (f) { var fu = urlFondo(f[0]); return '<button type="button" class="pn-fondo' + (act === fu ? ' on' : '') + '" data-est-fondo="' + esc(fu) + '" aria-label="' + esc(f[1]) + '"><img src="' + esc(fu || '/assets/3d/campo.webp') + '" alt=""></button>'; }).join('') + '</div>';
      $('[data-ctl="listo"]', ctl).addEventListener('click', function () { elegirPieza(''); });
      $$('[data-est-fondo]', ctl).forEach(function (b) {
        b.addEventListener('click', function () {
          $$('[data-est-fondo]', ctl).forEach(function (x) { x.classList.toggle('on', x === b); });
          P.config.fondo = b.getAttribute('data-est-fondo'); if (mEditor && mEditor.m) mEditor.m.fondo(P.config.fondo);
          guardarConfig(); notaFondo();
        });
      });
      // si el fondo escogido choca con este uniforme, la página le pone otro solo a este (y aquí se avisa por qué)
      function notaFondo() {
        var n = $('.pn-fondo-nota', ctl), cambio = mEditor && mEditor.m && mEditor.m.fondoCambiado && mEditor.m.fondoCambiado();
        if (cambio && !n) { n = document.createElement('p'); n.className = 'pn-fondo-nota'; n.textContent = 'Este fondo choca con este uniforme: aquí se cambia solo para que resalte.'; ctl.appendChild(n); }
        else if (!cambio && n) n.remove();
      }
      notaFondo();
      var on0 = $('.pn-fondo.on', ctl), tira = $('.pn-fondos', ctl); if (on0 && tira) tira.scrollLeft = on0.offsetLeft - 12;
      return;
    }
    if (!pnSel) { var f0 = u.fotos || {}; ctl.innerHTML = franjaInicio(u, !f0.frente ? 'frente' : !f0.espalda ? 'espalda' : !f0.short ? 'short' : '', { frente: 'el frente', espalda: 'la espalda', short: 'el short' }); return; }
    var esManga = pnSel === 'mangaI' || pnSel === 'mangaD';
    var clavePat = u.manga === 'larga' ? 'patronLarga' : 'patronCorta';
    if (esManga && (u.fotos || {})[clavePat]) {
      // uniforme hecho con molde: la manga ya trae su tela del molde; si el generador puso los parches en el brazo
      // contrario, un toque los pasa al otro brazo (sin volver a generar)
      ctl.innerHTML = '<div class="pn-ctl-tit"><span class="pn-ctl-pieza"><i></i>' + NOM_PIEZA[pnSel] + '</span><button type="button" class="pn-ctl-listo" data-ctl="listo">Listo</button></div>' +
        '<div class="pn-ctl-extra"><button type="button" class="chip" data-ctl="cambiar">Pasar al otro brazo</button></div>';
      $('[data-ctl="listo"]', ctl).addEventListener('click', function () { elegirPieza(''); });
      $('[data-ctl="cambiar"]', ctl).addEventListener('click', function () { cambiarMangas(u, clavePat); });
      return;
    }
    if (esManga && !(u.fotos || {})[pnSel]) {
      // la manga todavía sin su foto: sale de las fotos del frente y la espalda; aquí se le pone la suya
      ctl.innerHTML = '<div class="pn-ctl-tit"><span class="pn-ctl-pieza"><i></i>' + NOM_PIEZA[pnSel] + '</span><button type="button" class="pn-ctl-listo" data-ctl="listo">Listo</button></div>' +
        '<button type="button" class="pn-est-falta" data-ctl="foto"><span class="pn-est-cam"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/></svg></span><span><b>Sube la foto de esta manga</b><small>De lado, con el hombro arriba y el puño abajo</small></span></button>';
      $('[data-ctl="listo"]', ctl).addEventListener('click', function () { elegirPieza(''); });
      $('[data-ctl="foto"]', ctl).addEventListener('click', function () { var inp = $('[data-foto="' + pnSel + '"]', panel); if (inp) inp.click(); });
      return;
    }
    var txt = pnSel === 'nombre' || pnSel === 'numero', foto = !txt;
    var fl = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>'; };
    // un control redondo para mover (como el de un control de videojuego) y a su lado píldoras para el tamaño y el ancho
    ctl.innerHTML = '<div class="pn-ctl-tit"><span class="pn-ctl-pieza"><i></i>' + NOM_PIEZA[pnSel] + '</span><button type="button" class="pn-ctl-listo" data-ctl="listo">Listo</button></div>' +
      // mover: una cruz de 4 flechas; tamaño y ancho: menos / más lado a lado. Cada uno con su nombre abajo, nada encimado
      '<div class="pn-ctl-zona"><div class="pn-mov"><div class="pn-cruz">' +
      '<button type="button" class="ar" data-ctl="y+" aria-label="Más arriba">' + fl('M6 15l6-6 6 6') + '</button>' +
      '<button type="button" class="iz" data-ctl="x-" aria-label="A la izquierda">' + fl('M15 6l-6 6 6 6') + '</button><i></i>' +
      '<button type="button" class="de" data-ctl="x+" aria-label="A la derecha">' + fl('M9 6l6 6-6 6') + '</button>' +
      '<button type="button" class="ab" data-ctl="y-" aria-label="Más abajo">' + fl('M6 9l6 6 6-6') + '</button></div><small>Mover</small></div>' +
      '<div class="pn-tams"><div class="pn-mov"><div class="pn-par"><button type="button" data-ctl="z-" aria-label="Más chico">' + fl('M6 12h12') + '</button><button type="button" data-ctl="z+" aria-label="Más grande">' + fl('M12 6v12M6 12h12') + '</button></div><small>Tamaño</small></div>' +
      (txt ? '<div class="pn-mov"><div class="pn-par"><button type="button" data-ctl="a-" aria-label="Más angosto">' + fl('M3 12h6M21 12h-6M6 9l3 3-3 3M18 9l-3 3 3 3') + '</button><button type="button" data-ctl="a+" aria-label="Más ancho">' + fl('M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4') + '</button></div><small>Ancho</small></div>' : '') + '</div>' +
      '</div><div class="pn-ctl-extra">' + (foto ? '<button type="button" class="chip" data-ctl="foto">Cambiar foto</button>' : '') + (pnSel === 'frente' || pnSel === 'espalda' ? '<button type="button" class="chip" data-ctl="quitar">Quitar algo</button>' : '') + (esManga ? '<button type="button" class="chip" data-ctl="girar">Girar</button><button type="button" class="chip" data-ctl="sinfoto">Quitar foto</button>' : '') +
      '<button type="button" class="chip" data-ctl="0">Como estaba</button></div>';
    var rep = null;
    $$('[data-ctl]', ctl).forEach(function (b) {
      var k = b.getAttribute('data-ctl');
      if (k === 'listo') return b.addEventListener('click', function () { elegirPieza(''); });
      if (k === 'foto') return b.addEventListener('click', function () { var inp = $('[data-foto="' + pnSel + '"]', panel); if (inp) inp.click(); });
      if (k === 'quitar') return b.addEventListener('click', function () { borrador(u, pnSel); });
      // girar la foto de la manga de cuarto en cuarto (si llegó acostada o de cabeza)
      if (k === 'girar') return b.addEventListener('click', function () { u.ajuste = u.ajuste || {}; var v = (u.ajuste[pnSel] || [1, 0, 0]).slice(0, 3); var vu = mEditor.m.vueltasManga ? mEditor.m.vueltasManga(pnSel) : 0; v[3] = (vu + 1) % 4; u.ajuste[pnSel] = v; mEditor.m.ajuste(u.ajuste); });
      if (k === 'sinfoto') return b.addEventListener('click', function () { delete u.fotos[pnSel]; if (u.ajuste) delete u.ajuste[pnSel]; previsualizar().then(function () { pintarCtl(); }); });
      if (k === '0') return b.addEventListener('click', function () { if (u.ajuste) delete u.ajuste[pnSel]; mEditor.m.ajuste(u.ajuste || {}); });
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); pasoPieza(u, k); clearInterval(rep); b._t = setTimeout(function () { rep = setInterval(function () { pasoPieza(u, k); }, 70); }, 350); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { clearTimeout(b._t); clearInterval(rep); }); });
    });
  }
  function pasoPieza(u, k) {
    var txt = pnSel === 'nombre' || pnSel === 'numero', lim = function (n, a, b) { return Math.max(a, Math.min(b, n)); };
    u.ajuste = u.ajuste || {}; var v = (u.ajuste[pnSel] || (txt ? [1, 0, 0, 1] : [1, 0, 0])).slice();
    if (txt) {   // nombre y número: [tamaño, a los lados, arriba/abajo, ancho], con límites para que nunca se salgan de la playera
      if (k === 'z-') v[0] = lim(v[0] - 0.03, 0.6, 1.5); if (k === 'z+') v[0] = lim(v[0] + 0.03, 0.6, 1.5);
      if (k === 'x-') v[1] = lim(v[1] - 0.01, -0.15, 0.15); if (k === 'x+') v[1] = lim(v[1] + 0.01, -0.15, 0.15);
      if (k === 'y+') v[2] = lim(v[2] + 0.01, -0.2, 0.15); if (k === 'y-') v[2] = lim(v[2] - 0.01, -0.2, 0.15);
      if (k === 'a-') v[3] = lim(v[3] - 0.03, 0.6, 1.5); if (k === 'a+') v[3] = lim(v[3] + 0.03, 0.6, 1.5);
    } else {     // la foto: [tamaño, a los lados, arriba/abajo]
      if (k === 'z-') v[0] = lim(v[0] - 0.03, 0.6, 1.7); if (k === 'z+') v[0] = lim(v[0] + 0.03, 0.6, 1.7);
      if (k === 'x-') v[1] = lim(v[1] - 0.01, -0.3, 0.3); if (k === 'x+') v[1] = lim(v[1] + 0.01, -0.3, 0.3);
      if (k === 'y+') v[2] = lim(v[2] + 0.01, -0.3, 0.3); if (k === 'y-') v[2] = lim(v[2] - 0.01, -0.3, 0.3);
    }
    u.ajuste[pnSel] = v.map(function (n) { return Math.round(n * 1000) / 1000; }); mEditor.m.ajuste(u.ajuste);
  }
  function borrador(u, lado) {
    imagenP(u.fotos[lado]).then(function (im) {
      if (!im) { A.toast('No se pudo abrir la foto. Intenta otra vez.'); return; }
      var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0);
      var W = c.width, H = c.height, m = new Uint8Array(W * H), trazos = [];
      var cap = document.createElement('div'); cap.className = 'pn-borrador';
      cap.innerHTML = '<div class="pn-borrador-c"><p><b>Pinta con el dedo</b> lo que hay que quitar (etiqueta, gancho, mancha). Pinta un poquito más grande que la cosa.</p>' +
        '<div class="pn-borrador-lienzo"><canvas></canvas></div>' +
        '<div class="pn-borrador-b"><button type="button" class="btn btn-linea" data-b="atras">Deshacer</button><button type="button" class="btn btn-linea" data-b="no">Cancelar</button><button type="button" class="btn btn-oro" data-b="si">Listo</button></div></div>';
      document.body.appendChild(cap);
      var v = cap.querySelector('canvas'), vg = v.getContext('2d'); v.width = W; v.height = H;
      var radio = Math.max(6, Math.round(Math.max(W, H) * 0.022));
      function dibujar() {
        vg.clearRect(0, 0, W, H); vg.drawImage(c, 0, 0);
        vg.fillStyle = 'rgba(255,60,80,.55)';
        trazos.forEach(function (t) { t.forEach(function (p) { vg.beginPath(); vg.arc(p[0], p[1], radio, 0, 7); vg.fill(); }); });
      }
      dibujar();
      var activo = null;
      function punto(e) { var r = v.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
      function agrega(p) { var t = activo, u2 = t[t.length - 1]; if (u2) { var dd = Math.hypot(p[0] - u2[0], p[1] - u2[1]), pasos = Math.ceil(dd / (radio * 0.4)); for (var i = 1; i < pasos; i++) t.push([u2[0] + (p[0] - u2[0]) * i / pasos, u2[1] + (p[1] - u2[1]) * i / pasos]); } t.push(p); dibujar(); }
      v.addEventListener('pointerdown', function (e) { e.preventDefault(); v.setPointerCapture(e.pointerId); activo = []; trazos.push(activo); agrega(punto(e)); });
      v.addEventListener('pointermove', function (e) { if (activo) { e.preventDefault(); agrega(punto(e)); } });
      ['pointerup', 'pointercancel'].forEach(function (ev) { v.addEventListener(ev, function () { activo = null; }); });
      cap.addEventListener('click', function (e) {
        var b = e.target.closest('[data-b]'); if (!b) return; var q = b.getAttribute('data-b');
        if (q === 'atras') { trazos.pop(); dibujar(); return; }
        if (q === 'no' || !trazos.length) { cap.remove(); return; }
        trazos.forEach(function (t) { t.forEach(function (p) { var r2 = radio * radio; for (var y = Math.max(0, Math.floor(p[1] - radio)); y <= Math.min(H - 1, p[1] + radio); y++) for (var x = Math.max(0, Math.floor(p[0] - radio)); x <= Math.min(W - 1, p[0] + radio); x++) if ((x - p[0]) * (x - p[0]) + (y - p[1]) * (y - p[1]) <= r2) m[y * W + x] = 1; }); });
        cap.remove(); A.toast('Quitando…', true);
        setTimeout(function () {
          var out = rellenar(c, m);
          ponerFoto(u, lado, out).then(function () { pintar(); A.toast('Listo. Revisa cómo quedó en la vista 3D.'); }, function () { pintar(); A.toast('No se pudo subir. Revisa tu internet y vuelve a intentar.'); });
        }, 30);
      });
    });
  }
  // los uniformes de manga larga publicados antes no tienen su círculo en manga corta: se hacen solos, una vez, en segundo plano
  // (en un 3D escondido, sin tocar lo que el dueño esté haciendo) y se guardan; después ya no se vuelve a hacer
  var migrando = false;
  function migrarCirculos() {
    if (migrando || !P.pin) return;
    var falta = (P.catalogo || []).filter(function (u) { return u.tipo === '3d' && !u.borrado && u.manga === 'larga' && !u.circulo && u.fotos && u.fotos.frente && !/^data:/.test(u.fotos.frente); });
    if (!falta.length) return; migrando = true;
    var c = document.createElement('canvas'); c.width = 480; c.height = 720; c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;left:-10000px;top:0;width:240px;height:360px;pointer-events:none;opacity:0';
    document.body.appendChild(c);
    var hechos = 0;
    A.cargarMotor().then(function () { return window.Motor3D.crear(c); }).then(function (m) {
      return falta.reduce(function (cadena, u) {
        return cadena.then(function () {
          return Promise.all([imagenP(u.fotos.frente), imagenP(u.fotos.espalda), imagenP(u.fotos.short), imagenP(u.fotos.mangaI), imagenP(u.fotos.mangaD), imagenP(u.fotos.patronCorta), imagenP(u.fotos.patronLarga)]).then(function (im) {
            if (!im[0]) return;
            return m.uniforme({ frente: im[0], espalda: im[1], short: im[2], mangaI: im[3], mangaD: im[4], patronCorta: im[5], patronLarga: im[6], mangaFotos: u.manga === 'larga' ? 'larga' : 'corta', manga: 'corta', colorShort: u.colorShort || '#f3f3f5', colorCalceta: u.colorCalceta || u.colorShort || '#f3f3f5', colorFranja: u.colorFranja || '', numeroShort: !!u.numeroShort, torso: u.torso || null, ajuste: u.ajuste || null })
              .then(function () { return m.taco('negro'); })
              .then(function () { m.dorsal({ nombre: '', numero: '' }); return new Promise(function (ok) { requestAnimationFrame(function () { requestAnimationFrame(ok); }); }); })
              .then(function () { return A.subirConReintento(m.foto(480, 720, 'frente', true), 'catalogo'); })
              .then(function (url) { if (url) { u.circulo = url; hechos++; } });
          }).catch(function () { /* este se intenta la próxima vez */ });
        });
      }, Promise.resolve()).then(function () { m.destruir(); });
    }).catch(function () {}).then(function () {
      c.remove();
      if (hechos) return api('catalogo', { catalogo: P.catalogo }).then(function () { return A.cargarTienda(); }).catch(function () {});
    });
  }
  function imagenP(src) { return new Promise(function (ok) { if (!src) return ok(null); var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }
  function previsualizar() {
    var u = P.editando, c = $('#ed-3d'); if (!c || !u.fotos.frente) return Promise.resolve();
    return A.cargarMotor().catch(function () {}).then(function () {
      if (!window.Motor3D) return;
      if (!mEditor || mEditor.lienzo !== c) {
        if (mEditor && mEditor.m) mEditor.m.destruir();
        mEditor = { lienzo: c, p: window.Motor3D.crear(c).then(function (m) {
          // deslizar a los lados también voltea la vista previa
          if (m.deslizable) m.deslizable(function (v) { pvVista = v; $$('[data-pv]', panel).forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-pv') === v); }); });   // girar solo deslizando dentro del cuadro del 3D
          c.addEventListener('click', tocarPieza); pnSel = '';
          if (P.config.fondo && m.fondo) m.fondo(P.config.fondo);   // el estudio enseña el mismo fondo que la página   // tocar una pieza del uniforme la escoge para acomodarla
          return m;
        }) };
      }
      return mEditor.p.then(function (m) {
        mEditor.m = m;
        return Promise.all([imagenP(u.fotos.frente), imagenP(u.fotos.espalda), imagenP(u.fotos.short), imagenP(u.fotos.mangaI), imagenP(u.fotos.mangaD), imagenP(u.fotos.patronCorta), imagenP(u.fotos.patronLarga)]).then(function (im) {
          if (m.congelar) m.congelar(true);   // cambia de un solo jalón, sin pasos a medias
          return m.uniforme({ frente: im[0], espalda: im[1], short: im[2], mangaI: im[3], mangaD: im[4], patronCorta: im[5], patronLarga: im[6], mangaFotos: u.manga === 'larga' ? 'larga' : 'corta', manga: u.manga === 'larga' ? 'larga' : 'corta', colorShort: u.colorShort || '#f3f3f5', colorCalceta: u.colorCalceta || u.colorShort || '#f3f3f5', colorFranja: u.colorFranja || '', numeroShort: !!u.numeroShort, ajuste: u.ajuste || null });
        }).then(function () { return m.taco('negro'); }).then(function () { m.dorsal({ nombre: 'JUANPI', numero: '69', color: u.colorTexto || '#111111', sello: true }); m.vista(pvVista, false); return new Promise(function (ok) { requestAnimationFrame(function () { requestAnimationFrame(ok); }); }); }).then(function () { if (m.congelar) m.congelar(false); }, function () { if (m.congelar) m.congelar(false); });
      });
    });
  }
  /* ---------- el molde lleno ----------
     Las 4 marcas de las esquinas dicen cómo enderezarlo (aunque el generador lo haya movido o achicado); la máscara del molde
     dice qué pixel es de qué pieza. Cada pieza sale recortada justo por su silueta y entra como foto del uniforme. */
  var TEXTO_MOLDE = 'La primera imagen es un MOLDE: el patrón de costura de una playera de fútbol y su short, con cada pieza plana y en su tamaño real. Las demás son fotos reales de un uniforme (frente y espalda de la playera, frente del short; si hay, también las mangas). Pinta ese mismo uniforme dentro de las piezas blancas, como si la tela estuviera cortada para coserse: en FRENTE el frente de la playera (sin mangas), en ESPALDA la espalda vista desde atrás, en SHORT el frente del short. Cada MANGA es la manga completa desenrollada: arriba el hombro, abajo el puño, en el centro la cara de afuera del brazo (donde van los parches) y en las orillas de los lados la costura de abajo del brazo; fíjate en la foto del frente: lo que trae la manga que ves a tu izquierda va en la caja de la izquierda, y lo de la manga que ves a tu derecha va en la caja de la derecha. En la ESPALDA no pongas nombre ni número de jugador aunque vengan en la foto (los pone la página): deja esa zona con la tela lisa y solo los patrocinadores. Pon en cada manga solo los parches, franjas y puños que se ven en esa manga en las fotos; si no trae parche, déjala lisa. Si es MANGA LARGA: las franjas o líneas que bajan por el brazo van de arriba a abajo por el CENTRO de la pieza (la cara de afuera), del hombro hasta el puño, sin cortarse; no las pongas atravesadas. El resto de la manga es igual que en manga corta, solo más larga. Reglas: no muevas ni cambies el tamaño de las piezas; deja igual el fondo gris, los cuadros negros de las cuatro esquinas y los textos; llena cada pieza completa hasta su contorno; vista plana, sin sombras, sin arrugas y sin personas; copia exactamente los colores, logos, escudos y patrocinadores de las fotos; no inventes nada que no esté en las fotos.';
  function copiarTexto(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).catch(function () { return copiarViejo(t); });
    return Promise.resolve(copiarViejo(t));
  }
  function copiarViejo(t) { var a = document.createElement('textarea'); a.value = t; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) { /* nada */ } a.remove(); }
  function cargarJSON(u) { return fetch(u).then(function (r) { return r.json(); }); }
  function homografia(de, a) {   // 4 puntos del molde -> 4 puntos de la foto
    var M = [], b = [];
    for (var i = 0; i < 4; i++) { var x = de[i][0], y = de[i][1], u = a[i][0], v = a[i][1]; M.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); M.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
    for (var c = 0; c < 8; c++) { var p = c; for (var r = c + 1; r < 8; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; var t = M[c]; M[c] = M[p]; M[p] = t; t = b[c]; b[c] = b[p]; b[p] = t;
      for (r = 0; r < 8; r++) if (r !== c) { var f = M[r][c] / M[c][c]; for (var k = c; k < 8; k++) M[r][k] -= f * M[c][k]; b[r] -= f * b[c]; } }
    var h = b.map(function (bv, i) { return bv / M[i][i]; });
    return function (x, y) { var w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };
  }
  // los detalles de un pedazo de tela (parches, franjas, letras): los colores que NO son la tela principal, en 64 cajitas
  function detalles(c, dentro) {
    var W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data, cuenta = {}, px = [];
    for (var y = 0; y < H; y += 2) for (var x = 0; x < W; x += 2) { var i = (y * W + x) * 4; if (d[i + 3] < 200 || !dentro(x, y, W, H)) continue; px.push(i); var k = (d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5); cuenta[k] = (cuenta[k] || 0) + 1; }
    var top = null, n = 0; Object.keys(cuenta).forEach(function (k) { if (cuenta[k] > n) { n = cuenta[k]; top = k; } });
    if (!top) return null;
    var t = top.split(',').map(function (v) { return v * 32 + 16; }), h = new Float32Array(64), nd = 0;
    px.forEach(function (i) { if (Math.abs(d[i] - t[0]) + Math.abs(d[i + 1] - t[1]) + Math.abs(d[i + 2] - t[2]) < 110) return; h[(d[i] >> 6) * 16 + (d[i + 1] >> 6) * 4 + (d[i + 2] >> 6)]++; nd++; });
    if (nd) for (var j = 0; j < 64; j++) h[j] /= nd;
    return { h: h, n: nd, tot: px.length };
  }
  function mangasAlReves(pz, tipo) {
    var F = pz.frente, W = F.width, H = F.height, fd = F.getContext('2d').getImageData(0, Math.round(H * 0.7), W, 1).data, a = -1, b = -1;
    for (var x = 0; x < W; x++) if (fd[x * 4 + 3] > 128) { if (a < 0) a = x; b = x; }
    if (a < 0) return false;
    var cen = Math.round((a + b) / 2), i0 = cen, i1 = cen, hueco = Math.max(2, Math.round(W * 0.006));
    for (var v = 0, xx = cen; xx >= a; xx--) { if (fd[xx * 4 + 3] > 128) { i0 = xx; v = 0; } else if (++v > hueco) break; }
    for (v = 0, xx = cen; xx <= b; xx++) { if (fd[xx * 4 + 3] > 128) { i1 = xx; v = 0; } else if (++v > hueco) break; }
    var alto = tipo === 'corta' ? 0.45 : 0.97, m = W * 0.01;
    var izq = detalles(F, function (x, y, w, h) { return x < i0 - m && y < h * alto; }), der = detalles(F, function (x, y, w, h) { return x > i1 + m && y < h * alto; });
    var mI = detalles(pz.mangaI, function () { return true; }), mD = detalles(pz.mangaD, function () { return true; });
    if (!izq || !der || !mI || !mD) return false;
    // lo que es igual en las dos mangas (puños, franjas) se cancela: solo cuenta lo que una tiene y la otra no (el parche).
    // Si esa diferencia va al revés de la que se ve en las mangas del FRENTE, están cambiadas.
    var dens = function (p) { var o = new Float32Array(64); for (var j = 0; j < 64; j++) o[j] = p.h[j] * p.n / Math.max(1, p.tot); return o; };
    var hI = dens(mI), hD = dens(mD), hL = dens(izq), hR = dens(der), s = 0, nt = 0, nz = 0;
    for (var j = 0; j < 64; j++) { var dt = hI[j] - hD[j], dz = hL[j] - hR[j]; s += dt * dz; nt += dt * dt; nz += dz * dz; }
    var c = s / Math.max(1e-9, Math.sqrt(nt * nz));
    // solo con una diferencia fuerte y clara (un parche de otro color en una sola manga). Si las dos mangas traen detalles
    // parecidos (letras blancas en las dos), no se adivina: se respeta lo que puso el generador.
    return c < -0.35 && Math.sqrt(nt) > 0.03 && Math.sqrt(nz) > 0.02;
  }
  // dónde está el cuerpo (sin brazos) en una pieza de playera: el pedazo del centro a 70% de su alto
  function cuerpoDe(F) {
    var W = F.width, H = F.height, fd = F.getContext('2d').getImageData(0, Math.round(H * 0.7), W, 1).data, a = -1, b = -1;
    for (var x = 0; x < W; x++) if (fd[x * 4 + 3] > 128) { if (a < 0) a = x; b = x; }
    if (a < 0) return null;
    var cen = Math.round((a + b) / 2), i0 = cen, i1 = cen, hueco = Math.max(2, Math.round(W * 0.006));
    for (var v = 0, xx = cen; xx >= a; xx--) { if (fd[xx * 4 + 3] > 128) { i0 = xx; v = 0; } else if (++v > hueco) break; }
    for (v = 0, xx = cen; xx <= b; xx++) { if (fd[xx * 4 + 3] > 128) { i1 = xx; v = 0; } else if (++v > hueco) break; }
    return [i0 - W * 0.01, i1 + W * 0.01];
  }
  // las manchas de detalle de un pedazo de tela (parches, letras, escudos): lo que no es la tela principal, en grupos.
  // No cuentan las tiras (puños, franjas, ribetes): son muy alargadas o muy delgadas para su caja.
  function manchas(c, dentro, estricto) {
    var W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data, P = 3, gw = Math.ceil(W / P), gh = Math.ceil(H / P);
    var en = new Uint8Array(gw * gh), tela = new Uint8Array(gw * gh), cuenta = {}, celdas = 0;
    for (var gy = 0; gy < gh; gy++) for (var gx = 0; gx < gw; gx++) { var x = gx * P, y = gy * P, i = (y * W + x) * 4; if (d[i + 3] < 200) continue; tela[gy * gw + gx] = 1; if (!dentro(x, y, W, H)) continue; en[gy * gw + gx] = 1; celdas++; var k = (d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5); cuenta[k] = (cuenta[k] || 0) + 1; }
    var top = null, n = 0; Object.keys(cuenta).forEach(function (k) { if (cuenta[k] > n) { n = cuenta[k]; top = k; } });
    if (!top) return { lista: [], celdas: 0 };
    var t = top.split(',').map(function (v) { return v * 32 + 16; }), det = new Uint8Array(gw * gh);
    for (var q = 0; q < gw * gh; q++) { if (!en[q]) continue; var j = ((Math.floor(q / gw) * P) * W + (q % gw) * P) * 4; if (Math.abs(d[j] - t[0]) + Math.abs(d[j + 1] - t[1]) + Math.abs(d[j + 2] - t[2]) > 110) det[q] = 1; }
    var gr = new Uint8Array(gw * gh);   // las letras sueltas de un mismo parche se juntan
    for (q = 0; q < gw * gh; q++) if (det[q]) { var qx = q % gw, qy = (q - qx) / gw; for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) { var X = qx + dx, Y = qy + dy; if (X >= 0 && Y >= 0 && X < gw && Y < gh && en[Y * gw + X]) gr[Y * gw + X] = 1; } }
    var vis = new Uint8Array(gw * gh), lista = [];
    for (q = 0; q < gw * gh; q++) {
      if (!gr[q] || vis[q]) continue;
      var pila = [q], x0 = gw, x1 = 0, y0 = gh, y1 = 0, nd = 0, sr = 0, sg = 0, sb = 0, ng = 0, orilla = 0, hist = new Float32Array(64); vis[q] = 1;
      while (pila.length) { var p = pila.pop(), px = p % gw, py = (p - px) / gw; ng++;
        if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
        if (px === 0 || py === 0 || px === gw - 1 || py === gh - 1 || !tela[p - 1] || !tela[p + 1] || !tela[p - gw] || !tela[p + gw]) orilla++;   // la orilla de la prenda (no el corte de la zona)
        if (det[p]) { var jj = ((py * P) * W + px * P) * 4; sr += d[jj]; sg += d[jj + 1]; sb += d[jj + 2]; nd++; hist[(d[jj] >> 6) * 16 + (d[jj + 1] >> 6) * 4 + (d[jj + 2] >> 6)]++; }
        [p - gw, p + gw, px > 0 ? p - 1 : -1, px < gw - 1 ? p + 1 : -1].forEach(function (v) { if (v >= 0 && v < gw * gh && gr[v] && !vis[v]) { vis[v] = 1; pila.push(v); } }); }
      var bw = x1 - x0 + 1, bh = y1 - y0 + 1, asp = Math.max(bw, bh) / Math.min(bw, bh), lleno = ng / (bw * bh);
      // en las mangas del molde, lo que toca su orilla (franjas de hombro a puño, puño, contorno) no es parche.
      // En frente y espalda sí cuenta: ahí un parche puede quedar cortado por la orilla; el puño se distingue por su mezcla de colores.
      if (asp >= 5 || lleno < 0.3 || !nd || (estricto && orilla > 0)) continue;
      for (var hj = 0; hj < 64; hj++) hist[hj] /= nd;
      lista.push({ n: nd, col: [sr / nd, sg / nd, sb / nd], h: hist, caja: [x0 * P, y0 * P, (x1 + 1) * P, (y1 + 1) * P] });
    }
    return { lista: lista, celdas: celdas };
  }
  // regla: todo parche de una manga del molde tiene que verse también en esa manga en el FRENTE o la ESPALDA de la hoja.
  // Si no aparece en ninguna, el generador lo inventó. Regresa esos parches.
  function mangaInventada(manga, zonas) {
    var m = manchas(manga, function () { return true; }, true);
    var ref = []; zonas.forEach(function (z) { var r = manchas(z.c, z.dentro); r.lista.forEach(function (b) { if (b.n > r.celdas * 0.002) ref.push(b); }); });
    return m.lista.filter(function (b) {
      if (b.n < m.celdas * 0.004) return false;   // motitas: no son parches
      // la misma hoja tiene la misma escala: el parche real se ve en el frente o la espalda con al menos una cuarta parte de su tamaño
      // y con la misma mezcla de colores (un escudo rojo-blanco-azul no es lo mismo que una orilla gris azulada)
      return !ref.some(function (r) { if (r.n < b.n * 0.25) return false; var s2 = 0; for (var hj = 0; hj < 64; hj++) s2 += Math.min(r.h[hj], b.h[hj]); return s2 >= 0.76; });
    });
  }
  // borra un parche inventado: su lugar se llena con la tela de alrededor, renglón por renglón (de la orilla izquierda a la derecha)
  function borrarParche(c, caja) {
    var g = c.getContext('2d'), W = c.width, H = c.height, m = 6, x0 = Math.max(0, caja[0] - m), x1 = Math.min(W - 1, caja[2] + m), y0 = Math.max(0, caja[1] - m), y1 = Math.min(H - 1, caja[3] + m);
    var im = g.getImageData(0, 0, W, H), d = im.data;
    for (var y = y0; y <= y1; y++) {
      var a = (y * W + Math.max(0, x0 - 2)) * 4, b = (y * W + Math.min(W - 1, x1 + 2)) * 4;
      if (d[a + 3] < 200) a = b; if (d[b + 3] < 200) b = a; if (d[a + 3] < 200) continue;
      for (var x = x0; x <= x1; x++) { var t = (x - x0) / Math.max(1, x1 - x0), k = (y * W + x) * 4; if (d[k + 3] < 200) continue; for (var ch = 0; ch < 3; ch++) d[k + ch] = d[a + ch] * (1 - t) + d[b + ch] * t; }
    }
    g.putImageData(im, 0, 0);
  }
  // EL MOLDE LLENO → la tela del uniforme. El molde ES el patrón de costura del 3D (scripts/patron.py + molde.py), así que
  // cada pieza pintada se pone tal cual en su lugar del patrón: lo que se ve en el molde es lo que se ve en el 3D.
  // Pasos: 1) enderezar la hoja con las 4 marcas; 2) cada pieza: lo que el generador pintó en su zona (aunque se haya
  // pasado tantito de la línea o quedado más chico) se acomoda a la silueta exacta; 3) sin la línea del contorno y con la
  // tela extendida un poco más allá de cada orilla (las costuras del 3D nunca toman el fondo gris).
  // las dos mangas del molde cambian de brazo (los parches quedan en la cara de afuera y se leen derecho)
  function cambiarMangas(u, clave) {
    var tipo = clave === 'patronLarga' ? 'larga' : 'corta';
    A.toast('Pasando las mangas al otro brazo…', true);
    Promise.all([imagenP(u.fotos[clave]), cargarJSON('/assets/molde/molde-' + tipo + '.json?v=' + (window.VERSION || '1'))]).then(function (r) {
      if (!r[0]) throw new Error('img');
      var S = 2048, c = document.createElement('canvas'); c.width = c.height = S; var g = c.getContext('2d'); g.drawImage(r[0], 0, 0, S, S);
      var orig = document.createElement('canvas'); orig.width = orig.height = S; orig.getContext('2d').drawImage(c, 0, 0);
      var bI = r[1].piezas.mangaI, bD = r[1].piezas.mangaD, m = 40;
      var caja = function (b) { return [b[0] - m, b[1] - m, b[2] - b[0] + 2 * m, b[3] - b[1] + 2 * m]; };
      var cI = caja(bI), cD = caja(bD);
      g.clearRect(cI[0], cI[1], cI[2], cI[3]); g.clearRect(cD[0], cD[1], cD[2], cD[3]);
      g.drawImage(orig, cD[0], cD[1], cD[2], cD[3], cI[0], cI[1], cI[2], cI[3]);
      g.drawImage(orig, cI[0], cI[1], cI[2], cI[3], cD[0], cD[1], cD[2], cD[3]);
      var datos = c.toDataURL('image/webp', 0.9); if (datos.indexOf('data:image/webp') !== 0) datos = c.toDataURL('image/jpeg', 0.92);
      return A.subirConReintento(datos, 'catalogo');
    }).then(function (url) { u.fotos[clave] = url; A.toast('Listo: las mangas cambiaron de brazo'); return previsualizar(); }).catch(function () { A.toast('No se pudo cambiar. Inténtalo otra vez.'); });
  }
  // la espalda no trae nombre ni número de jugador (los pone la página encima). Si el generador los copió de la foto, se borran:
  // un número es una mancha alta en el centro de la espalda que no corre de arriba a abajo (eso son rayas de la tela); el
  // nombre es lo que está justo arriba. Se rellena columna por columna con la tela de arriba y de abajo (las rayas siguen).
  function limpiarDorsal(at, b) {
    var g = at.getContext('2d'), bw = b[2] - b[0], bh = b[3] - b[1];
    var zx0 = Math.round(b[0] + bw * 0.16), zx1 = Math.round(b[0] + bw * 0.84), zy0 = Math.round(b[1] + bh * 0.12), zy1 = Math.round(b[1] + bh * 0.64);
    var zw = zx1 - zx0, zh = zy1 - zy0, im = g.getImageData(zx0, zy0, zw, zh), d = im.data, cuenta = {}, P = 2, gw = Math.ceil(zw / P), gh = Math.ceil(zh / P);
    for (var y = 0; y < zh; y += 3) for (var x = 0; x < zw; x += 3) { var i = (y * zw + x) * 4; if (d[i + 3] < 200) continue; var k = (d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5); cuenta[k] = (cuenta[k] || 0) + 1; }
    var top = null, n = 0; Object.keys(cuenta).forEach(function (k) { if (cuenta[k] > n) { n = cuenta[k]; top = k; } });
    if (!top) return false;
    var t = top.split(',').map(function (v) { return v * 32 + 16; }), det = new Uint8Array(gw * gh);
    // los colores de la tela: los que hay en la orilla de arriba y en la de abajo de la zona (con rayas son varios). Lo que no
    // se parece a ninguno (el número, el nombre) es detalle.
    // (un color que solo está arriba, como un nombre que empieza ahí, no es tela: tiene que estar arriba Y abajo)
    var bandas = [[0, Math.round(zh * 0.06)], [Math.round(zh * 0.94), zh]].map(function (rg) {
      var l = [], vistos = {}, todos = [];
      for (var y = rg[0]; y < rg[1]; y += 2) for (var x = 0; x < zw; x += 2) { var i = (y * zw + x) * 4; if (d[i + 3] < 200) continue; var c0 = [d[i], d[i + 1], d[i + 2]]; todos.push(c0); var k = (d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5); if (!vistos[k]) { vistos[k] = 1; l.push(c0); } }
      // solo cuenta como tela un color que cubre buena parte de la orilla (una raya); la punta de un nombre o de un número
      // que toca la orilla es muy poquito y no es tela
      return l.filter(function (c) { var n = 0; for (var z = 0; z < todos.length; z++) if (Math.abs(c[0] - todos[z][0]) + Math.abs(c[1] - todos[z][1]) + Math.abs(c[2] - todos[z][2]) <= 60) n++; return n >= todos.length * 0.08; });
    });
    var cerca = function (c, l) { for (var z = 0; z < l.length; z++) if (Math.abs(c[0] - l[z][0]) + Math.abs(c[1] - l[z][1]) + Math.abs(c[2] - l[z][2]) <= 60) return true; return false; };
    var tela = bandas[0].filter(function (c) { return cerca(c, bandas[1]); }).concat(bandas[1].filter(function (c) { return cerca(c, bandas[0]); }));
    if (!tela.length) tela = [t];   // tela con dibujo muy variado: solo el color de siempre
    for (var q = 0; q < gw * gh; q++) {
      var qx = (q % gw) * P, qy = Math.floor(q / gw) * P, j = (qy * zw + qx) * 4; if (d[j + 3] <= 200) continue;
      var lejos = true; for (var tc = 0; tc < tela.length && lejos; tc++) if (Math.abs(d[j] - tela[tc][0]) + Math.abs(d[j + 1] - tela[tc][1]) + Math.abs(d[j + 2] - tela[tc][2]) <= 90) lejos = false;
      if (lejos) det[q] = 1;
    }
    var vis = new Uint8Array(gw * gh), manchas = [];
    for (q = 0; q < gw * gh; q++) {
      if (!det[q] || vis[q]) continue; var pila = [q], c = [gw, gh, -1, -1], cnt = 0; vis[q] = 1;
      while (pila.length) { var p = pila.pop(), px = p % gw, py = (p - px) / gw; cnt++; if (px < c[0]) c[0] = px; if (py < c[1]) c[1] = py; if (px > c[2]) c[2] = px; if (py > c[3]) c[3] = py;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) { var X = px + dx, Y = py + dy, v = Y * gw + X; if (X >= 0 && Y >= 0 && X < gw && Y < gh && det[v] && !vis[v]) { vis[v] = 1; pila.push(v); } } }
      if (c[1] <= 1 || c[3] >= gh - 2) continue;   // corre de arriba a abajo: es raya de la tela
      manchas.push({ x0: c[0] * P, y0: c[1] * P, x1: (c[2] + 1) * P, y1: (c[3] + 1) * P, n: cnt });
    }
    var numero = manchas.filter(function (m) { return m.y1 - m.y0 > bh * 0.17 && m.n > 60; });   // un número de jugador es grande (un logo de patrocinador, no)
    if (!numero.length) return false;
    var ny0 = Math.min.apply(null, numero.map(function (m) { return m.y0; }));
    var quitar = manchas.filter(function (m) { return numero.indexOf(m) >= 0 || (m.y1 <= ny0 + 4 && m.y1 > ny0 - bh * 0.16 && m.y1 - m.y0 > bh * 0.025); });
    var cx0 = Math.max(0, Math.min.apply(null, quitar.map(function (m) { return m.x0; })) - 8), cx1 = Math.min(zw - 1, Math.max.apply(null, quitar.map(function (m) { return m.x1; })) + 8);
    var cy0 = Math.max(0, Math.min.apply(null, quitar.map(function (m) { return m.y0; })) - 8), cy1 = Math.min(zh - 1, Math.max.apply(null, quitar.map(function (m) { return m.y1; })) + 8);
    for (var xx = cx0; xx <= cx1; xx++) {
      var a = (cy0 * zw + xx) * 4, bb = (cy1 * zw + xx) * 4;
      for (var yy = cy0 + 1; yy < cy1; yy++) { var f = (yy - cy0) / (cy1 - cy0), o = (yy * zw + xx) * 4; for (var ch = 0; ch < 3; ch++) d[o + ch] = d[a + ch] * (1 - f) + d[bb + ch] * f; }
    }
    g.putImageData(im, zx0, zy0);
    return true;
  }
  function leerMolde(file) {
    var u = P.editando; if (!u) return;
    A.toast('Leyendo el molde…', true);
    var S = 2048;
    A.cargarArchivo(file).then(function (im) {
      var hoja = A.aCanvas(im, 2400), W = hoja.width, H = hoja.height, d = hoja.getContext('2d').getImageData(0, 0, W, H).data;
      var marca = function (fx, fy) {
        var x0 = Math.round(fx ? W * 0.86 : 0), x1 = Math.round(fx ? W : W * 0.14), y0 = Math.round(fy ? H * 0.86 : 0), y1 = Math.round(fy ? H : H * 0.14), sx = 0, sy = 0, n = 0;
        for (var y = y0; y < y1; y += 2) for (var x = x0; x < x1; x += 2) { var i = (y * W + x) * 4; if (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 < 75) { sx += x; sy += y; n++; } }
        return n > 30 ? [sx / n, sy / n] : null;
      };
      var mk = [marca(0, 0), marca(1, 0), marca(0, 1), marca(1, 1)];
      if (mk.some(function (m) { return !m; })) throw new Error('marcas');
      return cargarJSON('/assets/molde/molde-corta.json?v=' + (window.VERSION || '1')).then(function (J) {
        var aH = homografia(J.marcas, mk);
        var fondo = function (i) { return Math.abs(d[i] - 236) + Math.abs(d[i + 1] - 238) + Math.abs(d[i + 2] - 243) <= 30; };
        // ¿corta o larga? Solo las mangas largas bajan hasta esta altura: ahí se cruzan sus contornos (líneas oscuras) o su tela
        // de color. Una playera blanca casi no se distingue del fondo, pero su contorno sí.
        // Se mira en 3 alturas: un renglón de letreros que el generador movió puede cruzar una, no las tres.
        var votos = 0;
        [1640, 1690, 1740].forEach(function (yy) {
          var lineas = 0, color = 0, tot = 0, enLinea = false;
          for (var x = 150; x < 1250; x += 2) {
            var q = aH(x, yy), qi = (Math.round(q[1]) * W + Math.round(q[0])) * 4, lum = d[qi] * 0.3 + d[qi + 1] * 0.59 + d[qi + 2] * 0.11; tot++;
            if (lum < 130) { if (!enLinea) lineas++; enLinea = true; } else enLinea = false;
            if (!fondo(qi)) color++;
          }
          if (lineas >= 3 || color / tot > 0.35) votos++;
        });
        var tipo = votos >= 2 ? 'larga' : 'corta';
        return Promise.all([tipo === 'corta' ? J : cargarJSON('/assets/molde/molde-larga.json?v=' + (window.VERSION || '1')), imagenP('/assets/molde/molde-' + tipo + '-mascara.png?v=' + (window.VERSION || '1'))]).then(function (r) {
          var JT = r[0], md = A.aCanvas(r[1], S).getContext('2d').getImageData(0, 0, S, S).data;
          var at = document.createElement('canvas'); at.width = at.height = S; var ag = at.getContext('2d'), ad = ag.createImageData(S, S), o = ad.data;
          var sueltas = {};
          Object.keys(JT.piezas).forEach(function (k) {
            var tb = JT.piezas[k], val = JT.mascara[k], m = 110;   // el generador a veces recorre una pieza (hasta ~100 px)
            // lo pintado en la zona de esta pieza (la mancha más grande): su caja en coordenadas del molde
            var zx0 = Math.max(0, tb[0] - m), zy0 = Math.max(0, tb[1] - m), zx1 = Math.min(S, tb[2] + m), zy1 = Math.min(S, tb[3] + m), zw = zx1 - zx0, zh = zy1 - zy0, P2 = 2;
            var gw = Math.ceil(zw / P2), gh = Math.ceil(zh / P2), pin = new Uint8Array(gw * gh);
            for (var gy = 0; gy < gh; gy++) for (var gx = 0; gx < gw; gx++) { var qq = aH(zx0 + gx * P2 + 0.5, zy0 + gy * P2 + 0.5), si = (Math.round(qq[1]) * W + Math.round(qq[0])) * 4; if (qq[0] >= 0 && qq[1] >= 0 && qq[0] < W && qq[1] < H && !fondo(si)) pin[gy * gw + gx] = 1; }
            var et = new Int32Array(gw * gh), mejor = 0, mejorN = 0, n2 = 0, caja = null, cajaN = [gw, gh, -1, -1];
            for (var s0 = 0; s0 < gw * gh; s0++) {
              if (!pin[s0] || et[s0]) continue; n2++; var pila = [s0], cnt = 0, bx = [gw, gh, -1, -1]; et[s0] = n2;
              while (pila.length) { var p = pila.pop(), px = p % gw, py = (p - px) / gw; cnt++; if (px < bx[0]) bx[0] = px; if (py < bx[1]) bx[1] = py; if (px > bx[2]) bx[2] = px; if (py > bx[3]) bx[3] = py;
                [p - gw, p + gw, px > 0 ? p - 1 : -1, px < gw - 1 ? p + 1 : -1].forEach(function (v) { if (v >= 0 && v < gw * gh && pin[v] && !et[v]) { et[v] = n2; pila.push(v); } }); }
              if (cnt > mejorN) { mejorN = cnt; mejor = n2; cajaN = bx; }
            }
            var tw = tb[2] - tb[0], th = tb[3] - tb[1];
            if (mejorN > gw * gh * 0.08) caja = [zx0 + cajaN[0] * P2, zy0 + cajaN[1] * P2, zx0 + (cajaN[2] + 1) * P2, zy0 + (cajaN[3] + 1) * P2];
            // si lo pintado no se parece en tamaño a la pieza (otra cosa), se usa la silueta tal cual
            if (!caja || Math.abs((caja[2] - caja[0]) / tw - 1) > 0.25 || Math.abs((caja[3] - caja[1]) / th - 1) > 0.25) caja = tb;
            // el fondo de la hoja que entra desde afuera (blanco/gris sin pintar): donde el generador dibujó la pieza un poco más
            // angosta que el molde, ahí no hay tela. Se marca ese fondo y su orilla (la línea del contorno) para no tomarlos.
            var afuera = new Uint8Array(gw * gh), cola = [];
            for (var g0 = 0; g0 < gw * gh; g0++) { var g0x = g0 % gw, g0y = (g0 - g0x) / gw; if ((g0x === 0 || g0y === 0 || g0x === gw - 1 || g0y === gh - 1) && !pin[g0]) { afuera[g0] = 1; cola.push(g0); } }
            // solo cerca de la orilla de la pieza (lo que el generador dibujó más angosto): muy adentro es tela clara (un short
            // blanco con sombra se parece al fondo), nunca fondo
            var hondo = function (v) { var X = zx0 + (v % gw) * P2, Y = zy0 + Math.floor(v / gw) * P2, r = 28;
              for (var e2 = 0; e2 < 8; e2++) { var XX = X + [r, -r, 0, 0, 20, -20, 20, -20][e2], YY = Y + [0, 0, r, -r, 20, 20, -20, -20][e2]; if (XX < 0 || YY < 0 || XX >= S || YY >= S || Math.abs(md[(YY * S + XX) * 4] - val) > 10) return false; }
              return true; };
            while (cola.length) { var f = cola.pop(), fx = f % gw; [f - gw, f + gw, fx > 0 ? f - 1 : -1, fx < gw - 1 ? f + 1 : -1].forEach(function (v) { if (v >= 0 && v < gw * gh && !pin[v] && !afuera[v] && !hondo(v)) { afuera[v] = 1; cola.push(v); } }); }
            for (var pasada = 0; pasada < 4; pasada++) { var sig = afuera.slice(); for (var g1 = 0; g1 < gw * gh; g1++) { if (afuera[g1]) continue; var g1x = g1 % gw; if ((g1x > 0 && afuera[g1 - 1]) || (g1x < gw - 1 && afuera[g1 + 1]) || (g1 >= gw && afuera[g1 - gw]) || (g1 + gw < gw * gh && afuera[g1 + gw])) sig[g1] = 2; } afuera = sig; }
            var kx = (caja[2] - caja[0]) / tw, ky = (caja[3] - caja[1]) / th, b = 8;
            for (var y2 = tb[1]; y2 < tb[3]; y2++) for (var x2 = tb[0]; x2 < tb[2]; x2++) {
              var mi = (y2 * S + x2) * 4; if (Math.abs(md[mi] - val) > 10) continue;
              // la orilla (donde va la línea del contorno que dibuja el generador) no se toma: la llena la tela de adentro
              var orilla = false;
              for (var e = 0; e < 8 && !orilla; e++) { var ox = [b, -b, 0, 0, 6, -6, 6, -6][e], oy = [0, 0, b, -b, 6, 6, -6, -6][e], X = x2 + ox, Y = y2 + oy; if (X < 0 || Y < 0 || X >= S || Y >= S || Math.abs(md[(Y * S + X) * 4] - val) > 10) orilla = true; }
              if (orilla) continue;
              var cxm = caja[0] + (x2 - tb[0] + 0.5) * kx, cym = caja[1] + (y2 - tb[1] + 0.5) * ky, agx = Math.floor((cxm - zx0) / P2), agy = Math.floor((cym - zy0) / P2);
              if (agx >= 0 && agy >= 0 && agx < gw && agy < gh && afuera[agy * gw + agx]) continue;
              var hq = aH(cxm, cym), hx = Math.round(hq[0]), hy = Math.round(hq[1]);
              if (hx < 0 || hy < 0 || hx >= W || hy >= H) continue;
              var hi = (hy * W + hx) * 4; o[mi] = d[hi]; o[mi + 1] = d[hi + 1]; o[mi + 2] = d[hi + 2]; o[mi + 3] = 255;
            }
          });
          ag.putImageData(ad, 0, 0);
          var dorsalQuitado = limpiarDorsal(at, JT.piezas.espalda);
          // cada pieza sola (con su transparencia) sirve como "foto": colores del buscador, nombre y número, círculos
          ['frente', 'espalda', 'short'].forEach(function (k) { var tb = JT.piezas[k], c = document.createElement('canvas'); c.width = tb[2] - tb[0]; c.height = tb[3] - tb[1]; c.getContext('2d').drawImage(at, tb[0], tb[1], c.width, c.height, 0, 0, c.width, c.height); sueltas[k] = c; });
          // la tela se extiende más allá de cada orilla (la costura del 3D nunca toma gris)
          var tmp = document.createElement('canvas'); tmp.width = tmp.height = S; var tg = tmp.getContext('2d');
          // cerca de la orilla, la tela sigue tal cual (unos pixeles); más lejos, el promedio de la tela vecina (sin rayas ni picos)
          [1, 2, 3, 5].forEach(function (dd) {
            tg.clearRect(0, 0, S, S); tg.drawImage(at, 0, 0);
            ag.globalCompositeOperation = 'destination-over';
            [[dd, 0], [-dd, 0], [0, dd], [0, -dd]].forEach(function (o2) { ag.drawImage(tmp, o2[0], o2[1]); });
            ag.globalCompositeOperation = 'source-over';
          });
          var niveles = [], prev = at;
          for (var tam = S / 2; tam >= 8; tam /= 2) { var cv = document.createElement('canvas'); cv.width = cv.height = tam; var cg = cv.getContext('2d'); cg.imageSmoothingEnabled = true; cg.drawImage(prev, 0, 0, tam, tam); niveles.push(cv); prev = cv; }
          ag.globalCompositeOperation = 'destination-over'; ag.imageSmoothingEnabled = true;
          niveles.forEach(function (cv) { for (var r2 = 0; r2 < 3; r2++) ag.drawImage(cv, 0, 0, S, S); });
          ag.globalCompositeOperation = 'source-over';
          ag.globalCompositeOperation = 'destination-over'; ag.fillStyle = '#808080'; ag.fillRect(0, 0, S, S); ag.globalCompositeOperation = 'source-over';
          return { tipo: tipo, atlas: at, piezas: sueltas, dorsalQuitado: dorsalQuitado };
        });
      });
    }).then(function (r) {
      u.manga = r.tipo; u.ajuste = {}; delete u.fotos.mangaI; delete u.fotos.mangaD;
      var clave = r.tipo === 'larga' ? 'patronLarga' : 'patronCorta';
      var datos = r.atlas.toDataURL('image/webp', 0.9); if (datos.indexOf('data:image/webp') !== 0) datos = r.atlas.toDataURL('image/jpeg', 0.92);
      return Promise.all([A.subirConReintento(datos, 'catalogo').then(function (url) { u.fotos[clave] = url; })].concat(['frente', 'espalda', 'short'].map(function (l) { return ponerFoto(u, l, r.piezas[l]); }))).then(function () {
        u.shortPropio = true;
        var otro = r.tipo === 'larga' ? 'corta' : 'larga', tieneOtro = !!u.fotos[r.tipo === 'larga' ? 'patronCorta' : 'patronLarga'];
        P.avisos = ['Molde de manga ' + r.tipo + ' leído: cada pieza quedó en su lugar del uniforme.' + (r.dorsalQuitado ? ' La espalda traía un nombre y número de jugador: los quitamos, porque los pone cada cliente.' : '') + (tieneOtro ? '' : ' Si también subes el molde de manga ' + otro + ', esa versión se verá igual de bien.') + ' Revisa en el 3D que todo venga de tus fotos antes de guardar.'];
        pintar(); $('#ed-aviso').innerHTML = '<div class="aviso"><p>' + esc(P.avisos[0]) + '</p></div>';
        A.toast('Molde listo'); previsualizar();
      });
    }).catch(function (e) {
      A.toast(e && e.message === 'marcas' ? 'No encontramos las 4 marcas negras de las esquinas. Sube el molde completo, sin recortar.' : 'No se pudo leer el molde. Inténtalo otra vez.');
    });
  }
  // la foto del dueño: se recorta el fondo, se revisa y se sube; de la del frente salen los colores para el buscador
  // la foto del dueño: la IA de su propio celular separa la prenda del fondo (sin créditos ni cuentas);
  // si trae playera y short juntos, se separan solos. De la del frente salen los colores para el buscador.
  // el color para nombre y número: de los colores de letra, el que ya trae la playera como detalle y contrasta con su tela
  function colorLetras(c) {
    var M = window.Motor3D, b = M.coloresBase(c), lum = function (p) { return p[0] * 0.3 + p[1] * 0.59 + p[2] * 0.11; };
    var cand = LETRAS_P.map(function (h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), h]; });
    var t = A.aCanvas(c, 80), d = t.getContext('2d').getImageData(0, 0, t.width, t.height).data, n = 0, cuenta = cand.map(function () { return 0; });
    for (var i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; n++; cand.forEach(function (k, j) { if (Math.abs(d[i] - k[0]) + Math.abs(d[i + 1] - k[1]) + Math.abs(d[i + 2] - k[2]) < 90) cuenta[j]++; }); }
    var mejor = null, puntos = -1;
    cand.forEach(function (k, j) {
      var con = Math.min(Math.abs(lum(k) - lum(b.A)), b.B ? Math.abs(lum(k) - lum(b.B)) : 999);
      if (con < 60) return;   // no se leería sobre la tela
      var p = con + (cuenta[j] / Math.max(1, n) > 0.01 && cuenta[j] / n < 0.25 ? 200 : 0);   // premio si ya es un detalle de la playera
      if (p > puntos) { puntos = p; mejor = k[3]; }
    });
    return mejor || (lum(b.A) > 140 ? '#111111' : '#FFFFFF');
  }
  function prepararCanvas(cut) { var out = A.aCanvas(cut, 900), data = out.toDataURL('image/webp', 0.86); if (data.indexOf('data:image/webp') !== 0) data = out.toDataURL('image/png'); return { out: out, data: data }; }
  function ponerFoto(u, lado, cut) {
    var r = prepararCanvas(cut);
    u.fotos[lado] = r.data;
    if (lado === 'frente') {
      u.etiquetas.colores = window.Motor3D.coloresDe(r.out);
      if (!u.colorShort) u.colorShort = hexDe(window.Motor3D.colorPrincipal(r.out));
      var lum = window.Motor3D.colorPrincipal(r.out).reduce(function (s, v) { return s + v; }, 0) / 3;
      if (!u.colorTextoElegido) u.colorTexto = lum > 140 ? '#111111' : '#FFFFFF';
    }
    if (lado === 'short') u.colorShort = hexDe(window.Motor3D.colorPrincipal(r.out));
    if (!u.calcetaFoto && (!u.colorCalceta || lado === 'short')) u.colorCalceta = u.colorShort;
    return A.subirConReintento(r.data, 'catalogo').then(function (url) { u.fotos[lado] = url; });
  }
  // el color del fondo de la foto: el que más se repite en las orillas
  function colorFondo(c) {
    var W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data, cajas = {}, mejor = null;
    function cuenta(x, y) { var i = (y * W + x) * 4, k = (d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4), cj = cajas[k] = cajas[k] || { n: 0, r: 0, g: 0, b: 0 }; cj.n++; cj.r += d[i]; cj.g += d[i + 1]; cj.b += d[i + 2]; if (!mejor || cj.n > mejor.n) mejor = cj; }
    for (var x = 0; x < W; x += 2) { cuenta(x, 0); cuenta(x, H - 1); }
    for (var y = 0; y < H; y += 2) { cuenta(0, y); cuenta(W - 1, y); }
    return mejor && mejor.n > (W + H) * 0.25 ? [mejor.r / mejor.n, mejor.g / mejor.n, mejor.b / mejor.n] : null;   // fondo parejo; si es un paisaje, no se usa
  }
  // una foto: se recorta, se le quita la persona si la trae, se separa el short y se mide qué tan de frente viene
  function analizar(file, lado) {
    var M = window.Motor3D;
    return A.cargarArchivo(file).then(function (im) {
      var base = A.aCanvas(im, 1400), r = { nombre: file.name, av: [], chica: Math.min(im.naturalWidth, im.naturalHeight) < 600, movida: A.nitidez(im) < 22 };
      return M.piezasIA(base).then(function (pz) {
        // en la casilla del short: si la foto trae también la playera, se toma solo el short
        if (lado === 'short') { var sp = pz.short ? null : M.separarConjunto(pz.playera); pz = { playera: pz.short || (sp && sp.short) || pz.playera }; }
        var cut = pz.playera;
        // la manga: el recorte automático a veces se queda solo con lo que más resalta (el parche). Se compara con el recorte
        // por color y se usa el que conserva la manga completa (nunca se inventa nada: es la misma foto, con o sin su fondo)
        if (/^manga/.test(lado)) {
          var area = function (c) { var t = A.aCanvas(c, 140), dd = t.getContext('2d').getImageData(0, 0, t.width, t.height).data, n = 0; for (var i = 3; i < dd.length; i += 4) if (dd[i] > 128) n++; return n / (dd.length / 4) * c.width * c.height; };
          var porColor = M.recortar(base); if (porColor && area(cut) < 0.55 * area(porColor)) cut = porColor;
        }
        // sin fondo = casi toda la foto quedó como prenda (no basta con que la prenda llene el cuadro: sus orillas sí se quitaron)
        r.fondo = colorFondo(base);
        r.sinFondo = (function () { var t = A.aCanvas(cut, 120), d = t.getContext('2d').getImageData(0, 0, t.width, t.height).data, n = 0; for (var i = 3; i < d.length; i += 4) if (d[i] > 128) n++; return n / (d.length / 4) * (cut.width * cut.height) / (base.width * base.height) > 0.9; })();
        r.persona = lado !== 'short' && M.tienePersona(cut);
        if (r.persona) {
          // se confirma con la piel (cabeza arriba de los hombros); si no hay, era una playera con tonos raros, no una persona
          var q = M.quitarPersona(cut, colorFondo(base)); r.persona = !!q;
          if (q) { cut = q; pz.short = null; if (q.calceta && !pz.calceta) pz.calceta = q.calceta; }   // con alguien puesto, las piezas sueltas son piernas, no un short
        }
        var esManga = /^manga/.test(lado);   // la foto de una manga se usa tal cual: ni se separa ni se completa con espejo
        var sep = lado !== 'short' && !esManga && !pz.short ? M.separarConjunto(cut, r.persona) : null;
        if (sep) { cut = sep.playera; pz.short = sep.short; }
        // fondo blanco y playera con blanco: la IA se come mangas o costados. La playera es simétrica: se completa con su espejo
        var fz = colorFondo(base);
        if (!r.persona && lado !== 'short' && !esManga && M.simetrizar && fz && fz[0] + fz[1] + fz[2] > 600) { var sm = M.simetrizar(cut); if (sm) { cut = sm; r.reparada = true; } }
        r.cut = cut; r.short = pz.short || null; r.calceta = (pz.short || r.persona) ? pz.calceta || null : null;   // calcetas solo en una foto del uniforme completo (en una playera sola, una pieza suelta no son calcetas)
        // la mejor foto: de frente y derecha, grande, sin persona
        r.frente = lado === 'short' || esManga ? 1 : M.deFrente(cut);
        r.nota = lado === 'short' || esManga ? cut.width * cut.height : r.frente - (r.persona ? 0.04 : 0) - (r.chica ? 0.03 : 0) - (r.sinFondo ? 0.5 : 0) + 0.08 * Math.min(1, cut.width * cut.height / 640000) - (pz.parecidas ? 0.06 : 0);   // a igual de derecha, gana la foto más grande y nítida
        return r;
      });
    });
  }
  // el dueño puede subir varias fotos de una vez: el panel usa la mejor para cada lado y saca de todas el short y las calcetas
  function procesarFoto(files, lado) {
    var u = P.editando, M;
    files = Array.prototype.slice.call(files || []).slice(0, 8); if (!files.length) return;
    A.toast(files.length > 1 ? 'Revisando ' + files.length + ' fotos…' : 'Preparando la foto…', true);
    return A.cargarMotor().catch(function () {}).then(function () {
      M = window.Motor3D;
      return files.reduce(function (cadena, f) { return cadena.then(function (lista) { return analizar(f, lado).then(function (r) { lista.push(r); return lista; }, function () { return lista; }); }); }, Promise.resolve([]));
    }).then(function (lista) {
      if (!lista.length) throw new Error('sin fotos');
      lista.sort(function (x, y) { return y.nota - x.nota; });
      try { window.__fotos = lista.map(function (x) { return { f: x.nombre, nota: +x.nota.toFixed(3), persona: !!x.persona, chica: !!x.chica, sinFondo: !!x.sinFondo, short: !!x.short, w: x.cut.width, h: x.cut.height }; }); } catch (e) {}
      var r = lista[0], av = [], cut = r.cut, tareas = [];
      if (lista.length > 1) av.push('De ' + lista.length + ' fotos usamos la que viene más de frente.');
      if (r.sinFondo) av.push('No pudimos separar la prenda del fondo. Tómala sobre el piso o una sábana de un solo color.');
      if (r.chica) av.push('La foto es pequeña: en la página se verá bien, pero pide una más grande para imprimir.');
      if (r.movida) av.push('La foto parece movida. Si puedes, tómala otra vez con el celular quieto.');
      if (r.persona) av.push('La foto traía a alguien con el uniforme puesto: tomamos solo la ropa.');
      var fondoClaro = r.fondo && r.fondo[0] + r.fondo[1] + r.fondo[2] > 600;
      if (lado !== 'short' && r.frente < 0.6 && fondoClaro) av.push('No pudimos separar bien la playera del fondo blanco: se comió una parte de la playera. Pasa cuando la playera también tiene blanco. Tómala sobre un fondo de color (piso, sábana oscura) o sube otra foto.');
      else if (lado !== 'short' && r.frente < 0.78) av.push('La playera viene un poco de lado y puede verse chueca. Si tienes una foto de frente, súbela aquí.');
      if (lado === 'espalda' && M.tieneDorsal(cut, M.coloresBase(cut))) {
        // solo el nombre y el número: los patrocinadores de arriba (junto al cuello) y de abajo se quedan
        cut = M.limpiarTela(cut, M.coloresBase(cut), true);
        av.push('La espalda traía nombre y número impresos: los quitamos para poner los del cliente.');
      }
      // una foto nueva del frente, la espalda o el short es otro uniforme: el molde que tenía ya no le corresponde
      // (si no, el 3D seguiría mostrando el molde viejo encima de la foto nueva)
      if (lado === 'frente' || lado === 'espalda' || lado === 'short') { if (u.fotos.patronCorta || u.fotos.patronLarga) u.sinMolde = true; delete u.fotos.patronCorta; delete u.fotos.patronLarga; }
      tareas.push(ponerFoto(u, lado, cut));
      // short y calcetas: de cualquier foto que los traiga (el short de su propia foto manda)
      if (lado !== 'short' && !/^manga/.test(lado) && !u.shortPropio) {   // de la foto de una manga no se saca short
        var conShort = lista.filter(function (x) { return x.short; }).sort(function (x, y) { return y.short.width * y.short.height - x.short.width * x.short.height; })[0];
        if (conShort && (lado === 'frente' || !u.fotos.short)) { tareas.push(ponerFoto(u, 'short', conShort.short)); av.unshift('Venía el short en la foto: lo separamos solo.'); }
      }
      if (lado === 'short') u.shortPropio = true;
      var conCalceta = /^manga/.test(lado) ? null : lista.filter(function (x) { return x.calceta; })[0];
      if (conCalceta) { u.colorCalceta = hexDe(conCalceta.calceta); u.calcetaFoto = true; av.unshift('También venían las calcetas: tomamos su color.'); }
      // nombre y número: el color de acento de la playera si se lee bien (amarillo en el Barça), si no blanco o negro
      if (lado === 'frente' && !u.colorTextoElegido) u.colorTexto = colorLetras(cut);
      P.avisos = av;
      // el 3D muestra solo el lado de la foto que acaba de subir (la espalda gira el uniforme; frente o short lo ponen de frente)
      pvVista = lado === 'espalda' || /^manga/.test(lado) ? lado : 'frente'; if (mEditor && mEditor.m) mEditor.m.vista(pvVista);
      pintar(); $('#ed-aviso').innerHTML = av.length ? '<div class="aviso">' + av.map(function (a) { return '<p>' + esc(a) + '</p>'; }).join('') + '</div>' : '';
      // (el estudio no se baja: el 3D siempre está a la vista)
      return Promise.all(tareas).then(function () {
        A.toast('Foto lista');
        var pub = $('[data-publicar]', panel); if (pub && u.fotos.frente && u.fotos.espalda && u.fotos.short && !/^data:/.test(u.fotos.frente + u.fotos.espalda + u.fotos.short)) { pub.disabled = false; pub.parentNode.classList.add("listo"); var fl = $(".pn-falta", panel); if (fl) fl.remove(); }
        previsualizar();
      });
    }).catch(function () { A.toast('No se pudo subir la foto. Inténtalo otra vez.'); });
  }
  // misma playera, otro color: se hace una copia con las fotos ya recoloreadas, lista para ponerle nombre y publicar
  function otroColor(T) {
    var u = P.editando; if (!u || !u.fotos.frente) return;
    A.toast('Haciendo la versión de otro color…', true);
    var rgb = [1, 3, 5].map(function (i) { return parseInt(T.slice(i, i + 2), 16); });
    Promise.all([imagenP(u.fotos.frente), imagenP(u.fotos.espalda), imagenP(u.fotos.short), imagenP(u.fotos.mangaI), imagenP(u.fotos.mangaD)]).then(function (im) {
      var M = window.Motor3D, cf = A.aCanvas(im[0], 1000), base = M.coloresBase(cf);
      var nuevo = A.clone(u); nuevo.id = 'u' + Date.now().toString(36); nuevo.nuevo = true; delete nuevo.destacado; delete nuevo.oculto;
      nuevo.nombre = ''; nuevo.mini = ''; nuevo.version = ''; delete nuevo.fotos.patronCorta; delete nuevo.fotos.patronLarga;
      var mapa = function (hex) { var c = document.createElement('canvas'); c.width = c.height = 1; var g = c.getContext('2d'); g.fillStyle = hex; g.fillRect(0, 0, 1, 1); return hexDe(Array.from(M.recolorear(c, base, rgb).getContext('2d').getImageData(0, 0, 1, 1).data).slice(0, 3)); };
      ['colorShort', 'colorCalceta', 'colorFranja', 'colorTexto'].forEach(function (k) { if (nuevo[k]) nuevo[k] = mapa(nuevo[k]); });
      var lados = ['frente', 'espalda', 'short', 'mangaI', 'mangaD'];
      return Promise.all(lados.map(function (l, i) {
        if (!im[i]) { if (i < 3) nuevo.fotos[l] = ''; else delete nuevo.fotos[l]; return null; }
        var r = prepararCanvas(M.recolorear(A.aCanvas(im[i], 1000), base, rgb));
        return A.subirConReintento(r.data, 'catalogo').then(function (url) { nuevo.fotos[l] = url; });
      })).then(function () {
        nuevo.etiquetas.colores = M.coloresDe(A.aCanvas(im[0], 300));
        imagenP(nuevo.fotos.frente).then(function (f) { if (f) nuevo.etiquetas.colores = M.coloresDe(A.aCanvas(f, 300)); P.editando = nuevo; pintar(); A.toast('Listo: ponle nombre y publícalo'); });
      });
    }).catch(function () { A.toast('No se pudo hacer la otra versión. Inténtalo otra vez.'); });
  }
  // el escudo: la IA de su celular le quita el fondo (sirve un logo sobre blanco o un escudo bordado en la playera) y se centra
  /* Encuadrar una imagen a mano: se arrastra con el dedo, se hace más grande o más chica (con dos dedos o con − +).
     tipo 'escudo': se ve dentro del círculo blanco tal cual quedará en la página (el logo vive en el 70% del círculo).
     tipo 'foto': cuadro completo (la foto del uniforme de un equipo). Devuelve el lienzo final o null si cancela. */
  function encuadrar(src, tipo) {
    return new Promise(function (listo) {
      var esc0 = tipo === 'escudo', S = 600, area = esc0 ? Math.round(S * 0.7) : S, a0 = (S - area) / 2;   // en el escudo, lo que se guarda es el cuadro del centro
      var W = src.naturalWidth || src.width, H = src.naturalHeight || src.height;
      var k = Math.min(area / W, area / H) * (esc0 ? 0.96 : 0.94), ox = 0, oy = 0;
      var cap = document.createElement('div'); cap.className = 'pn-borrador pn-encuadre';
      cap.innerHTML = '<div class="pn-borrador-c"><p><b>Acomódalo con el dedo</b>: arrástralo para moverlo y usa − + (o dos dedos) para el tamaño. ' + (esc0 ? 'Así se verá en el círculo.' : 'Así se verá en la página.') + '</p>' +
        '<div class="pn-encuadre-marco' + (esc0 ? ' circulo' : '') + '"><canvas width="' + S + '" height="' + S + '"></canvas></div>' +
        '<div class="pn-encuadre-z"><button type="button" class="btn btn-linea" data-z="-">−</button><button type="button" class="btn btn-linea" data-z="0">Centrar</button><button type="button" class="btn btn-linea" data-z="+">+</button></div>' +
        '<div class="pn-borrador-b"><button type="button" class="btn btn-linea" data-b="no">Cancelar</button><button type="button" class="btn btn-oro" data-b="si">Listo</button></div></div>';
      document.body.appendChild(cap);
      var c = $('canvas', cap), g = c.getContext('2d'), k0 = k;
      function dibujar() {
        g.clearRect(0, 0, S, S);
        if (esc0) { g.fillStyle = '#f4f5f9'; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, 7); g.fill(); }
        var w = W * k, h = H * k, x = S / 2 - w / 2 + ox, y = S / 2 - h / 2 + oy;
        g.save(); if (esc0) { g.globalAlpha = 0.25; g.drawImage(src, x, y, w, h); g.globalAlpha = 1; g.beginPath(); g.rect(a0, a0, area, area); g.clip(); }
        g.drawImage(src, x, y, w, h); g.restore();
        if (esc0) { g.lineWidth = 14; g.strokeStyle = 'rgba(255,198,26,.6)'; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 8, 0, 7); g.stroke(); }
      }
      dibujar();
      var ptrs = {}, d0 = 0, k1 = k, base = null;
      function escala() { var r = c.getBoundingClientRect(); return S / r.width; }
      c.addEventListener('pointerdown', function (e) { e.preventDefault(); c.setPointerCapture(e.pointerId); ptrs[e.pointerId] = [e.clientX, e.clientY]; var ids = Object.keys(ptrs); if (ids.length === 2) { var p1 = ptrs[ids[0]], p2 = ptrs[ids[1]]; d0 = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]); k1 = k; } base = [e.clientX, e.clientY, ox, oy]; });
      c.addEventListener('pointermove', function (e) {
        if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = [e.clientX, e.clientY]; var ids = Object.keys(ptrs), f = escala();
        if (ids.length >= 2) { var p1 = ptrs[ids[0]], p2 = ptrs[ids[1]], d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]); if (d0) k = Math.max(k0 * 0.2, Math.min(k0 * 5, k1 * d / d0)); }
        else if (base) { ox = base[2] + (e.clientX - base[0]) * f; oy = base[3] + (e.clientY - base[1]) * f; }
        dibujar();
      });
      ['pointerup', 'pointercancel'].forEach(function (ev) { c.addEventListener(ev, function (e) { delete ptrs[e.pointerId]; var ids = Object.keys(ptrs); base = ids.length ? [ptrs[ids[0]][0], ptrs[ids[0]][1], ox, oy] : null; d0 = 0; }); });
      $$('[data-z]', cap).forEach(function (b) {
        var rep = null;
        function z() { var q = b.getAttribute('data-z'); if (q === '0') { k = k0; ox = oy = 0; } else k = Math.max(k0 * 0.2, Math.min(k0 * 5, k * (q === '+' ? 1.04 : 1 / 1.04))); dibujar(); }
        b.addEventListener('pointerdown', function (e) { e.preventDefault(); z(); if (b.getAttribute('data-z') !== '0') b._t = setTimeout(function () { rep = setInterval(z, 60); }, 350); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { clearTimeout(b._t); clearInterval(rep); }); });
      });
      cap.addEventListener('click', function (e) {
        var b = e.target.closest('[data-b]'); if (!b) return;
        if (b.getAttribute('data-b') === 'no') { cap.remove(); listo(null); return; }
        var o = document.createElement('canvas'); o.width = o.height = area; var og = o.getContext('2d');
        var w = W * k, h = H * k; og.drawImage(src, S / 2 - w / 2 + ox - a0, S / 2 - h / 2 + oy - a0, w, h);
        cap.remove(); listo(o);
      });
    });
  }
  function subirEscudo(file) {
    A.toast('Preparando el escudo…', true);
    return A.cargarArchivo(file).then(function (im) { return A.cargarMotor().catch(function () {}).then(function () { return im; }); }).then(function (im) {
      return window.Motor3D.recortarIA(A.aCanvas(im, 700)).then(function (c) { return window.Motor3D.centrarEscudo ? window.Motor3D.centrarEscudo(c) : c; });
    }).then(function (c) { return encuadrar(c, 'escudo'); }).then(function (c) {
      if (!c) { var e = new Error('cancelado'); e.cancelado = true; throw e; }
      return A.subirConReintento(prepararCanvas(c).data, 'catalogo');
    }).then(function (url) { A.toast('Escudo listo'); return url; })
      .catch(function (e) { if (!e || !e.cancelado) A.toast('No se pudo subir el escudo. Inténtalo otra vez.'); throw e; });
  }
  // volver a acomodar una imagen ya subida (sin subirla otra vez desde el celular)
  function reacomodar(url, tipo) {
    return imagenP(url).then(function (im) { if (!im) throw new Error('img'); return encuadrar(im, tipo); }).then(function (c) {
      if (!c) { var e = new Error('cancelado'); e.cancelado = true; throw e; }
      A.toast('Guardando…', true); return A.subirConReintento(prepararCanvas(c).data, 'catalogo');
    });
  }
  function enlazarEditor() {
    enlazarEstudio();
    var u = P.editando;
    $('[data-volver]', panel).addEventListener('click', function () { P.editando = null; pintar(P.scrollLista || 0); });
    $('#ed-nombre').addEventListener('input', function (e) { u.nombre = e.target.value; });
    var selEq = $('#ed-eq'), cajaNuevo = $('.pn-eq-nuevo', panel);
    function tomarEquipo() {
      if (selEq.value === '__nuevo') { u.equipoNuevo = true; cajaNuevo.hidden = false; u.etiquetas.equipo = $('#ed-equipo').value.trim(); u.categoria = $('#ed-cat').value; return; }
      var x = equipoDe(arbol(), selEq.value); if (!x) return;
      u.equipoNuevo = false; cajaNuevo.hidden = true; u.etiquetas.equipo = x.nombre; u.categoria = x.sec; u.escudo = x.escudo || '';
    }
    selEq.addEventListener('change', tomarEquipo);
    $('#ed-cat').addEventListener('change', function (e) { u.categoria = e.target.value; });
    $('#ed-pais').addEventListener('input', function (e) { u.etiquetas.pais = e.target.value; });
    $('#ed-equipo').addEventListener('input', function (e) { u.etiquetas.equipo = e.target.value; });
    $$('[data-mg]', panel).forEach(function (b) { b.addEventListener('click', function () { u.manga = b.getAttribute('data-mg'); $$('[data-mg]', panel).forEach(function (x) { x.classList.toggle('on', x === b); }); previsualizar(); }); });
    function verPh() { var n = $('#ed-nombre'); if (n) n.placeholder = nombreAuto(u) || 'Ej. México · Local'; }
    // al cambiar la versión, el nombre en la página la sigue (si decía "visitante" y escoges Local, dice "Local")
    function ponerVersion(v) {
      var antes = (u.version || '').trim(), n = $('#ed-nombre');
      u.version = v;
      if (n && n.value && antes) { var re = new RegExp(antes.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); if (re.test(n.value)) { n.value = v ? n.value.replace(re, v) : n.value.replace(re, '').replace(/[\s·-]+$/, ''); u.nombre = n.value; } }
      else if (n && n.value && !antes && v) { n.value = n.value.replace(/[\s·-]+$/, '') + ' · ' + v; u.nombre = n.value; }
      verPh();
    }
    $('#ed-version').addEventListener('input', function (e) { ponerVersion(e.target.value.trim()); });
    ['anio', 'liga', 'otros'].forEach(function (k) { var el = $('#ed-' + k); if (el) el.addEventListener('input', function () { u.etiquetas[k] = el.value.trim(); }); });
    $$('[data-ver]', panel).forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-ver'), ov = $('#ed-version');
        $$('[data-ver]', panel).forEach(function (x) { x.classList.toggle('on', x === b); });
        if (v === 'Otra') { ov.hidden = false; ov.focus(); if (ov.value.trim()) ponerVersion(ov.value.trim()); }
        else { ov.hidden = true; ponerVersion(v); }
      });
    });
    selEq.addEventListener('change', verPh); $('#ed-equipo').addEventListener('input', verPh);
    var mas = $('[data-mas-op]', panel); if (mas) mas.addEventListener('toggle', function () { P.masAbierto = mas.open; });
    $$('[data-ns]', panel).forEach(function (b) { b.addEventListener('click', function () { u.numeroShort = b.getAttribute('data-ns') === '1'; $$('[data-ns]', panel).forEach(function (x) { x.classList.toggle('on', x === b); }); previsualizar(); }); });
    // el escudo de un equipo nuevo (el de un equipo que ya existe se cambia en el equipo)
    var inEsc = $('[data-escudo]', panel);
    if (inEsc) inEsc.addEventListener('change', function () {
      var file = inEsc.files && inEsc.files[0]; if (!file) return;
      subirEscudo(file).then(function (url) { u.escudo = url; var box = $('.pn-escudo-img', panel); if (box) box.innerHTML = '<img src="' + esc(url) + '" alt="">'; });
    });
    $$('[data-col]', panel).forEach(function (b) { b.addEventListener('click', function () { var c = b.getAttribute('data-col'), l = u.etiquetas.colores, i = l.indexOf(c); if (i >= 0) l.splice(i, 1); else l.push(c); b.classList.toggle('on', i < 0); }); });
    var CAMPO = { ca: 'colorCalceta', fr: 'colorFranja', tx: 'colorTexto', sh: 'colorShort' }, espera = null;
    enlazarBarras(function (campo, col) {
      if (campo === 'oc') return;
      u[CAMPO[campo]] = col; if (campo === 'tx') u.colorTextoElegido = true;
      if (campo === 'fr') { var sin = $('[data-fr=""]', panel); if (sin) sin.classList.remove('on'); }
      clearTimeout(espera); espera = setTimeout(previsualizar, 180);   // el 3D sigue al dedo sin trabarse
    }, function (campo, col) { if (campo === 'oc') otroColor(col); else { clearTimeout(espera); previsualizar(); } });
    var sinF = $('[data-fr=""]', panel); if (sinF) sinF.addEventListener('click', function () { u.colorFranja = ''; sinF.classList.add('on'); var p2 = $('[data-barra-campo="fr"] .barra-pulgar', panel); if (p2) p2.style.opacity = '.55'; var m2 = $('[data-barra-campo="fr"] .pn-barra-muestra', panel); if (m2) m2.style.background = ''; previsualizar(); });
    var estP = $('.pn-estudio', panel);
    if (estP) estP.addEventListener('click', function (e) { var b = e.target.closest('[data-pv]'); if (!b) return; pvVista = b.getAttribute('data-pv'); $$('[data-pv]', panel).forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-pv') === pvVista); }); if (mEditor && mEditor.m) mEditor.m.vista(pvVista); });
    $$('[data-sw]', panel).forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-sw'), real = porId(u.id); if (!real) return;
        real[k] = !real[k]; u[k] = real[k];
        pintar(); guardarCatalogo(k === 'destacado' ? (real[k] ? 'Destacado en la página' : 'Ya no está destacado') : (real[k] ? 'Oculto en la página' : 'Visible en la página'));
      });
    });
    var pap = $('[data-papelera]', panel);
    if (pap) pap.addEventListener('click', function () { var real = porId(u.id); if (!real) return; real.borrado = Date.now(); P.editando = null; pintar(P.scrollLista || 0); guardarCatalogo('Se fue a la papelera. Lo puedes recuperar durante 30 días.'); });
    $$('[data-foto]', panel).forEach(function (inp) {
      inp.addEventListener('change', function () { if (inp.files && inp.files.length) procesarFoto(inp.files, inp.getAttribute('data-foto')); });
    });
    $('[data-publicar]', panel).addEventListener('click', function () {
      var btn = this;
      if (selEq.value === '__nuevo') {
        u.etiquetas.equipo = $('#ed-equipo').value.trim().replace(/\s+/g, ' '); u.categoria = $('#ed-cat').value;
        if (!u.etiquetas.equipo) { A.toast('Ponle nombre al equipo nuevo.'); $('#ed-equipo').focus(); return; }
        if (equipoDe(arbol(), u.etiquetas.equipo.toLowerCase())) { A.toast('Ese equipo ya existe: escógelo de la lista.'); return; }
      }
      if (!u.nombre.trim()) u.nombre = nombreAuto(u) || 'Uniforme';   // sin nombre escrito: el equipo y la versión
      // la página muestra hasta N equipos (el dueño elige N en Datos de la tienda); cada equipo con sus versiones
      var max = +P.config.maxEquipos || 10, equipos = {};
      P.catalogo.forEach(function (x) { if (!x.oculto && !x.borrado && x.id !== u.id) equipos[claveEq(x)] = 1; });
      if (!equipos[claveEq(u)] && Object.keys(equipos).length >= max) { A.toast('Ya tienes ' + max + ' equipos en la página. Oculta uno, súbelo como versión de un equipo que ya tienes o cambia el número en Datos de la tienda.'); return; }
      btn.disabled = true; btn.textContent = 'Publicando…'; cortina('Publicando…');
      // la foto de estudio del catálogo se hace aquí, una sola vez; así el catálogo carga rápido en cualquier celular
      // (si el 3D de este celular tarda demasiado, se publica igual: la página hace la foto después)
      conTiempo(previsualizar(), 15000).then(function () {
        if (!mEditor || !mEditor.m) return null;
        mEditor.m.dorsal({ nombre: '', numero: '' });
        var m = mEditor.m, d = m.foto(480, 720, 'frente');
        var sil = m.foto(480, 720, 'frente', true);   // la que se ve mientras carga el 3D en la página
        // el círculo de los diseños: siempre en manga corta (aunque este venga en larga), para que todos se vean parejos
        var circP = u.manga === 'larga' && m.manga ? m.manga('corta').then(function () { var c = m.foto(480, 720, 'frente', true); return m.manga('larga').then(function () { return c; }); }).catch(function () { return null; }) : Promise.resolve(null);
        return circP.then(function (circ) {
          m.dorsal({ nombre: 'JUANPI', numero: '69', color: u.colorTexto });
          return Promise.all([A.subirConReintento(d, 'catalogo'), A.subirConReintento(sil, 'catalogo').catch(function () { return ''; }), circ ? A.subirConReintento(circ, 'catalogo').catch(function () { return ''; }) : '']);
        });
      }).then(function (r) {
        var mini = r && r[0]; if (mini) u.mini = mini; if (r && r[1]) u.silueta = r[1];
        if (r && r[2]) u.circulo = r[2]; else if (r && u.manga !== 'larga') delete u.circulo;   // en manga corta la silueta ya sirve
        var i = -1; P.catalogo.forEach(function (x, k) { if (x.id === u.id) i = k; });
        var limpio = A.clone(u); delete limpio.nuevo; delete limpio.colorTextoElegido; delete limpio.shortPropio; delete limpio.calcetaFoto; delete limpio.equipoNuevo;
        if (i >= 0) P.catalogo[i] = limpio; else { limpio.orden = 1e6; P.catalogo.push(limpio); }   // lo nuevo va al final de su equipo
        renumerar(arbol());
        return api('catalogo', { catalogo: (ordenados().forEach(function (x, k) { x.orden = k + 1; }), P.catalogo) }).then(function () {
          P.respaldos = null; P.editando = null; P.equipo = null;
          cortina('✓ Publicado', true);   // que se vea que sí pasó algo, y de regreso a la lista de uniformes
          setTimeout(function () { cortina(null); pintar(0); }, 1300);
          A.cargarTienda().then(function () { A.pintarCatalogo(); });
        });
      }).catch(function () { cortina(null); btn.disabled = false; btn.textContent = 'Publicar'; A.toast('No se pudo publicar. Revisa tu conexión e inténtalo otra vez.'); });
    });
    previsualizar();
  }

  /* ---------- datos ---------- */
  // textos de la página: cada uno ya trae escrito el de siempre; el dueño lo cambia ahí mismo (si lo borra, regresa el de siempre)
  var NOMBRE_TX = { intro_lema: 'Lema', hero_k: 'Texto chico de arriba', hero_t: 'Título', hero_p: 'Texto debajo del título', cat_t: 'Título', cat_p: 'Texto', hist_k: 'Texto chico de arriba', hist_t: 'Título', eq_k: 'Título', eq_p: 'Texto', como_t: 'Título', como_1: 'Paso 1', como_2: 'Paso 2', como_3: 'Paso 3', visita_t: 'Título', escribenos: 'Botón de WhatsApp', como_llegar: 'Botón del mapa' };
  var LARGO_TX = { intro_lema: 60, hero_k: 60, hero_t: 80, hero_p: 240, cat_t: 40, cat_p: 120, hist_k: 40, hist_t: 60, cifra_a: 6, hist_prendas: 90, cifra_b: 6, hist_folio: 90, eq_k: 60, eq_p: 160, como_t: 40, como_1: 50, como_2: 50, como_3: 50, visita_t: 40, escribenos: 40, como_llegar: 30 };
  function campoTexto(k, c, nombre) {
    var v = (c.textos || {})[k] || (k === 'intro_lema' && c.lema) || window.I18N.es[k] || '', largo = LARGO_TX[k] > 100;
    return '<div class="grupo"><label for="tx-' + k + '">' + esc(nombre || NOMBRE_TX[k] || k) + '</label>' + (largo ? '<textarea class="campo campo-largo" id="tx-' + k + '" data-tx="' + k + '" maxlength="' + LARGO_TX[k] + '">' + esc(v) + '</textarea>' : '<input class="campo" id="tx-' + k + '" data-tx="' + k + '" maxlength="' + LARGO_TX[k] + '" value="' + esc(v) + '">') + '</div>';
  }
  // qué es cada parte de la página, dicho en sencillo (se lee sin abrirla)
  var QUE_ES = {
    'Arriba de todo (lo amarillo)': 'La frase grande que sale al abrir la página.',
    'Arma tu uniforme': 'Lo primero que lee el cliente: le invita a armar su uniforme en 3D.',
    'Catálogo': 'La fila de escudos de los equipos que puede escoger el cliente.',
    'Quiénes somos': 'Tu historia, tu calificación de Google y dos datos de la tienda.',
    'Equipos que visten M Sport': 'Equipos a los que ya les hiciste uniforme: se ven con su uniforme en 3D, su escudo y su red social.',
    'Así de fácil': 'Los 3 pasos para pedir: escoger, mandar por WhatsApp y recibir.',
    'Visítanos': 'Tu dirección, tu horario y los botones para escribirte o llegar.'
  };
  function grupoTextos(titulo, keys, c, extra) {
    var abierto = (P.gruposAbiertos || {})[titulo];
    return '<details class="pn-mas pn-seccion" data-grupo="' + esc(titulo) + '"' + (abierto ? ' open' : '') + '><summary><span>' + esc(titulo) + (QUE_ES[titulo] ? '<small class="pn-que-es">' + esc(QUE_ES[titulo]) + '</small>' : '') + '</span></summary>' + keys.map(function (k) { return campoTexto(k, c); }).join('') + (extra || '') + '</details>';
  }
  // equipos que visten M Sport: foto del uniforme que les hiciste, nombre y hasta 3 redes
  // el uniforme de cada equipo cliente: el que escogió el dueño o, si no escogió, el del catálogo con el mismo nombre de equipo
  function normal(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function uniCliente(x, unis) {
    var u = x.uni ? unis.filter(function (y) { return y.id === x.uni; })[0] : null;
    if (!u && x.nombre) u = unis.filter(function (y) { return normal((y.etiquetas || {}).equipo || y.nombre) === normal(x.nombre); })[0] || null;
    return u;
  }
  function escudoDeEquipo(u, unis) {
    if (!u) return ''; var k = normal((u.etiquetas || {}).equipo || u.nombre);
    return u.escudo || (unis.filter(function (y) { return y.escudo && normal((y.etiquetas || {}).equipo || y.nombre) === k; })[0] || {}).escudo || '';
  }
  // cada equipo que viste M Sport: se escoge su uniforme del catálogo (se ve en 3D en la página), su logo sale solo y se ponen sus redes
  function clientesHTML(c) {
    var l = c.clientes || [], unis = ordenados();
    return '<div class="pn-clientes"><span class="etq">Los equipos <small>(si no agregas ninguno, se ven tus uniformes destacados)</small></span>' + l.map(function (x, i) {
      var uc = uniCliente(x, unis), ver = uc && (uc.silueta || uc.mini), logo = x.escudo || escudoDeEquipo(uc, unis);
      var red = x.ig ? 'ig' : x.fb ? 'fb' : x.tt ? 'tt' : '';
      return '<div class="pn-cliente" data-cli="' + i + '">' +
        '<div class="pn-cli-vista"><span class="pn-cli-foto">' + (ver ? '<img src="' + esc(ver) + '" alt="">' : '<small>Su uniforme</small>') + '</span>' +
        '<span class="pn-cli-lado"><span class="pn-cli-esc">' + (logo ? '<img src="' + esc(logo) + '" alt="">' : '<small>Logo</small>') + '</span>' +
        '<span class="pn-cli-red' + (red ? ' on' : '') + '">' + (red ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONO_RED[red] + '</svg>' : '<small>Red</small>') + '</span></span></div>' +
        '<div class="pn-cli-datos"><label class="etq">Su uniforme</label><select class="campo" data-cli-k="uni"><option value="">' + (unis.length ? 'Escoge su uniforme' : 'Primero sube su uniforme en Uniformes') + '</option>' + unis.map(function (u) { return '<option value="' + esc(u.id) + '"' + (uc && u.id === uc.id ? ' selected' : '') + '>' + esc(u.nombre) + '</option>'; }).join('') + '</select>' +
        (uc ? '' : '<small class="falta">Escoge su uniforme para que se vea en la página. Si no está, súbelo primero en Uniformes.</small>') +
        '<input class="campo" data-cli-k="nombre" maxlength="40" placeholder="Nombre del equipo" value="' + esc(x.nombre || '') + '">' +
        '<div class="pn-cli-botones"><label class="chip">' + (x.escudo ? 'Cambiar logo' : (logo ? 'Poner otro logo' : 'Subir logo')) + '<input type="file" accept="image/*,.heic,.heif" data-cli-esc="' + i + '" hidden></label>' + (x.escudo ? '<button type="button" class="chip" data-cli-acomodar="escudo" data-i="' + i + '">⤢ Acomodar logo</button>' : '') + '</div>' +
        '<input class="campo" data-cli-k="ig" placeholder="Instagram (@usuario)" value="' + esc(x.ig || '') + '" autocapitalize="off">' +
        '<input class="campo" data-cli-k="fb" placeholder="Facebook (link)" value="' + esc(x.fb || '') + '" autocapitalize="off">' +
        '<input class="campo" data-cli-k="tt" placeholder="TikTok (@usuario)" value="' + esc(x.tt || '') + '" autocapitalize="off">' +
        '<button type="button" class="chip pn-peligro" data-cli-quita="' + i + '">Quitar este equipo</button></div></div>';
    }).join('') + (l.length < 12 ? '<button type="button" class="btn btn-linea" data-cli-mas>+ Agregar un equipo</button>' : '') + '</div>';
  }
  var ICONO_RED = {
    ig: '<path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>',
    fb: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8Z"/>',
    tt: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.6 2.4 4.4 5 4.6"/>'
  };
  /* ---------- Tu página: arriba la página como la ve el cliente; tocas un texto y abajo lo cambias ---------- */
  P.pg = { k: '', que: '', lang: 'es', listo: false };
  function largoTx(k) { return k === 'hist_p' ? 900 : Math.max(30, Math.min(500, Math.round(String(window.I18N.es[k] || '').length * 2.5))); }
  function txDe(k, l) { var c = P.config, m = l === 'en' ? (c.textos_en || {}) : (c.textos || {}); return m[k] || ''; }
  function txBase(k, l) { return (window.I18N[l] || {})[k] || window.I18N.es[k] || ''; }
  var FLECHA_D = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  var FLECHA_I = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  function vistaPagina(c) {
    // la historia de antes vivía aparte: ahora es un texto más de la página (en español y en inglés)
    if (c.historia && !(c.textos || {}).hist_p) { c.textos = Object.assign({}, c.textos || {}); if (c.historia !== window.I18N.es.hist_p) c.textos.hist_p = c.historia; }
    c.historia = '';
    var abierto = !!(P.pg.k || P.pg.que);
    // arriba de la barra, toda la pantalla es tu página (como la ve el cliente). Se desliza con el dedo como siempre;
    // tocas un texto o una foto y desde abajo sube el recuadro para cambiarlo, encima de la página (nada se encoge)
    return '<div class="pn-pag">' +
      '<div class="pn-pag-vista"><div class="pn-pag-marco" id="pg-marco"><span class="pn-pag-cargando">Cargando tu página…</span></div></div>' +
      '<p class="pn-pag-pista"' + (P.pg.usado ? ' hidden' : '') + '>☝ Toca cualquier texto o foto para cambiarlo</p>' +
      '<div class="pn-pag-ed" id="pg-campo"' + (abierto ? '' : ' hidden') + '>' + (abierto ? campoPagina() : '') + '</div>' +
      '<div class="pn-hoja" data-hoja="pg-mas"' + (P.pg.hoja ? '' : ' hidden') + '><div class="pn-hoja-in"><div class="pn-hoja-cab"><b>Más de tu página</b><button type="button" class="pn-ctl-listo" data-pg-mas-cerrar>Listo</button></div><div class="pn-hoja-cuerpo">' +
      '<div class="fila2"><div class="grupo"><label for="dt-cal">Calificación en Google</label><input class="campo" id="dt-cal" inputmode="decimal" value="' + esc(c.calificacion || '') + '"></div><div class="grupo"><label for="dt-op">Número de opiniones</label><input class="campo" id="dt-op" inputmode="numeric" value="' + esc(c.opiniones || '') + '"></div></div>' +
      '<h3 class="pn-h">Foto para compartir</h3><div class="pn-pag-fotos"><div class="pn-pag-fotofila">' + filaFoto('compartir') + botonesFoto('compartir') + '</div></div>' +
      '<h3 class="pn-h">Equipos que visten M Sport</h3>' + clientesHTML(c) +
      '<div class="grupo"><label for="dt-max">¿Cuántos equipos se ven para armar uniforme?</label><input class="campo" id="dt-max" type="number" inputmode="numeric" min="1" max="30" value="' + esc(String(c.maxEquipos || 10)) + '"></div>' +
      '</div></div></div><input type="file" accept="image/*,.heic,.heif" class="pn-est-oculto" data-pg-archivo tabindex="-1" aria-hidden="true"></div>';
  }
  var QUE_TOQUE = {
    tienda: ['Visítanos', 'La dirección, el horario y el WhatsApp se cambian en Tienda.', 'Ir a Tienda', 'datos'],
    uniformes: ['Uniformes', 'Los uniformes y sus escudos se cambian en Uniformes.', 'Ir a Uniformes', 'uniformes'],
    clientes: ['Equipos que visten M Sport', 'Escoge su uniforme, su logo y sus redes.', 'Cambiarlos', 'mas'],
    cal: ['Calificación de Google', 'Tu calificación y cuántas opiniones tienes.', 'Cambiarla', 'mas'],
    moon: ['Crédito', 'Este crédito es de MOON Digital y no se cambia.', '', ''],
    nada: ['Aquí no hay texto', 'Toca un título, un botón, un párrafo o una foto.', '', '']
  };
  // las fotos de la página: cómo se llaman, dónde salen y cuál es la de siempre
  var FOTOS_PAG = {
    logo: ['Tu logo', 'Sale arriba, en la portada y al abrir la página.'],
    fondo: ['Fondo del uniforme', 'Escoge uno o pon tu foto.'],
    compartir: ['Foto para compartir', 'La que sale cuando alguien manda tu link por WhatsApp o redes.']
  };
  // 10 fondos listos para escoger (el primero es el de siempre)
  var FONDOS = [['', 'Estadio de siempre'], ['dia', 'Estadio de día'], ['atardecer', 'Atardecer'], ['noche', 'Noche con luces'], ['nublado', 'Estadio clásico'], ['azulnoche', 'Noche azul'], ['naranja', 'Último sol'], ['lluvia', 'Lluvia de noche'], ['techado', 'Estadio techado'], ['blanco', 'Estadio de techo blanco'], ['dorado', 'Noche dorada'],
    ['g-azul', 'Azul'], ['g-negro', 'Negro'], ['g-blanco', 'Blanco'], ['g-dorado', 'Amarillo'], ['g-rojo', 'Rojo']];
  function urlFondo(k) { return k ? '/assets/fondos/' + k + '.webp' : ''; }
  function miniFoto(k) {
    var u = P.config[k];
    if (k === 'logo' && !u) return '<span class="pn-pag-mini logo">' + A.logoSVG('#1F2E7A', '#FFFFFF') + '</span>';
    return '<span class="pn-pag-mini' + (k === 'logo' ? ' logo' : '') + '"><img src="' + esc(u || (k === 'fondo' ? '/assets/3d/campo.webp' : '/assets/og.jpg')) + '" alt=""></span>';
  }
  function filaFoto(k) {
    return '<div class="pn-pag-foto">' + miniFoto(k) + '<span class="pn-pag-foto-t"><b>' + esc(FOTOS_PAG[k][0]) + '</b><small>' + esc(FOTOS_PAG[k][1]) + '</small></span></div>';
  }
  function botonesFoto(k) {
    return '<div class="pn-pag-pie"><button type="button" class="pn-ctl-listo" data-pg-foto="' + k + '">Cambiar foto</button><button type="button" class="pn-pag-orig" data-pg-foto-quitar="' + k + '"' + (P.config[k] ? '' : ' disabled') + '>Como venía</button></div>';
  }
  function cabEd(t) { return '<div class="pn-pag-cab"><span class="pn-pag-nom"><i></i><b>' + esc(t) + '</b></span><button type="button" class="pn-ctl-listo pn-pag-listo" data-pg-listo>Listo</button></div>'; }
  function campoPagina() {
    var g = P.pg, k = g.k;
    if (k) {
      var l = g.lang, v = txDe(k, l) || txBase(k, l), nom = k === 'hist_p' ? 'Tu historia' : NOMBRE_TX[k] || 'Este texto';
      return cabEd(nom) +
        '<textarea class="campo pn-pag-tx" id="pg-tx" maxlength="' + largoTx(k) + '" aria-label="' + esc(nom) + (l === 'en' ? ' en inglés' : ' en español') + '">' + esc(v) + '</textarea>' +
        '<div class="pn-pag-pie"><span class="pn-seg" role="group" aria-label="Idioma"><button type="button" data-pg-lang="es"' + (l === 'es' ? ' class="on"' : '') + '>Español</button><button type="button" data-pg-lang="en"' + (l === 'en' ? ' class="on"' : '') + '>English</button></span>' +
        '<button type="button" class="pn-pag-orig" data-pg-orig' + (txDe(k, l) ? '' : ' disabled') + '>Como venía</button></div>';
    }
    if (g.que === 'fondo') {
      var act = P.config.fondo || '', propio = act && !/^\/assets\/fondos\//.test(act);
      return cabEd('Fondo del uniforme') + '<div class="pn-fondos">' + FONDOS.map(function (f) {
        var u = urlFondo(f[0]), on = !propio && act === u;
        return '<button type="button" class="pn-fondo' + (on ? ' on' : '') + '" data-pg-fondo="' + esc(u) + '" aria-label="' + esc(f[1]) + '"><img src="' + esc(u || '/assets/3d/campo.webp') + '" alt=""></button>';
      }).join('') + '<button type="button" class="pn-fondo pn-fondo-tuyo' + (propio ? ' on' : '') + '" data-pg-foto="fondo" aria-label="Poner mi foto">' + (propio ? '<img src="' + esc(act) + '" alt="">' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/></svg>') + '</button></div>' +
        '<p class="pn-pag-nota">Desliza para ver más · la cámara pone tu foto</p>';
    }
    if (g.que === 'logo') return cabEd('Tu logo') + '<div class="pn-pag-fotobox">' + filaFoto('logo') + botonesFoto('logo') + '</div>';
    var q = QUE_TOQUE[g.que] || QUE_TOQUE.nada;
    return cabEd(q[0]) + '<div class="pn-pag-msj"><p>' + esc(q[1]) + '</p>' + (q[2] ? '<button type="button" class="pn-pag-orig pn-pag-ir" data-pg-ir="' + q[3] + '">' + esc(q[2]) + '</button>' : '') + '</div>';
  }
  // fondo: hasta 1600 de ancho, como venga; foto para compartir: 1200×630 (lo que piden WhatsApp y Facebook), recortada al centro
  function prepararFotoPag(f, k) {
    return A.cargarArchivo(f).then(function (im) {
      var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height, cv = document.createElement('canvas'), g = cv.getContext('2d');
      if (k === 'compartir') {
        cv.width = 1200; cv.height = 630; var s = Math.max(1200 / w, 630 / h);
        g.drawImage(im, (1200 - w * s) / 2, (630 - h * s) / 2, w * s, h * s);
      } else { var e = Math.min(1, 1600 / Math.max(w, h)); cv.width = Math.round(w * e); cv.height = Math.round(h * e); g.drawImage(im, 0, 0, cv.width, cv.height); }
      return cv.toDataURL('image/jpeg', 0.86);
    });
  }
  function ponerFotoPag(k, url) {
    P.config[k] = url;
    decirPagina({ tipo: 'fotos', logo: P.config.logo || '', fondo: P.config.fondo || '' });
    if (P.tab === 'pagina') { pintarCampo(); var mf = $('[data-hoja="pg-mas"] .pn-pag-fotos', panel); if (mf) mf.innerHTML = '<div class="pn-pag-fotofila">' + filaFoto('compartir') + botonesFoto('compartir') + '</div>'; } else pintar();
    if (P.guardarDatos) P.guardarDatos();
  }
  function decirPagina(m) { var f = P.capaPag && $('iframe', P.capaPag); if (f && f.contentWindow && P.pg.listo) { m.msport = 1; f.contentWindow.postMessage(m, location.origin); } }
  function capaPagina() {
    if (P.capaPag) return P.capaPag;
    var cap = document.createElement('div'); cap.className = 'pn-pag-capa';
    var f = document.createElement('iframe'); f.title = 'Tu página como la ve el cliente'; f.setAttribute('tabindex', '-1');
    f.src = '/?editar=1&sinintro=1&v=' + (window.VERSION || '1');
    cap.appendChild(f); panel.appendChild(cap); P.capaPag = cap;
    return cap;
  }
  function colocarCapa() {
    var m = P.tab === 'pagina' && $('#pg-marco', panel);
    if (!m) { P.pg.hoja = false; P.pg.hojaY = 0; if (P.capaPag) P.capaPag.style.display = 'none'; return; }
    var cap = capaPagina(), f = $('iframe', cap), r = m.getBoundingClientRect(), pr = panel.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // a tamaño real: la página se ve exactamente como en el celular del cliente
    cap.style.cssText = 'display:block;left:' + (r.left - pr.left) + 'px;top:' + (r.top - pr.top) + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
    f.style.cssText = 'width:' + Math.round(r.width) + 'px;height:' + Math.round(r.height) + 'px';
  }
  // el recuadro de abajo: aparece al tocar algo en la página y se va con Listo. Siempre mide lo mismo.
  function pintarCampo() {
    var cp = $('#pg-campo', panel); if (!cp) return;
    var abierto = !!(P.pg.k || P.pg.que), estaba = !cp.hidden;
    // mientras cambias algo, la barra de abajo se esconde y el recuadro ocupa su lugar: la página se ve más grande.
    // Todo cambia en el mismo instante (barra, tamaño de la página y recuadro), así el recuadro sube una sola vez.
    var pn = $('.pn', panel); if (pn) pn.classList.toggle('enfoque', abierto);
    cp.classList.toggle('sube', abierto && !estaba);
    // lo que se desliza de lado (la tira de fondos) se queda donde lo dejaste al volver a pintarse
    var tira = $('.pn-fondos', cp), sl = tira ? tira.scrollLeft : 0;
    cp.hidden = !abierto; cp.innerHTML = abierto ? campoPagina() : '';
    var tira2 = $('.pn-fondos', cp); if (tira2 && sl) tira2.scrollLeft = sl;
    colocarCapa();
    var pista = $('.pn-pag-pista', panel); if (pista) pista.hidden = !!P.pg.usado;
    // lo escogido no queda tapado por el recuadro
    if (abierto) decirPagina({ tipo: 'centrar', abajo: cp.offsetHeight + 8 });
    var tx = $('#pg-tx', cp);
    if (tx) {
      tx.addEventListener('input', function () {
        var k = P.pg.k, l = P.pg.lang, c = P.config, map = l === 'en' ? 'textos_en' : 'textos', v = tx.value.trim();
        c[map] = Object.assign({}, c[map] || {});
        if (v && v !== txBase(k, l)) c[map][k] = v; else delete c[map][k];
        decirPagina({ tipo: 'texto', k: k, es: txDe(k, 'es'), en: txDe(k, 'en') });
        var o = $('[data-pg-orig]', cp); if (o) o.disabled = !txDe(k, l);
        if (P.guardarDatos) P.guardarDatos();
      });
      // al abrirse el teclado (tarda un poco y cambia de tamaño mientras sube), lo que cambias se vuelve a poner a la vista varias veces
      tx.addEventListener('focus', function () { modoEscribir(true); [120, 350, 700, 1100].forEach(function (t) { setTimeout(function () { ajustarTeclado(); }, t); }); });
      tx.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== tx) modoEscribir(false); }, 120); });
    }
  }
  // modo escribir: con el teclado abierto, el panel mide lo que queda libre arriba del teclado; lo que escribes nunca queda tapado
  function modoEscribir(si) {
    var pn = $('.pn', panel); if (!pn) return;
    // solo en celular o tableta (con teclado en pantalla); en computadora no cambia nada
    pn.classList.toggle('escribiendo', !!si && !!(window.matchMedia && matchMedia('(pointer: coarse)').matches));
    var ed = $('#pg-campo', panel);
    decirPagina({ tipo: 'escribiendo', si: pn.classList.contains('escribiendo'), abajo: ed && !ed.hidden ? ed.offsetHeight + 8 : 0 });
    ajustarTeclado();
  }
  function ajustarTeclado() {
    var pn = $('.pn', panel), vv = window.visualViewport;
    if (!pn) return;
    if (pn.classList.contains('escribiendo') && vv) { pn.style.height = vv.height + 'px'; pn.style.transform = 'translateY(' + vv.offsetTop + 'px)'; }
    else { pn.style.height = ''; pn.style.transform = ''; }
    colocarCapa();
    var ed = $('#pg-campo', panel); if (ed && !ed.hidden) decirPagina({ tipo: 'centrar', abajo: ed.offsetHeight + 8 });
  }
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', ajustarTeclado); window.visualViewport.addEventListener('scroll', ajustarTeclado); }
  window.addEventListener('resize', function () { colocarCapa(); });
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !P.capaPag || e.source !== ($('iframe', P.capaPag) || {}).contentWindow) return;
    var m = e.data || {}; if (!m.msport) return;
    if (m.tipo === 'listo') {
      P.pg.listo = true; var mk = $('.pn-pag-cargando', panel); if (mk) mk.remove();
      decirPagina({ tipo: 'todos', es: P.config.textos || {}, en: P.config.textos_en || {} });
      decirPagina({ tipo: 'fotos', logo: P.config.logo || '', fondo: P.config.fondo || '' });
      if (P.pg.lang !== 'es') decirPagina({ tipo: 'lang', l: P.pg.lang });
      if (P.pg.k) decirPagina({ tipo: 'ir', k: P.pg.k, abajo: (($('#pg-campo', panel) || {}).offsetHeight || 0) + 8 });
    }
    if (m.tipo === 'elige') { if (P.pg.k !== m.k) { var a = document.activeElement; if (a && a.id === 'pg-tx') a.blur(); } P.pg.k = m.k; P.pg.que = ''; P.pg.usado = true; pintarCampo(); }
    if (m.tipo === 'toque') { P.pg.k = ''; P.pg.que = m.que; P.pg.usado = true; pintarCampo(); }
  });
  function enlazarPagina() {
    var pag = $('.pn-pag', panel); if (!pag) return;
    if (P.capaPag && P.pg.listo) { var mk = $('.pn-pag-cargando', panel); if (mk) mk.remove(); }
    function hoja(si) { P.pg.hoja = !!si; var h = $('[data-hoja="pg-mas"]', panel); if (h) h.hidden = !si; }
    var hc = $('[data-hoja="pg-mas"] .pn-hoja-cuerpo', panel);
    if (hc) { hc.scrollTop = P.pg.hojaY || 0; hc.addEventListener('scroll', function () { P.pg.hojaY = hc.scrollTop; }, { passive: true }); }
    pag.addEventListener('click', function (e) {
      var t = e.target.closest('[data-pg-lang],[data-pg-orig],[data-pg-ir],[data-pg-mas-cerrar],[data-pg-foto],[data-pg-foto-quitar],[data-pg-listo],[data-pg-fondo]');
      if (!t) { if (e.target.getAttribute && e.target.getAttribute('data-hoja') === 'pg-mas') hoja(false); return; }
      if (t.hasAttribute('data-pg-foto')) { P.pg.fotoK = t.getAttribute('data-pg-foto'); var ia = $('[data-pg-archivo]', panel); ia.value = ''; ia.click(); return; }
      if (t.hasAttribute('data-pg-foto-quitar')) { ponerFotoPag(t.getAttribute('data-pg-foto-quitar'), ''); return; }
      if (t.hasAttribute('data-pg-listo')) { var ac = document.activeElement; if (ac && ac.id === 'pg-tx') ac.blur(); P.pg.k = ''; P.pg.que = ''; decirPagina({ tipo: 'suelta' }); pintarCampo(); return; }
      if (t.hasAttribute('data-pg-fondo')) {
        // escoger un fondo solo cambia cuál está marcado: la tira no se vuelve a pintar ni se regresa al inicio
        $$('.pn-fondo', panel).forEach(function (b) { b.classList.toggle('on', b === t); });
        P.config.fondo = t.getAttribute('data-pg-fondo');
        decirPagina({ tipo: 'fotos', logo: P.config.logo || '', fondo: P.config.fondo || '' });
        if (P.guardarDatos) P.guardarDatos(); return;
      }
      if (false) {
      } else if (t.hasAttribute('data-pg-lang')) {
        P.pg.lang = t.getAttribute('data-pg-lang'); decirPagina({ tipo: 'lang', l: P.pg.lang }); pintarCampo();
      } else if (t.hasAttribute('data-pg-orig')) {
        var k = P.pg.k, l = P.pg.lang, mp = l === 'en' ? 'textos_en' : 'textos';
        P.config[mp] = Object.assign({}, P.config[mp] || {}); delete P.config[mp][k];
        decirPagina({ tipo: 'texto', k: k, es: txDe(k, 'es'), en: txDe(k, 'en') }); pintarCampo(); if (P.guardarDatos) P.guardarDatos();
      } else if (t.hasAttribute('data-pg-ir')) {
        var d = t.getAttribute('data-pg-ir');
        if (d === 'mas') hoja(true); else { P.tab = d; P.tSel = ''; pintar(0); }
      } else hoja(false);
    });
    var mb = $('[data-pg-mas]', panel); if (mb) mb.addEventListener('click', function () { hoja(true); });
    var ia = $('[data-pg-archivo]', panel);
    if (ia) ia.addEventListener('change', function () {
      var f = ia.files && ia.files[0], k = P.pg.fotoK; if (!f || !k) return;
      var lista = k === 'logo' ? subirEscudo(f) : prepararFotoPag(f, k).then(function (d) { A.toast('Subiendo tu foto…', true); return A.subirConReintento(d, 'catalogo'); });
      lista.then(function (url) { A.toast('Foto lista'); ponerFotoPag(k, url); }).catch(function (e) { if (!e || !e.cancelado) A.toast('No se pudo subir esa foto. Inténtalo otra vez.'); });
    });
    pintarCampo();
  }
  function vistaDatos() {
    var c = P.config;
    function lista(id, arr) {
      return '<div class="pn-tags" id="' + id + '">' + (arr || []).map(function (t, i) { return '<span class="eq-chip">' + esc(t) + '<button type="button" data-quita-tag="' + id + '" data-i="' + i + '" aria-label="Quitar">×</button></span>'; }).join('') +
        '<span class="pn-tag-nueva"><input class="campo pn-tag-in" data-tag-in="' + id + '" placeholder="Nueva" maxlength="40"><button type="button" class="chip" data-tag-mas="' + id + '" aria-label="Agregar">+</button></span></div>';
    }
    // dos pestañas con un solo formulario: "Datos de la tienda" (cómo encontrarte y pedidos) y "Secciones de la página" (lo que dice
    // cada parte de la página). Las dos partes están siempre y solo se esconde la que no toca, así todo se guarda junto.
    var pag = P.tab === 'pagina', aj = P.tab === 'ajustes';
    return '<div class="pn-form pn-datos"><p class="pn-auto" id="dt-estado">Todo lo que cambies aquí se guarda solo.</p>' +
      '<div data-parte="datos"' + (P.tab === 'datos' ? '' : ' hidden') + '><div class="pn-col">' + vistaVisita(c) +
      '<div class="grupo" data-tsel="wa"' + (P.tSel === 'wa' ? '' : ' hidden') + '><label for="dt-wa">WhatsApp de la tienda (10 dígitos)</label><input class="campo" id="dt-wa" inputmode="tel" value="' + esc(String(c.whatsapp || '').replace(/^52/, '')) + '" placeholder="998 000 0000"></div>' +
      '<div class="grupo pn-redes-campos" data-tsel="redes"' + (P.tSel === 'redes' ? '' : ' hidden') + '>' + [['ig', 'Instagram', '@deportesmsport'], ['fb', 'Facebook', 'Link o nombre de la página'], ['tt', 'TikTok', '@deportesmsport']].map(function (r) { return '<label class="pn-red-campo"><i>' + svgRed(r[0]) + '</i><input class="campo" id="dt-' + r[0] + '" data-red-in="' + r[0] + '" placeholder="' + r[2] + '" aria-label="' + r[1] + '" autocapitalize="off" autocomplete="off" value="' + esc((c.redes || {})[r[0]] || '') + '"></label>'; }).join('') + '<p class="nota">Si dejas uno vacío, ese no sale en tu página.</p></div>' +
      '<div class="grupo" data-tsel="dir"' + (P.tSel === 'dir' ? '' : ' hidden') + '><label for="dt-dir">Dirección</label><input class="campo" id="dt-dir" value="' + esc(c.direccion) + '"></div>' +
      '<div class="grupo" data-tsel="hor"' + (P.tSel === 'hor' ? '' : ' hidden') + '><span class="etq">Horario <small>(toca la hora y escoge con la ruedita)</small></span>' + horarioHTML(c.horario) + '</div>' +
      '</div></div><div data-parte="ajustes"' + (aj ? '' : ' hidden') + '><div class="pn-col"><h3 class="pn-h">Pedidos</h3>' +
      '<div class="grupo"><span class="etq">Tallas que manejas <small>(escribe una y toca +)</small></span>' + lista('tallas', c.tallas) + '</div>' +
      sonidoHTML(c) +
      '<div class="grupo pn-cambia-cod"><h3 class="pn-h">Tu código para entrar</h3><div class="fila2"><input class="campo" id="dt-cod1" type="password" inputmode="numeric" autocomplete="new-password" placeholder="Código nuevo" maxlength="32"><input class="campo" id="dt-cod2" type="password" inputmode="numeric" autocomplete="new-password" placeholder="Repítelo" maxlength="32"></div>' +
      '<button type="button" class="btn btn-linea" data-cambiar-codigo>Cambiar código</button><p class="nota">Mínimo 4 dígitos. Si algún día lo olvidas, el código maestro que te dio MOON Digital siempre funciona.</p></div></div></div>' +
      '<div data-parte="pagina"' + (pag ? '' : ' hidden') + '>' + vistaPagina(c) + '</div></div>';
  }
  // el sonido que suena cuando el cliente manda su cotización: con o sin sonido, el suyo propio y el volumen
  function sonidoHTML(c) {
    var vol = isFinite(parseFloat(c.sonidoVolumen)) ? Math.round(parseFloat(c.sonidoVolumen)) : 50, si = c.sonido !== 'no';
    P.sonido = { sonido: si ? 'si' : 'no', sonidoUrl: c.sonidoUrl || '', sonidoVolumen: vol };
    return '<div class="grupo pn-sonido"><span class="etq">Sonido cuando el cliente manda su cotización</span>' +
      '<div class="chips llenar"><button type="button" class="chip' + (si ? ' on' : '') + '" data-son="si">Con sonido</button><button type="button" class="chip' + (!si ? ' on' : '') + '" data-son="no">Sin sonido</button></div>' +
      '<div class="pn-son-op"' + (si ? '' : ' hidden') + '><label class="pn-vol">Volumen <input type="range" min="0" max="100" step="5" value="' + vol + '" id="dt-vol"><b id="dt-vol-n">' + vol + '%</b></label>' +
      '<p class="nota" id="dt-son-cual">' + (c.sonidoUrl ? 'Suena tu sonido.' : 'Suena el sonido de M Sport.') + '</p>' +
      '<div class="pn-switches"><button type="button" class="chip" data-son-probar>▶ Escuchar</button><label class="chip">Subir mi sonido<input type="file" accept="audio/*" data-son-subir hidden></label>' +
      (c.sonidoUrl ? '<button type="button" class="chip" data-son-quitar>Usar el de M Sport</button>' : '') + '</div></div></div>';
  }
  function enlazarSonido() {
    var s = P.sonido, op = $('.pn-son-op', panel), vol = $('#dt-vol', panel);
    $$('[data-son]', panel).forEach(function (b) { b.addEventListener('click', function () { s.sonido = b.getAttribute('data-son'); $$('[data-son]', panel).forEach(function (x) { x.classList.toggle('on', x === b); }); op.hidden = s.sonido === 'no'; }); });
    vol.addEventListener('input', function () { s.sonidoVolumen = +vol.value; $('#dt-vol-n', panel).textContent = vol.value + '%'; });
    $('[data-son-probar]', panel).addEventListener('click', function () { A.probarSonido(s.sonidoUrl || '/assets/sonido/folio.mp3?v=' + (window.VERSION || '1'), s.sonidoVolumen / 100); });
    var q = $('[data-son-quitar]', panel); if (q) q.addEventListener('click', function () { s.sonidoUrl = ''; $('#dt-son-cual', panel).textContent = 'Suena el sonido de M Sport.'; q.remove(); });
    var inp = $('[data-son-subir]', panel);
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      if (f.size > 4e6) { A.toast('El sonido es muy pesado. Usa uno de menos de 4 MB (unos segundos).'); return; }
      A.toast('Subiendo tu sonido…', true);
      var r = new FileReader();
      r.onload = function () {
        var data = String(r.result).replace(/^data:audio\/(x-)?m4a/, 'data:audio/mp4');
        A.subirConReintento(data, 'catalogo').then(function (url) { s.sonidoUrl = url; $('#dt-son-cual', panel).textContent = 'Suena tu sonido.'; A.toast('Listo: toca Escuchar para oírlo'); if (P.sonidoGuardar) P.sonidoGuardar(); })
          .catch(function () { A.toast('No se pudo subir ese sonido. Prueba con un MP3.'); });
      };
      r.readAsDataURL(f);
    });
  }
  var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  // horario: un renglón por día, como en Google Maps (abierto/cerrado y sus horas). Se guarda juntando los días con las mismas horas.
  var ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0], DIAS_L = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  // Tu tienda: arriba se ve "Visítanos" como en la página (con lo que hay ahorita); se toca la dirección, el horario o el
  // WhatsApp y abajo sale solo eso para cambiarlo. Lo que cambias se ve arriba al instante.
  function textoHorario() {
    var g = P.horDia ? leerHorario() : (P.config.horario || []);
    if (!g.length) return '<span class="pn-vv-h"><span>Todos los días</span><b>Cerrado</b></span>';
    return g.map(function (r) {
      var ds = r.dias.slice().sort(function (a, b) { return ORDEN_DIAS.indexOf(a) - ORDEN_DIAS.indexOf(b); }), nom = ds.length > 2 && ORDEN_DIAS.indexOf(ds[ds.length - 1]) - ORDEN_DIAS.indexOf(ds[0]) === ds.length - 1 ? DIAS_L[ds[0]] + ' a ' + DIAS_L[ds[ds.length - 1]].toLowerCase() : ds.map(function (d) { return DIAS_L[d]; }).join(', ');
      var hh = function (t) { var x = String(t || '').split(':'), H = +x[0], m = x[1] || '00'; return ((H % 12) || 12) + (m !== '00' ? ':' + m : '') + (H < 12 ? ' am' : ' pm'); };
      return '<span class="pn-vv-h"><span>' + esc(nom) + '</span><b>' + hh(r.abre) + ' – ' + hh(r.cierra) + '</b></span>';
    }).join('');
  }
  // redes de la tienda: los mismos íconos que salen en la página, junto a "Visítanos"
  var ICONO_RED_T = { ig: '<path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>', fb: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8Z"/>', tt: '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.6 2.4 4.4 5 4.6"/>' };
  function svgRed(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONO_RED_T[k] + '</svg>'; }
  function vistaVisita(c) {
    var sel = function (k) { return P.tSel === k ? ' on' : ''; }, wa = String(c.whatsapp || '').replace(/^52/, ''), r = c.redes || {};
    return '<div class="pn-vv' + (P.tSel ? ' foco' : '') + '"><p class="pn-vv-k">' + (P.tSel ? 'Así se ve en tu página' : '☝ Toca un dato para cambiarlo') + '</p><div class="pn-vv-cab"><h4>' + (({ dir: 'Dirección', hor: 'Horario', wa: 'WhatsApp', redes: 'Tus redes' })[P.tSel] || 'Visítanos') + '</h4>' +
      '<button type="button" class="pn-vv-redes' + sel('redes') + '" data-tsel-ir="redes" aria-label="Tus redes sociales">' + ['ig', 'fb', 'tt'].map(function (k) { return '<i class="pn-vv-red' + (r[k] ? ' on' : '') + '" data-red-k="' + k + '">' + svgRed(k) + '</i>'; }).join('') + '</button><button type="button" class="pn-ctl-listo pn-vv-listo" data-tsel-listo>Listo</button></div>' +
      '<button type="button" class="pn-vv-t' + sel('dir') + '" data-tsel-ir="dir"><span id="vv-dir">' + esc(c.direccion || 'Toca para poner tu dirección') + '</span></button>' +
      '<button type="button" class="pn-vv-t pn-vv-hor' + sel('hor') + '" data-tsel-ir="hor" id="vv-hor">' + textoHorario() + '</button>' +
      '<button type="button" class="pn-vv-t pn-vv-wa' + sel('wa') + '" data-tsel-ir="wa"><span>Escríbenos por WhatsApp</span><small id="vv-wa">' + esc(wa ? wa.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') : 'Toca para poner tu número') + '</small></button>' +
      '</div>';
  }
  function horarioHTML(h) {
    if (!Array.isArray(h)) h = A.clone(window.CONFIG_BASE.horario);
    var pd = {}; ORDEN_DIAS.forEach(function (d) { pd[d] = { abierto: false, abre: '09:00', cierra: '19:00' }; });
    h.forEach(function (r) { (r.dias || []).forEach(function (d) { pd[d] = { abierto: true, abre: r.abre, cierra: r.cierra }; }); });
    P.horDia = pd;
    return '<div class="pn-hor" id="pn-hor">' + ORDEN_DIAS.map(function (d) {
      var x = pd[d];
      return '<div class="pn-dia' + (x.abierto ? '' : ' cerrado') + '" data-dia="' + d + '"><b>' + DIAS_L[d].slice(0, 3) + '</b>' +
        '<button type="button" class="pn-sw' + (x.abierto ? ' on' : '') + '" data-dia-ab="' + d + '" aria-pressed="' + x.abierto + '"><i></i><span>' + (x.abierto ? 'Abierto' : 'Cerrado') + '</span></button>' +
        '<span class="pn-dia-horas"><input class="campo" type="time" data-habre="' + d + '" value="' + x.abre + '" aria-label="Abre"><em>a</em><input class="campo" type="time" data-hcierra="' + d + '" value="' + x.cierra + '" aria-label="Cierra"></span></div>';
    }).join('') + '</div>';
  }
  function leerHorario() {
    var grupos = [];
    ORDEN_DIAS.forEach(function (d) {
      var x = P.horDia[d], a = $('[data-habre="' + d + '"]', panel), c = $('[data-hcierra="' + d + '"]', panel);
      if (a) x.abre = a.value || x.abre; if (c) x.cierra = c.value || x.cierra;
      if (!x.abierto) return;
      var g = grupos.filter(function (r) { return r.abre === x.abre && r.cierra === x.cierra; })[0];
      if (g) g.dias.push(d); else grupos.push({ dias: [d], abre: x.abre, cierra: x.cierra });
    });
    return grupos;
  }
  function enlazarDatos() {
    // Tu tienda: tocar un pedazo de la vista previa abre solo su campo; lo que se escribe se ve arriba al instante
    function tsel(k) {
        P.tSel = k;
        $$('[data-tsel-ir]', panel).forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-tsel-ir') === P.tSel); });
        $$('[data-tsel]', panel).forEach(function (g) { g.hidden = g.getAttribute('data-tsel') !== P.tSel; });
        var kk = $('.pn-vv-k', panel); if (kk) kk.textContent = P.tSel ? 'Así se ve en tu página' : '☝ Toca un dato para cambiarlo';
        var vv = $('.pn-vv', panel); if (vv) vv.classList.toggle('foco', !!P.tSel);
        var h4 = $('.pn-vv h4', panel); if (h4) h4.textContent = ({ dir: 'Dirección', hor: 'Horario', wa: 'WhatsApp', redes: 'Tus redes' })[P.tSel] || 'Visítanos';
        var pn = $('.pn', panel); if (pn) pn.classList.toggle('enfoque', !!P.tSel);   // mientras cambias algo, se esconde la barra de abajo: todo cabe sin bajar   // con algo escogido, arriba solo queda eso: el campo cabe sin bajar
        var inp = P.tSel === 'dir' ? $('#dt-dir', panel) : P.tSel === 'wa' ? $('#dt-wa', panel) : P.tSel === 'redes' ? $('#dt-ig', panel) : null; if (inp) inp.focus();
    }
    $$('[data-tsel-ir]', panel).forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-tsel-ir'); tsel(P.tSel === k ? '' : k); }); });
    var tl = $('[data-tsel-listo]', panel); if (tl) tl.addEventListener('click', function () { tsel(''); });
    var vd = $('#vv-dir', panel), vw = $('#vv-wa', panel), vh = $('#vv-hor', panel);
    $$('[data-red-in]', panel).forEach(function (inp) { inp.addEventListener('input', function () { var i = $('.pn-vv-red[data-red-k="' + inp.getAttribute('data-red-in') + '"]', panel); if (i) i.classList.toggle('on', !!inp.value.trim()); }); });
    var dd = $('#dt-dir', panel); if (dd && vd) dd.addEventListener('input', function () { vd.textContent = dd.value || 'Toca para poner tu dirección'; });
    var ww = $('#dt-wa', panel); if (ww && vw) ww.addEventListener('input', function () { var n = ww.value.replace(/\D/g, '').replace(/^52(?=\d{10})/, ''); vw.textContent = n.length === 10 ? n.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') : (n || 'Toca para poner tu número'); });
    var hor = $('[data-tsel="hor"]', panel); if (hor && vh) { var rehor = function () { setTimeout(function () { vh.innerHTML = textoHorario(); }, 0); }; hor.addEventListener('input', rehor); hor.addEventListener('change', rehor); hor.addEventListener('click', rehor); }
    $$('[data-dia-ab]', panel).forEach(function (b) {
      b.addEventListener('click', function () {
        var d = +b.getAttribute('data-dia-ab'), x = P.horDia[d]; x.abierto = !x.abierto;
        b.classList.toggle('on', x.abierto); b.setAttribute('aria-pressed', x.abierto); $('span', b).textContent = x.abierto ? 'Abierto' : 'Cerrado';
        b.parentNode.classList.toggle('cerrado', !x.abierto);
      });
    });
    var c = P.config;
    $$('[data-quita-tag]', panel).forEach(function (b) { b.addEventListener('click', function () { c[b.getAttribute('data-quita-tag')].splice(+b.getAttribute('data-i'), 1); P.leerDatos(); pintar(); P.guardarDatos(); }); });
    $$('[data-tag-mas]', panel).forEach(function (b) { b.addEventListener('click', function () { P.leerDatos(); pintar(); P.guardarDatos(); var n = $('[data-tag-in]', panel); if (n) n.focus(); }); });
    $$('[data-tag-in]', panel).forEach(function (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return; e.preventDefault();
        var v = inp.value.trim(); if (!v) return;
        P.leerDatos(); pintar(); P.guardarDatos();
        var n = $('[data-tag-in="' + k + '"]', panel); if (n) n.focus();
      });
    });
    $$('[data-grupo]', panel).forEach(function (d) { d.addEventListener('toggle', function () { P.gruposAbiertos = P.gruposAbiertos || {}; P.gruposAbiertos[d.getAttribute('data-grupo')] = d.open; }); });
    var cliMas = $('[data-cli-mas]', panel);
    if (cliMas) cliMas.addEventListener('click', function () { P.leerDatos(); c.clientes = (c.clientes || []).concat([{ id: Math.random().toString(36).slice(2, 10), nombre: '' }]); pintar(); var r = $$('[data-cli]', panel).pop(); if (r) r.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
    $$('[data-cli-quita]', panel).forEach(function (b) { dobleToque(b, '¿Seguro? Toca otra vez', function () { P.leerDatos(); c.clientes.splice(+b.getAttribute('data-cli-quita'), 1); pintar(); P.guardarDatos(); }); });
    $$('[data-cli-k="uni"]', panel).forEach(function (sel) { sel.addEventListener('change', function () { P.leerDatos(); var i = +sel.closest('[data-cli]').getAttribute('data-cli'); var x = c.clientes[i], u = ordenados().filter(function (y) { return y.id === sel.value; })[0]; x.foto = ''; if (u && !x.nombre) x.nombre = (u.etiquetas || {}).equipo || u.nombre; pintar(); P.guardarDatos(); }); });   // al escoger el uniforme, el nombre del equipo se pone solo
    function subirCli(i, campo, url) { P.leerDatos(); c.clientes[i][campo] = url; A.toast(campo === 'escudo' ? 'Logo listo' : 'Foto lista'); pintar(); P.guardarDatos(); }
    $$('[data-cli-esc]', panel).forEach(function (inp) {
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0], i = +inp.getAttribute('data-cli-esc'); if (!f) return;
        subirEscudo(f).then(function (url) { subirCli(i, 'escudo', url); }).catch(function () {});
      });
    });
    $$('[data-cli-acomodar]', panel).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = +b.getAttribute('data-i'), campo = b.getAttribute('data-cli-acomodar');
        reacomodar(c.clientes[i][campo], campo === 'escudo' ? 'escudo' : 'foto').then(function (url) { subirCli(i, campo, url); }).catch(function (e) { if (!e || !e.cancelado) A.toast('No se pudo. Inténtalo otra vez.'); });
      });
    });
    enlazarSonido();
    $('[data-cambiar-codigo]', panel).addEventListener('click', function () {
      var a = $('#dt-cod1').value.trim(), b2 = $('#dt-cod2').value.trim();
      if (a.length < 4) { A.toast('El código debe tener al menos 4 dígitos.'); $('#dt-cod1').focus(); return; }
      if (a !== b2) { A.toast('Los dos códigos no son iguales.'); $('#dt-cod2').focus(); return; }
      api('codigo', { nuevo: a }).then(function () { P.pin = a; ses.set(a); $('#dt-cod1').value = ''; $('#dt-cod2').value = ''; A.toast('Código cambiado. Desde ahora entras con el nuevo.'); })
        .catch(function () { A.toast('No se cambió. Inténtalo otra vez.'); });
    });
    // todo se guarda solo: al salir de un campo o al tocar una opción (un momento después, para juntar varios toques)
    var estado = $('#dt-estado', panel);
    function marca(t, mal) {
      if (estado) { estado.textContent = t; estado.classList.toggle('mal', !!mal); }
      var pe = $('#pg-estado', panel); if (pe) { pe.textContent = mal ? 'No se guardó' : t; pe.classList.toggle('mal', !!mal); }
    }
    function leer() {
      $$('[data-tag-in]', panel).forEach(function (inp) { var v = inp.value.trim(); if (v) { var k = inp.getAttribute('data-tag-in'); c[k] = (c[k] || []).concat([v]); inp.value = ''; } });
      var mx = parseInt($('#dt-max').value, 10); c.maxEquipos = mx >= 1 && mx <= 30 ? mx : 10;
      c.clientes = $$('[data-cli]', panel).map(function (row, i) { var x = Object.assign({}, (c.clientes || [])[i] || {}); $$('[data-cli-k]', row).forEach(function (el) { x[el.getAttribute('data-cli-k')] = el.value.trim(); }); return x; });
      Object.assign(c, P.sonido);
      c.redes = { ig: ($('#dt-ig') ? $('#dt-ig').value.trim() : ''), fb: ($('#dt-fb') ? $('#dt-fb').value.trim() : ''), tt: ($('#dt-tt') ? $('#dt-tt').value.trim() : '') };
      c.direccion = $('#dt-dir').value; c.horario = leerHorario(); c.calificacion = $('#dt-cal').value.trim(); c.opiniones = $('#dt-op').value.trim();
      var wa = $('#dt-wa').value.replace(/\D/g, ''); if (wa.length === 12 && wa.indexOf('52') === 0) wa = wa.slice(2);
      if (wa.length === 10) { c.whatsapp = '52' + wa; return true; }
      return !wa ? (c.whatsapp = '', true) : false;
    }
    var reloj = null;
    function guardar() {
      clearTimeout(reloj);
      reloj = setTimeout(function () {
        if (!leer()) { marca('El WhatsApp debe tener 10 dígitos. Lo demás sí se guardó cuando lo corrijas.', true); return; }
        marca('Guardando…');
        api('config', { config: c }).then(function () { marca('Guardado ✓'); return A.cargarTienda(); }).then(function () { A.pintarDatos(); A.pintarCatalogo(); })
          .catch(function () { marca('No se guardó: revisa tu internet. Lo intentamos otra vez en cuanto cambies algo.', true); });
      }, 700);
    }
    P.guardarDatos = guardar; P.leerDatos = leer;
    if (P.tab === 'pagina') enlazarPagina();
    $$('.pn-datos input, .pn-datos textarea', panel).forEach(function (inp) {
      if (/^dt-cod/.test(inp.id) || inp.type === 'file') return;
      inp.addEventListener('change', guardar);
      if (inp.tagName === 'TEXTAREA' || inp.type === 'text' || !inp.type || inp.type === 'tel' || inp.type === 'number') inp.addEventListener('input', function () { marca('Escribiendo…'); });
    });
    $$('.pn-datos [data-dia-ab], .pn-datos [data-son], .pn-datos [data-son-quitar]', panel).forEach(function (b) { b.addEventListener('click', guardar); });
    var vol2 = $('#dt-vol', panel); if (vol2) vol2.addEventListener('change', guardar);
    P.sonidoGuardar = guardar;
  }

  /* ---------- papelera ---------- */
  // cómo estaba antes: cada vez que se guarda, lo de antes queda respaldado (los últimos 30 cambios)
  function respaldosHTML() {
    var r = P.respaldos;
    if (!r) return '<div class="pn-respaldos"><h3 class="pn-h">Cómo estaba antes</h3><p class="nota">Cargando…</p></div>';
    var hoy = new Date().toDateString();
    return '<div class="pn-respaldos"><h3 class="pn-h">Cómo estaba antes</h3><p class="nota">Si algo se cambió por error, regresa la página a como estaba en ese momento. Lo de ahora también queda guardado aquí.</p>' +
      (r.length ? '<div class="pn-lista">' + r.slice(0, 15).map(function (x) {
        var d = new Date(x.fecha), cuando = (d.toDateString() === hoy ? 'Hoy' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })) + ', ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        return '<div class="pn-fila"><span class="pn-info"><b>' + (x.tipo === 'catalogo' ? 'Uniformes y equipos' : 'Datos y secciones') + '</b><small>' + esc(cuando) + '</small></span><button type="button" class="btn btn-linea" data-restaura="' + esc(x.path) + '">Regresar a este</button></div>';
      }).join('') + '</div>' : '<p class="nota">Todavía no hay cambios guardados.</p>') + '</div>';
  }
  function vistaPapelera() {
    var l = P.catalogo.filter(function (u) { return u.borrado; });
    if (!l.length) return '<div class="pn-vacio"><h3>La papelera está vacía</h3><p>Lo que mandes aquí se puede recuperar durante 30 días. Después se borra solo.</p></div>' + respaldosHTML();
    return '<div class="pn-lista">' + l.map(function (u) {
      var quedan = Math.max(0, 30 - Math.floor((Date.now() - u.borrado) / DIA));
      return '<div class="pn-fila"><span class="pn-info"><b>' + esc(u.nombre) + '</b><small>Se borra en ' + quedan + ' días</small></span><button type="button" class="btn btn-linea" data-recupera="' + esc(u.id) + '">Recuperar</button></div>';
    }).join('') + '</div>' + respaldosHTML();
  }
  function enlazarPapelera() {
    if (!P.respaldos) api('respaldos').then(function (j) { P.respaldos = j.respaldos || []; if (P.tab === 'papelera') pintar(); }).catch(function () { P.respaldos = []; });
    $$('[data-restaura]', panel).forEach(function (b) {
      dobleToque(b, '¿Seguro? Toca otra vez', function () {
        b.disabled = true;
        api('restaurar', { path: b.getAttribute('data-restaura') }).then(function () { A.toast('Listo: la página regresó a como estaba.'); P.respaldos = null; return A.cargarTienda(); })
          .then(function () { A.pintarDatos(); A.pintarCatalogo(); cargar(); })
          .catch(function () { A.toast('No se pudo regresar. Inténtalo otra vez.'); b.disabled = false; });
      });
    });
    $$('[data-recupera]', panel).forEach(function (b) { b.addEventListener('click', function () { var u = porId(b.getAttribute('data-recupera')); delete u.borrado; pintar(); guardarCatalogo('Recuperado'); }); });
  }

  // Entrada del dueño: mantener presionado el logo 2 segundos. No es un enlace, así que el iPhone
  // no ofrece abrirlo en otra pestaña ni muestra vista previa.
  // (también el logo grande de la portada: arriba de la página el logo de la barra no se ve)
  var marca = $('#marca'), reloj = 0, aro = null;
  // al mantener el dedo aparece un círculo justo donde está el dedo y se va llenando en 2 segundos (azul sobre amarillo, dorado sobre azul)
  function aroEn(x, y, color) {
    quitarAro();
    aro = document.createElement('div'); aro.className = 'toque-aro'; aro.style.left = x + 'px'; aro.style.top = y + 'px'; aro.style.setProperty('--c', color);
    aro.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" class="fondo"/><circle cx="32" cy="32" r="26" class="lleno"/></svg>';
    document.body.appendChild(aro); void aro.offsetWidth; aro.classList.add('va');
  }
  function quitarAro() { if (aro) { aro.remove(); aro = null; } }
  // en la portada: desde el dedo, toda la parte amarilla se va llenando de azul en 2 segundos (y las letras se vuelven blancas)
  var capaLlena = null;
  function llenar(el, x, y) {
    var pt = el.closest('.portada') || el; vaciar();
    var r = pt.getBoundingClientRect();
    capaLlena = document.createElement('div'); capaLlena.className = 'portada-llena';
    capaLlena.style.setProperty('--x', (x - r.left) + 'px'); capaLlena.style.setProperty('--y', (y - r.top) + 'px');
    var dx = Math.max(x - r.left, r.right - x), dy = Math.max(y - r.top, r.bottom - y); capaLlena.style.setProperty('--r', Math.ceil(Math.hypot(dx, dy)) + 'px');   // se llena justo a los 2 segundos
    pt.insertBefore(capaLlena, pt.firstChild); void capaLlena.offsetWidth;
    pt.classList.add('llenando');
  }
  function vaciar() {
    if (!capaLlena) return; var c = capaLlena, pt = c.parentNode; capaLlena = null;
    pt.classList.remove('llenando'); c.classList.add('se-va'); setTimeout(function () { c.remove(); }, 350);
  }
  function entrada(el, color) {
    if (!el) return;
    var x0 = 0, y0 = 0;
    function soltar() { clearTimeout(reloj); el.classList.remove('cargando'); quitarAro(); vaciar(); }
    el.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;
      x0 = e.clientX; y0 = e.clientY;
      el.classList.add('cargando'); if (color) llenar(el, e.clientX, e.clientY);
      // primero se abre el panel (encima de lo azul) y ya tapado se regresa la portada: sin parpadeo
      reloj = setTimeout(function () { reloj = 0; if (navigator.vibrate) { try { navigator.vibrate(30); } catch (x) { /* nada */ } } abrir(); setTimeout(soltar, 450); }, 2000);
    });
    el.addEventListener('pointermove', function (e) { if (Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > 12) soltar(); });   // si mueve el dedo, está deslizando la página
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { el.addEventListener(ev, soltar); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  entrada(marca); entrada($('.portada-in'), '#1F2E7A');   // arriba de la página: toda la parte amarilla del logo y el nombre
  marca.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  if (location.hash === '#panel') abrir();
  window.addEventListener('hashchange', function () { if (location.hash === '#panel') abrir(); });
})();
