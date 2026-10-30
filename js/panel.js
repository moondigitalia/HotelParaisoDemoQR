(function () {
  'use strict';
  var A = window.APP, T = A.T, esc = A.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var panel = $('#panel');
  var P = { pin: null, tab: 'folios', folios: [], catalogo: [], config: {}, editando: null, detalle: null };
  var DIA = 864e5;
  var ESTADOS = ['nuevo', 'cotizado', 'produccion', 'entregado'];
  var ses = {
    get: function () { try { return sessionStorage.getItem('msport:pin'); } catch (e) { return null; } },
    set: function (v) { try { sessionStorage.setItem('msport:pin', v); } catch (e) { /* nada */ } }
  };

  function api(accion, extra) {
    var b = Object.assign({ pin: P.pin, accion: accion }, extra || {});
    return fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || 'error'); e.code = r.status; throw e; } return j; }); });
  }

  function abrir() {
    if (panel.hidden) window.FIJAR.on(); panel.hidden = false;
    P.pin = P.pin || ses.get();
    if (P.pin) cargar(); else pantallaPin();
  }
  function cerrar() {
    if (!panel.hidden) window.FIJAR.off(); panel.hidden = true;
    if (location.hash === '#panel') history.replaceState(null, '', location.pathname + location.search);
  }

  function marco(contenido) {
    return '<div class="pn"><header class="pn-top"><span class="pn-logo">' + A.logoSVG('#1F2E7A', '#FFFFFF') + '</span><b>Panel M Sport</b>' +
      '<button type="button" class="capa-x pn-x" data-pn-cerrar aria-label="Cerrar">×</button></header>' + contenido + '</div>';
  }
  function pantallaPin(error) {
    panel.innerHTML = marco('<form class="pn-pin" id="pn-pin"><h2>Hola</h2><p>Escribe tu código para entrar a tu panel.</p>' +
      '<input class="campo pn-codigo" id="pn-codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="8" aria-label="Código">' +
      (error ? '<p class="pn-error">' + esc(error) + '</p>' : '') +
      '<button class="btn btn-oro btn-xl" type="submit">Entrar</button></form>');
    enlazarMarco();
    var inp = $('#pn-codigo'); setTimeout(function () { inp.focus(); }, 60);
    $('#pn-pin').addEventListener('submit', function (e) {
      e.preventDefault(); P.pin = inp.value.trim(); cargar();
    });
  }
  function cargar() {
    panel.innerHTML = marco('<p class="pn-cargando">Cargando tu panel…</p>'); enlazarMarco();
    api('todo').then(function (j) {
      ses.set(P.pin);
      P.folios = j.folios || []; P.masFolios = !!j.masFolios; P.catalogo = (Array.isArray(j.catalogo) && j.catalogo.some(function (u) { return u.tipo === '3d'; })) ? (A.completarCatalogo ? A.completarCatalogo(j.catalogo) : j.catalogo) : A.clone(window.CATALOGO_BASE); P.config = j.config || {};
      pintar();
    }).catch(function (e) {
      ses.set(''); var pin = P.pin; P.pin = null;
      pantallaPin(e.code === 401 && pin ? 'Ese código no es correcto. Inténtalo otra vez.' : e.code === 429 ? 'Demasiados intentos. Espera unos minutos.' : 'No hay conexión en este momento. Inténtalo otra vez.');
    });
  }
  function enlazarMarco() { $$('[data-pn-cerrar]', panel).forEach(function (b) { b.addEventListener('click', cerrar); }); }

  // vuelve a dibujar el panel sin brincar: se queda donde estabas, o va al lugar que se le pida
  function pintar(irA) {
    var pn0 = $('.pn', panel), antes = pn0 ? pn0.scrollTop : 0;
    var nuevos = P.folios.filter(function (f) { return f.estado === 'nuevo'; }).length;
    var vivos = P.catalogo.filter(function (u) { return !u.borrado; });
    var papel = P.catalogo.filter(function (u) { return u.borrado; });
    var tabs = [['folios', 'Folios' + (nuevos ? ' · ' + nuevos + ' nuevos' : '')], ['uniformes', 'Uniformes · ' + vivos.length], ['datos', 'Datos de la tienda'], ['papelera', 'Papelera' + (papel.length ? ' · ' + papel.length : '')]];
    var h = '<nav class="pn-tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" class="chip' + (P.tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + esc(t[1]) + '</button>'; }).join('') + '</nav><div class="pn-cuerpo">';
    if (P.tab === 'folios') h += P.detalle !== null ? vistaDetalle() : vistaFolios();
    if (P.tab === 'uniformes') h += P.editando ? vistaEditor() : vistaUniformes();
    if (P.tab === 'datos') h += vistaDatos();
    if (P.tab === 'papelera') h += vistaPapelera();
    h += '</div>';
    panel.innerHTML = marco(h); enlazarMarco();
    var pn1 = $('.pn', panel); if (pn1) pn1.scrollTop = irA == null ? antes : irA;
    $$('[data-tab]', panel).forEach(function (b) { b.addEventListener('click', function () { P.tab = b.getAttribute('data-tab'); P.editando = null; P.detalle = null; P.equipo = null; pintar(0); }); });
    ({ folios: P.detalle !== null ? enlazarDetalle : enlazarFolios, uniformes: P.editando ? enlazarEditor : enlazarUniformes, datos: enlazarDatos, papelera: enlazarPapelera })[P.tab]();
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
    return buscar + '<div class="pn-lista">' + P.folios.map(function (f, i) {
      var fecha = new Date(f.creado).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }), n = totalDe(f);
      var e0 = f.equipos[0] || {}, j0 = (e0.jugadores || [])[0] || {}, quien = e0.nombre && e0.nombre !== 'Mi equipo' ? e0.nombre : ((j0.nombre || '') + (j0.numero ? ' ' + j0.numero : '')).trim();
      return '<button type="button" class="pn-folio" data-folio="' + i + '"><img src="' + esc(f.equipos[0].vistas.frente) + '" alt="">' +
        '<span class="pn-folio-txt"><b>' + esc(f.id) + '</b>' + (e0.base || quien ? '<span class="pn-que">' + esc([String(e0.base || '').split(' · ')[0], quien].filter(Boolean).join(' · ')) + '</span>' : '') + '<span class="pn-cuantos">' + plural(n, 'uniforme', 'uniformes') + (f.equipos.length > 1 ? ' · ' + plural(f.equipos.length, 'equipo', 'equipos') : '') + '</span><small>' + esc(fecha) + '</small></span>' +
        '<span class="estado ' + esc(f.estado) + '">' + esc(T('est_' + f.estado)) + '</span></button>';
    }).join('') + '</div>' + (P.masFolios ? '<div class="subir"><button type="button" class="btn btn-linea" data-mas-folios>Ver folios más antiguos</button></div>' : '');
  }
  function cambiarEstado(f, est) {
    var antes = f.estado; f.estado = est;
    api('estado', { id: f.id, estado: est }).then(function () { A.toast('Folio ' + f.id + ': ' + T('est_' + est)); })
      .catch(function () { f.estado = antes; A.toast('No se guardó. Inténtalo otra vez.'); pintar(); });
  }
  function enlazarFolios() {
    $$('[data-folio]', panel).forEach(function (b) { b.addEventListener('click', function () { P.scrollLista = $('.pn', panel).scrollTop; P.detalle = +b.getAttribute('data-folio'); pintar(0); }); });
    var bf = $('[data-buscar-folio]', panel);
    if (bf) bf.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = parseInt($('#pn-bf').value.replace(/\D/g, ''), 10); if (!n) { A.toast('Escribe el número del folio. Ej. 47'); return; }
      var id = 'M-' + String(n).padStart(4, '0'), k = P.folios.findIndex(function (f) { return f.id === id; });
      var abrir = function (i) { P.scrollLista = $('.pn', panel).scrollTop; P.detalle = i; pintar(0); };
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
    var h = '<button type="button" class="link-x" data-volver>← Todos los folios</button>' +
      '<div class="pn-det-top"><h3 class="pn-h">' + esc(f.id) + '</h3><small>' + esc(fecha) + '</small></div>' +
      '<div class="pn-resumen"><div class="pn-total"><b>' + n + '</b><span>' + (n === 1 ? 'uniforme' : 'uniformes') + (f.equipos.length > 1 ? '<br>en ' + f.equipos.length + ' equipos' : '') + '</span></div>' +
      '<div class="pn-tallas"><span class="etq">Tallas</span><div>' + tallasDe(todos) + '</div></div></div>' +
      '<span class="etq">Estado del pedido</span><div class="pn-estados">' + ESTADOS.map(function (e) { return '<button type="button" class="chip' + (f.estado === e ? ' on' : '') + '" data-est="' + e + '">' + esc(T('est_' + e)) + '</button>'; }).join('') + '</div>';
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
    return '<div class="pn-acciones"><button type="button" class="btn btn-oro" data-nuevo-eq>+ Nuevo equipo</button><button type="button" class="btn btn-linea" data-voz>▶ Escuchar cómo subir uno</button></div>' +
      '<p class="nota">Toca un equipo para cambiar su nombre, escudo, sección o sus uniformes. Las flechas cambian el orden en la página. ' +
      'Se ven ' + vis + ' de ' + max + ' equipos (el número lo cambias en Datos de la tienda). Toca el nombre de una sección para cambiarlo.</p>' +
      gr.map(function (g, si) {
        var real = si < secs.length;
        if (!real && !g.equipos.length) return '';
        return '<section class="pn-sec"><div class="pn-sec-cab">' +
          (real ? '<input class="campo pn-sec-nom" data-sec-nom="' + si + '" value="' + esc(g.sec) + '" maxlength="40" enterkeyhint="done" aria-label="Nombre de la sección">' +
            '<span class="pn-orden fila"><button type="button" class="icon-btn" data-sec-mueve="-1" data-si="' + si + '" aria-label="Subir sección"' + (si === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button type="button" class="icon-btn" data-sec-mueve="1" data-si="' + si + '" aria-label="Bajar sección"' + (si === secs.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<button type="button" class="icon-btn" data-sec-quita="' + si + '" aria-label="Quitar sección">×</button></span>'
            : '<b class="pn-sec-sin">Sin sección <small>(no se ven en el paso de elegir equipo; pásalos a una sección)</small></b>') + '</div>' +
          (g.equipos.length ? '<div class="pn-lista">' + g.equipos.map(function (e, ei) { return filaEquipo(e, si, ei, g.equipos.length); }).join('') + '</div>' : '<p class="nota">Esta sección no tiene equipos. Para pasar uno aquí, ábrelo y elige esta sección.</p>') +
          '</section>';
      }).join('') +
      '<div class="subir"><button type="button" class="btn btn-linea" data-sec-nueva>+ Nueva sección</button></div>';
  }
  function filaEquipo(e, si, ei, n) {
    var oculto = !visibleEq(e);
    var cara = e.escudo ? '<span class="pn-esc"><img src="' + esc(e.escudo) + '" alt=""></span>' : '<img class="pn-th" src="' + esc((e.items[0] || {}).mini || '') + '" alt="">';
    return '<div class="pn-fila pn-uni' + (oculto ? ' apagado' : '') + '"><button type="button" class="pn-abrir" data-eq="' + esc(e.clave) + '">' + cara +
      '<span class="pn-info"><b>' + esc(e.nombre || 'Sin nombre') + '</b><small>' + (e.items.length === 1 ? '1 uniforme' : e.items.length + ' uniformes') + (oculto ? ' · oculto' : '') + '</small></span></button>' +
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
    $('[data-nuevo-eq]', panel).addEventListener('click', function () { P.scrollLista = $('.pn', panel).scrollTop; nuevoUniforme(null); });
    $('[data-voz]', panel).addEventListener('click', narrar);
    $$('[data-eq]', panel).forEach(function (b) { b.addEventListener('click', function () { P.scrollLista = $('.pn', panel).scrollTop; P.equipo = b.getAttribute('data-eq'); pintar(0); }); });
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
    P.editando = { id: 'u' + Date.now().toString(36), nombre: '', categoria: e ? e.sec : ((P.config.categorias || [])[0] || ''), tipo: '3d', fotos: { frente: '', espalda: '', short: '' }, colorShort: '', colorCalceta: '', colorTexto: '#111111',
      etiquetas: { colores: [], pais: '', equipo: e ? e.nombre : '' }, escudo: e ? e.escudo : '', manga: 'corta', nuevo: true, equipoNuevo: !e };
    pintar(0);
  }
  function vistaEquipo() {
    var gr = arbol(), e = equipoDe(gr, P.equipo), secs = P.config.categorias || [];
    if (!e) { P.equipo = null; return vistaUniformes(); }
    var oculto = !visibleEq(e);
    return '<button type="button" class="link-x" data-volver-eq>← Uniformes</button><h3 class="pn-h">' + esc(e.nombre || 'Equipo') + '</h3><div class="pn-form">' +
      '<div class="fila2"><div class="grupo"><label for="eq-nombre">Nombre del equipo</label><input class="campo" id="eq-nombre" maxlength="40" value="' + esc(e.nombre) + '"></div>' +
      '<div class="grupo"><span class="etq">Escudo</span><label class="pn-escudo"><span class="pn-escudo-img">' + (e.escudo ? '<img src="' + esc(e.escudo) + '" alt="">' : '<b>+</b>') + '</span><input type="file" accept="image/*" data-escudo-eq></label></div></div>' +
      '<div class="grupo"><label for="eq-sec">Sección</label><select class="campo" id="eq-sec">' + secs.map(function (s) { return '<option' + (s === e.sec ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '<option value=""' + (e.sec ? '' : ' selected') + '>Sin sección</option></select></div>' +
      '<div class="grupo"><span class="etq">Sus uniformes <small>(el primero es el que se ve primero)</small></span><div class="pn-lista">' + e.items.map(function (u, i) {
        return '<div class="pn-fila pn-uni' + (u.oculto ? ' apagado' : '') + '"><button type="button" class="pn-abrir" data-edit="' + esc(u.id) + '"><img class="pn-th" src="' + esc(u.mini || '') + '" alt="">' +
          '<span class="pn-info"><b>' + esc(u.version || u.nombre) + '</b><small>' + esc(u.nombre) + (u.oculto ? ' · oculto' : '') + '</small></span></button>' +
          '<span class="pn-orden"><button type="button" class="icon-btn" data-ver-mueve="-1" data-i="' + i + '" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="icon-btn" data-ver-mueve="1" data-i="' + i + '" aria-label="Bajar"' + (i === e.items.length - 1 ? ' disabled' : '') + '>↓</button></span></div>';
      }).join('') + '</div><button type="button" class="btn btn-linea" data-ver-nueva>+ Otra versión de este equipo</button></div>' +
      '<div class="grupo"><span class="etq">En la página</span><div class="pn-switches">' +
      '<button type="button" class="chip' + (oculto ? ' on' : '') + '" data-eq-oculto>' + (oculto ? 'Equipo oculto · tocar para mostrar' : 'Ocultar equipo') + '</button>' +
      '<button type="button" class="chip" data-eq-papelera>Mandar el equipo a la papelera</button></div></div>' +
      '<div class="subir"><button type="button" class="btn btn-oro btn-xl" data-eq-guardar>Guardar</button></div></div>';
  }
  function enlazarEquipo() {
    var gr = arbol(), e = equipoDe(gr, P.equipo); if (!e) return;
    $('[data-volver-eq]', panel).addEventListener('click', function () { P.equipo = null; pintar(P.scrollLista || 0); });
    $$('[data-edit]', panel).forEach(function (b) { b.addEventListener('click', function () { P.editando = A.clone(porId(b.getAttribute('data-edit'))); pintar(0); }); });
    $$('[data-ver-mueve]', panel).forEach(function (b) {
      b.addEventListener('click', function () { var g2 = arbol(), e2 = equipoDe(g2, P.equipo), i = +b.getAttribute('data-i'), j = i + +b.getAttribute('data-ver-mueve'), t = e2.items[i]; e2.items[i] = e2.items[j]; e2.items[j] = t; guardarArbol(g2, 'Orden guardado'); });
    });
    $('[data-ver-nueva]', panel).addEventListener('click', function () { nuevoUniforme(e); });
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
  function bolitas(campo, valor, lista) {
    var v = String(valor || '').toLowerCase(), l = lista.slice(), propio = v && !l.some(function (c) { return c.toLowerCase() === v; });
    if (propio) l.unshift(valor);
    return '<div class="colores">' + l.map(function (c) { return '<button type="button" class="color' + (v === c.toLowerCase() ? ' on' : '') + '" style="background:' + c + '" data-' + campo + '="' + c + '" aria-label="' + c + '"></button>'; }).join('') +
      '<label class="color color-mas" aria-label="Otro color"><input type="color" data-cc="' + campo + '" value="' + (/^#[0-9a-f]{6}$/i.test(valor || '') ? valor : '#ffffff') + '"></label></div>';
  }
  function hexDe(rgb) { return '#' + rgb.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); }
  function equipoHTML(u, cats) {
    var eqs = []; arbol().forEach(function (g) { g.equipos.forEach(function (x) { eqs.push(x); }); });
    var k = claveEq(u), existe = !u.equipoNuevo && eqs.some(function (x) { return x.clave === k; }) && (u.etiquetas || {}).equipo;
    return '<div class="grupo"><label for="ed-eq">Equipo</label><select class="campo" id="ed-eq">' + eqs.map(function (x) { return '<option value="' + esc(x.clave) + '"' + (existe && x.clave === k ? ' selected' : '') + '>' + esc(x.nombre) + '</option>'; }).join('') +
      '<option value="__nuevo"' + (existe ? '' : ' selected') + '>+ Equipo nuevo…</option></select></div>' +
      '<div class="pn-eq-nuevo"' + (existe ? ' hidden' : '') + '><div class="fila2"><div class="grupo"><label for="ed-equipo">Nombre del equipo nuevo</label><input class="campo" id="ed-equipo" maxlength="40" value="' + esc(existe ? '' : ((u.etiquetas || {}).equipo || '')) + '" placeholder="Ej. Chivas"></div>' +
      '<div class="grupo"><span class="etq">Escudo <small>(opcional)</small></span><label class="pn-escudo"><span class="pn-escudo-img">' + (u.escudo ? '<img src="' + esc(u.escudo) + '" alt="">' : '<b>+</b>') + '</span><input type="file" accept="image/*" data-escudo></label></div></div>' +
      '<div class="grupo"><label for="ed-cat">Sección</label><select class="campo" id="ed-cat">' + cats.map(function (c) { return '<option' + (c === u.categoria ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '<option value=""' + (u.categoria ? '' : ' selected') + '>Sin sección</option></select></div></div>';
  }
  function nombreAuto(u) { var eq = (u.etiquetas || {}).equipo || '', v = (u.version || '').trim(); return eq ? eq + (v ? ' · ' + v : '') : ''; }
  function vistaEditor() {
    var u = P.editando, cats = P.config.categorias || [], f = u.fotos, e = u.etiquetas || (u.etiquetas = { colores: [], pais: '', equipo: '' });
    function boton(lado, texto, opcional) {
      return '<label class="pn-foto' + (f[lado] ? ' lista' : '') + '"><span class="pn-foto-img">' + (f[lado] ? '<img src="' + esc(f[lado]) + '" alt="">' : '<b>+</b>') + '</span><span>' + texto + (opcional ? ' <small>(opcional)</small>' : '') + '</span><input type="file" accept="image/*" multiple data-foto="' + lado + '"></label>';
    }
    // arriba lo único que hace falta: fotos → cómo se ve → equipo y versión → Publicar. Lo demás ya viene listo, en "Más opciones"
    var angosto = window.innerWidth <= 980;   // en celular la vista 3D va justo debajo de las fotos; en compu, a un lado
    var prev = '<div class="pn-prev3d"' + (f.frente ? '' : ' hidden') + '><div class="vistas pn-vistas3d"><button type="button" class="vista on" data-pv="frente">Frente</button><button type="button" class="vista" data-pv="espalda">Espalda</button></div><canvas id="ed-3d" class="ed-3d"></canvas><p class="nota">Así se verá en la página, con un nombre y número de ejemplo.</p></div>';
    var h = '<button type="button" class="link-x" data-volver>← Uniformes</button><h3 class="pn-h">' + (u.nuevo ? 'Nuevo uniforme' : 'Editar uniforme') + '</h3>' +
      '<div class="pn-editor"><div class="pn-form">' +
      '<p class="pn-paso"><b>1</b> Sube las fotos ' + (f.frente ? '<small>(toca una para cambiarla)</small>' : '<small>(puedes escoger varias)</small>') + '</p>' +
      '<div class="pn-fotos">' + boton('frente', 'Frente') + boton('espalda', 'Espalda') + boton('short', 'Short') + '</div>' +
      (angosto ? prev : '') +
      '<div id="ed-aviso"></div>' +
      ((f.frente || f.espalda) ? '<div class="pn-borrar">' + ['frente', 'espalda'].filter(function (l) { return f[l]; }).map(function (l) { return '<button type="button" class="chip" data-borrar="' + l + '">✎ Quitar algo ' + (l === 'frente' ? 'del frente' : 'de la espalda') + '</button>'; }).join('') + '<small>Etiqueta, gancho o mancha: píntalo con el dedo y desaparece.</small></div>' : '') +
      '<details class="pn-guia"' + (f.frente ? '' : ' open') + '><summary>Cómo tomar las fotos</summary><ul><li>Playera extendida en el piso, sobre un fondo de un solo color</li><li>De frente, desde arriba, con buena luz y sin flash</li><li>El short también va con foto (lleva logo). Si viene en la misma foto que la playera, lo separamos solo</li><li>Si trae etiqueta o gancho, después lo quitas con el dedo</li></ul></details>' +
      '<p class="pn-paso"><b>2</b> ¿De qué equipo es?</p>' +
      // el equipo se escoge de la lista (un error de dedo no parte al equipo en dos); si es nuevo, aquí mismo se le pone sección y escudo
      equipoHTML(u, cats) +
      '<div class="grupo"><label for="ed-version">Versión</label><div class="pn-version"><input class="campo" id="ed-version" maxlength="30" value="' + esc(u.version || '') + '" placeholder="Ej. Local">' +
      ['Local', 'Visitante', 'Tercera'].map(function (v) { return '<button type="button" class="chip' + (u.version === v ? ' on' : '') + '" data-ver="' + v + '">' + v + '</button>'; }).join('') + '</div></div>' +
      '<details class="pn-mas" data-mas-op' + (P.masAbierto ? ' open' : '') + '><summary>Más opciones <small>(ya vienen listas)</small></summary>' +
      '<div class="grupo"><label for="ed-nombre">Nombre en la página <small>(vacío = equipo y versión)</small></label><input class="campo" id="ed-nombre" maxlength="50" value="' + esc(u.nombre) + '" placeholder="' + esc(nombreAuto(u) || 'Ej. México · Local') + '"></div>' +
      '<div class="grupo"><label for="ed-pais">País</label><input class="campo" id="ed-pais" maxlength="40" value="' + esc(e.pais) + '" placeholder="Ej. México"></div>' +
      '<div class="grupo"><span class="etq">Manga con la que se ve primero <small>(el cliente puede cambiarla)</small></span><div class="chips llenar"><button type="button" class="chip' + (u.manga !== 'larga' ? ' on' : '') + '" data-mg="corta">Corta</button><button type="button" class="chip' + (u.manga === 'larga' ? ' on' : '') + '" data-mg="larga">Larga</button></div></div>' +
      '<div class="grupo"><span class="etq">Color de nombre y número</span>' + bolitas('tx', u.colorTexto, LETRAS_P) + '</div>' +
      '<div class="grupo"><span class="etq">Color de las calcetas</span>' + bolitas('ca', u.colorCalceta, TELAS) + '</div>' +
      '<div class="grupo"><span class="etq">Franja de arriba de la calceta</span><div class="colores"><button type="button" class="color sin' + (!u.colorFranja ? ' on' : '') + '" data-fr="" aria-label="Sin franja">✕</button>' + TELAS.map(function (c) { return '<button type="button" class="color' + (u.colorFranja === c ? ' on' : '') + '" style="background:' + c + '" data-fr="' + c + '" aria-label="' + c + '"></button>'; }).join('') + '</div></div>' +
      '<div class="grupo"><span class="etq">Número chico en el short</span><div class="chips llenar"><button type="button" class="chip' + (u.numeroShort ? ' on' : '') + '" data-ns="1">Sí</button><button type="button" class="chip' + (!u.numeroShort ? ' on' : '') + '" data-ns="0">No</button></div></div>' +
      '<div class="grupo"><span class="etq">Colores para el buscador <small>(se marcan solos con la foto)</small></span><div class="pn-tags">' + COLORES_N.map(function (c) { return '<button type="button" class="chip' + (e.colores.indexOf(c[0]) >= 0 ? ' on' : '') + '" data-col="' + c[0] + '"><i class="pn-bolita" style="background:' + c[1] + '"></i>' + c[0] + '</button>'; }).join('') + '</div></div>' +
      (f.frente && !/^data:/.test(f.frente) ? '<div class="grupo"><span class="etq">Misma playera, otro color <small>(toca un color y se hace la copia)</small></span>' + bolitas('oc', '', TELAS) + '</div>' : '') +
      '</details>';
    if (!u.nuevo) {
      h += '<div class="grupo"><span class="etq">En la página</span><div class="pn-switches">' +
        '<button type="button" class="chip' + (u.destacado ? ' on' : '') + '" data-sw="destacado">★ ' + (u.destacado ? 'Destacado' : 'Destacar') + '</button>' +
        '<button type="button" class="chip' + (u.oculto ? ' on' : '') + '" data-sw="oculto">' + (u.oculto ? 'Oculto · tocar para mostrar' : 'Ocultar') + '</button>' +
        '<button type="button" class="chip pn-peligro" data-papelera>Mandar a la papelera</button></div></div>';
    }
    var listo = f.frente && f.short && !/^data:/.test(f.frente + f.espalda + f.short);   // el short siempre con foto: lleva logo y a veces diseño
    var falta = !f.frente ? 'Primero sube la foto del frente.' : !f.short ? 'Falta la foto del short. Si viene en la misma foto que la playera, la separamos sola.' : '';
    h += '<div class="subir pn-publicar' + (listo ? ' listo' : '') + '"><button type="button" class="btn btn-oro btn-xl" data-publicar' + (listo ? '' : ' disabled') + '>' + (u.nuevo ? 'Publicar' : 'Guardar cambios') + '</button>' + (falta ? '<small class="pn-falta">' + falta + '</small>' : '') + '</div></div>' +
      (angosto ? '' : prev) + '</div>';
    return h;
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
  function imagenP(src) { return new Promise(function (ok) { if (!src) return ok(null); var i = new Image(); i.crossOrigin = 'anonymous'; i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); }
  function previsualizar() {
    var u = P.editando, c = $('#ed-3d'); if (!c || !u.fotos.frente) return Promise.resolve();
    return A.cargarMotor().catch(function () {}).then(function () {
      if (!window.Motor3D) return;
      if (!mEditor || mEditor.lienzo !== c) {
        if (mEditor && mEditor.m) mEditor.m.destruir();
        mEditor = { lienzo: c, p: window.Motor3D.crear(c).then(function (m) {
          // deslizar a los lados también voltea la vista previa
          if (m.deslizable) m.deslizable(function (v) { pvVista = v; $$('[data-pv]', panel).forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-pv') === v); }); });
          return m;
        }) };
      }
      return mEditor.p.then(function (m) {
        mEditor.m = m;
        return Promise.all([imagenP(u.fotos.frente), imagenP(u.fotos.espalda), imagenP(u.fotos.short)]).then(function (im) {
          return m.uniforme({ frente: im[0], espalda: im[1], short: im[2], manga: u.manga === 'larga' ? 'larga' : 'corta', colorShort: u.colorShort || '#f3f3f5', colorCalceta: u.colorCalceta || u.colorShort || '#f3f3f5', colorFranja: u.colorFranja || '', numeroShort: !!u.numeroShort });
        }).then(function () { return m.taco('negro'); }).then(function () { m.dorsal({ nombre: 'JUANPI', numero: '69', color: u.colorTexto || '#111111', sello: true }); m.vista(pvVista, false); });
      });
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
        // sin fondo = casi toda la foto quedó como prenda (no basta con que la prenda llene el cuadro: sus orillas sí se quitaron)
        r.sinFondo = (function () { var t = A.aCanvas(cut, 120), d = t.getContext('2d').getImageData(0, 0, t.width, t.height).data, n = 0; for (var i = 3; i < d.length; i += 4) if (d[i] > 128) n++; return n / (d.length / 4) * (cut.width * cut.height) / (base.width * base.height) > 0.9; })();
        r.persona = lado !== 'short' && M.tienePersona(cut);
        if (r.persona) {
          // se confirma con la piel (cabeza arriba de los hombros); si no hay, era una playera con tonos raros, no una persona
          var q = M.quitarPersona(cut, colorFondo(base)); r.persona = !!q;
          if (q) { cut = q; pz.short = null; if (q.calceta && !pz.calceta) pz.calceta = q.calceta; }   // con alguien puesto, las piezas sueltas son piernas, no un short
        }
        var sep = lado !== 'short' && !pz.short ? M.separarConjunto(cut, r.persona) : null;
        if (sep) { cut = sep.playera; pz.short = sep.short; }
        r.cut = cut; r.short = pz.short || null; r.calceta = (pz.short || r.persona) ? pz.calceta || null : null;   // calcetas solo en una foto del uniforme completo (en una playera sola, una pieza suelta no son calcetas)
        // la mejor foto: de frente y derecha, grande, sin persona
        r.frente = lado === 'short' ? 1 : M.deFrente(cut);
        r.nota = lado === 'short' ? cut.width * cut.height : r.frente - (r.persona ? 0.04 : 0) - (r.chica ? 0.03 : 0) - (r.sinFondo ? 0.5 : 0) + 0.08 * Math.min(1, cut.width * cut.height / 640000) - (pz.parecidas ? 0.06 : 0);   // a igual de derecha, gana la foto más grande y nítida
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
      if (lado !== 'short' && r.frente < 0.78) av.push('La playera viene un poco de lado y puede verse chueca. Si tienes una foto de frente, súbela aquí.');
      if (lado === 'espalda' && M.tieneDorsal(cut, M.coloresBase(cut))) {
        // solo el nombre y el número: los patrocinadores de arriba (junto al cuello) y de abajo se quedan
        cut = M.limpiarTela(cut, M.coloresBase(cut), true);
        av.push('La espalda traía nombre y número impresos: los quitamos para poner los del cliente.');
      }
      tareas.push(ponerFoto(u, lado, cut));
      // short y calcetas: de cualquier foto que los traiga (el short de su propia foto manda)
      if (lado !== 'short' && !u.shortPropio) {
        var conShort = lista.filter(function (x) { return x.short; }).sort(function (x, y) { return y.short.width * y.short.height - x.short.width * x.short.height; })[0];
        if (conShort && (lado === 'frente' || !u.fotos.short)) { tareas.push(ponerFoto(u, 'short', conShort.short)); av.unshift('Venía el short en la foto: lo separamos solo.'); }
      }
      if (lado === 'short') u.shortPropio = true;
      var conCalceta = lista.filter(function (x) { return x.calceta; })[0];
      if (conCalceta) { u.colorCalceta = hexDe(conCalceta.calceta); u.calcetaFoto = true; av.unshift('También venían las calcetas: tomamos su color.'); }
      // nombre y número: el color de acento de la playera si se lee bien (amarillo en el Barça), si no blanco o negro
      if (lado === 'frente' && !u.colorTextoElegido) u.colorTexto = colorLetras(cut);
      P.avisos = av;
      pintar(); $('#ed-aviso').innerHTML = av.length ? '<div class="aviso">' + av.map(function (a) { return '<p>' + esc(a) + '</p>'; }).join('') + '</div>' : '';
      var pv = $('.pn-prev3d', panel); if (pv && !pv.hidden) setTimeout(function () { pv.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120);   // que vea su uniforme en 3D sin buscarlo
      return Promise.all(tareas).then(function () {
        A.toast('Foto lista');
        var pub = $('[data-publicar]', panel); if (pub && u.fotos.frente && u.fotos.short && !/^data:/.test(u.fotos.frente + u.fotos.espalda + u.fotos.short)) { pub.disabled = false; pub.parentNode.classList.add("listo"); var fl = $(".pn-falta", panel); if (fl) fl.remove(); }
        previsualizar();
      });
    }).catch(function () { A.toast('No se pudo subir la foto. Inténtalo otra vez.'); });
  }
  // misma playera, otro color: se hace una copia con las fotos ya recoloreadas, lista para ponerle nombre y publicar
  function otroColor(T) {
    var u = P.editando; if (!u || !u.fotos.frente) return;
    A.toast('Haciendo la versión de otro color…', true);
    var rgb = [1, 3, 5].map(function (i) { return parseInt(T.slice(i, i + 2), 16); });
    Promise.all([imagenP(u.fotos.frente), imagenP(u.fotos.espalda), imagenP(u.fotos.short)]).then(function (im) {
      var M = window.Motor3D, cf = A.aCanvas(im[0], 1000), base = M.coloresBase(cf);
      var nuevo = A.clone(u); nuevo.id = 'u' + Date.now().toString(36); nuevo.nuevo = true; delete nuevo.destacado; delete nuevo.oculto;
      nuevo.nombre = ''; nuevo.mini = ''; nuevo.version = '';
      var mapa = function (hex) { var c = document.createElement('canvas'); c.width = c.height = 1; var g = c.getContext('2d'); g.fillStyle = hex; g.fillRect(0, 0, 1, 1); return hexDe(Array.from(M.recolorear(c, base, rgb).getContext('2d').getImageData(0, 0, 1, 1).data).slice(0, 3)); };
      ['colorShort', 'colorCalceta', 'colorFranja', 'colorTexto'].forEach(function (k) { if (nuevo[k]) nuevo[k] = mapa(nuevo[k]); });
      var lados = ['frente', 'espalda', 'short'];
      return Promise.all(lados.map(function (l, i) {
        if (!im[i]) { nuevo.fotos[l] = ''; return null; }
        var r = prepararCanvas(M.recolorear(A.aCanvas(im[i], 1000), base, rgb));
        return A.subirConReintento(r.data, 'catalogo').then(function (url) { nuevo.fotos[l] = url; });
      })).then(function () {
        nuevo.etiquetas.colores = M.coloresDe(A.aCanvas(im[0], 300));
        imagenP(nuevo.fotos.frente).then(function (f) { if (f) nuevo.etiquetas.colores = M.coloresDe(A.aCanvas(f, 300)); P.editando = nuevo; pintar(); A.toast('Listo: ponle nombre y publícalo'); });
      });
    }).catch(function () { A.toast('No se pudo hacer la otra versión. Inténtalo otra vez.'); });
  }
  // el escudo: la IA de su celular le quita el fondo (sirve un logo sobre blanco o un escudo bordado en la playera) y se centra
  function subirEscudo(file) {
    A.toast('Preparando el escudo…', true);
    return A.cargarArchivo(file).then(function (im) { return A.cargarMotor().catch(function () {}).then(function () { return im; }); }).then(function (im) {
      return window.Motor3D.recortarIA(A.aCanvas(im, 700)).then(function (c) { return prepararCanvas(window.Motor3D.centrarEscudo ? window.Motor3D.centrarEscudo(c) : c); });
    }).then(function (r) { return A.subirConReintento(r.data, 'catalogo'); }).then(function (url) { A.toast('Escudo listo'); return url; })
      .catch(function (e) { A.toast('No se pudo subir el escudo. Inténtalo otra vez.'); throw e; });
  }
  function enlazarEditor() {
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
    $('#ed-version').addEventListener('input', function (e) { u.version = e.target.value; $$('[data-ver]', panel).forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-ver') === u.version); }); verPh(); });
    $$('[data-ver]', panel).forEach(function (b) { b.addEventListener('click', function () { u.version = b.getAttribute('data-ver'); $('#ed-version').value = u.version; $$('[data-ver]', panel).forEach(function (x) { x.classList.toggle('on', x === b); }); verPh(); }); });
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
    [['sh', 'colorShort'], ['ca', 'colorCalceta'], ['fr', 'colorFranja'], ['tx', 'colorTexto']].forEach(function (par) {
      $$('[data-' + par[0] + ']', panel).forEach(function (b) { b.addEventListener('click', function () { u[par[1]] = b.getAttribute('data-' + par[0]); if (par[0] === 'tx') u.colorTextoElegido = true; $$('[data-' + par[0] + ']', panel).forEach(function (x) { x.classList.toggle('on', x === b); }); previsualizar(); }); });
    });
    $$('[data-oc]', panel).forEach(function (b) { b.addEventListener('click', function () { otroColor(b.getAttribute('data-oc')); }); });
    // "otro color": el selector de colores del celular; la vista previa se actualiza al soltar
    var espera = null;
    [['sh', 'colorShort'], ['ca', 'colorCalceta'], ['fr', 'colorFranja'], ['tx', 'colorTexto']].forEach(function (par) {
      var inp = $('[data-cc="' + par[0] + '"]', panel); if (!inp) return;
      inp.addEventListener('input', function () {
        u[par[1]] = inp.value; if (par[0] === 'tx') u.colorTextoElegido = true;
        $$('[data-' + par[0] + ']', panel).forEach(function (x) { x.classList.remove('on'); }); inp.parentNode.classList.add('on'); inp.parentNode.style.background = inp.value;
        clearTimeout(espera); espera = setTimeout(previsualizar, 250);
      });
    });
    var occ = $('[data-cc="oc"]', panel); if (occ) occ.addEventListener('change', function () { otroColor(occ.value); });
    $$('[data-pv]', panel).forEach(function (b) { b.addEventListener('click', function () { pvVista = b.getAttribute('data-pv'); $$('[data-pv]', panel).forEach(function (x) { x.classList.toggle('on', x === b); }); if (mEditor && mEditor.m) mEditor.m.vista(pvVista); }); });
    $$('[data-sw]', panel).forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-sw'), real = porId(u.id); if (!real) return;
        real[k] = !real[k]; u[k] = real[k];
        pintar(); guardarCatalogo(k === 'destacado' ? (real[k] ? 'Destacado en la página' : 'Ya no está destacado') : (real[k] ? 'Oculto en la página' : 'Visible en la página'));
      });
    });
    var pap = $('[data-papelera]', panel);
    if (pap) pap.addEventListener('click', function () { var real = porId(u.id); if (!real) return; real.borrado = Date.now(); P.editando = null; pintar(P.scrollLista || 0); guardarCatalogo('Se fue a la papelera. Lo puedes recuperar durante 30 días.'); });
    $$('[data-borrar]', panel).forEach(function (b) { b.addEventListener('click', function () { borrador(u, b.getAttribute('data-borrar')); }); });
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
      btn.disabled = true; btn.textContent = 'Publicando…';
      // la foto de estudio del catálogo se hace aquí, una sola vez; así el catálogo carga rápido en cualquier celular
      previsualizar().then(function () {
        if (!mEditor || !mEditor.m) return null;
        mEditor.m.dorsal({ nombre: '', numero: '' });
        var d = mEditor.m.foto(480, 720, 'frente');
        var sil = mEditor.m.foto(480, 720, 'frente', true);   // la que se ve mientras carga el 3D en la página
        mEditor.m.dorsal({ nombre: 'JUANPI', numero: '69', color: u.colorTexto });
        return Promise.all([A.subirConReintento(d, 'catalogo'), A.subirConReintento(sil, 'catalogo').catch(function () { return ''; })]);
      }).then(function (r) {
        var mini = r && r[0]; if (mini) u.mini = mini; if (r && r[1]) u.silueta = r[1];
        var i = -1; P.catalogo.forEach(function (x, k) { if (x.id === u.id) i = k; });
        var limpio = A.clone(u); delete limpio.nuevo; delete limpio.colorTextoElegido; delete limpio.shortPropio; delete limpio.calcetaFoto; delete limpio.equipoNuevo;
        if (i >= 0) P.catalogo[i] = limpio; else { limpio.orden = 1e6; P.catalogo.push(limpio); }   // lo nuevo va al final de su equipo
        renumerar(arbol());
        P.editando = null; pintar(P.scrollLista || 0);
        return guardarCatalogo('Publicado en la página');
      }).catch(function () { btn.disabled = false; btn.textContent = 'Publicar'; A.toast('No se pudo publicar. Revisa tu conexión e inténtalo otra vez.'); });
    });
    previsualizar();
  }

  /* ---------- datos ---------- */
  function vistaDatos() {
    var c = P.config;
    function lista(id, arr) {
      return '<div class="pn-tags" id="' + id + '">' + (arr || []).map(function (t, i) { return '<span class="eq-chip">' + esc(t) + '<button type="button" data-quita-tag="' + id + '" data-i="' + i + '" aria-label="Quitar">×</button></span>'; }).join('') +
        '<span class="pn-tag-nueva"><input class="campo pn-tag-in" data-tag-in="' + id + '" placeholder="Nueva" maxlength="40"><button type="button" class="chip" data-tag-mas="' + id + '" aria-label="Agregar">+</button></span></div>';
    }
    return '<div class="pn-form pn-datos"><p class="pn-auto" id="dt-estado">Todo lo que cambies aquí se guarda solo.</p>' +
      '<h3 class="pn-h">Tu tienda</h3>' +
      '<div class="grupo"><label for="dt-wa">WhatsApp de la tienda (10 dígitos)</label><input class="campo" id="dt-wa" inputmode="tel" value="' + esc(String(c.whatsapp || '').replace(/^52/, '')) + '" placeholder="998 000 0000"></div>' +
      '<div class="grupo"><label for="dt-dir">Dirección</label><input class="campo" id="dt-dir" value="' + esc(c.direccion) + '"></div>' +
      '<div class="grupo"><span class="etq">Horario</span>' + horarioHTML(c.horario) + '</div>' +
      '<h3 class="pn-h">Tu página</h3>' +
      '<div class="grupo"><label for="dt-lema">Lema</label><input class="campo" id="dt-lema" value="' + esc(c.lema) + '"></div>' +
      '<div class="grupo"><label for="dt-hist">Tu historia (la ve la gente en "Quiénes somos")</label><textarea class="campo campo-largo" id="dt-hist" maxlength="900" placeholder="Si lo dejas vacío, se muestra el texto de ejemplo.">' + esc(c.historia || '') + '</textarea></div>' +
      '<div class="fila2"><div class="grupo"><label for="dt-cal">Calificación en Google</label><input class="campo" id="dt-cal" inputmode="decimal" value="' + esc(c.calificacion || '') + '"></div><div class="grupo"><label for="dt-op">Número de opiniones</label><input class="campo" id="dt-op" inputmode="numeric" value="' + esc(c.opiniones || '') + '"></div></div>' +
      '<div class="grupo"><label for="dt-max">¿Cuántos equipos se ven en la página?</label><input class="campo" id="dt-max" type="number" inputmode="numeric" min="1" max="30" value="' + esc(String(c.maxEquipos || 10)) + '"></div>' +
      '<div class="grupo"><label for="dt-tit">Título de la portada <small>(vacío = el de siempre)</small></label><input class="campo" id="dt-tit" maxlength="80" value="' + esc((c.textos || {}).hero_t || '') + '" placeholder="' + esc(window.I18N.es.hero_t) + '"></div>' +
      '<div class="grupo"><label for="dt-sub">Texto debajo del título <small>(vacío = el de siempre)</small></label><textarea class="campo campo-largo" id="dt-sub" maxlength="240" placeholder="' + esc(window.I18N.es.hero_p) + '">' + esc((c.textos || {}).hero_p || '') + '</textarea></div>' +
      '<h3 class="pn-h">Pedidos</h3>' +
      '<div class="grupo"><span class="etq">Tallas que manejas <small>(escribe una y toca +)</small></span>' + lista('tallas', c.tallas) + '</div>' +
      sonidoHTML(c) +
      '<div class="grupo pn-cambia-cod"><h3 class="pn-h">Tu código para entrar</h3><div class="fila2"><input class="campo" id="dt-cod1" type="password" inputmode="numeric" autocomplete="new-password" placeholder="Código nuevo" maxlength="32"><input class="campo" id="dt-cod2" type="password" inputmode="numeric" autocomplete="new-password" placeholder="Repítelo" maxlength="32"></div>' +
      '<button type="button" class="btn btn-linea" data-cambiar-codigo>Cambiar código</button><p class="nota">Mínimo 4 dígitos. Si algún día lo olvidas, el código maestro que te dio MOON Digital siempre funciona.</p></div></div>';
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
  function horarioHTML(h) {
    if (!Array.isArray(h)) h = A.clone(window.CONFIG_BASE.horario);
    var pd = {}; ORDEN_DIAS.forEach(function (d) { pd[d] = { abierto: false, abre: '09:00', cierra: '19:00' }; });
    h.forEach(function (r) { (r.dias || []).forEach(function (d) { pd[d] = { abierto: true, abre: r.abre, cierra: r.cierra }; }); });
    P.horDia = pd;
    return '<div class="pn-hor" id="pn-hor">' + ORDEN_DIAS.map(function (d) {
      var x = pd[d];
      return '<div class="pn-dia' + (x.abierto ? '' : ' cerrado') + '" data-dia="' + d + '"><b>' + DIAS_L[d] + '</b>' +
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
    function marca(t, mal) { if (estado) { estado.textContent = t; estado.classList.toggle('mal', !!mal); } }
    function leer() {
      $$('[data-tag-in]', panel).forEach(function (inp) { var v = inp.value.trim(); if (v) { var k = inp.getAttribute('data-tag-in'); c[k] = (c[k] || []).concat([v]); inp.value = ''; } });
      var mx = parseInt($('#dt-max').value, 10); c.maxEquipos = mx >= 1 && mx <= 30 ? mx : 10;
      c.textos = { hero_t: $('#dt-tit').value.trim(), hero_p: $('#dt-sub').value.trim() };
      Object.assign(c, P.sonido);
      c.direccion = $('#dt-dir').value; c.horario = leerHorario(); c.lema = $('#dt-lema').value; c.historia = $('#dt-hist').value.trim(); c.calificacion = $('#dt-cal').value.trim(); c.opiniones = $('#dt-op').value.trim();
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
  var marca = $('#marca'), reloj = 0;
  function entrada(el) {
    if (!el) return;
    function soltar() { clearTimeout(reloj); el.classList.remove('cargando'); }
    el.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;
      el.classList.add('cargando');
      reloj = setTimeout(function () { soltar(); if (navigator.vibrate) { try { navigator.vibrate(30); } catch (x) { /* nada */ } } abrir(); }, 2000);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { el.addEventListener(ev, soltar); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  entrada(marca); entrada($('#portada-logo'));
  marca.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  if (location.hash === '#panel') abrir();
  window.addEventListener('hashchange', function () { if (location.hash === '#panel') abrir(); });
})();
