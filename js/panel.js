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

  function pintar() {
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
    $$('[data-tab]', panel).forEach(function (b) { b.addEventListener('click', function () { P.tab = b.getAttribute('data-tab'); P.editando = null; P.detalle = null; pintar(); }); });
    ({ folios: P.detalle !== null ? enlazarDetalle : enlazarFolios, uniformes: P.editando ? enlazarEditor : enlazarUniformes, datos: enlazarDatos, papelera: enlazarPapelera })[P.tab]();
  }

  /* ---------- folios ---------- */
  function vistaFolios() {
    if (!P.folios.length) return '<div class="pn-vacio"><h3>Aún no hay folios</h3><p>Cuando un cliente arme su uniforme y toque "Cotízalo conmigo en WhatsApp", aparece aquí con su número.</p></div>';
    return '<div class="pn-lista">' + P.folios.map(function (f, i) {
      var jug = f.equipos.reduce(function (s, e) { return s + (e.jugadores || []).length; }, 0);
      var fecha = new Date(f.creado).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
      return '<div class="pn-fila"><button type="button" class="pn-ver" data-folio="' + i + '"><img src="' + esc(f.equipos[0].vistas.frente) + '" alt=""><span><b>' + esc(f.id) + '</b><small>' + esc(fecha) + ' · ' + f.equipos.length + (f.equipos.length > 1 ? ' equipos' : ' equipo') + (jug ? ' · ' + jug + ' jugadores' : '') + '</small></span></button>' +
        '<select class="campo pn-estado" data-estado="' + i + '" aria-label="Estado de ' + esc(f.id) + '">' + ESTADOS.map(function (e) { return '<option value="' + e + '"' + (f.estado === e ? ' selected' : '') + '>' + esc(T('est_' + e)) + '</option>'; }).join('') + '</select></div>';
    }).join('') + '</div>';
  }
  function cambiarEstado(f, est, sel) {
    var antes = f.estado; f.estado = est;
    api('estado', { id: f.id, estado: est }).then(function () { A.toast('Folio ' + f.id + ': ' + T('est_' + est)); })
      .catch(function () { f.estado = antes; if (sel) sel.value = antes; A.toast('No se guardó. Inténtalo otra vez.'); });
  }
  function enlazarFolios() {
    $$('[data-folio]', panel).forEach(function (b) { b.addEventListener('click', function () { P.detalle = +b.getAttribute('data-folio'); pintar(); }); });
    $$('[data-estado]', panel).forEach(function (s) { s.addEventListener('change', function () { cambiarEstado(P.folios[+s.getAttribute('data-estado')], s.value, s); }); });
  }
  function vistaDetalle() {
    var f = P.folios[P.detalle];
    return '<button type="button" class="link-x" data-volver>← Todos los folios</button>' +
      '<div class="pn-estados">' + ESTADOS.map(function (e) { return '<button type="button" class="chip' + (f.estado === e ? ' on' : '') + '" data-est="' + e + '">' + esc(T('est_' + e)) + '</button>'; }).join('') + '</div>' +
      A.folioHTML(f, true);
  }
  function enlazarDetalle() {
    var f = P.folios[P.detalle];
    $('[data-volver]', panel).addEventListener('click', function () { P.detalle = null; pintar(); });
    $$('[data-est]', panel).forEach(function (b) { b.addEventListener('click', function () { cambiarEstado(f, b.getAttribute('data-est')); $$('[data-est]', panel).forEach(function (x) { x.classList.toggle('on', x === b); }); }); });
  }

  /* ---------- uniformes ---------- */
  function ordenados() { return P.catalogo.filter(function (u) { return !u.borrado; }).sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); }); }
  function vistaUniformes() {
    var lista = ordenados();
    return '<div class="pn-acciones"><button type="button" class="btn btn-oro" data-nuevo>+ Nuevo uniforme</button><button type="button" class="btn btn-linea" data-voz>▶ Escuchar cómo subir uno</button></div>' +
      '<p class="nota">Arrastra un uniforme para cambiar su lugar, o usa las flechas. Lo oculto no se ve en la página pero no se borra.</p>' +
      '<div class="pn-lista" id="pn-unis">' + lista.map(function (u, i) {
        return '<div class="pn-fila pn-uni' + (u.oculto ? ' apagado' : '') + '" draggable="true" data-uid="' + esc(u.id) + '">' +
          '<span class="pn-asa" aria-hidden="true">⋮⋮</span><canvas width="120" height="180" data-th="' + esc(u.id) + '"></canvas>' +
          '<span class="pn-info"><b>' + esc(u.nombre) + '</b><small>' + esc(u.categoria || 'Sin categoría') + (u.oculto ? ' · Oculto' : '') + '</small></span>' +
          '<span class="pn-btns">' +
          '<button type="button" class="icon-btn" data-mueve="-1" data-i="' + i + '" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="icon-btn" data-mueve="1" data-i="' + i + '" aria-label="Bajar"' + (i === lista.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button type="button" class="icon-btn' + (u.destacado ? ' on' : '') + '" data-dest="' + esc(u.id) + '" aria-label="Destacar" title="Destacar">★</button>' +
          '<button type="button" class="icon-btn" data-ocul="' + esc(u.id) + '" aria-label="' + (u.oculto ? 'Mostrar' : 'Ocultar') + '" title="' + (u.oculto ? 'Mostrar' : 'Ocultar') + '">' + (u.oculto ? '◌' : '●') + '</button>' +
          '<button type="button" class="icon-btn" data-edit="' + esc(u.id) + '" aria-label="Editar" title="Editar">✎</button>' +
          '<button type="button" class="icon-btn" data-borra="' + esc(u.id) + '" aria-label="Mandar a la papelera" title="Papelera"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></span></div>';
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
    $('[data-nuevo]', panel).addEventListener('click', function () { P.editando = { id: 'u' + Date.now().toString(36), nombre: '', categoria: (P.config.categorias || [])[0] || '', tipo: 'foto', foto: { frente: '', espalda: '', yNombre: 0.2 }, colorTexto: '#111111', nuevo: true }; pintar(); });
    $('[data-voz]', panel).addEventListener('click', narrar);
    $$('[data-mueve]', panel).forEach(function (b) {
      b.addEventListener('click', function () {
        var l = ordenados(), i = +b.getAttribute('data-i'), j = i + +b.getAttribute('data-mueve');
        var t = l[i]; l[i] = l[j]; l[j] = t; l.forEach(function (u, k) { u.orden = k + 1; });
        pintar(); guardarCatalogo('Orden guardado');
      });
    });
    $$('[data-dest]', panel).forEach(function (b) { b.addEventListener('click', function () { var u = porId(b.getAttribute('data-dest')); u.destacado = !u.destacado; pintar(); guardarCatalogo(u.destacado ? 'Destacado' : 'Ya no está destacado'); }); });
    $$('[data-ocul]', panel).forEach(function (b) { b.addEventListener('click', function () { var u = porId(b.getAttribute('data-ocul')); u.oculto = !u.oculto; pintar(); guardarCatalogo(u.oculto ? 'Oculto en la página' : 'Visible en la página'); }); });
    $$('[data-edit]', panel).forEach(function (b) { b.addEventListener('click', function () { P.editando = A.clone(porId(b.getAttribute('data-edit'))); pintar(); }); });
    $$('[data-borra]', panel).forEach(function (b) { b.addEventListener('click', function () { var u = porId(b.getAttribute('data-borra')); u.borrado = Date.now(); pintar(); guardarCatalogo('Se fue a la papelera. Lo puedes recuperar durante 30 días.'); }); });
    // arrastrar para ordenar (escritorio)
    var cont = $('#pn-unis'), arr = null;
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
        '<div class="grupo"><label for="ed-y">Altura del nombre en la espalda</label><input type="range" id="ed-y" min="0.08" max="0.4" step="0.01" value="' + (u.foto.yNombre || 0.2) + '"></div>' +
        '<div class="grupo"><span class="etq">Color de nombre y número</span><div class="colores">' + ['#111111', '#FFFFFF', '#1F2E7A', '#FFC61A', '#D7262E'].map(function (c) { return '<button type="button" class="color' + (u.colorTexto === c ? ' on' : '') + '" style="background:' + c + '" data-tx="' + c + '" aria-label="' + c + '"></button>'; }).join('') + '</div></div>';
    } else {
      h += '<p class="nota">Este diseño lo dibujó MOON Digital. Aquí puedes cambiarle el nombre y la categoría.</p>';
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
    $('[data-volver]', panel).addEventListener('click', function () { P.editando = null; pintar(); });
    $('#ed-nombre').addEventListener('input', function (e) { u.nombre = e.target.value; });
    $('#ed-cat').addEventListener('change', function (e) { u.categoria = e.target.value; });
    var y = $('#ed-y'); if (y) y.addEventListener('input', function () { u.foto.yNombre = +y.value; previsualizar(); });
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
