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
      P.folios = j.folios || []; P.catalogo = (Array.isArray(j.catalogo) && j.catalogo.some(function (u) { return u.tipo === '3d'; })) ? (A.completarCatalogo ? A.completarCatalogo(j.catalogo) : j.catalogo) : A.clone(window.CATALOGO_BASE); P.config = j.config || {};
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
    $$('[data-tab]', panel).forEach(function (b) { b.addEventListener('click', function () { P.tab = b.getAttribute('data-tab'); P.editando = null; P.detalle = null; pintar(0); }); });
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
    return '<div class="pn-lista">' + P.folios.map(function (f, i) {
      var fecha = new Date(f.creado).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }), n = totalDe(f);
      return '<button type="button" class="pn-folio" data-folio="' + i + '"><img src="' + esc(f.equipos[0].vistas.frente) + '" alt="">' +
        '<span class="pn-folio-txt"><b>' + esc(f.id) + '</b><span class="pn-cuantos">' + plural(n, 'uniforme', 'uniformes') + (f.equipos.length > 1 ? ' · ' + plural(f.equipos.length, 'equipo', 'equipos') : '') + '</span><small>' + esc(fecha) + '</small></span>' +
        '<span class="estado ' + esc(f.estado) + '">' + esc(T('est_' + f.estado)) + '</span></button>';
    }).join('') + '</div>';
  }
  function cambiarEstado(f, est) {
    var antes = f.estado; f.estado = est;
    api('estado', { id: f.id, estado: est }).then(function () { A.toast('Folio ' + f.id + ': ' + T('est_' + est)); })
      .catch(function () { f.estado = antes; A.toast('No se guardó. Inténtalo otra vez.'); pintar(); });
  }
  function enlazarFolios() {
    $$('[data-folio]', panel).forEach(function (b) { b.addEventListener('click', function () { P.scrollLista = $('.pn', panel).scrollTop; P.detalle = +b.getAttribute('data-folio'); pintar(0); }); });
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
      var ps = A.patros(d);
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
  var conMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // Lista limpia: tocas la tarjeta y se abre el uniforme; solo quedan afuera las flechas para cambiar el orden.
  function vistaUniformes() {
    var lista = ordenados();
    return '<div class="pn-acciones"><button type="button" class="btn btn-oro" data-nuevo>+ Nuevo uniforme</button><button type="button" class="btn btn-linea" data-voz>▶ Escuchar cómo subir uno</button></div>' +
      '<p class="nota">Toca un uniforme para cambiarlo, destacarlo, ocultarlo o mandarlo a la papelera. Las flechas cambian su lugar en la página.</p>' +
      '<div class="pn-lista" id="pn-unis">' + lista.map(function (u, i) {
        var marcas = (u.destacado ? '<span class="pn-marca oro">★ Destacado</span>' : '') + (u.oculto ? '<span class="pn-marca">Oculto</span>' : '');
        return '<div class="pn-fila pn-uni' + (u.oculto ? ' apagado' : '') + '"' + (conMouse ? ' draggable="true"' : '') + ' data-uid="' + esc(u.id) + '">' +
          '<button type="button" class="pn-abrir" data-edit="' + esc(u.id) + '"><img class="pn-th" src="' + esc(u.mini || '') + '" alt="">' +
          '<span class="pn-info"><b>' + esc(u.nombre) + '</b><small>' + esc(u.categoria || 'Sin categoría') + '</small>' + (marcas ? '<span class="pn-marcas">' + marcas + '</span>' : '') + '</span></button>' +
          '<span class="pn-orden">' +
          '<button type="button" class="icon-btn" data-mueve="-1" data-i="' + i + '" aria-label="Subir de lugar"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="icon-btn" data-mueve="1" data-i="' + i + '" aria-label="Bajar de lugar"' + (i === lista.length - 1 ? ' disabled' : '') + '>↓</button></span></div>';
      }).join('') + '</div>';
  }
  function guardarCatalogo(msg) {
    ordenados().forEach(function (u, i) { u.orden = i + 1; });
    return api('catalogo', { catalogo: P.catalogo }).then(function () {
      if (msg) A.toast(msg);
      return A.cargarTienda().then(function () { A.pintarCatalogo(); });
    }).catch(function () { A.toast('No se guardó. Revisa tu conexión e inténtalo otra vez.'); });
  }
  function porId(id) { return P.catalogo.filter(function (u) { return u.id === id; })[0]; }
  function enlazarUniformes() {
    $('[data-nuevo]', panel).addEventListener('click', function () {
      if (ordenados().filter(function (u) { return !u.oculto; }).length >= 10) { A.toast('Ya tienes 10 uniformes en la página. Oculta o manda uno a la papelera para subir otro.'); return; }
      P.scrollLista = $('.pn', panel).scrollTop;
      P.editando = { id: 'u' + Date.now().toString(36), nombre: '', categoria: (P.config.categorias || [])[0] || '', tipo: '3d', fotos: { frente: '', espalda: '', short: '' }, colorShort: '', colorCalceta: '', colorTexto: '#111111', etiquetas: { colores: [], pais: '', equipo: '' }, nuevo: true };
      pintar(0);
    });
    $('[data-voz]', panel).addEventListener('click', narrar);
    $$('[data-mueve]', panel).forEach(function (b) {
      b.addEventListener('click', function () {
        var l = ordenados(), i = +b.getAttribute('data-i'), j = i + +b.getAttribute('data-mueve');
        var t = l[i]; l[i] = l[j]; l[j] = t; l.forEach(function (u, k) { u.orden = k + 1; });
        pintar(); guardarCatalogo('Orden guardado');
      });
    });
    $$('[data-edit]', panel).forEach(function (b) { b.addEventListener('click', function () { P.scrollLista = $('.pn', panel).scrollTop; P.editando = A.clone(porId(b.getAttribute('data-edit'))); pintar(0); }); });
    // arrastrar para ordenar: solo con mouse; en el celular el dedo sirve para bajar por la lista
    var cont = $('#pn-unis'), arr = null;
    if (!conMouse) return;
    $$('.pn-uni', cont).forEach(function (f) {
      f.addEventListener('dragstart', function (e) { arr = f; f.classList.add('arrastra'); try { e.dataTransfer.setData('text/plain', f.getAttribute('data-uid')); } catch (x) { /* nada */ } });
      f.addEventListener('dragend', function () { f.classList.remove('arrastra'); });
      f.addEventListener('dragover', function (e) { e.preventDefault(); if (!arr || arr === f) return; var r = f.getBoundingClientRect(); cont.insertBefore(arr, e.clientY < r.top + r.height / 2 ? f : f.nextSibling); });
      f.addEventListener('drop', function (e) {
        e.preventDefault();
        $$('.pn-uni', cont).forEach(function (x, k) { porId(x.getAttribute('data-uid')).orden = k + 1; });
        guardarCatalogo('Orden guardado').then(pintar);
      });
    });
  }
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
  function bolitas(campo, valor, lista) {
    return '<div class="colores">' + lista.map(function (c) { return '<button type="button" class="color' + (valor === c ? ' on' : '') + '" style="background:' + c + '" data-' + campo + '="' + c + '" aria-label="' + c + '"></button>'; }).join('') + '</div>';
  }
  function hexDe(rgb) { return '#' + rgb.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); }
  function vistaEditor() {
    var u = P.editando, cats = P.config.categorias || [], f = u.fotos, e = u.etiquetas || (u.etiquetas = { colores: [], pais: '', equipo: '' });
    function boton(lado, texto, opcional) {
      return '<label class="pn-foto' + (f[lado] ? ' lista' : '') + '"><span class="pn-foto-img">' + (f[lado] ? '<img src="' + esc(f[lado]) + '" alt="">' : '<b>+</b>') + '</span><span>' + texto + (opcional ? ' <small>(opcional)</small>' : '') + '</span><input type="file" accept="image/*" multiple data-foto="' + lado + '"></label>';
    }
    var h = '<button type="button" class="link-x" data-volver>← Uniformes</button><h3 class="pn-h">' + (u.nuevo ? 'Nuevo uniforme' : 'Editar uniforme') + '</h3>' +
      '<div class="pn-editor"><div class="pn-form">' +
      '<div class="pn-guia"><b>Cómo tomar las fotos</b><ul><li>Playera extendida en el piso, sobre un fondo de un solo color</li><li>De frente, desde arriba, con buena luz y sin flash</li><li>Puedes subir varias fotos de cada lado: usamos la mejor. Si el short o las calcetas vienen en la misma foto, los separamos solos</li><li>Quita la etiqueta que cuelga antes de tomar la foto</li></ul></div>' +
      '<div class="pn-fotos">' + boton('frente', 'Frente') + boton('espalda', 'Espalda') + boton('short', 'Short', true) + '</div>' +
      '<div id="ed-aviso"></div>' +
      '<div class="grupo"><label for="ed-nombre">Nombre</label><input class="campo" id="ed-nombre" maxlength="50" value="' + esc(u.nombre) + '" placeholder="Ej. México 2026 local"></div>' +
      '<div class="grupo"><label for="ed-cat">Carpeta</label><select class="campo" id="ed-cat"><option value="">Sin carpeta</option>' + cats.map(function (c) { return '<option' + (c === u.categoria ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
      '<div class="fila2"><div class="grupo"><label for="ed-version">Versión</label><input class="campo" id="ed-version" maxlength="30" value="' + esc(u.version || '') + '" placeholder="Ej. Local, Visitante"></div>' +
      '<div class="grupo"><span class="etq">Escudo del equipo <small>(opcional)</small></span><label class="pn-escudo"><span class="pn-escudo-img">' + (u.escudo ? '<img src="' + esc(u.escudo) + '" alt="">' : '<b>+</b>') + '</span><input type="file" accept="image/*" data-escudo></label></div></div>' +
      '<div class="fila2"><div class="grupo"><label for="ed-pais">País</label><input class="campo" id="ed-pais" maxlength="40" value="' + esc(e.pais) + '" placeholder="Ej. México"></div><div class="grupo"><label for="ed-equipo">Equipo</label><input class="campo" id="ed-equipo" maxlength="40" value="' + esc(e.equipo) + '" placeholder="Ej. Chivas"></div></div>' +
      '<div class="grupo"><span class="etq">Colores del uniforme <small>(se marcan solos con la foto; corrige si hace falta)</small></span><div class="pn-tags">' + COLORES_N.map(function (c) { return '<button type="button" class="chip' + (e.colores.indexOf(c[0]) >= 0 ? ' on' : '') + '" data-col="' + c[0] + '"><i class="pn-bolita" style="background:' + c[1] + '"></i>' + c[0] + '</button>'; }).join('') + '</div></div>' +
      '<div class="grupo"><span class="etq">Color del short</span>' + bolitas('sh', u.colorShort, TELAS) + '</div>' +
      '<div class="grupo"><span class="etq">Color de las calcetas</span>' + bolitas('ca', u.colorCalceta, TELAS) + '</div>' +
      '<div class="grupo"><span class="etq">Franja de arriba de la calceta</span><div class="colores"><button type="button" class="color sin' + (!u.colorFranja ? ' on' : '') + '" data-fr="" aria-label="Sin franja">✕</button>' + TELAS.map(function (c) { return '<button type="button" class="color' + (u.colorFranja === c ? ' on' : '') + '" style="background:' + c + '" data-fr="' + c + '" aria-label="' + c + '"></button>'; }).join('') + '</div></div>' +
      '<div class="grupo"><span class="etq">Color de nombre y número</span>' + bolitas('tx', u.colorTexto, LETRAS_P) + '</div>' +
      '<div class="grupo"><span class="etq">Número chico en el short</span><div class="chips llenar"><button type="button" class="chip' + (u.numeroShort ? ' on' : '') + '" data-ns="1">Sí</button><button type="button" class="chip' + (!u.numeroShort ? ' on' : '') + '" data-ns="0">No</button></div></div>' +
      (f.frente && !/^data:/.test(f.frente) ? '<div class="grupo"><span class="etq">Misma playera, otro color <small>(toca un color y se hace la copia)</small></span>' + bolitas('oc', '', TELAS) + '</div>' : '');
    if (!u.nuevo) {
      h += '<div class="grupo"><span class="etq">En la página</span><div class="pn-switches">' +
        '<button type="button" class="chip' + (u.destacado ? ' on' : '') + '" data-sw="destacado">★ ' + (u.destacado ? 'Destacado' : 'Destacar') + '</button>' +
        '<button type="button" class="chip' + (u.oculto ? ' on' : '') + '" data-sw="oculto">' + (u.oculto ? 'Oculto · tocar para mostrar' : 'Ocultar') + '</button>' +
        '<button type="button" class="chip pn-peligro" data-papelera>Mandar a la papelera</button></div></div>';
    }
    h += '<div class="subir"><button type="button" class="btn btn-oro btn-xl" data-publicar' + (!f.frente || /^data:/.test(f.frente + f.espalda + f.short) ? ' disabled' : '') + '>Publicar</button></div></div>' +
      '<div class="pn-prev3d"><div class="vistas pn-vistas3d"><button type="button" class="vista on" data-pv="frente">Frente</button><button type="button" class="vista" data-pv="espalda">Espalda</button></div><canvas id="ed-3d" class="ed-3d"></canvas><p class="nota">' + (f.frente ? 'Así se verá en la página, con el nombre y número de ejemplo.' : 'Sube la foto del frente para verlo en 3D.') + '</p></div></div>';
    return h;
  }
  var mEditor = null, pvVista = 'frente';
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
          return m.uniforme({ frente: im[0], espalda: im[1], short: im[2], manga: 'corta', colorShort: u.colorShort || '#f3f3f5', colorCalceta: u.colorCalceta || u.colorShort || '#f3f3f5', colorFranja: u.colorFranja || '', numeroShort: !!u.numeroShort });
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
  // una foto: se recorta, se le quita la persona si la trae, se separa el short y se mide qué tan de frente viene
  function analizar(file, lado) {
    var M = window.Motor3D;
    return A.cargarArchivo(file).then(function (im) {
      var base = A.aCanvas(im, 1400), r = { av: [], chica: Math.min(im.naturalWidth, im.naturalHeight) < 600, movida: A.nitidez(im) < 22 };
      return (lado === 'short' ? M.recortarIA(base).then(function (c) { return { playera: c }; }) : M.piezasIA(base)).then(function (pz) {
        var cut = pz.playera;
        r.sinFondo = cut.width * cut.height > base.width * base.height * 0.93;
        r.persona = lado !== 'short' && M.tienePersona(cut);
        if (r.persona) { var q = M.quitarPersona(cut); if (q) { cut = q; if (q.calceta && !pz.calceta) pz.calceta = q.calceta; } }
        var sep = lado !== 'short' && !pz.short ? M.separarConjunto(cut, r.persona) : null;
        if (sep) { cut = sep.playera; pz.short = sep.short; }
        r.cut = cut; r.short = pz.short || null; r.calceta = pz.calceta || null;
        // la mejor foto: de frente y derecha, grande, sin persona
        r.nota = lado === 'short' ? cut.width * cut.height : M.deFrente(cut) - (r.persona ? 0.04 : 0) - (r.chica ? 0.03 : 0) - (r.sinFondo ? 0.5 : 0);
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
      var r = lista[0], av = [], cut = r.cut, tareas = [];
      if (lista.length > 1) av.push('De ' + lista.length + ' fotos usamos la que viene más de frente.');
      if (r.sinFondo) av.push('No pudimos separar la prenda del fondo. Tómala sobre el piso o una sábana de un solo color.');
      if (r.chica) av.push('La foto es pequeña: en la página se verá bien, pero pide una más grande para imprimir.');
      if (r.movida) av.push('La foto parece movida. Si puedes, tómala otra vez con el celular quieto.');
      if (r.persona) av.push('La foto traía a alguien con el uniforme puesto: tomamos solo la ropa.');
      if (lado !== 'short' && r.nota < 0.86) av.push('La playera viene un poco de lado y puede verse chueca. Si tienes una foto de frente, súbela aquí.');
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
      return Promise.all(tareas).then(function () {
        A.toast('Foto lista');
        var pub = $('[data-publicar]', panel); if (pub && u.fotos.frente && !/^data:/.test(u.fotos.frente + u.fotos.espalda + u.fotos.short)) pub.disabled = false;
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
  function enlazarEditor() {
    var u = P.editando;
    $('[data-volver]', panel).addEventListener('click', function () { P.editando = null; pintar(P.scrollLista || 0); });
    $('#ed-nombre').addEventListener('input', function (e) { u.nombre = e.target.value; });
    $('#ed-cat').addEventListener('change', function (e) { u.categoria = e.target.value; });
    $('#ed-pais').addEventListener('input', function (e) { u.etiquetas.pais = e.target.value; });
    $('#ed-equipo').addEventListener('input', function (e) { u.etiquetas.equipo = e.target.value; });
    $('#ed-version').addEventListener('input', function (e) { u.version = e.target.value; });
    $$('[data-ns]', panel).forEach(function (b) { b.addEventListener('click', function () { u.numeroShort = b.getAttribute('data-ns') === '1'; $$('[data-ns]', panel).forEach(function (x) { x.classList.toggle('on', x === b); }); previsualizar(); }); });
    // el escudo: se le quita el fondo si lo trae y se sube; todos los uniformes del mismo equipo lo comparten
    var inEsc = $('[data-escudo]', panel);
    if (inEsc) inEsc.addEventListener('change', function () {
      var file = inEsc.files && inEsc.files[0]; if (!file) return;
      A.toast('Preparando el escudo…', true);
      A.cargarArchivo(file).then(function (im) { return A.cargarMotor().catch(function () {}).then(function () { return im; }); }).then(function (im) {
        var c = window.Motor3D.recortar(A.aCanvas(im, 700)), r = prepararCanvas(c);
        return A.subirConReintento(r.data, 'catalogo').then(function (url) { u.escudo = url; A.toast('Escudo listo'); var box = $('.pn-escudo-img', panel); if (box) box.innerHTML = '<img src="' + esc(url) + '" alt="">'; });
      }).catch(function () { A.toast('No se pudo subir el escudo. Inténtalo otra vez.'); });
    });
    $$('[data-col]', panel).forEach(function (b) { b.addEventListener('click', function () { var c = b.getAttribute('data-col'), l = u.etiquetas.colores, i = l.indexOf(c); if (i >= 0) l.splice(i, 1); else l.push(c); b.classList.toggle('on', i < 0); }); });
    [['sh', 'colorShort'], ['ca', 'colorCalceta'], ['fr', 'colorFranja'], ['tx', 'colorTexto']].forEach(function (par) {
      $$('[data-' + par[0] + ']', panel).forEach(function (b) { b.addEventListener('click', function () { u[par[1]] = b.getAttribute('data-' + par[0]); if (par[0] === 'tx') u.colorTextoElegido = true; $$('[data-' + par[0] + ']', panel).forEach(function (x) { x.classList.toggle('on', x === b); }); previsualizar(); }); });
    });
    $$('[data-oc]', panel).forEach(function (b) { b.addEventListener('click', function () { otroColor(b.getAttribute('data-oc')); }); });
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
    $$('[data-foto]', panel).forEach(function (inp) {
      inp.addEventListener('change', function () { if (inp.files && inp.files.length) procesarFoto(inp.files, inp.getAttribute('data-foto')); });
    });
    $('[data-publicar]', panel).addEventListener('click', function () {
      var btn = this;
      if (!u.nombre.trim()) { A.toast('Ponle un nombre al uniforme.'); $('#ed-nombre').focus(); return; }
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
        var limpio = A.clone(u); delete limpio.nuevo; delete limpio.colorTextoElegido; delete limpio.shortPropio; delete limpio.calcetaFoto;
        if (i >= 0) P.catalogo[i] = limpio; else { limpio.orden = 0; P.catalogo.unshift(limpio); }
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
        '<input class="campo pn-tag-in" data-tag-in="' + id + '" placeholder="Agregar y Enter" maxlength="40"></div>';
    }
    return '<div class="pn-form pn-datos">' +
      '<div class="grupo"><label for="dt-wa">WhatsApp de la tienda (10 dígitos)</label><input class="campo" id="dt-wa" inputmode="tel" value="' + esc(String(c.whatsapp || '').replace(/^52/, '')) + '" placeholder="998 000 0000"></div>' +
      '<div class="grupo"><label for="dt-dir">Dirección</label><input class="campo" id="dt-dir" value="' + esc(c.direccion) + '"></div>' +
      '<div class="grupo"><span class="etq">Horario</span>' + horarioHTML(c.horario) + '</div>' +
      '<div class="grupo"><label for="dt-lema">Lema</label><input class="campo" id="dt-lema" value="' + esc(c.lema) + '"></div>' +
      '<div class="grupo"><label for="dt-hist">Tu historia (la ve la gente en "Quiénes somos")</label><textarea class="campo campo-largo" id="dt-hist" maxlength="900" placeholder="Si lo dejas vacío, se muestra el texto de ejemplo.">' + esc(c.historia || '') + '</textarea></div>' +
      '<div class="fila2"><div class="grupo"><label for="dt-cal">Calificación en Google</label><input class="campo" id="dt-cal" inputmode="decimal" value="' + esc(c.calificacion || '') + '"></div><div class="grupo"><label for="dt-op">Número de opiniones</label><input class="campo" id="dt-op" inputmode="numeric" value="' + esc(c.opiniones || '') + '"></div></div>' +
      '<div class="grupo"><span class="etq">Tallas que manejas</span>' + lista('tallas', c.tallas) + '</div>' +
      '<div class="grupo"><span class="etq">Categorías del catálogo</span>' + lista('categorias', c.categorias) + '</div>' +
      '<div class="subir"><button type="button" class="btn btn-oro btn-xl" data-guardar-datos>Guardar cambios</button></div></div>';
  }
  var DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  function horarioHTML(h) {
    if (!Array.isArray(h)) h = A.clone(window.CONFIG_BASE.horario);
    P.horario = h;
    return '<div class="pn-hor" id="pn-hor">' + h.map(function (r, i) {
      return '<div class="pn-hor-fila"><div class="chips">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) {
        return '<button type="button" class="chip chip-dia' + (r.dias.indexOf(d) >= 0 ? ' on' : '') + '" data-hdia="' + d + '" data-hi="' + i + '">' + DIAS[d] + '</button>';
      }).join('') + '</div><div class="pn-hor-horas"><label>Abre <input class="campo" type="time" data-habre="' + i + '" value="' + r.abre + '"></label><label>Cierra <input class="campo" type="time" data-hcierra="' + i + '" value="' + r.cierra + '"></label>' +
      '<button type="button" class="icon-btn" data-hquita="' + i + '" aria-label="Quitar renglón">×</button></div></div>';
    }).join('') + '<button type="button" class="btn btn-linea" data-hmas>+ Otro horario</button></div>';
  }
  function leerHorario() {
    return P.horario.map(function (r, i) {
      var a = $('[data-habre="' + i + '"]', panel), c = $('[data-hcierra="' + i + '"]', panel);
      return { dias: r.dias, abre: a ? a.value : r.abre, cierra: c ? c.value : r.cierra };
    }).filter(function (r) { return r.dias.length; });
  }
  function enlazarDatos() {
    $$('[data-hdia]', panel).forEach(function (b) {
      b.addEventListener('click', function () {
        var r = P.horario[+b.getAttribute('data-hi')], d = +b.getAttribute('data-hdia'), k = r.dias.indexOf(d);
        if (k >= 0) r.dias.splice(k, 1); else r.dias.push(d);
        b.classList.toggle('on', k < 0);
      });
    });
    $$('[data-hquita]', panel).forEach(function (b) { b.addEventListener('click', function () { P.config.horario = leerHorario(); P.config.horario.splice(+b.getAttribute('data-hquita'), 1); pintar(); }); });
    var mas = $('[data-hmas]', panel); if (mas) mas.addEventListener('click', function () { P.config.horario = leerHorario().concat([{ dias: [], abre: '09:00', cierra: '18:00' }]); pintar(); });
    var c = P.config;
    $$('[data-quita-tag]', panel).forEach(function (b) { b.addEventListener('click', function () { c[b.getAttribute('data-quita-tag')].splice(+b.getAttribute('data-i'), 1); pintar(); }); });
    $$('[data-tag-in]', panel).forEach(function (inp) {
      inp.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return; e.preventDefault();
        var v = inp.value.trim(); if (!v) return;
        var k = inp.getAttribute('data-tag-in'); c[k] = (c[k] || []).concat([v]); pintar();
        var n = $('[data-tag-in="' + k + '"]', panel); if (n) n.focus();
      });
    });
    $('[data-guardar-datos]', panel).addEventListener('click', function () {
      var wa = $('#dt-wa').value.replace(/\D/g, '');
      if (wa && wa.length === 10) wa = '52' + wa;
      if (wa && wa.length !== 12) { A.toast('El WhatsApp debe tener 10 dígitos.'); $('#dt-wa').focus(); return; }
      $$('[data-tag-in]', panel).forEach(function (inp) { var v = inp.value.trim(); if (v) { var k = inp.getAttribute('data-tag-in'); c[k] = (c[k] || []).concat([v]); } });
      c.whatsapp = wa; c.direccion = $('#dt-dir').value; c.horario = leerHorario(); c.lema = $('#dt-lema').value; c.historia = $('#dt-hist').value.trim(); c.calificacion = $('#dt-cal').value.trim(); c.opiniones = $('#dt-op').value.trim();
      api('config', { config: c }).then(function () { A.toast('Datos guardados'); return A.cargarTienda(); }).then(function () { A.pintarDatos(); A.pintarCatalogo(); pintar(); })
        .catch(function () { A.toast('No se guardó. Inténtalo otra vez.'); });
    });
  }

  /* ---------- papelera ---------- */
  function vistaPapelera() {
    var l = P.catalogo.filter(function (u) { return u.borrado; });
    if (!l.length) return '<div class="pn-vacio"><h3>La papelera está vacía</h3><p>Lo que mandes aquí se puede recuperar durante 30 días. Después se borra solo.</p></div>';
    return '<div class="pn-lista">' + l.map(function (u) {
      var quedan = Math.max(0, 30 - Math.floor((Date.now() - u.borrado) / DIA));
      return '<div class="pn-fila"><span class="pn-info"><b>' + esc(u.nombre) + '</b><small>Se borra en ' + quedan + ' días</small></span><button type="button" class="btn btn-linea" data-recupera="' + esc(u.id) + '">Recuperar</button></div>';
    }).join('') + '</div>';
  }
  function enlazarPapelera() {
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
