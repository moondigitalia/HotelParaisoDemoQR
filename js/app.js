(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem('msport:' + k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('msport:' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };

  /* ---------- fondo congelado: mientras hay algo abierto encima, la página de atrás no se mueve (también en iPhone) ---------- */
  var FIJAR = (function () {
    var n = 0, y = 0;
    return {
      on: function () {
        if (n++) return;
        y = window.scrollY;
        var b = document.body.style;
        b.position = 'fixed'; b.top = -y + 'px'; b.left = '0'; b.right = '0'; b.width = '100%'; b.overflow = 'hidden';
      },
      off: function () {
        if (!n) return;
        if (--n) return;
        var b = document.body.style;
        b.position = ''; b.top = ''; b.left = ''; b.right = ''; b.width = ''; b.overflow = '';
        window.scrollTo({ top: y, behavior: 'instant' });
      }
    };
  })();
  window.FIJAR = FIJAR;
  // en iPhone (sobre todo los viejos) arrastrar al llegar al final de una ventana encimada mueve la página de atrás:
  // solo se deja arrastrar lo que de verdad tiene para dónde moverse
  (function () {
    var y0 = 0;
    function rodante(el, tope) {
      for (; el && el !== tope.parentNode; el = el.parentNode) {
        if (el.nodeType !== 1) continue;
        var o = getComputedStyle(el).overflowY;
        if ((o === 'auto' || o === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el;
      }
      return null;
    }
    document.addEventListener('touchstart', function (e) { if (e.touches.length === 1) y0 = e.touches[0].clientY; }, { passive: true });
    // pellizcar para hacer zoom (iPhone ignora user-scalable=no): con algo abierto encima no se hace zoom a la pantalla
    ['gesturestart', 'gesturechange'].forEach(function (ev) { document.addEventListener(ev, function (e) { if (document.body.style.position) e.preventDefault(); }, { passive: false }); });
    document.addEventListener('touchmove', function (e) {
      if (!document.body.style.position || e.touches.length !== 1) return;   // solo cuando hay algo abierto encima
      var capa = e.target.closest && e.target.closest('.panel,.probador,.capa,.fiesta,.pn-borrador'); if (!capa) { e.preventDefault(); return; }
      if (e.target.closest('input[type=range],canvas')) return;
      var r = rodante(e.target, capa), dy = e.touches[0].clientY - y0;
      if (!r) { e.preventDefault(); return; }
      if ((dy > 0 && r.scrollTop <= 0) || (dy < 0 && r.scrollTop + r.clientHeight >= r.scrollHeight - 1)) e.preventDefault();
    }, { passive: false });
  })();
  // al recargar, la página empieza siempre hasta arriba
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------- idioma ---------- */
  var LANGS = Object.keys(window.I18N);
  // el idioma lo decide el celular o la computadora de cada persona
  var lang = ((navigator.languages && navigator.languages[0]) || navigator.language || 'es').slice(0, 2).toLowerCase();
  if (LANGS.indexOf(lang) < 0) lang = 'es';
  var TXT = {};   // los textos que el dueño cambió en su panel (en español; en otros idiomas se queda la traducción de siempre)
  function T(k) { return (lang === 'es' && TXT[k]) || (window.I18N[lang] && window.I18N[lang][k]) || window.I18N.es[k] || k; }
  function aplicarIdioma() {
    document.documentElement.lang = lang;
    $$('[data-t]').forEach(function (el) { el.textContent = T(el.getAttribute('data-t')); });
    if (typeof moverPulgar === 'function') setTimeout(moverPulgar, 30);
    pintarTablero(); pintarCatalogo(); pintarDatos();
  }

  /* ---------- logo M Sport en SVG ---------- */
  function archD(cx) {
    return 'M' + (cx - 18) + ' 92C' + (cx - 17) + ' 52 ' + (cx - 9) + ' 22 ' + cx + ' 9C' + (cx + 9) + ' 22 ' + (cx + 17) + ' 52 ' + (cx + 18) + ' 92L' + (cx + 9) + ' 92C' + (cx + 8) + ' 62 ' + (cx + 4) + ' 40 ' + cx + ' 31C' + (cx - 4) + ' 40 ' + (cx - 8) + ' 62 ' + (cx - 9) + ' 92Z';
  }
  function logoSVG(fondo, linea) {
    fondo = fondo || '#1F2E7A'; linea = linea || '#FFFFFF';
    return '<svg viewBox="0 0 136 132" role="img" aria-label="M Sport"><rect x="4" y="4" width="112" height="112" rx="6" fill="' + fondo + '"/>' +
      '<rect x="11" y="11" width="98" height="98" rx="3" fill="none" stroke="' + linea + '" stroke-width="3"/>' +
      '<g transform="translate(14 13) scale(.92)"><path d="' + archD(33) + archD(67) + '" fill="' + linea + '"/>' +
      '<path d="M26 50l7 6-3 10M60 44l6 9-4 8M38 70l-5 8" fill="none" stroke="' + fondo + '" stroke-width="2.4" stroke-linecap="round"/></g>' +
      '<text x="66" y="126" font-family="Yellowtail, cursive" font-size="28" fill="' + linea + '" stroke="' + fondo + '" stroke-width="5" paint-order="stroke" transform="rotate(-8 70 120)">Sport</text></svg>';
  }

  /* ---------- estado ---------- */
  var TIENDA = { config: clone(window.CONFIG_BASE), catalogo: clone(window.CATALOGO_BASE) };
  var BASE_D = { manga: 'corta', taco: 'negro', nombre: '', numero: '', colorTexto: '' };
  var S = {
    modo: null, paso: 0, vista: 'frente', baseId: null,
    d: clone(BASE_D),
    equipos: [], esEquipo: false, nombreEquipo: '', jugadores: [], tallaUno: '',
    filtro: { cat: 'todos', q: '' }
  };
  var PASOS = ['diseno', 'tacos', 'dorsal', 'equipo', 'listo'];
  function pasos() { return PASOS; }
  // hasta 10 equipos (cada uno con sus versiones: local, visitante…)
  function catalogoVisible() {
    var eqs = {}, n = 0;
    return (TIENDA.catalogo || []).filter(function (u) { return !u.oculto && !u.borrado && u.tipo === '3d'; }).sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); })
      .filter(function (u) { var k = String((u.etiquetas && u.etiquetas.equipo) || u.id).trim().toLowerCase(); if (!eqs[k]) { if (n >= (+TIENDA.config.maxEquipos || 10)) return false; eqs[k] = 1; n++; } return true; });
  }
  function uniformeActual() { var l = catalogoVisible(); return l.filter(function (u) { return u.id === S.baseId; })[0] || l[0] || null; }
  function usarBase(u) {
    S.baseId = u.id;
    if (u.manga === 'larga' || u.manga === 'corta') S.d.manga = u.manga;   // el uniforme viene así de fábrica (el cliente lo puede cambiar)
    if (!S.d.colorTexto || S.d.colorAuto) { S.d.colorTexto = u.colorTexto || '#111111'; S.d.colorAuto = true; }
  }

  /* ---------- filtros inteligentes: carpeta + lo que escribas (color, país, equipo) ---------- */
  var COLORES_NOMBRE = {
    rojo: ['rojo', 'roja', 'red', 'rouge', 'vermelho', 'vino', 'guinda'], azul: ['azul', 'blue', 'bleu', 'marino'], celeste: ['celeste', 'cielo', 'sky', 'bleu ciel'],
    blanco: ['blanco', 'blanca', 'white', 'blanc', 'branco'], negro: ['negro', 'negra', 'black', 'noir', 'preto'], amarillo: ['amarillo', 'yellow', 'jaune', 'amarelo'],
    verde: ['verde', 'green', 'vert'], morado: ['morado', 'lila', 'purple', 'violeta', 'violet', 'roxo'], naranja: ['naranja', 'orange', 'laranja'],
    rosa: ['rosa', 'pink', 'rose'], gris: ['gris', 'gray', 'grey', 'cinza'], dorado: ['dorado', 'oro', 'gold', 'or', 'dourado']
  };
  function normal(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  function textoBuscable(u) {
    var e = u.etiquetas || {}, partes = [u.nombre, u.categoria, e.pais, e.equipo, e.otros, u.version];
    (e.colores || []).forEach(function (c) { partes = partes.concat(COLORES_NOMBRE[c] || [c]); });
    return normal(partes.join(' '));
  }
  function filtrar(lista) {
    var f = S.filtro, palabras = normal(f.q).split(/\s+/).filter(Boolean);
    return lista.filter(function (u) {
      if (f.cat !== 'todos' && u.categoria !== f.cat) return false;
      var t = textoBuscable(u);
      return palabras.every(function (p) { return t.indexOf(p) >= 0; });
    });
  }
  function carpetas() {
    var orden = TIENDA.config.categorias || [], usadas = {};
    catalogoVisible().forEach(function (u) { if (u.categoria) usadas[u.categoria] = 1; });
    return orden.filter(function (c) { return usadas[c]; }).concat(Object.keys(usadas).filter(function (c) { return orden.indexOf(c) < 0; }));
  }
  function filtrosHTML(idPre) {
    var cs = carpetas();
    return '<div class="buscar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>' +
      '<input class="campo" type="search" id="' + idPre + '-buscar" autocomplete="off" enterkeyhint="search" placeholder="' + esc(T('buscar_ph')) + '" value="' + esc(S.filtro.q) + '" aria-label="' + esc(T('buscar_ph')) + '"></div>' +
      (cs.length ? '<div class="chips llenar carpetas">' + ['todos'].concat(cs).map(function (c) { return '<button type="button" class="chip' + (S.filtro.cat === c ? ' on' : '') + '" data-carpeta="' + esc(c) + '">' + esc(c === 'todos' ? T('todos') : c) + '</button>'; }).join('') + '</div>' : '');
  }
  function enlazarFiltros(raiz, idPre, alCambiar) {
    var inp = $('#' + idPre + '-buscar', raiz);
    if (inp) inp.addEventListener('input', function () { S.filtro.q = inp.value; alCambiar(true); });
    $$('[data-carpeta]', raiz).forEach(function (b) { b.addEventListener('click', function () { S.filtro.cat = b.getAttribute('data-carpeta'); $$('[data-carpeta]', raiz).forEach(function (x) { x.classList.toggle('on', x === b); }); alCambiar(false); }); });
  }

  /* ---------- el uniforme en 3D ----------
     El motor (Three.js propio) se carga solo cuando hace falta. Mientras carga, y en teléfonos sin 3D,
     se ve la foto de estudio que la página guardó al publicar el uniforme. */
  var lienzo = $('#lienzo3d'), respaldo = $('#lienzo-respaldo'), motor = null, motorP = null, sin3D = false;
  // el 3D no compite con la entrada ni con la primera pintura: arranca al terminar la entrada, al abrir el probador,
  // o cuando el teléfono queda libre. Mientras, se ve la foto de estudio del uniforme.
  var abrir3D, puerta3D = new Promise(function (ok) { abrir3D = ok; });
  window.addEventListener('load', function () { setTimeout(function () { (window.requestIdleCallback || setTimeout)(function () { abrir3D(); }, { timeout: 2500 }); }, document.getElementById('intro') ? 3600 : 300); });
  function cargarMotorYa() { abrir3D(); return cargarMotor(); }
  function cargarMotor() {
    if (motorP) return motorP;
    motorP = puerta3D.then(function () { return new Promise(function (ok, no) {
      if (window.Motor3D) return ok();
      var s = document.createElement('script'); s.src = '/js/motor3d.js?v=' + (window.VERSION || '1'); s.onload = ok; s.onerror = no; document.head.appendChild(s);
    }); }).then(function () { return document.fonts && document.fonts.load ? document.fonts.load('700 100px "Saira Extra Condensed"').catch(function () {}) : null; })
      .then(function () { return window.Motor3D.crear(lienzo); })
      .then(function (m) { motor = m; if (m.deslizable) m.deslizable(function (v) { enfocar('cuerpo'); if (v !== S.vista) marcarVista(v); }); return m; })
      .catch(function (e) { sin3D = true; throw e; });
    return motorP;
  }
  var imgCache = {};
  function imagen(url) {
    if (!url) return Promise.resolve(null);
    if (!imgCache[url]) imgCache[url] = new Promise(function (ok, no) { var i = new Image(); i.crossOrigin = 'anonymous'; i.decoding = 'async'; i.onload = function () { ok(i); }; i.onerror = no; i.src = url; });
    return imgCache[url];
  }
  var cola = Promise.resolve(), puesto = null;
  function config(u, d) { return { frente: u.fotos.frente, espalda: u.fotos.espalda, short: u.fotos.short, manga: d.manga, colorShort: u.colorShort, colorCalceta: u.colorCalceta, colorFranja: u.colorFranja || '', numeroShort: !!u.numeroShort, torso: u.torso || null, taco: d.taco, nombre: d.nombre, numero: d.numero, color: d.colorTexto || u.colorTexto || '#111111' }; }
  function aplicar(m, c) {
    return Promise.all([imagen(c.frente), imagen(c.espalda), imagen(c.short)]).then(function (im) {
      var clave = c.frente + '|' + c.espalda + '|' + c.short + '|' + c.manga;
      var p = clave !== puesto ? m.uniforme({ frente: im[0], espalda: im[1], short: im[2], manga: c.manga, colorShort: c.colorShort, colorCalceta: c.colorCalceta, colorFranja: c.colorFranja, numeroShort: c.numeroShort, torso: c.torso }) : Promise.resolve();
      puesto = clave;
      return p.then(function () { return m.taco(c.taco); }).then(function () { m.dorsal({ nombre: c.nombre, numero: c.numero, color: c.color, sello: true }); });
    });
  }
  function dibujar() {
    var u = uniformeActual(); if (!u) return;
    // mientras llega el 3D: el uniforme recortado (sin estadio) sobre el mismo estadio, en el mismo lugar y tamaño que el 3D
    if (respaldo && !motor) { if (!u.silueta) respaldo.removeAttribute('src'); else if (respaldo.getAttribute('src') !== u.silueta) respaldo.src = u.silueta; }
    var c = config(u, S.d);
    cola = cola.then(function () { return cargarMotor(); }).then(function (m) { return aplicar(m, c); }).then(function () {
      if (respaldo) respaldo.classList.add('fuera'); lienzo.classList.add('listo');
    }).catch(function () { /* sin 3D: se queda la foto de estudio */ });
    return cola;
  }
  function moverPulgar() {
    var b = $('.vista.on'), p = $('#vistas-pulgar');
    if (!b || !p) return;
    p.style.width = b.offsetWidth + 'px';
    p.style.transform = 'translateX(' + b.offsetLeft + 'px)';
  }
  window.addEventListener('resize', function () { moverPulgar(); if (motor) motor.redibujar(); });
  function enfocar(que) { if (motor && motor.enfoque) motor.enfoque(que); }
  function marcarVista(v) {
    S.vista = v;
    $$('.vista').forEach(function (b) { var on = b.getAttribute('data-vista') === v; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    moverPulgar();
  }
  function cambiarVista(v) {
    enfocar('cuerpo');
    if (v === S.vista) return;
    marcarVista(v);
    if (motor) motor.vista(v);
  }
  $$('.vista').forEach(function (b) { b.addEventListener('click', function () { cambiarVista(b.getAttribute('data-vista')); }); });
  function verVistaDe(paso) { cambiarVista(paso === 'dorsal' ? 'espalda' : 'frente'); }

  /* ---------- imágenes del cliente ---------- */
  function cargarArchivo(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error('img')); };
      im.src = url;
    });
  }
  function aCanvas(im, max) {
    var s = Math.min(1, max / Math.max(im.naturalWidth || im.width, im.naturalHeight || im.height));
    var c = document.createElement('canvas');
    c.width = Math.round((im.naturalWidth || im.width) * s); c.height = Math.round((im.naturalHeight || im.height) * s);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return c;
  }
  function nitidez(im) {
    // variación de bordes en una versión chica en grises: si es muy baja, la foto salió movida
    var c = aCanvas(im, 320), g = c.getContext('2d'), w = c.width, h = c.height;
    var px = g.getImageData(0, 0, w, h).data, gris = new Float32Array(w * h), i;
    for (i = 0; i < w * h; i++) gris[i] = px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11;
    var suma = 0, suma2 = 0, n = 0;
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) {
      var k = y * w + x, l = 4 * gris[k] - gris[k - 1] - gris[k + 1] - gris[k - w] - gris[k + w];
      suma += l; suma2 += l * l; n++;
    }
    var m = suma / n; return suma2 / n - m * m;
  }
  function subir(dataURL, carpeta) {
    return fetch('/api/subir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: dataURL, carpeta: carpeta || 'subidas' }) })
      .then(function (r) { if (!r.ok) throw new Error('subir ' + r.status); return r.json(); })
      .then(function (j) { return j.url; });
  }
  function subirConReintento(dataURL, carpeta) {
    var intento = 0;
    function uno() { return subir(dataURL, carpeta).catch(function (e) { if (++intento < 3) return new Promise(function (r) { setTimeout(r, 900 * intento); }).then(uno); throw e; }); }
    return uno();
  }
  /* ---------- tablero de pasos ----------
     Reglas: (1) cada paso cabe completo en el celular más chico; (2) "Atrás" y "Siguiente" viven en una barra fija;
     (3) las rejillas se acomodan con cuentas, nunca queda un elemento solo en un renglón;
     (4) solo el catálogo y la lista de jugadores pueden crecer, y entonces se avisa que hay más abajo. */
  var tablero = $('#tablero');
  var COLORES = ['#FFFFFF', '#111111', '#1F2E7A', '#FFC61A', '#D7262E', '#14804A', '#6B2FB3', '#8B7BE0', '#FF8A3D', '#7FD6E6'];
  var LETRAS = ['#111111', '#FFFFFF', '#1F2E7A', '#FFC61A', '#D7262E'];
  function chipsColor(nombre, valor, lista, conNinguno) {
    var h = '<div class="colores rejilla" data-tam="34" role="radiogroup">';
    if (conNinguno) h += '<button type="button" class="color ninguno' + (!valor ? ' on' : '') + '" data-color="" data-campo="' + nombre + '" aria-label="' + esc(T('ninguno')) + '"></button>';
    lista.forEach(function (c) { h += '<button type="button" class="color' + (valor === c ? ' on' : '') + '" style="background:' + c + '" data-color="' + c + '" data-campo="' + nombre + '" aria-label="' + c + '"></button>'; });
    return h + '</div>';
  }
  function icono(n) {
    var I = {
      lista: '<svg viewBox="0 0 24 24" fill="none" stroke="#121633" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
      lapiz: '<svg viewBox="0 0 24 24" fill="none" stroke="#121633" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4Z"/><path d="M14 6l3 3"/></svg>',
      frente: '<svg viewBox="0 0 24 24" fill="none" stroke="#121633" stroke-width="2.4"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>',
      sol: '<svg viewBox="0 0 24 24" fill="none" stroke="#121633" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>',
      estira: '<svg viewBox="0 0 24 24" fill="none" stroke="#121633" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3"/></svg>',
      mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
      sube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
      abajo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
    };
    return I[n] || '';
  }

  /* Acomodo con cuentas: renglones parejos, sin elementos solos */
  function acomodar(raiz) {
    $$('.rejilla', raiz).forEach(function (g) {
      var tam = +g.getAttribute('data-tam') || 34, gap = 10, n = g.children.length;
      if (!n) return;
      var ancho = g.clientWidth || g.parentNode.clientWidth;
      var max = Math.max(1, Math.floor((ancho + gap) / (tam + gap)));
      var filas = Math.ceil(n / max), cols = Math.ceil(n / filas);
      g.style.gridTemplateColumns = 'repeat(' + cols + ', ' + tam + 'px)';
    });
    $$('.pares', raiz).forEach(function (g) {
      // tarjetas de dos en dos: si sobra una, ocupa el renglón completo
      var kids = Array.prototype.slice.call(g.children);
      kids.forEach(function (k, i) { k.style.gridColumn = (kids.length % 2 && i === kids.length - 1) ? '1 / -1' : ''; });
    });
    $$('.chips.llenar', raiz).forEach(function (g) {
      // botones de texto: todos del mismo ancho y renglones parejos; si el texto es largo, baja a dos líneas dentro del botón
      var n = g.children.length, gap = 8, ancho = g.clientWidth; if (!n) return;
      var cols = n;
      while (cols > 1 && (ancho - gap * (cols - 1)) / cols < 92) cols--;
      var filas = Math.ceil(n / cols); cols = Math.ceil(n / filas);
      g.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
    });
    var dg = $('#mini-grid', raiz); if (dg) acomodarDisenos(dg);
  }
  function acomodarDisenos(g) {
    // tarjetas de ~110 px con renglones parejos; si son muchas, el paso se desliza y avisa que hay más
    var n = g.children.length; if (!n) return;
    // los escudos son círculos chicos: caben 5 por renglón en el celular y todos los equipos se ven sin deslizar
    var objetivo = g.querySelector('.con-escudo') ? 60 : 104;
    var ancho = g.clientWidth, gap = 8, max = Math.max(2, Math.floor((ancho + gap) / (objetivo + gap)));
    var filas = Math.ceil(n / max), cols = Math.min(max, Math.ceil(n / filas));
    var w = Math.min(objetivo < 100 ? 92 : 150, Math.floor((ancho - gap * (cols - 1)) / cols));
    g.style.gridTemplateColumns = 'repeat(' + cols + ', ' + w + 'px)';
  }
  window.addEventListener('resize', function () { if (!probador.hidden) acomodar(tablero); });

  function pintarTablero(dir) {
    if (!tablero) return;
    if (!S.modo || probador.hidden) { tablero.classList.remove('en-pasos'); tablero.innerHTML = vistaInicio(); enlazarInicio(); return; }
    var lista = pasos();
    S.paso = Math.max(0, Math.min(lista.length - 1, S.paso));
    var id = lista[S.paso];
    probador.setAttribute('data-paso', id);   // el uniforme se ve más grande en los pasos de elegir; en los de escribir cede lugar
    if (!tablero.classList.contains('en-pasos')) {
      tablero.classList.add('en-pasos');
      tablero.innerHTML = '<div class="paso-vista" id="paso-vista"></div>' +
        '<div class="paso-barra" id="paso-barra"><button type="button" class="btn btn-linea barra-atras" data-nav="atras">' + esc(T('atras')) + '</button>' +
        '<span class="puntos" id="puntos" aria-hidden="true"></span>' +
        '<button type="button" class="btn btn-oro barra-sig" data-nav="siguiente" id="barra-sig">' + esc(T('siguiente')) + '</button></div>';
      $$('[data-nav]', tablero).forEach(function (b) {
        b.addEventListener('click', function () {
          var n = b.getAttribute('data-nav');
          if (probador.classList.contains('grande')) verGrande(false);
          if (n === 'siguiente') { if (pasos()[S.paso] === 'listo') { prepararSonido(); cotizar(); } else irA(S.paso + 1); }
          else if (n === 'atras') irA(S.paso - 1);
        });
      });
    }
    // contenido del paso
    var vista = $('#paso-vista');
    var cab = '<div class="paso-cab"><span class="paso-num">' + esc(T('paso')) + ' ' + (S.paso + 1) + ' ' + esc(T('de')) + ' ' + lista.length + '</span>' + (CABEZAS[id] ? CABEZAS[id]() : '') + '</div>';
    vista.innerHTML = cab + '<div class="mas-wrap"><div class="paso-cuerpo" id="paso-cuerpo" data-paso="' + id + '">' + (VISTAS[id] ? VISTAS[id]() : '') + '</div><span class="mas-abajo" aria-hidden="true">' + icono('abajo') + esc(T('ver_mas')) + '</span></div>';
    if (dir) { vista.classList.remove('entra-der', 'entra-izq'); void vista.offsetWidth; vista.classList.add(dir > 0 ? 'entra-der' : 'entra-izq'); }
    // barra fija
    var atras = $('.barra-atras', tablero), sig = $('#barra-sig');
    atras.classList.toggle('oculto', S.paso === 0);
    var esListo = id === 'listo';
    sig.textContent = esListo ? T('cotizar_corto') : T('siguiente');
    $('#paso-barra').classList.toggle('final', esListo);
    sig.id = 'barra-sig';
    sig.classList.toggle('btn-wa', esListo); sig.classList.toggle('btn-oro', !esListo);
    if (esListo) sig.setAttribute('data-cotizar', ''); else sig.removeAttribute('data-cotizar');
    var pts = $('#puntos');
    if (pts.children.length !== lista.length) pts.innerHTML = lista.map(function () { return '<i></i>'; }).join('');
    $$('i', pts).forEach(function (el, i) { el.className = i === S.paso ? 'on' : i < S.paso ? 'hecho' : ''; });
    enlazarComunes();
    if (ENLACES[id]) ENLACES[id]();
    acomodar(vista);
    ajustarEscenario();
    vigilarMas();
  }
  /* En celular, los pasos de elegir y escribir nunca llevan scroll: el uniforme toma justo el alto que sobra
     (si el navegador come pantalla con pestañas o barras, el uniforme se achica un poco, las opciones no). */
  var FIJOS = { tacos: 1, dorsal: 1, listo: 1 };
  // El alto lo reparte la pantalla sola (ver app.css: el uniforme toma todo lo que el paso no ocupa). Aquí solo se
  // suelta el alto fijo que deja "ver en grande" al regresar.
  function ajustarEscenario() {
    if (!escenario || probador.classList.contains('grande')) return;
    escenario.style.height = '';
    if (motor) motor.redibujar();
    encajar();
  }
  // Si en algún celular (Safari mide distinto) el paso aún no cabe con el uniforme ya en su mínimo, el paso se
  // encoge parejo lo justo para caber: nunca hay que recorrer nada ni rebota la pantalla.
  // Además se vuelve a medir cada vez que algo del paso cambia de tamaño después de pintarse (en Safari los escudos y las
  // letras terminan de cargar después y el paso crecía cuando ya se había medido: de ahí salía el scroll).
  var vigiaPaso = null, pasoVigilado = null;
  function medirPaso(c) {
    var alto = c.clientHeight, todo = c.scrollHeight, hijos = Array.prototype.slice.call(c.children);
    if (todo > alto + 1 && alto > 40) {
      var k0 = parseFloat(c.getAttribute('data-k')) || 1, k = Math.max(0.6, k0 * (alto - 2) / todo);
      c.setAttribute('data-k', k); hijos.forEach(function (h) { h.style.zoom = k; });
    }
    c.classList.toggle('cabe', c.scrollHeight <= c.clientHeight + 1);
  }
  function encajar() {
    var c = $('#paso-cuerpo'); if (!c || probador.hidden || probador.classList.contains('grande')) return;
    c.removeAttribute('data-k'); Array.prototype.forEach.call(c.children, function (h) { h.style.zoom = ''; });
    requestAnimationFrame(function () { medirPaso(c); });
    if (pasoVigilado !== c && typeof ResizeObserver === 'function') {
      if (vigiaPaso) vigiaPaso.disconnect();
      var pend = false;
      vigiaPaso = new ResizeObserver(function () { if (pend) return; pend = true; requestAnimationFrame(function () { pend = false; if (document.body.contains(c)) medirPaso(c); }); });
      vigiaPaso.observe(c); Array.prototype.forEach.call(c.children, function (h) { vigiaPaso.observe(h); });
      pasoVigilado = c;
    }
    $$('img', c).forEach(function (im) { if (!im.complete) im.addEventListener('load', function () { medirPaso(c); }, { once: true }); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (document.body.contains(c)) medirPaso(c); });
  }
  window.addEventListener('resize', function () { ajustarEscenario(); });
  function vigilarMas() {
    var c = $('#paso-cuerpo'); if (!c) return;
    var w = c.parentNode;
    function revisar() { w.classList.toggle('hay-mas', c.scrollTop + c.clientHeight < c.scrollHeight - 6); }
    c.addEventListener('scroll', revisar, { passive: true });
    revisar(); setTimeout(revisar, 120);
  }
  function irA(i) {
    var lista = pasos(), antes_ = S.paso;
    S.paso = Math.max(0, Math.min(lista.length - 1, i));
    if (S.paso === antes_) return;
    enfocar('cuerpo');
    pintarTablero(S.paso > antes_ ? 1 : -1); verVistaDe(lista[S.paso]); guardarBorrador();
  }
  function enlazarComunes() {
    $$('.color[data-campo]', tablero).forEach(function (b) {
      b.addEventListener('click', function () {
        var campo = b.getAttribute('data-campo'), c = b.getAttribute('data-color') || null;
        S.d[campo] = c; if (campo === 'colorTexto') S.d.colorAuto = false;
        $$('.color[data-campo="' + campo + '"]', tablero).forEach(function (x) { x.classList.toggle('on', x === b); });
        dibujar(); guardarBorrador();
      });
    });
  }
  function reiniciar() {
    S.modo = null; S.paso = 0; S.d = clone(BASE_D); S.equipos = []; S.esEquipo = false; S.jugadores = []; S.nombreEquipo = ''; S.tallaUno = '';
    store.set('borrador', null);
    if (!probador.hidden) cerrarProbador();
    vitrina(); pintarTablero(); cambiarVista('frente'); dibujar();
  }

  // antes de abrir: un solo botón, el catálogo es el camino
  function vistaInicio() {
    var hay = S.modo && store.get('borrador');
    return '<div class="paso"><h3>' + esc(T('inicio_t2')) + '</h3><p class="nota-corta">' + esc(T('inicio_p2')) + '</p><div class="caminos">' +
      (hay ? '<button type="button" class="camino camino-sigue" data-camino="seguir"><span class="ico">' + icono('lapiz') + '</span><div><b>' + esc(T('seguir_armando')) + '</b><span>' + esc(T('seguir_armando_p')) + '</span></div></button>' : '') +
      '<button type="button" class="camino" data-camino="catalogo"><span class="ico">' + icono('lista') + '</span><div><b>' + esc(T('inicio_a')) + '</b><span>' + esc(T('inicio_a_p2')) + '</span></div></button>' +
      '</div>' +
      // en computadora sobra alto junto al uniforme: ahí mismo se ven los equipos, y tocar uno abre su uniforme
      '<div class="inicio-equipos"><p class="kicker">' + esc(T('p_diseno2')) + '</p>' + tarjetasPorSeccion(catalogoVisible()) + '</div></div>';
  }
  function enlazarInicio() {
    $$('.inicio-equipos [data-equipo]', tablero).forEach(function (b) {
      b.addEventListener('click', function () {
        var q = equiposDe(catalogoVisible()).filter(function (x) { return x.clave === b.getAttribute('data-equipo'); })[0]; if (!q) return;
        S.equipos = []; S.esEquipo = false; S.jugadores = []; S.nombreEquipo = '';
        abrirProbador(q.items[0], b);
      });
    });
    $$('[data-camino]', tablero).forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.getAttribute('data-camino') !== 'seguir') { S.modo = 'catalogo'; S.paso = 0; S.equipos = []; S.esEquipo = false; S.jugadores = []; S.nombreEquipo = ''; var u = uniformeActual(); if (u) usarBase(u); }
        abrirProbador(null, null);
      });
    });
  }

  /* ---- títulos de cada paso ---- */
  var CABEZAS = {
    diseno: function () { return '<h3>' + esc(T('p_diseno2')) + '</h3>'; },
    tacos: function () { return '<h3>' + esc(T('p_tacos')) + '</h3>'; },
    dorsal: function () { return '<h3>' + esc(T('p_dorsal')) + '</h3>'; },
    equipo: function () { return '<h3>' + esc(T('p_equipo')) + '</h3>'; },
    listo: function () { return '<h3>' + esc(T('p_listo')) + '</h3>'; }
  };
  /* Tacos de un solo color: 5 colores de siempre a un toque y uno libre. El libre abre, en la misma fila, una barra
     con todos los colores: se desliza el dedo y el taco cambia en vivo. Nada de listas largas ni scroll. */
  var TACOS_FILA = { negro: '#141518', blanco: '#f2f3f5', dorado: '#c9a23a', rojo: '#d7262e', azul: '#1f4fd1' };
  var TACOS_VIEJOS = { rosa: '#f6588a', turquesa: '#16b0b5' };
  var BARRA = [[0, '#ffffff'], [0.08, '#ff2a2a'], [0.18, '#ff8a00'], [0.28, '#ffd400'], [0.36, '#c9a23a'], [0.47, '#3ccf4e'], [0.58, '#16b0b5'], [0.69, '#1f4fd1'], [0.8, '#7b3fe4'], [0.9, '#f6588a'], [1, '#141518']];
  function rgbDe(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function hexTaco(t) { return TACOS_FILA[t] || TACOS_VIEJOS[t] || (/^#[0-9a-f]{6}$/i.test(t || '') ? t : TACOS_FILA.negro); }
  function colorBarra(k) {
    k = Math.max(0, Math.min(1, k));
    for (var i = 1; i < BARRA.length; i++) if (k <= BARRA[i][0]) {
      var a = BARRA[i - 1], b = BARRA[i], t = (k - a[0]) / (b[0] - a[0]), ca = rgbDe(a[1]), cb = rgbDe(b[1]);
      return '#' + ca.map(function (v, j) { return ('0' + Math.round(v + (cb[j] - v) * t).toString(16)).slice(-2); }).join('');
    }
    return BARRA[BARRA.length - 1][1];
  }
  function filaTacos() {
    var libre = !TACOS_FILA[S.d.taco];
    return Object.keys(TACOS_FILA).map(function (t) {
      return '<button type="button" class="taco-c' + (S.d.taco === t ? ' on' : '') + '" data-taco="' + t + '" style="--c:' + TACOS_FILA[t] + '" aria-label="' + esc(T('taco_' + t)) + '" aria-pressed="' + (S.d.taco === t) + '"></button>';
    }).join('') + '<button type="button" class="taco-c otro' + (libre ? ' on' : '') + '" data-taco-otro' + (libre ? ' style="--c:' + hexTaco(S.d.taco) + '"' : '') + ' aria-label="' + esc(T('taco_otro')) + '"></button>';
  }
  function barraTacos() {
    return '<div class="barra-color" data-barra role="slider" aria-label="' + esc(T('taco_otro')) + '" tabindex="0" style="background:linear-gradient(90deg,' + BARRA.map(function (b) { return b[1] + ' ' + b[0] * 100 + '%'; }).join(',') + ')"><i class="barra-pulgar"></i></div>' +
      '<button type="button" class="taco-listo" data-taco-listo aria-label="' + esc(T('taco_listo')) + '">✓</button>';
  }
  function ponerTaco(t) {
    S.d.taco = t;
    if (motor) motor.taco(t);   // solo se repinta: es instantáneo, aunque el dedo vaya rápido
  }
  function enlazarTacos(fila) {
    if (!fila) return;
    fila.classList.remove('abierta'); fila.innerHTML = filaTacos();
    $$('[data-taco]', fila).forEach(function (b) {
      b.addEventListener('click', function () {
        ponerTaco(b.getAttribute('data-taco'));
        $$('.taco-c', fila).forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
        enfocar('tacos');   // la cámara baja sola a los pies: los tacos se ven sin abrir pantalla completa
        guardarBorrador();
      });
    });
    $('[data-taco-otro]', fila).addEventListener('click', function () {
      // la barra ocupa el lugar de los círculos: mismo alto, nada se mueve en la pantalla
      fila.classList.add('abierta'); fila.innerHTML = barraTacos(); enfocar('tacos');
      var barra = $('[data-barra]', fila), pulgar = $('.barra-pulgar', fila), pend = null;
      var k = 0.36; if (!TACOS_FILA[S.d.taco]) { var mejor = 1e9, c = rgbDe(hexTaco(S.d.taco)); for (var i = 0; i <= 200; i++) { var q = rgbDe(colorBarra(i / 200)), d = Math.abs(q[0] - c[0]) + Math.abs(q[1] - c[1]) + Math.abs(q[2] - c[2]); if (d < mejor) { mejor = d; k = i / 200; } } }
      function mover(nk) { k = Math.max(0, Math.min(1, nk)); var col = colorBarra(k); pulgar.style.left = (k * 100) + '%'; pulgar.style.background = col; if (pend === null) pend = requestAnimationFrame(function () { pend = null; ponerTaco(colorBarra(k)); }); }
      mover(k);
      var x0 = 0, w = 1, id = null;
      barra.addEventListener('pointerdown', function (e) { var r = barra.getBoundingClientRect(); x0 = r.left; w = r.width; id = e.pointerId; try { barra.setPointerCapture(id); } catch (_) {} mover((e.clientX - x0) / w); barra.classList.add('tocando'); });
      barra.addEventListener('pointermove', function (e) { if (e.pointerId === id) mover((e.clientX - x0) / w); });
      var soltar = function (e) { if (e.pointerId !== id) return; id = null; barra.classList.remove('tocando'); guardarBorrador(); };
      barra.addEventListener('pointerup', soltar); barra.addEventListener('pointercancel', soltar);
      barra.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); mover(k + (e.key === 'ArrowRight' ? 0.02 : -0.02)); guardarBorrador(); } });
      $('[data-taco-listo]', fila).addEventListener('click', function () { guardarBorrador(); enlazarTacos(fila); });
    });
  }
  /* ---------- equipos: se ve el escudo; al tocarlo salen sus uniformes (local, visita…) ---------- */
  function claveEquipo(u) { var e = (u.etiquetas || {}).equipo; return e ? 'e:' + normal(e) : 'u:' + u.id; }
  function equiposDe(lista) {
    var m = {}, out = [];
    lista.forEach(function (u) {
      var k = claveEquipo(u);
      if (!m[k]) { m[k] = { clave: k, nombre: (u.etiquetas || {}).equipo || u.nombre, escudo: '', items: [] }; out.push(m[k]); }
      m[k].items.push(u); if (!m[k].escudo && u.escudo) m[k].escudo = u.escudo;
    });
    return out;
  }
  function equipoDeId(id) { var u = catalogoVisible().filter(function (x) { return x.id === id; })[0]; if (!u) return null; var k = claveEquipo(u); return equiposDe(catalogoVisible()).filter(function (q) { return q.clave === k; })[0]; }
  function versionDe(u) { if (u.version) return u.version; var i = String(u.nombre).lastIndexOf('·'); return i >= 0 ? u.nombre.slice(i + 1).trim() : u.nombre; }
  function nUniformes(n) { return n === 1 ? T('un_uniforme') : T('n_uniformes').replace('{n}', n); }
  function caraEquipo(q) {
    // sin escudo: el mismo círculo, con la playera del equipo adentro (nunca un recuadro distinto a los demás)
    return q.escudo ? '<span class="mini-foto escudo"><img src="' + esc(q.escudo) + '" alt="" loading="lazy" decoding="async"></span>'
      : '<span class="mini-foto escudo sin-escudo"><img src="' + esc(q.items[0].mini) + '" alt="" loading="lazy" decoding="async"></span>';
  }
  // paso 1: los equipos por sección (Liga MX, Europa, Países…), un renglón por sección con su nombre al lado
  function tarjetaEquipo(q) {
    var actual = equipoDeId(S.baseId), on = actual && actual.clave === q.clave;
    var n = q.items.length > 1 ? '<i class="mini-n" aria-label="' + esc(nUniformes(q.items.length)) + '">' + q.items.length + '</i>' : '';
    return '<button type="button" class="mini con-escudo' + (on ? ' on' : '') + '" data-equipo="' + esc(q.clave) + '"><span class="mini-cara">' + caraEquipo(q) + n + '</span><span class="mini-nom' + (q.nombre.length > 11 ? ' largo' : '') + '">' + esc(q.nombre) + '</span></button>';
  }
  // una sección con más de 3 equipos no crece hacia abajo (el uniforme se achicaría): se ven de 3 en 3 y una flecha dorada pasa a los siguientes
  function filaSeccion(eqs) {
    if (eqs.length <= 3) return '<div class="mini-grid">' + eqs.map(tarjetaEquipo).join('') + '</div>';
    var pags = [], actual = equipoDeId(S.baseId), ini = 0;
    for (var i = 0; i < eqs.length; i += 3) pags.push(eqs.slice(i, i + 3));
    pags.forEach(function (pg, k) { if (actual && pg.some(function (q) { return q.clave === actual.clave; })) ini = k; });
    var n = pags.length;
    return '<div class="sec-vista" data-pag="' + ini + '" data-pags="' + n + '"><div class="sec-pista" style="width:' + (n * 100) + '%;transform:translateX(' + (-ini * 100 / n) + '%)">' +
      pags.map(function (pg) { return '<div class="mini-grid" style="flex-basis:' + (100 / n) + '%">' + pg.map(tarjetaEquipo).join('') + '</div>'; }).join('') + '</div></div>' +
      '<button type="button" class="sec-mas' + (ini === n - 1 ? ' atras' : '') + '" data-sec-mas aria-label="' + esc(T('mas_equipos')) + '"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></i><small>' + esc(ini === n - 1 ? T('volver') : '+' + (eqs.length - (ini + 1) * 3 > 0 ? eqs.length - (ini + 1) * 3 : 0)) + '</small></button>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-sec-mas]'); if (!b) return;
    var v = b.parentNode.querySelector('.sec-vista'), n = +v.getAttribute('data-pags'), p = (+v.getAttribute('data-pag') + 1) % n, tot = v.querySelectorAll('[data-equipo]').length;
    v.setAttribute('data-pag', p); v.firstChild.style.transform = 'translateX(' + (-p * 100 / n) + '%)';
    b.classList.toggle('atras', p === n - 1);
    var resto = tot - (p + 1) * 3; b.querySelector('small').textContent = p === n - 1 ? T('volver') : '+' + resto;
  });
  function tarjetasPorSeccion(lista) {
    var secs = carpetas(), sin = lista.filter(function (u) { return !u.categoria || secs.indexOf(u.categoria) < 0; });
    var grupos = secs.map(function (c) { return [c, lista.filter(function (u) { return u.categoria === c; })]; });
    if (sin.length) grupos.push(['', sin]);
    return '<div class="secciones">' + grupos.map(function (g) {
      var eqs = equiposDe(g[1]);
      return '<div class="seccion' + (eqs.length > 3 ? ' paginada' : '') + '"><span class="etq">' + esc(g[0]) + '</span>' + filaSeccion(eqs) + '</div>';
    }).join('') + '</div>';
  }
  function tarjetasUniformes(lista) {
    if (!lista.length) return '<p class="nota-corta vacio">' + esc(T('sin_resultados')) + '</p>';
    var actual = equipoDeId(S.baseId), qs = equiposDe(lista);
    return '<div class="mini-grid" id="mini-grid">' + qs.map(function (q) {
      var on = actual && actual.clave === q.clave;
      // cuántos uniformes trae el equipo: un circulito con el número en la esquina del escudo (sin renglones de más)
      var n = q.items.length > 1 ? '<i class="mini-n" aria-label="' + esc(nUniformes(q.items.length)) + '">' + q.items.length + '</i>' : '';
      return '<button type="button" class="mini' + (q.escudo ? ' con-escudo' : '') + (on ? ' on' : '') + '" data-equipo="' + esc(q.clave) + '"><span class="mini-cara">' + caraEquipo(q) + n + '</span><span class="mini-nom">' + esc(q.nombre) + '</span></button>';
    }).join('') + '</div>';
  }
  function tarjetasUniformesViejo(lista) {
    if (!lista.length) return '<p class="nota-corta vacio">' + esc(T('sin_resultados')) + '</p>';
    return '<div class="mini-grid" id="mini-grid">' + lista.map(function (u) {
      return '<button type="button" class="mini' + (u.id === S.baseId ? ' on' : '') + '" data-base="' + esc(u.id) + '"><span class="mini-foto"><img src="' + esc(u.mini) + '" alt="" loading="lazy" decoding="async"></span><span>' + esc(u.nombre) + '</span></button>';
    }).join('') + '</div>';
  }
  var VISTAS = {
    diseno: function () {
      // con 10 equipos o menos se ven todos de un vistazo: el buscador y las carpetas sobran y empujarían los escudos fuera
      return '<div id="p-resultados">' + tarjetasPorSeccion(catalogoVisible()) + '</div>';
    },
    tacos: function () {
      var q = equipoDeId(S.baseId), vers = q && q.items.length > 1 ? '<div class="grupo g0"><span class="etq">' + esc(T('version')) + '</span><div class="chips llenar">' + q.items.map(function (u) {
        return '<button type="button" class="chip' + (u.id === S.baseId ? ' on' : '') + '" data-version="' + esc(u.id) + '">' + esc(versionDe(u)) + '</button>';
      }).join('') + '</div></div>' : '';
      return vers + '<div class="grupo' + (vers ? '' : ' g0') + '"><span class="etq">' + esc(T('manga')) + '</span><div class="chips llenar"><button type="button" class="chip' + (S.d.manga !== 'larga' ? ' on' : '') + '" data-manga="corta">' + esc(T('manga_corta')) + '</button>' +
        '<button type="button" class="chip' + (S.d.manga === 'larga' ? ' on' : '') + '" data-manga="larga">' + esc(T('manga_larga')) + '</button></div></div>' +
        '<div class="grupo"><span class="etq">' + esc(T('tus_tacos')) + '</span><div class="tacos-fila" id="tacos-fila">' + filaTacos() + '</div></div><p class="nota-corta">' + esc(T('tacos_s')) + '</p>';
    },
    dorsal: function () {
      return '<div class="fila2 g0"><div><label class="etq" for="f-nombre">' + esc(T('nombre_espalda')) + '</label><input class="campo" id="f-nombre" maxlength="16" autocomplete="off" placeholder="' + esc(T('ej_nombre')) + '" value="' + esc(S.d.nombre || '') + '"></div>' +
        '<div><label class="etq" for="f-numero">' + esc(T('numero')) + '</label><input class="campo" id="f-numero" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" placeholder="10" value="' + esc(S.d.numero || '') + '"></div></div>' +
        '<div class="grupo"><span class="etq">' + esc(T('color_letras')) + '</span>' + chipsColor('colorTexto', S.d.colorTexto, LETRAS) + '</div>';
    },
    equipo: function () {
      var h = '';
      if (S.equipos.length) h += '<div class="equipos g0">' + S.equipos.map(function (e, i) {
        return '<span class="eq-chip"><img src="' + esc(e.mini) + '" alt="">' + esc(e.nombre) + ' · ' + e.jugadores.length + '<button type="button" data-quita-eq="' + i + '" aria-label="' + esc(T('quitar')) + '">×</button></span>';
      }).join('') + '</div>';
      h += '<div class="chips llenar' + (S.equipos.length ? '' : ' g0') + '"><button type="button" class="chip' + (!S.esEquipo ? ' on' : '') + '" data-eq="no">' + esc(T('equipo_no')) + '</button><button type="button" class="chip' + (S.esEquipo ? ' on' : '') + '" data-eq="si">' + esc(T('equipo_si')) + '</button></div>';
      var tallas = TIENDA.config.tallas || [];
      if (!S.esEquipo) return h + '<div class="grupo"><label class="etq" for="f-talla1">' + esc(T('talla_uno')) + '</label><select class="campo" id="f-talla1"><option value="" disabled hidden' + (S.tallaUno ? '' : ' selected') + '>' + esc(T('talla_elige')) + '</option>' + tallas.map(function (t) { return '<option' + (t === S.tallaUno ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></div><p class="nota-corta">' + esc(T('p_equipo_s')) + '</p>';
      h += '<div class="grupo"><label class="etq" for="f-equipo">' + esc(T('nombre_equipo')) + '</label><input class="campo" id="f-equipo" maxlength="40" value="' + esc(S.nombreEquipo) + '"></div>';
      h += '<div class="roster"><div class="r-fila r-head"><span>' + esc(T('jugador')) + '</span><span>' + esc(T('numero')) + '</span><span>' + esc(T('talla')) + '</span><span></span></div>' +
        S.jugadores.map(function (j, i) {
          return '<div class="r-fila"><input class="campo" data-j="' + i + '" data-k="nombre" maxlength="30" value="' + esc(j.nombre) + '" aria-label="' + esc(T('jugador')) + '">' +
            '<input class="campo" data-j="' + i + '" data-k="numero" inputmode="numeric" maxlength="3" value="' + esc(j.numero) + '" aria-label="' + esc(T('numero')) + '">' +
            '<select class="campo" data-j="' + i + '" data-k="talla" aria-label="' + esc(T('talla')) + '"><option value=""></option>' + tallas.map(function (t) { return '<option' + (t === j.talla ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>' +
            '<button type="button" class="icon-btn" data-quita-j="' + i + '" aria-label="' + esc(T('quitar')) + '">×</button></div>';
        }).join('') + '</div>';
      h += '<div class="pares"><button type="button" class="btn btn-linea" data-mas-j>' + icono('mas') + esc(T('mas_jugador')) + '</button><button type="button" class="btn btn-linea" data-otro-eq>' + icono('mas') + esc(T('mas_equipo')) + '</button></div>';
      return h;
    },
    listo: function () {
      var d = S.d, u = uniformeActual(), items = [];
      if (u) items.push(u.nombre);
      items.push(T(d.manga === 'larga' ? 'manga_larga' : 'manga_corta'));
      if (d.nombre || d.numero) items.push((d.nombre || '') + (d.numero ? ' · ' + d.numero : ''));
      var nEq = S.equipos.length + 1, nJug = S.equipos.reduce(function (s, e) { return s + e.jugadores.length; }, 0) + (S.esEquipo ? S.jugadores.filter(function (j) { return j.nombre || j.numero; }).length : 0);
      if (nEq > 1 || nJug) items.push(nEq + ' ' + T(nEq > 1 ? 'equipos' : 'equipo_1') + (nJug ? ' · ' + nJug + ' ' + T(nJug > 1 ? 'jugadores' : 'jugador_1') : ''));
      return '<div class="chips resumen-chips g0">' + items.map(function (t) { return '<span class="chip on-suave">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<p class="nota-corta">' + esc(T('p_listo_s')) + '</p>' +
        '<p class="nota">' + esc(T('guia_final')) + '</p>';
    }
  };

  /* ---- enlaces de cada paso ---- */
  function enlazarTarjetas(raiz, alElegir) {
    $$('[data-equipo]', raiz).forEach(function (b) {
      b.addEventListener('click', function () {
        var q = equiposDe(catalogoVisible()).filter(function (x) { return x.clave === b.getAttribute('data-equipo'); })[0];
        if (q) alElegir(q.items[0], b, true);
      });
    });
    $$('[data-version]', raiz).forEach(function (b) {
      b.addEventListener('click', function () {
        var u = catalogoVisible().filter(function (x) { return x.id === b.getAttribute('data-version'); })[0];
        if (u) alElegir(u, b, true);
      });
    });
    $$('[data-base]', raiz).forEach(function (b) {
      b.addEventListener('click', function () {
        var u = catalogoVisible().filter(function (x) { return x.id === b.getAttribute('data-base'); })[0];
        if (!u) return;
        $$('[data-base]', raiz).forEach(function (x) { x.classList.toggle('on', x === b); });
        alElegir(u, b);
      });
    });
  }
  var ENLACES = {
    diseno: function () {
      function elegir(u) {
        if (u.id !== S.baseId && claveEquipo(u) !== (equipoDeId(S.baseId) || {}).clave) { usarBase(u); cambiarVista('frente'); dibujar(); guardarBorrador(); }
        irA(1);   // al tocar el escudo se abre su uniforme (local / visitante, manga y tacos)
      }
      function repintar() {
        var r = $('#p-resultados'); if (!r) return;
        r.innerHTML = tarjetasUniformes(filtrar(catalogoVisible()));
        enlazarTarjetas(r, elegir); acomodar(r); vigilarMas();
      }
      enlazarFiltros(tablero, 'p', repintar);
      enlazarTarjetas(tablero, elegir);
    },
    tacos: function () {
      $$('[data-version]', tablero).forEach(function (b) {
        b.addEventListener('click', function () {
          var u = catalogoVisible().filter(function (x) { return x.id === b.getAttribute('data-version'); })[0]; if (!u || u.id === S.baseId) return;
          usarBase(u); cambiarVista('frente'); enfocar('cuerpo'); dibujar(); guardarBorrador();
          $$('[data-version]', tablero).forEach(function (x) { x.classList.toggle('on', x === b); });
          $$('[data-manga]', tablero).forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-manga') === S.d.manga); });
        });
      });
      $$('[data-manga]', tablero).forEach(function (b) {
        b.addEventListener('click', function () {
          S.d.manga = b.getAttribute('data-manga'); enfocar('cuerpo');
          $$('[data-manga]', tablero).forEach(function (x) { x.classList.toggle('on', x === b); });
          dibujar(); guardarBorrador();
        });
      });
      enlazarTacos($('#tacos-fila', tablero));
    },
    dorsal: function () {
      var n = $('#f-nombre'), num = $('#f-numero');
      n.addEventListener('input', function () { S.d.nombre = n.value.toUpperCase(); dibujar(); guardarBorrador(); });
      num.addEventListener('input', function () { num.value = num.value.replace(/\D/g, '').slice(0, 3); S.d.numero = num.value; dibujar(); guardarBorrador(); });
    },
    equipo: function () {
      $$('[data-eq]', tablero).forEach(function (b) {
        b.addEventListener('click', function () {
          var si = b.getAttribute('data-eq') === 'si';
          if (si === S.esEquipo) return;
          S.esEquipo = si;
          if (S.esEquipo && !S.jugadores.length) S.jugadores = [{ nombre: S.d.nombre || '', numero: S.d.numero || '', talla: '' }, { nombre: '', numero: '', talla: '' }];
          pintarTablero(); guardarBorrador();
        });
      });
      var t1 = $('#f-talla1'); if (t1) t1.addEventListener('change', function () { S.tallaUno = t1.value; guardarBorrador(); });
      var ne = $('#f-equipo'); if (ne) ne.addEventListener('input', function () { S.nombreEquipo = ne.value; guardarBorrador(); });
      $$('[data-j]', tablero).forEach(function (el) {
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', function () {
          var j = S.jugadores[+el.getAttribute('data-j')], k = el.getAttribute('data-k');
          if (k === 'numero') el.value = el.value.replace(/\D/g, '').slice(0, 3);
          j[k] = k === 'nombre' ? el.value.toUpperCase() : el.value;
          if (+el.getAttribute('data-j') === 0 && k !== 'talla') { S.d[k] = j[k]; dibujar(); }
          guardarBorrador();
        });
      });
      $$('[data-quita-j]', tablero).forEach(function (b) { b.addEventListener('click', function () { S.jugadores.splice(+b.getAttribute('data-quita-j'), 1); var y = $('#paso-cuerpo').scrollTop; pintarTablero(); $('#paso-cuerpo').scrollTop = y; guardarBorrador(); }); });
      var mas = $('[data-mas-j]', tablero);
      if (mas) mas.addEventListener('click', function () {
        S.jugadores.push({ nombre: '', numero: '', talla: '' }); pintarTablero();
        var c = $('#paso-cuerpo'), ins = $$('[data-k="nombre"]', tablero), ult = ins[ins.length - 1];
        if (ult) { c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' }); ult.focus({ preventScroll: true }); }
      });
      var otro = $('[data-otro-eq]', tablero);
      if (otro) otro.addEventListener('click', guardarEquipoYOtro);
      $$('[data-quita-eq]', tablero).forEach(function (b) { b.addEventListener('click', function () { S.equipos.splice(+b.getAttribute('data-quita-eq'), 1); pintarTablero(); guardarBorrador(); }); });
    },
    listo: function () {}
  };

  /* ---------- equipos ---------- */
  function equipoActual() {
    var jug = S.esEquipo ? S.jugadores.filter(function (j) { return j.nombre || j.numero || j.talla; })
      : [{ nombre: S.d.nombre || '', numero: S.d.numero || '', talla: S.tallaUno || '' }];
    var u = uniformeActual() || {};
    var d = clone(S.d); d.base = u.id; d.colorTexto = d.colorTexto || u.colorTexto;
    var arch = [];
    if (u.fotos) { if (u.fotos.frente) arch.push({ que: 'Foto del frente', url: abs(u.fotos.frente) }); if (u.fotos.espalda) arch.push({ que: 'Foto de la espalda', url: abs(u.fotos.espalda) }); if (u.fotos.short) arch.push({ que: 'Foto del short', url: abs(u.fotos.short) }); }
    return { nombre: (S.esEquipo && S.nombreEquipo) || T('sin_nombre'), diseno: d, jugadores: clone(jug), base: u.nombre || '', mini: u.mini, archivos: arch };
  }
  function abs(u) { return /^https?:/.test(u) ? u : location.origin + u; }
  function guardarEquipoYOtro() {
    var e = equipoActual();
    S.equipos.push(e);
    S.jugadores = []; S.nombreEquipo = ''; S.esEquipo = false; S.tallaUno = '';
    S.d.nombre = ''; S.d.numero = '';
    S.paso = 0; pintarTablero(-1); verVistaDe(pasos()[0]); dibujar(); guardarBorrador();
    toast(T('otro_equipo_ok'));
  }

  /* ---------- cotizar: guardar folio y celebrar ---------- */
  // fotos de estudio del pedido, hechas con el mismo motor 3D (o la foto guardada si el teléfono no tiene 3D)
  function vistasDe(e) {
    var u = catalogoVisible().filter(function (x) { return x.id === e.diseno.base; })[0] || uniformeActual();
    if (!motor || !u) return Promise.resolve([u && u.mini, u && u.mini].map(function (x) { return x ? abs(x) : ''; }));
    return aplicar(motor, config(u, e.diseno)).then(function () { return [motor.foto(800, 1200, 'frente'), motor.foto(800, 1200, 'espalda')]; });
  }
  var guardando = false;
  function cotizar() {
    if (guardando) return;
    guardando = true;
    var btn = $('#barra-sig'); btn.disabled = true; btn.textContent = T('guardando');
    var equipos = S.equipos.concat([equipoActual()]);
    var listos = [];
    var cadena = cola.then(function () { return cargarMotor().catch(function () { return null; }); });
    equipos.forEach(function (e) {
      cadena = cadena.then(function () { return vistasDe(e); }).then(function (v) {
        return Promise.all(v.map(function (x) { return /^data:/.test(x) ? subirConReintento(x) : x; }));
      }).then(function (u) {
        listos.push({ nombre: e.nombre, base: e.base || '', diseno: e.diseno, jugadores: e.jugadores, vistas: { frente: u[0], espalda: u[1] }, originales: [], archivos: e.archivos || [], avisos: [] });
      });
    });
    cadena.then(function () {
      puesto = null; dibujar(); // regresa al uniforme que estaba en pantalla
      return fetch('/api/folio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ equipos: listos, idioma: lang }) })
        .then(function (r) { if (!r.ok) throw new Error('folio'); return r.json(); });
    }).then(function (j) {
      guardando = false;
      var link = location.origin + '/?folio=' + j.id + '&k=' + j.clave;
      store.set('ultimoFolio', { id: j.id, link: link });
      store.set('borrador', null);
      celebrar(j.id, link);
      btn.disabled = false; btn.textContent = T('cotizar_corto');
    }).catch(function () {
      guardando = false; btn.disabled = false; btn.textContent = T('cotizar_corto');
      toast(T('error_guardar'));
    });
  }

  function waLink(texto) {
    var n = String(TIENDA.config.whatsapp || '').replace(/\D/g, '');
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto);
  }

  /* ---------- animaciones: entrada y celebración ---------- */
  var BALON = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="#fff" stroke="#0A1033" stroke-width="3"/><path d="M50 30l17 12-6 20H39l-6-20Z" fill="#0A1033"/><path d="M50 30V8M67 42l20-7M61 62l12 18M39 62L27 80M33 42l-20-7" stroke="#0A1033" stroke-width="3"/><path d="M38 6l12 2 12-2M88 30l2 12-6 10M78 84l-12 6-10-6M22 84l12 6M10 52l-4-12 6-10" fill="none" stroke="#0A1033" stroke-width="3"/></svg>';
  var ESTRELLA = '<svg viewBox="0 0 24 24"><path d="M12 1.5l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2L12 18l-6.5 3.4 1.3-7.2L1.5 9.1l7.3-1Z"/></svg>';
  var COPA = '<svg viewBox="0 0 60 70"><path d="M15 6h30v14c0 11-6 19-15 21-9-2-15-10-15-21Z" fill="#FFC61A"/><path d="M15 10H7c0 9 4 14 10 15M45 10h8c0 9-4 14-10 15" fill="none" stroke="#FFC61A" stroke-width="4" stroke-linecap="round"/><rect x="26" y="41" width="8" height="11" fill="#E0A800"/><rect x="17" y="52" width="26" height="7" rx="2" fill="#FFC61A"/><rect x="13" y="59" width="34" height="9" rx="3" fill="#1F2E7A"/></svg>';
  var MEDALLA = '<svg viewBox="0 0 50 70"><path d="M12 0h10l6 26h-10ZM38 0H28l-6 26h10Z" fill="#1F2E7A"/><circle cx="25" cy="46" r="20" fill="#FFC61A"/><circle cx="25" cy="46" r="13" fill="none" stroke="#E0A800" stroke-width="3"/></svg>';
  function rnd(a, b) { return a + Math.random() * (b - a); }
  // la portada siempre se ve; la animación solo se agrega si la página está a la vista
  function animarPortada() {
    var p = $('.portada'), raiz = document.documentElement;
    if (!p || p.classList.contains('anim')) { raiz.classList.remove('espera'); return; }
    if (document.visibilityState !== 'visible') { raiz.classList.remove('espera'); return; }
    // en el mismo cuadro se quita la espera y empieza la animación: las letras entran desde invisibles, sin parpadeo
    requestAnimationFrame(function () { p.classList.add('anim'); raiz.classList.remove('espera'); });
  }
  function intro() {
    var el = $('#intro');
    if (!el) return;
    var q = new URLSearchParams(location.search);
    if (q.has('folio') || q.has('sinintro') || location.hash === '#panel') { el.remove(); animarPortada(); return; }
    $('#intro-logo').innerHTML = logoSVG('#1F2E7A', '#FFFFFF');
    var W = window.innerWidth, H = window.innerHeight, fx = $('#intro-fx'), h = '';
    for (var i = 0; i < 7; i++) {
      var s = rnd(46, 92), lado = i % 2 ? 1 : -1;
      var x0 = (lado < 0 ? -120 : W + 20), y0 = rnd(0.05, 0.4) * H;
      var x1 = rnd(0.15, 0.85) * W, y1 = H - s - rnd(10, 60);
      var x2 = x1 + lado * -rnd(80, 200), y2 = rnd(0.25, 0.55) * H;
      var x3 = x2 + lado * -rnd(120, 260), y3 = H + 40;
      h += '<div class="intro-bola" style="left:0;top:0;width:' + s + 'px;height:' + s + 'px;--x0:' + x0 + 'px;--y0:' + y0 + 'px;--x1:' + x1 + 'px;--y1:' + y1 + 'px;--x2:' + x2 + 'px;--y2:' + y2 + 'px;--x3:' + x3 + 'px;--y3:' + y3 + 'px;--g1:' + rnd(180, 400) * lado + 'deg;--g2:' + rnd(400, 640) * lado + 'deg;--g3:' + rnd(700, 900) * lado + 'deg;animation-delay:' + rnd(0, 0.5).toFixed(2) + 's">' + BALON + '</div>';
    }
    for (var j = 0; j < 30; j++) {
      var z = rnd(12, 34), ang = rnd(0, Math.PI * 2), dist = rnd(0.18, 0.55) * Math.min(W, H);
      h += '<div class="intro-estrella" style="left:' + (W / 2 - z / 2) + 'px;top:' + (H / 2 - z / 2) + 'px;width:' + z + 'px;height:' + z + 'px;--dx:' + Math.cos(ang) * dist + 'px;--dy:' + Math.sin(ang) * dist + 'px;--s:' + rnd(0.8, 1.6).toFixed(2) + ';--r:' + rnd(-160, 160) + 'deg;animation-delay:' + rnd(0.45, 0.85).toFixed(2) + 's">' + ESTRELLA + '</div>';
    }
    fx.innerHTML = h;
    window.scrollTo(0, 0); FIJAR.on();
    var fin = false;
    function terminar() { if (fin) return; fin = true; FIJAR.off(); window.scrollTo(0, 0); el.remove(); animarPortada(); }
    // la cortina amarilla sube al final; las letras de la portada empiezan a entrar justo cuando se destapa
    setTimeout(animarPortada, 3050);
    setTimeout(terminar, 3400);
  }
  /* sonido del folio: patada → porra → brillo al final, en un solo archivo para que nada se encime.
     Se prepara en el mismo toque de "Cotizar" (los teléfonos solo dejan sonar si nace de un toque) y suena cuando sale el folio. */
  /* Sonido al mandar la cotización. Va por el mezclador del navegador (no por <audio>): así el volumen y la entrada y
     salida suaves funcionan también en iPhone, donde el volumen de <audio> no se puede cambiar.
     El dueño escoge en su panel: con o sin sonido, su propio sonido y el volumen (de arranque, 50 %). */
  var mezcla = null, sonBuf = null, sonDe = '', sonCargando = null, sonFuente = null, sonGan = null;
  function sonidoConfig() {
    var c = TIENDA.config || {}, v = parseFloat(c.sonidoVolumen);
    return { url: c.sonido === 'no' ? '' : (c.sonidoUrl || '/assets/sonido/folio.mp3?v=' + (window.VERSION || '1')), vol: isFinite(v) && v >= 0 && v <= 100 ? v / 100 : 0.5 };
  }
  function cargarSonido(url) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC || !url) return null;
      if (!mezcla) mezcla = new AC();
      if (mezcla.state === 'suspended') mezcla.resume();   // se despierta con el toque del cliente (regla del iPhone)
      if (sonDe === url && sonCargando) return sonCargando;
      sonDe = url; sonBuf = null;
      sonCargando = fetch(url).then(function (r) { return r.arrayBuffer(); })
        .then(function (a) { return new Promise(function (ok, no) { mezcla.decodeAudioData(a, ok, no); }); })
        .then(function (b) { if (sonDe === url) sonBuf = b; return b; })
        .catch(function () { if (sonDe === url) { sonDe = ''; sonCargando = null; } return null; });
      return sonCargando;
    } catch (e) { return null; }
  }
  function prepararSonido() { cargarSonido(sonidoConfig().url); }
  function pararSonido() {
    try {
      if (sonGan && mezcla) { var t = mezcla.currentTime, f = sonFuente; sonGan.gain.cancelScheduledValues(t); sonGan.gain.setValueAtTime(sonGan.gain.value, t); sonGan.gain.linearRampToValueAtTime(0, t + 0.25); setTimeout(function () { try { f.stop(); } catch (e) {} }, 320); }
    } catch (e) {}
    sonFuente = null; sonGan = null;
  }
  function tocar(buf, vol) {
    if (!buf || !mezcla) return;
    pararSonido();
    var t = mezcla.currentTime + 0.02, d = buf.duration, ent = Math.min(0.3, d / 4), sal = Math.min(0.8, d / 3);
    var g = mezcla.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + ent);   // entra suave
    g.gain.setValueAtTime(vol, Math.max(t + ent, t + d - sal)); g.gain.linearRampToValueAtTime(0, t + d);        // y sale suave
    var f = mezcla.createBufferSource(); f.buffer = buf; f.connect(g); g.connect(mezcla.destination); f.start(t);
    sonFuente = f; sonGan = g;
  }
  function sonar() {
    var c = sonidoConfig(); if (!c.url) return;
    var p = cargarSonido(c.url); if (p) p.then(function (b) { tocar(b, c.vol); });
  }
  // para el panel: escuchar un sonido con un volumen antes de guardarlo
  function probarSonido(url, vol) { var p = cargarSonido(url); if (p) p.then(function (b) { tocar(b, vol); }); }
  function lluviaDePremios(cont, n) {
    var piezas = [COPA, COPA, MEDALLA, ESTRELLA, ESTRELLA, BALON], h = '';
    var W = window.innerWidth;
    for (var i = 0; i < n; i++) {
      var p = piezas[i % piezas.length], s = p === ESTRELLA ? rnd(16, 30) : p === BALON ? rnd(26, 40) : rnd(34, 58);
      h += '<div class="premio" style="left:' + rnd(-0.02, 0.98) * W + 'px;width:' + s + 'px;height:' + s * 1.15 + 'px;--dx:' + rnd(-80, 80) + 'px;--rot:' + rnd(-300, 300) + 'deg;animation-duration:' + rnd(2.4, 4.2).toFixed(2) + 's;animation-delay:' + rnd(0, 1.4).toFixed(2) + 's' + (p === ESTRELLA ? ';fill:#FFC61A' : '') + '">' + p + '</div>';
    }
    cont.innerHTML = h;
  }
  function celebrar(id, link) {
    var f = $('#fiesta');
    $('#fiesta-folio').textContent = id;
    $('#fiesta-wa').href = waLink(T('wa_msg').replace('{f}', id).replace('{u}', link));
    f.hidden = false; FIJAR.on();
    lluviaDePremios($('#fiesta-fx'), 46);
    sonar();
    setTimeout(function () { $('#fiesta-wa').focus(); }, 900);
  }
  $('#fiesta-cerrar').addEventListener('click', function () { pararSonido(); $('#fiesta').hidden = true; $('#fiesta-fx').innerHTML = ''; FIJAR.off(); reiniciar(); });
  /* ---------- catálogo de la página: las mismas carpetas y el mismo buscador que dentro del probador ---------- */
  /* Catálogo: una sola fila de escudos que se desliza de lado, con una barrita que dice cuánto falta y la píldora
     "Ver todos". "Ver todos" abre una pantalla con todos los escudos grandes; arriba siempre quedan la búsqueda y las secciones. */
  function escudoCat(q) {
    var u = q.items[0], img = q.escudo ? '<img src="' + esc(q.escudo) + '" alt="" loading="lazy" decoding="async">' : '<img class="sin" src="' + esc(u.mini) + '" alt="" loading="lazy" decoding="async">';
    return '<button type="button" class="cat-esc" data-cat="' + esc(u.id) + '"><span class="cat-cara' + (q.escudo ? '' : ' sin-escudo') + '">' + img + (q.items.length > 1 ? '<i class="mini-n">' + q.items.length + '</i>' : '') + '</span><b>' + esc(q.nombre) + '</b></button>';
  }
  function enlazarCat(raiz) {
    $$('[data-cat]', raiz).forEach(function (b) {
      b.addEventListener('click', function () {
        var u = catalogoVisible().filter(function (x) { return x.id === b.getAttribute('data-cat'); })[0];
        if (!u) return; if (catTodo && !catTodo.hidden) cerrarCatTodo(); abrirProbador(u, b);
      });
    });
  }
  function pintarCatalogo() {
    var cont = $('#cat-zona'); if (!cont) return;
    var qs = equiposDe(catalogoVisible());
    cont.innerHTML = '<div class="cat-fila" id="cat-fila">' + qs.map(escudoCat).join('') + '</div>' +
      '<div class="cat-pie"><span class="cat-avance" aria-hidden="true"><i id="cat-avance"></i></span><button type="button" class="btn btn-oro cat-todos" data-ver-todos>' + esc(T('ver_todos')) + ' <span>' + qs.length + '</span></button></div>';
    enlazarCat(cont);
    var fila = $('#cat-fila'), barra = $('#cat-avance');
    function avance() {   // la barrita: su largo es lo que se ve; su lugar, cuánto has recorrido
      var vis = fila.clientWidth / Math.max(1, fila.scrollWidth), pos = fila.scrollLeft / Math.max(1, fila.scrollWidth - fila.clientWidth);
      barra.style.width = Math.max(12, vis * 100) + '%'; barra.style.left = ((1 - Math.min(1, vis)) * pos * 100) + '%';
      barra.parentNode.classList.toggle('lleno', vis >= 0.999);
    }
    fila.addEventListener('scroll', avance, { passive: true }); window.addEventListener('resize', avance); avance();
    $$('img', fila).forEach(function (im) { if (!im.complete) im.addEventListener('load', avance, { once: true }); });
    $('[data-ver-todos]', cont).addEventListener('click', abrirCatTodo);
  }
  var catTodo = null;
  function abrirCatTodo() {
    if (!catTodo) {
      catTodo = document.createElement('div'); catTodo.className = 'capa cat-todo'; catTodo.hidden = true;
      catTodo.innerHTML = '<div class="cat-todo-in" role="dialog" aria-modal="true" aria-label="' + esc(T('cat_t')) + '"><header class="cat-todo-top"><div class="cat-todo-tit"><h2>' + esc(T('cat_t')) + '</h2><button type="button" class="capa-x" data-cerrar-todo aria-label="' + esc(T('cerrar')) + '">×</button></div><div id="t-filtros"></div></header><div id="t-resultados"></div></div>';
      document.body.appendChild(catTodo);
      $('[data-cerrar-todo]', catTodo).addEventListener('click', function () { cerrarCatTodo(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && catTodo && !catTodo.hidden) cerrarCatTodo(); });
    }
    $('h2', catTodo).textContent = T('cat_t');
    $('#t-filtros', catTodo).innerHTML = filtrosHTML('t');
    function lista() {
      var vis = filtrar(catalogoVisible()), qs = equiposDe(vis), r = $('#t-resultados', catTodo);
      r.innerHTML = qs.length ? '<div class="cat-todo-grid">' + qs.map(escudoCat).join('') + '</div>' : '<p class="nota-corta vacio">' + esc(T('sin_resultados')) + '</p>';
      enlazarCat(r);
    }
    enlazarFiltros(catTodo, 't', lista); lista();
    if (catTodo.hidden) { window.FIJAR.on(); catTodo.hidden = false; }
    $('.cat-todo-in', catTodo).scrollTop = 0;
  }
  function cerrarCatTodo() {
    if (!catTodo || catTodo.hidden) return;
    catTodo.hidden = true; window.FIJAR.off();
  }

  function pintarDatos() {
    var c = TIENDA.config;
    var hp = $('#historia-p'); if (hp) hp.textContent = c.historia || T('hist_p');
    // los textos de portada que escribe el dueño (en español; en otros idiomas se queda la traducción de siempre)
    TXT = Object.assign({}, c.textos || {});
    if (!TXT.intro_lema && c.lema && c.lema !== 'La tienda de las estrellas') TXT.intro_lema = c.lema;   // el lema de antes
    $$('[data-t]').forEach(function (el) { el.textContent = T(el.getAttribute('data-t')); });
    var cal = $('#cifra-cal'); if (cal) cal.textContent = c.calificacion || '4.3';
    var op = $('#cifra-op'); if (op) op.textContent = (c.opiniones ? c.opiniones + ' ' : '') + T('hist_op');
    pintarEquiposCasa();
    var dir = $('#dato-dir'), hor = $('#dato-hor');
    if (dir) dir.textContent = c.direccion || '';
    if (hor) pintarHorario(hor, c.horario);
    var saludo = waLink('Hola M Sport, quiero información de uniformes.');
    $('#wa-top').href = saludo; $('#wa-visita').href = saludo;
    $('#mapa').href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Deportes M Sport, ' + (c.direccion || 'Cancún')) + '&query_place_id=ChIJW_VETwUsTI8RK6y9Uue9Ksc';
  }

  /* horario: días agrupados, hora en formato de cada idioma, hoy marcado y "abierto ahora" en hora de Cancún */
  function nombreDia(d, largo) {
    var ref = new Date(Date.UTC(2026, 9, 18 + d, 12)); // 18-oct-2026 fue domingo
    return new Intl.DateTimeFormat(lang, { weekday: largo ? 'long' : 'short', timeZone: 'UTC' }).format(ref);
  }
  function hora(hhmm) {
    var h = +hhmm.slice(0, 2), m = hhmm.slice(3);
    if (lang === 'fr') return h + ' h' + (+m ? ' ' + m : '');
    if (lang === 'pt') return h + 'h' + (+m ? m : '');
    var h12 = h % 12 || 12, suf = h < 12 ? 'am' : 'pm';
    if (lang === 'en') suf = suf.toUpperCase();
    return h12 + (+m ? ':' + m : '') + ' ' + suf;
  }
  function diasTexto(dias) {
    var orden = dias.slice().sort(function (a, b) { return ((a + 6) % 7) - ((b + 6) % 7); });
    var cap = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
    if (orden.length > 2) {
      var seguidos = orden.every(function (d, i) { return !i || (orden[i - 1] + 1) % 7 === d; });
      if (seguidos) return cap(nombreDia(orden[0], true)) + ' ' + T('a_dia') + ' ' + nombreDia(orden[orden.length - 1], true);
    }
    return orden.map(function (d, i) { return i ? nombreDia(d, true) : cap(nombreDia(d, true)); }).join(orden.length === 2 ? ' ' + T('y_dia') + ' ' : ', ');
  }
  function ahoraCancun() {
    var p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Cancun', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    var g = function (t) { return (p.filter(function (x) { return x.type === t; })[0] || {}).value; };
    return { dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')), min: (+g('hour') % 24) * 60 + +g('minute') };
  }
  function pintarHorario(ul, horario) {
    if (!Array.isArray(horario)) horario = window.CONFIG_BASE.horario;
    var ah = ahoraCancun(), abierto = false;
    ul.innerHTML = horario.map(function (h) {
      var hoy = h.dias.indexOf(ah.dia) >= 0;
      var aMin = +h.abre.slice(0, 2) * 60 + +h.abre.slice(3), cMin = +h.cierra.slice(0, 2) * 60 + +h.cierra.slice(3);
      if (hoy && ah.min >= aMin && ah.min < cMin) abierto = true;
      return '<li' + (hoy ? ' class="hoy"' : '') + '><span>' + esc(diasTexto(h.dias)) + (hoy ? ' <em>' + esc(T('hoy')) + '</em>' : '') + '</span><b>' + esc(hora(h.abre)) + ' – ' + esc(hora(h.cierra)) + '</b></li>';
    }).join('');
    var ab = $('#abierto');
    if (ab) { ab.textContent = T(abierto ? 'abierto' : 'cerrado'); ab.className = 'abierto' + (abierto ? ' si' : ''); }
  }
  // equipos que visten M Sport: los que el dueño sube en su panel (foto del uniforme que les hizo, nombre y sus redes).
  // Si todavía no sube ninguno, se ven los uniformes destacados del catálogo.
  var REDES = {
    ig: ['Instagram', 'https://instagram.com/', '<path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>'],
    fb: ['Facebook', 'https://facebook.com/', '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8Z"/>'],
    tt: ['TikTok', 'https://www.tiktok.com/@', '<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.6 2.4 4.4 5 4.6"/>']
  };
  function linkRed(tipo, v) {
    if (!v) return ''; if (/^https?:\/\//i.test(v)) return v;
    if (/^(www\.)?(instagram|facebook|tiktok)\.com/i.test(v)) return 'https://' + v;
    return REDES[tipo][1] + v.replace(/^@/, '');
  }
  function pintarEquiposCasa() {
    var cont = $('#eq-casa'); if (!cont) return;
    var cl = (TIENDA.config.clientes || []).filter(function (x) { return x.foto || x.nombre; });
    if (cl.length) {
      cont.classList.add('clientes');
      cont.innerHTML = cl.map(function (x) {
        var redes = ['ig', 'fb', 'tt'].filter(function (t) { return x[t]; }).map(function (t) {
          return '<a class="red" href="' + esc(linkRed(t, x[t])) + '" target="_blank" rel="noopener" aria-label="' + esc(REDES[t][0] + ' de ' + x.nombre) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + REDES[t][2] + '</svg></a>';
        }).join('');
        return '<div class="eq-cliente">' + (x.foto ? '<img src="' + esc(x.foto) + '" alt="' + esc(x.nombre) + '" loading="lazy" decoding="async">' : '') + '<b>' + esc(x.nombre) + '</b>' + (redes ? '<span class="redes">' + redes + '</span>' : '') + '</div>';
      }).join('');
      return;
    }
    cont.classList.remove('clientes');
    var lista = catalogoVisible().filter(function (u) { return u.destacado; }).slice(0, 4);
    if (!lista.length) lista = catalogoVisible().slice(0, 2);
    cont.innerHTML = lista.map(function (u) {
      return '<button type="button" class="eq-casa-item" data-casa="' + esc(u.id) + '"><img src="' + esc(u.silueta || u.mini) + '" alt="" loading="lazy" decoding="async"><b>' + esc(u.nombre) + '</b><small>' + esc(T('eq_ver')) + ' →</small></button>';
    }).join('');
    $$('[data-casa]', cont).forEach(function (b) {
      b.addEventListener('click', function () {
        var u = lista.filter(function (x) { return x.id === b.getAttribute('data-casa'); })[0];
        if (u) abrirProbador(u, b);
      });
    });
  }

  /* ---------- probador a pantalla completa: uniforme fijo arriba, pasos abajo; la página de atrás no se mueve ---------- */
  var estudio = $('#estudio'), lugarEstudio = estudio.parentNode, probador = $('#probador'), hueco = document.createElement('div');
  var ancla = null;
  function abrirProbador(u, el) {
    prepararSonido();   // se baja desde ahora: cuando llegue el folio ya está listo
    abrir3D();
    ancla = el ? { el: el, top: el.getBoundingClientRect().top } : null;
    if (u) { S.modo = 'catalogo'; S.equipos = []; S.esEquipo = false; S.jugadores = []; S.nombreEquipo = ''; usarBase(u); S.paso = 1; }   // se abre directo en su uniforme (ahí están local / visitante)
    if (probador.hidden) {
      hueco.style.height = estudio.offsetHeight + 'px'; lugarEstudio.insertBefore(hueco, estudio);
      $('#probador-cuerpo').appendChild(estudio);
      FIJAR.on();
      probador.hidden = false;
    }
    tablero.scrollTop = 0;
    pintarTablero(); verVistaDe(pasos()[S.paso]); dibujar(); guardarBorrador(); moverPulgar();
  }
  function cerrarProbador() {
    if (probador.hidden) return;
    verGrande(false, true);
    lugarEstudio.insertBefore(estudio, hueco); hueco.remove();
    probador.hidden = true;
    pintarTablero();
    FIJAR.off();
    if (ancla && document.body.contains(ancla.el)) window.scrollTo({ top: window.scrollY + ancla.el.getBoundingClientRect().top - ancla.top, behavior: 'instant' });
    if (motor) motor.redibujar(); moverPulgar();
  }
  $('#probador-x').addEventListener('click', cerrarProbador);

  /* ---- ver el uniforme en grande mientras se arma (celular) ----
     Tocar el uniforme o la lupa lo agranda hasta la barra de abajo; otra vez, regresa a los pasos. */
  var escenario = $('#escenario'), lupa = $('#lupa');
  var ICON_GRANDE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-6 6M4 20l6-6"/></svg>';
  var ICON_CHICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10h-6V4M4 14h6v6M14 10l6-6M10 14l-6 6"/></svg>';
  function esCelular() { return window.matchMedia('(max-width: 980px)').matches; }
  function altoGrande() { var b = $('#paso-barra'); return window.innerHeight - (b ? b.offsetHeight : 0); }
  function pintarLupa() {
    var g = probador.classList.contains('grande');
    lupa.innerHTML = g ? ICON_CHICO : ICON_GRANDE;
    lupa.setAttribute('aria-label', T(g ? 'ver_pasos' : 'ver_grande'));
  }
  function verGrande(si, sinAnim) {
    if (probador.hidden && si) return;
    if (si === probador.classList.contains('grande')) return;
    if (si && !esCelular()) return;
    enfocar('cuerpo');   // en grande siempre se ve el uniforme completo
    var desde = escenario.getBoundingClientRect().height;
    probador.classList.toggle('grande', si);
    probador.classList.remove('achicando');
    escenario.style.height = '';
    if (!si) ajustarEscenario();
    var hasta = si ? altoGrande() : escenario.getBoundingClientRect().height;   // al regresar: el alto que le toca junto a los pasos
    pintarLupa();
    if (sinAnim) { escenario.style.height = si ? hasta + 'px' : ''; return; }
    // al achicar, el alto automático de los pasos (con !important) brincaba de golpe: mientras dura la animación manda el alto que le damos
    if (!si) probador.classList.add('achicando');
    escenario.classList.remove('creciendo');
    escenario.style.height = desde + 'px'; void escenario.offsetHeight;
    escenario.classList.add('creciendo');
    escenario.style.height = hasta + 'px';
    var listo = false;
    function fin() { if (listo) return; listo = true; escenario.classList.remove('creciendo'); probador.classList.remove('achicando'); if (!probador.classList.contains('grande')) { escenario.style.height = ''; ajustarEscenario(); } moverPulgar(); }
    escenario.addEventListener('transitionend', function te(e) { if (e.target === escenario) { escenario.removeEventListener('transitionend', te); fin(); } });
    setTimeout(fin, 700);
  }
  lupa.addEventListener('click', function () { verGrande(!probador.classList.contains('grande')); });
  $('#lienzo-wrap').addEventListener('click', function () { if (!probador.hidden && esCelular()) verGrande(!probador.classList.contains('grande')); });
  window.addEventListener('resize', function () { if (probador.classList.contains('grande')) { if (esCelular()) escenario.style.height = altoGrande() + 'px'; else verGrande(false, true); } });
  pintarLupa();
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarProbador(); });
  /* ---------- folio compartido ---------- */
  function abrirFolio(id, k) {
    var capa = $('#folio-capa'), cuerpo = $('#folio-cuerpo');
    capa.hidden = false; FIJAR.on(); cuerpo.innerHTML = '<p>' + esc(T('cargando')) + '</p>';
    fetch('/api/folio?id=' + encodeURIComponent(id) + '&k=' + encodeURIComponent(k)).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (f) {
      cuerpo.innerHTML = folioHTML(f, false);
      $$('[data-armar]', cuerpo).forEach(function (b) {
        b.addEventListener('click', function () {
          var e = f.equipos[+b.getAttribute('data-armar')];
          S.modo = 'catalogo'; S.d = Object.assign(clone(BASE_D), e.diseno); if (e.diseno.base) S.baseId = e.diseno.base; S.paso = pasos().indexOf('dorsal');
          capa.hidden = true; FIJAR.off();
          history.replaceState(null, '', '/');
          abrirProbador(null, null);
        });
      });
    }).catch(function () { cuerpo.innerHTML = '<p>' + esc(T('folio_no')) + '</p>'; });
  }
  function folioHTML(f, dueno) {
    var fecha = new Date(f.creado).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
    var h = '<p class="kicker">' + esc(T('folio_t')) + '</p><h2 id="folio-tt">' + esc(f.id) + '</h2><p style="margin:8px 0 0;color:var(--suave)">' + esc(fecha) + ' · <span class="estado ' + esc(f.estado) + '">' + esc(T('est_' + f.estado)) + '</span></p>';
    f.equipos.forEach(function (e, i) {
      h += '<div class="folio-eq"><figure><img src="' + esc(e.vistas.frente) + '" alt="' + esc(T('v_frente')) + '" loading="lazy"></figure><figure><img src="' + esc(e.vistas.espalda) + '" alt="' + esc(T('v_espalda')) + '" loading="lazy"></figure>' +
        '<div class="tabla-wrap"><h3 style="font:800 26px/1 var(--display);text-transform:uppercase;margin:4px 0 10px">' + esc(e.nombre) + '</h3>';
      var conDatos = (e.jugadores || []).filter(function (j) { return j.nombre || j.numero || j.talla; });
      if (conDatos.length > 1 || (conDatos.length === 1 && conDatos[0].talla)) {
        h += '<table class="tabla"><thead><tr><th>' + esc(T('jugador')) + '</th><th>' + esc(T('numero')) + '</th><th>' + esc(T('talla')) + '</th></tr></thead><tbody>' +
          e.jugadores.map(function (j) { return '<tr><td>' + esc(j.nombre) + '</td><td>' + esc(j.numero) + '</td><td>' + esc(j.talla) + '</td></tr>'; }).join('') + '</tbody></table>';
      } else if (e.diseno && (e.diseno.nombre || e.diseno.numero)) {
        h += '<p>' + esc(e.diseno.nombre || '') + ' · ' + esc(e.diseno.numero || '') + '</p>';
      }
      if (dueno && e.originales && e.originales.length) h += '<p class="nota">' + e.originales.map(function (u, n) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener">Archivo ' + (n + 1) + '</a>'; }).join(' · ') + '</p>';
      if (dueno && e.avisos && e.avisos.length) h += '<p class="nota">Avisos que vio el cliente: ' + esc(e.avisos.join(', ')) + '</p>';
      if (!dueno) h += '<div class="subir"><button type="button" class="btn btn-linea" data-armar="' + i + '">' + esc(T('folio_armar')) + '</button></div>';
      h += '</div></div>';
    });
    return h;
  }
  $$('[data-cerrar]').forEach(function (b) { b.addEventListener('click', function () { var c = b.closest('.capa'); if (!c.hidden) { c.hidden = true; FIJAR.off(); } }); });
  /* ---------- avisos breves ---------- */
  var toastEl = null, toastT = 0;
  function toast(msg, fijo) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('ver');
    clearTimeout(toastT); if (!fijo) toastT = setTimeout(quitarToast, 2600);
  }
  function quitarToast() { clearTimeout(toastT); if (toastEl) toastEl.classList.remove('ver'); }

  /* ---------- borrador del cliente ---------- */
  function guardarBorrador() {
    store.set('borrador', { modo: S.modo, paso: S.paso, baseId: S.baseId, d: S.d, tallaUno: S.tallaUno, esEquipo: S.esEquipo, nombreEquipo: S.nombreEquipo, jugadores: S.jugadores });
  }
  function cargarBorrador() {
    var b = store.get('borrador');
    if (!b || !b.d || !b.modo || b.d.taco == null) return;
    S.modo = b.modo; S.paso = b.paso || 0; S.baseId = b.baseId; S.d = Object.assign(clone(BASE_D), b.d); S.esEquipo = !!b.esEquipo; S.tallaUno = b.tallaUno || ''; S.nombreEquipo = b.nombreEquipo || ''; S.jugadores = b.jugadores || [];
  }

  /* ---------- arranque ---------- */
  // lo guardado por el dueño puede ser de antes de una mejora: lo que falte de los uniformes de arranque se toma de ahí
  function completarCatalogo(lista) {
    var base = {}; window.CATALOGO_BASE.forEach(function (u) { base[u.id] = u; });
    return lista.map(function (u) { var b = base[u.id]; if (b && !u.silueta && b.silueta) u.silueta = b.silueta; return u; });
  }
  function cargarTienda() {
    return fetch('/api/tienda', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (t) {
      // un catálogo guardado del sistema anterior (dibujos) no se usa: solo uniformes con foto real en 3D
      if (Array.isArray(t.catalogo) && t.catalogo.some(function (u) { return u.tipo === '3d'; })) TIENDA.catalogo = completarCatalogo(t.catalogo);
      TIENDA.config = Object.assign({}, window.CONFIG_BASE, t.config || {});
    }).catch(function () { /* si no hay conexión, se queda el catálogo de arranque */ });
  }
  // lo que se ve antes de empezar: el primer uniforme destacado con un nombre de ejemplo
  function vitrina() {
    var l = catalogoVisible(), u = l.filter(function (x) { return x.destacado; })[0] || l[0];
    if (!u) return;
    S.baseId = u.id; S.d = clone(BASE_D); S.d.nombre = 'M SPORT'; S.d.numero = '10'; S.d.colorTexto = u.colorTexto || '#111111'; S.d.colorAuto = true;
  }
  // pantalla fija: sin acercar ni alejar con los dedos (iPhone ignora la etiqueta del navegador)
  ['gesturestart', 'gesturechange'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  function iniciar() {
    if (!new URLSearchParams(location.search).has('folio')) window.scrollTo(0, 0);
    $('#marca-logo').insertAdjacentHTML('afterbegin', logoSVG('#1F2E7A', '#FFFFFF'));
    $('#portada-logo').innerHTML = logoSVG('#1F2E7A', '#FFFFFF');
    // la barra muestra el logo solo cuando la portada (que ya lo trae) quedó arriba, fuera de la vista
    var top = $('.top'), portadaTxt = $('.portada-txt');
    if (top && portadaTxt && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { top.classList.toggle('con-marca', !es[0].isIntersecting); }, { rootMargin: '-67px 0px 0px 0px' }).observe(portadaTxt);
    } else if (top) top.classList.add('con-marca');
    $('#portada-balon').innerHTML = BALON;
    intro();
    cargarBorrador();
    if (!S.modo) vitrina();
    aplicarIdioma(); setTimeout(moverPulgar, 60);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moverPulgar);
    cargarTienda().then(function () {
      if (!S.modo || !uniformeActual() || uniformeActual().id !== S.baseId) { if (!S.modo) vitrina(); else { var u = uniformeActual(); if (u) usarBase(u); } }
      pintarCatalogo(); pintarDatos(); pintarTablero(); dibujar();
    });
    var q = new URLSearchParams(location.search);
    if (q.get('folio')) abrirFolio(q.get('folio'), q.get('k') || '');
  }

  window.APP = { probarSonido: probarSonido, pararSonido: pararSonido, T: T, esc: esc, clone: clone, completarCatalogo: completarCatalogo, logoSVG: logoSVG, folioHTML: folioHTML, TIENDA: TIENDA, cargarTienda: cargarTienda, pintarCatalogo: pintarCatalogo, pintarDatos: pintarDatos, pintarTablero: pintarTablero, subirConReintento: subirConReintento, cargarArchivo: cargarArchivo, aCanvas: aCanvas, nitidez: nitidez, toast: toast, lluvia: lluviaDePremios, dibujar: dibujar, cargarMotor: cargarMotorYa, get motor() { return motor; }, S: S, get lang() { return lang; } };
  iniciar();
})();
