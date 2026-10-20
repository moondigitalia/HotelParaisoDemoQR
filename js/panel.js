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
      P.folios = j.folios || []; P.catalogo = Array.isArray(j.catalogo) ? j.catalogo : A.clone(window.CATALOGO_BASE); P.config = j.config || {};
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
  function ordenados() { return P.catalogo.filter(function (u) { return !u.borrado; }).sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); }); }
  var conMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // Lista limpia: tocas la tarjeta y se abre el uniforme; solo quedan afuera las flechas para cambiar el orden.
  function vistaUniformes() {
    var lista = ordenados();
    return '<div class="pn-acciones"><button type="button" class="btn btn-oro" data-nuevo>+ Nuevo uniforme</button><button type="button" class="btn btn-linea" data-voz>▶ Escuchar cómo subir uno</button></div>' +
      '<p class="nota">Toca un uniforme para cambiarlo, destacarlo, ocultarlo o mandarlo a la papelera. Las flechas cambian su lugar en la página.</p>' +
      '<div class="pn-lista" id="pn-unis">' + lista.map(function (u, i) {
        var marcas = (u.destacado ? '<span class="pn-marca oro">★ Destacado</span>' : '') + (u.oculto ? '<span class="pn-marca">Oculto</span>' : '');
        return '<div class="pn-fila pn-uni' + (u.oculto ? ' apagado' : '') + '"' + (conMouse ? ' draggable="true"' : '') + ' data-uid="' + esc(u.id) + '">' +
          '<button type="button" class="pn-abrir" data-edit="' + esc(u.id) + '"><canvas width="120" height="180" data-th="' + esc(u.id) + '"></canvas>' +
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
    $$('canvas[data-th]', panel).forEach(function (c) { var u = porId(c.getAttribute('data-th')); if (u) Kit.render(c, u.tipo === 'foto' ? { foto: u.foto } : u.diseno, 'front'); });
    $('[data-nuevo]', panel).addEventListener('click', function () { P.scrollLista = $('.pn', panel).scrollTop; P.editando = { id: 'u' + Date.now().toString(36), nombre: '', categoria: (P.config.categorias || [])[0] || '', tipo: 'foto', foto: { frente: '', espalda: '', yNombre: 0.2 }, colorTexto: '#111111', nuevo: true }; pintar(0); });
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

  /* editor de uniforme con fotos del dueño */
  function vistaEditor() {
    var u = P.editando, cats = P.config.categorias || [];
    var esFoto = u.tipo === 'foto';
    var h = '<button type="button" class="link-x" data-volver>← Uniformes</button><h3 class="pn-h">' + (u.nuevo ? 'Nuevo uniforme' : 'Editar uniforme') + '</h3>' +
      '<div class="pn-editor"><div class="pn-form">' +
      '<div class="grupo"><label for="ed-nombre">Nombre</label><input class="campo" id="ed-nombre" maxlength="50" value="' + esc(u.nombre) + '" placeholder="Ej. México 2026"></div>' +
      '<div class="grupo"><label for="ed-cat">Categoría</label><select class="campo" id="ed-cat">' + cats.map(function (c) { return '<option' + (c === u.categoria ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>';
    if (esFoto) {
      h += '<div class="pn-guia"><b>Cómo tomar las fotos</b><ul><li>Playera extendida en el suelo</li><li>De frente, desde arriba</li><li>Con buena luz, sin flash</li><li>Una foto del frente y una de la espalda</li></ul></div>' +
        '<div class="subir"><span class="btn btn-oro archivo">' + (u.foto.frente ? 'Cambiar frente' : 'Foto del frente') + '<input type="file" accept="image/*" data-foto="frente"></span>' +
        '<span class="btn btn-oro archivo">' + (u.foto.espalda ? 'Cambiar espalda' : 'Foto de la espalda') + '<input type="file" accept="image/*" data-foto="espalda"></span></div>' +
        '<div id="ed-aviso"></div>' +
        '<div class="grupo fila-tam"><span class="etq">Altura del nombre en la espalda</span><div class="tam-btns"><button type="button" class="icon-btn" data-ny="-1" aria-label="Más arriba">↑</button><button type="button" class="icon-btn" data-ny="1" aria-label="Más abajo">↓</button></div></div>' +
        '<div class="grupo"><span class="etq">Color de nombre y número</span><div class="colores">' + ['#111111', '#FFFFFF', '#1F2E7A', '#FFC61A', '#D7262E'].map(function (c) { return '<button type="button" class="color' + (u.colorTexto === c ? ' on' : '') + '" style="background:' + c + '" data-tx="' + c + '" aria-label="' + c + '"></button>'; }).join('') + '</div></div>';
    } else {
      h += '<p class="nota">Este diseño lo dibujó MOON Digital. Aquí puedes cambiarle el nombre y la categoría.</p>';
    }
    if (!u.nuevo) {
      h += '<div class="grupo"><span class="etq">En la página</span><div class="pn-switches">' +
        '<button type="button" class="chip' + (u.destacado ? ' on' : '') + '" data-sw="destacado">★ ' + (u.destacado ? 'Destacado' : 'Destacar') + '</button>' +
        '<button type="button" class="chip' + (u.oculto ? ' on' : '') + '" data-sw="oculto">' + (u.oculto ? 'Oculto · tocar para mostrar' : 'Ocultar') + '</button>' +
        '<button type="button" class="chip pn-peligro" data-papelera>Mandar a la papelera</button></div></div>';
    }
    h += '<div class="subir"><button type="button" class="btn btn-oro btn-xl" data-publicar' + (esFoto && !(u.foto.frente && u.foto.espalda) ? ' disabled' : '') + '>Publicar</button></div></div>' +
      '<div class="pn-prev"><figure><canvas width="500" height="750" id="ed-f"></canvas><figcaption>Frente</figcaption></figure><figure><canvas width="500" height="750" id="ed-b"></canvas><figcaption>Espalda con nombre y número de ejemplo</figcaption></figure></div></div>';
    return h;
  }
  function previsualizar() {
    var u = P.editando;
    var d = u.tipo === 'foto' ? { foto: u.foto, nombre: 'JUANPY', numero: '69', colorTexto: u.colorTexto } : Object.assign({}, u.diseno, { nombre: 'JUANPY', numero: '69' });
    var f = $('#ed-f'), b = $('#ed-b'); if (f) Kit.render(f, d, 'front'); if (b) Kit.render(b, d, 'back');
  }
  function enlazarEditor() {
    var u = P.editando;
    $('[data-volver]', panel).addEventListener('click', function () { P.editando = null; pintar(P.scrollLista || 0); });
    $('#ed-nombre').addEventListener('input', function (e) { u.nombre = e.target.value; });
    $('#ed-cat').addEventListener('change', function (e) { u.categoria = e.target.value; });
    $$('[data-ny]', panel).forEach(function (b) { b.addEventListener('click', function () { u.foto.yNombre = Math.max(0.08, Math.min(0.4, (u.foto.yNombre || 0.2) + 0.02 * +b.getAttribute('data-ny'))); previsualizar(); }); });
    $$('[data-sw]', panel).forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-sw'), real = porId(u.id); if (!real) return;
        real[k] = !real[k]; u[k] = real[k];
        pintar(); guardarCatalogo(k === 'destacado' ? (real[k] ? 'Destacado en la página' : 'Ya no está destacado') : (real[k] ? 'Oculto en la página' : 'Visible en la página'));
      });
    });
    var pap = $('[data-papelera]', panel);
    if (pap) pap.addEventListener('click', function () { var real = porId(u.id); if (!real) return; real.borrado = Date.now(); P.editando = null; pintar(P.scrollLista || 0); guardarCatalogo('Se fue a la papelera. Lo puedes recuperar durante 30 días.'); });
    $$('[data-tx]', panel).forEach(function (b) { b.addEventListener('click', function () { u.colorTexto = b.getAttribute('data-tx'); $$('[data-tx]', panel).forEach(function (x) { x.classList.toggle('on', x === b); }); previsualizar(); }); });
    $$('[data-foto]', panel).forEach(function (inp) {
      inp.addEventListener('change', function () {
        var file = inp.files && inp.files[0]; if (!file) return;
        var lado = inp.getAttribute('data-foto');
        A.toast('Subiendo foto…');
        A.cargarArchivo(file).then(function (im) {
          var av = [], w = im.naturalWidth, h = im.naturalHeight;
          if (Math.min(w, h) < 900) av.push('La foto es pequeña: en la página se verá bien, pero pide una más grande para imprimir.');
          if (A.nitidez(im) < 22) av.push('La foto parece movida. Si puedes, tómala otra vez con el celular quieto.');
          if (w > h * 1.25) av.push('La foto salió acostada. Tómala vertical para que la playera se vea completa.');
          var c = A.aCanvas(im, 2000), data = c.toDataURL('image/jpeg', 0.9);
          u.foto[lado] = data; previsualizar();
          $('#ed-aviso').innerHTML = av.length ? '<div class="aviso">' + av.map(function (a) { return '<p>' + esc(a) + '</p>'; }).join('') + '</div>' : '';
          return A.subirConReintento(data, 'catalogo').then(function (url) {
            u.foto[lado] = url; A.toast('Foto lista');
            var pub = $('[data-publicar]', panel); if (pub && u.foto.frente && u.foto.espalda && !/^data:/.test(u.foto.frente + u.foto.espalda)) pub.disabled = false;
          });
        }).catch(function () { A.toast('No se pudo subir la foto. Inténtalo otra vez.'); });
      });
    });
    $('[data-publicar]', panel).addEventListener('click', function () {
      if (!u.nombre.trim()) { A.toast('Ponle un nombre al uniforme.'); $('#ed-nombre').focus(); return; }
      var i = -1; P.catalogo.forEach(function (x, k) { if (x.id === u.id) i = k; });
      var limpio = A.clone(u); delete limpio.nuevo;
      if (i >= 0) P.catalogo[i] = limpio; else { limpio.orden = 0; P.catalogo.unshift(limpio); }
      P.editando = null; pintar();
      guardarCatalogo('Publicado en la página');
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
  var marca = $('#marca'), reloj = 0;
  function soltarMarca() { clearTimeout(reloj); marca.classList.remove('cargando'); }
  marca.addEventListener('pointerdown', function (e) {
    if (e.button && e.button !== 0) return;
    marca.classList.add('cargando');
    reloj = setTimeout(function () { soltarMarca(); if (navigator.vibrate) { try { navigator.vibrate(30); } catch (x) { /* nada */ } } abrir(); }, 2000);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { marca.addEventListener(ev, soltarMarca); });
  marca.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  marca.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  if (location.hash === '#panel') abrir();
  window.addEventListener('hashchange', function () { if (location.hash === '#panel') abrir(); });
})();
