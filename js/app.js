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
  // al recargar, la página empieza siempre hasta arriba
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------- idioma ---------- */
  var LANGS = Object.keys(window.I18N);
  // el idioma lo decide el celular o la computadora de cada persona
  var lang = ((navigator.languages && navigator.languages[0]) || navigator.language || 'es').slice(0, 2).toLowerCase();
  if (LANGS.indexOf(lang) < 0) lang = 'es';
  function T(k) { return (window.I18N[lang] && window.I18N[lang][k]) || window.I18N.es[k] || k; }
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
  var DISENO_LIBRE = { manga: 'corta', relleno: { tipo: 'color', color: '#FFFFFF' }, cuello: '#1F2E7A', costados: null, short: { color: '#1F2E7A' }, logos: [], patrocinadores: [], colorTexto: '#1F2E7A', sello: true, nombre: '', numero: '', numeroShort: false };
  var S = {
    modo: null, paso: 0, vista: 'front', baseId: null,
    d: clone(DISENO_LIBRE),
    equipos: [], esEquipo: false, nombreEquipo: '', jugadores: [],
    avisos: {}, telas: {}, patroSel: -1, mangaLado: 'izq', originales: {}, remotos: {}, pendientes: [], colorPatro: 'auto'
  };
  var PASOS = {
    catalogo: ['diseno', 'manga', 'dorsal', 'equipo', 'listo'],
    libre: ['relleno', 'espalda', 'detalles', 'logo', 'patro', 'manga', 'dorsal', 'equipo', 'listo']
  };
  function pasos() {
    var p = PASOS[S.modo] || [];
    if (S.d.foto) p = p.filter(function (x) { return x !== 'manga'; });
    return p;
  }

  /* ---------- dibujo del escenario ---------- */
  var lienzo = $('#lienzo');
  var dibujando = false, otraVez = false;
  function dibujar() {
    if (dibujando) { otraVez = true; return; }
    dibujando = true;
    var suave = S.suave; S.suave = false;
    if (suave) { var g = antes.getContext('2d'); g.clearRect(0, 0, antes.width, antes.height); g.drawImage(lienzo, 0, 0); }
    Kit.render(lienzo, S.d, S.vista, { lado: S.mangaLado }).then(function () {
      dibujando = false;
      if (suave) {
        var wrap = $('#lienzo-wrap');
        wrap.classList.remove('tr-lado', 'tr-zoom', 'tr-izq', 'tr-der', 'tr-sale', 'tr-ok', 'tr-funde'); void wrap.offsetWidth;
        wrap.classList.add('tr-funde', 'tr-sale');
        requestAnimationFrame(function () { requestAnimationFrame(function () { wrap.classList.add('tr-ok'); }); });
      }
      if (otraVez) { otraVez = false; dibujar(); }
    });
  }
  var ORDEN_VISTA = { front: 0, back: 1, manga: 2 };
  var antes = $('#lienzo-antes'), transicion = 0;
  function moverPulgar() {
    var b = $('.vista.on'), p = $('#vistas-pulgar');
    if (!b || !p) return;
    p.style.width = b.offsetWidth + 'px';
    p.style.transform = 'translateX(' + b.offsetLeft + 'px)';
  }
  window.addEventListener('resize', moverPulgar);
  function cambiarVista(v) {
    if (v === S.vista) return;
    var desde = S.vista;
    S.vista = v;
    $$('.vista').forEach(function (b) { var on = b.getAttribute('data-vista') === v; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    moverPulgar();
    // la vista anterior se queda en una copia y se desvanece mientras entra la nueva
    var g = antes.getContext('2d'); g.clearRect(0, 0, antes.width, antes.height); g.drawImage(lienzo, 0, 0);
    var tipo = (v === 'manga' || desde === 'manga') ? 'zoom' : 'lado';
    var dir = ORDEN_VISTA[v] > ORDEN_VISTA[desde] ? 1 : -1;
    var mio = ++transicion;
    Kit.render(lienzo, S.d, S.vista, { lado: S.mangaLado }).then(function () {
      if (mio !== transicion) return;
      var wrap = $('#lienzo-wrap');
      wrap.classList.remove('tr-lado', 'tr-zoom', 'tr-izq', 'tr-der', 'tr-sale', 'tr-ok', 'tr-funde'); void wrap.offsetWidth;
      wrap.classList.add('tr-' + tipo, dir > 0 ? 'tr-der' : 'tr-izq', 'tr-sale');
      requestAnimationFrame(function () { requestAnimationFrame(function () { wrap.classList.add('tr-ok'); }); });
    });
  }
  $$('.vista').forEach(function (b) { b.addEventListener('click', function () { cambiarVista(b.getAttribute('data-vista')); }); });
  function verVistaDe(paso) {
    var v = paso === 'dorsal' ? 'back' : paso === 'patro' ? 'manga' : (paso === 'espalda') ? 'back' : (paso === 'relleno' || paso === 'detalles' || paso === 'logo' || paso === 'diseno' || paso === 'manga') ? 'front' : null;
    if (v === 'manga' && S.d.foto) v = 'front';
    if (paso === 'patro' && !S.d.foto) {
      var ps = Kit.patros(S.d), p0 = ps[S.patroSel] || ps[0];
      if (p0) { mirarPatro(p0); return; }
      S.mangaLado = 'izq';
    }
    if (v) cambiarVista(v);
  }

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
  function luzMedia(c) {
    var t = aCanvas(c, 40), d = t.getContext('2d').getImageData(0, 0, t.width, t.height).data, s = 0, n = 0;
    for (var i = 0; i < d.length; i += 4) { if (d[i + 3] < 20) continue; s += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; n++; }
    return n ? s / n : 255;
  }
  function quitarFondo(c) {
    // si la orilla es de un solo color, se vuelve transparente desde las orillas hacia adentro
    var g = c.getContext('2d'), w = c.width, h = c.height, im = g.getImageData(0, 0, w, h), d = im.data;
    var orilla = [], i, x, y;
    for (x = 0; x < w; x += 3) { orilla.push((0 * w + x) * 4, ((h - 1) * w + x) * 4); }
    for (y = 0; y < h; y += 3) { orilla.push((y * w) * 4, (y * w + w - 1) * 4); }
    var transp = 0, r = 0, gg = 0, b = 0, n = 0;
    orilla.forEach(function (p) { if (d[p + 3] < 30) transp++; else { r += d[p]; gg += d[p + 1]; b += d[p + 2]; n++; } });
    if (transp > orilla.length * 0.6) return 'transparente';
    r /= n; gg /= n; b /= n;
    var dif = 0;
    orilla.forEach(function (p) { if (d[p + 3] >= 30) dif += Math.abs(d[p] - r) + Math.abs(d[p + 1] - gg) + Math.abs(d[p + 2] - b); });
    if (dif / n > 40) return 'raro';
    var tol = 60, vis = new Uint8Array(w * h), cola = [];
    function parece(k) { var p = k * 4; return Math.abs(d[p] - r) + Math.abs(d[p + 1] - gg) + Math.abs(d[p + 2] - b) < tol; }
    for (x = 0; x < w; x++) { cola.push(x, (h - 1) * w + x); }
    for (y = 0; y < h; y++) { cola.push(y * w, y * w + w - 1); }
    while (cola.length) {
      var k = cola.pop();
      if (vis[k] || !parece(k)) continue;
      vis[k] = 1; d[k * 4 + 3] = 0;
      var cx = k % w, cy = (k - cx) / w;
      if (cx > 0) cola.push(k - 1); if (cx < w - 1) cola.push(k + 1);
      if (cy > 0) cola.push(k - w); if (cy < h - 1) cola.push(k + w);
    }
    g.putImageData(im, 0, 0);
    return 'limpio';
  }
  // Si la foto trae una prenda completa sobre un fondo liso, se busca la prenda y se toma solo la tela del centro.
  function autoRecorte(c) {
    var t = aCanvas(c, 300), g = t.getContext('2d'), w = t.width, h = t.height, d = g.getImageData(0, 0, w, h).data;
    var orilla = [], x, y;
    for (x = 0; x < w; x += 2) orilla.push(x * 4, ((h - 1) * w + x) * 4);
    for (y = 0; y < h; y += 2) orilla.push((y * w) * 4, (y * w + w - 1) * 4);
    var r = 0, gg = 0, b = 0;
    orilla.forEach(function (p) { r += d[p]; gg += d[p + 1]; b += d[p + 2]; });
    r /= orilla.length; gg /= orilla.length; b /= orilla.length;
    var dif = 0; orilla.forEach(function (p) { dif += Math.abs(d[p] - r) + Math.abs(d[p + 1] - gg) + Math.abs(d[p + 2] - b); });
    var TODA = { x: 0, y: 0, w: 1, h: 1, auto: false };
    if (dif / orilla.length > 36) return TODA; // foto de pura tela
    // máscara de prenda y suma acumulada para medir rápido cuánta prenda hay en un cuadro
    var S2 = new Uint32Array((w + 1) * (h + 1)), cols = new Uint32Array(w);
    for (y = 0; y < h; y++) {
      var fila = 0;
      for (x = 0; x < w; x++) {
        var k = (y * w + x) * 4, f = (Math.abs(d[k] - r) + Math.abs(d[k + 1] - gg) + Math.abs(d[k + 2] - b) > 26) ? 1 : 0;
        fila += f; cols[x] += f;
        S2[(y + 1) * (w + 1) + x + 1] = S2[y * (w + 1) + x + 1] + fila;
      }
    }
    function suma(x0, y0, x1, y1) { return S2[y1 * (w + 1) + x1] - S2[y0 * (w + 1) + x1] - S2[y1 * (w + 1) + x0] + S2[y0 * (w + 1) + x0]; }
    // tramos de columnas con prenda (puede haber varias prendas lado a lado)
    var tramos = [], ini = -1;
    for (x = 0; x <= w; x++) {
      var hay = x < w && cols[x] > h * 0.12;
      if (hay && ini < 0) ini = x;
      if (!hay && ini >= 0) { if (x - ini > w * 0.08) tramos.push([ini, x]); ini = -1; }
    }
    if (!tramos.length) return TODA;
    var mejor = tramos.sort(function (A, B) { return Math.abs((A[0] + A[1]) / 2 - w / 2) - Math.abs((B[0] + B[1]) / 2 - w / 2); })[0];
    var sx0 = mejor[0], sx1 = mejor[1], sw = sx1 - sx0, scx = (sx0 + sx1) / 2;
    var ry0 = h, ry1 = 0;
    for (y = 0; y < h; y++) if (suma(sx0, y, sx1, y + 1) > sw * 0.35) { if (y < ry0) ry0 = y; ry1 = y; }
    var bh = ry1 - ry0;
    if (bh < h * 0.1) return TODA;
    // el cuadro más grande que quepa dentro de la tela, abajo del pecho y centrado
    for (var L = Math.round(sw * 0.62); L >= Math.max(10, sw * 0.14); L -= 3) {
      var mejorPos = null, mejorDist = 1e9;
      for (var cy = ry0 + bh * 0.42 + L / 2; cy + L / 2 <= ry1 - bh * 0.04; cy += 3) {
        for (var cx = scx - sw * 0.18; cx <= scx + sw * 0.18; cx += 3) {
          var x0 = Math.round(cx - L / 2), y0 = Math.round(cy - L / 2);
          if (x0 < 0 || y0 < 0 || x0 + L > w || y0 + L > h) continue;
          if (suma(x0, y0, x0 + L, y0 + L) < L * L * 0.93) continue;
          var dist = Math.abs(cx - scx) + Math.abs(cy - (ry0 + bh * 0.62));
          if (dist < mejorDist) { mejorDist = dist; mejorPos = [x0, y0]; }
        }
      }
      if (mejorPos) return { x: mejorPos[0] / w, y: mejorPos[1] / h, w: L / w, h: L / h, auto: true };
    }
    return TODA;
  }
  // Convierte un pedazo de foto en tela continua: el pedazo se repite en espejo para que no se noten uniones
  function hacerTela(fuente, R, forzar) {
    var sx = R.x * fuente.width, sy = R.y * fuente.height, sw = Math.max(8, R.w * fuente.width), sh = Math.max(8, R.h * fuente.height);
    if (!forzar && Math.min(sw, sh) >= 520) {
      // pedazo grande: se usa tal cual, sin repetir
      var u = document.createElement('canvas'); u.width = Math.round(sw); u.height = Math.round(sh);
      u.getContext('2d').drawImage(fuente, sx, sy, sw, sh, 0, 0, u.width, u.height); return u;
    }
    var lado = Math.min(600, Math.max(sw, sh, 300)), c = document.createElement('canvas');
    c.repetir = true;
    c.width = c.height = Math.round(lado * 2);
    var g = c.getContext('2d');
    [[0, 0, 1, 1], [1, 0, -1, 1], [0, 1, 1, -1], [1, 1, -1, -1]].forEach(function (m) {
      g.save(); g.translate(m[0] * lado * 2, m[1] * lado * 2); g.scale(m[2], m[3]);
      g.drawImage(fuente, sx, sy, sw, sh, 0, 0, lado, lado); g.restore();
    });
    return c;
  }
  function recortarTransparente(c) {
    var g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
    var x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0 || y1 <= y0) return c;
    var o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    o.getContext('2d').drawImage(c, -x0, -y0); return o;
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
  // Prepara una imagen: versión para dibujar (local) y original para producción (se sube en segundo plano)
  function prepararImagen(file, tipo) {
    return cargarArchivo(file).then(function (im) {
      var W0 = im.naturalWidth, H0 = im.naturalHeight, info = { avisos: [], ancho: W0, alto: H0 };
      if (tipo === 'relleno') {
        if (Math.min(W0, H0) < 900) info.avisos.push('chica');
        if (nitidez(im) < 22) info.avisos.push('borrosa');
        var vista = aCanvas(im, 1600), orig = aCanvas(im, 2400);
        info.fuente = vista;
        info.recorte = autoRecorte(vista);
        var tela = hacerTela(vista, info.recorte);
        info.repetir = !!tela.repetir;
        info.local = tela.toDataURL('image/jpeg', 0.9);
        info.original = orig.toDataURL('image/jpeg', 0.92);
        info.luz = luzMedia(tela);
        info.zoom = zoomPixel(im);
      } else {
        var c = aCanvas(im, 1000);
        info.fondo = quitarFondo(c);
        c = recortarTransparente(c);
        if (Math.max(W0, H0) < 300) info.avisos.push('chica');
        info.local = c.toDataURL('image/png');
        info.original = info.local;
        info.zoom = zoomPixel(im);
      }
      URL.revokeObjectURL(im.src);
      var p = subirConReintento(info.original).then(function (url) { if (tipo !== 'relleno') S.remotos[info.local] = url; S.originales[info.local] = url; return url; })
        .catch(function () { return null; });
      S.pendientes.push(p);
      if (tipo === 'relleno') {
        var origUrl = p;
        info.origPromesa = origUrl;
        S.pendientes.push(subirConReintento(info.local).then(function (u) { S.remotos[info.local] = u; }).catch(function () {}));
      }
      return info;
    });
  }
  function zoomPixel(im) {
    // muestra cómo se ve un pedazo de la foto ampliado al tamaño de impresión
    var W0 = im.naturalWidth, H0 = im.naturalHeight, lado = Math.max(24, Math.round(Math.min(W0, H0) * 0.18));
    var c = document.createElement('canvas'); c.width = c.height = 260;
    var g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(im, (W0 - lado) / 2, (H0 - lado) / 2, lado, lado, 0, 0, 260, 260);
    return c.toDataURL('image/png');
  }

  /* ---------- tablero de pasos ----------
     Reglas: (1) cada paso cabe completo en el celular más chico; (2) "Atrás" y "Siguiente" viven en una barra fija;
     (3) las rejillas se acomodan con cuentas, nunca queda un elemento solo en un renglón;
     (4) solo la lista de jugadores puede crecer, y entonces se avisa que hay más abajo. */
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
    // se prueba de 1 en adelante cuántas columnas hacen falta para que TODO quepa, con el tamaño real de cada tarjeta
    var n = g.children.length; if (!n) return;
    var caja = $('#paso-cuerpo');
    var pad = caja ? parseFloat(getComputedStyle(caja).paddingBottom) || 0 : 0;
    var alto = caja ? caja.clientHeight - pad - (g.getBoundingClientRect().top - caja.getBoundingClientRect().top) - 2 : 400;
    var ancho = g.clientWidth, gap = 8, extra = 6 + 8 + 4 + 28; // marco + relleno + separación + dos renglones de nombre
    var cols = 1;
    for (; cols <= n; cols++) {
      var w = (ancho - gap * (cols - 1)) / cols, filas = Math.ceil(n / cols);
      if (w > 150) continue;
      if (filas * (w * 1.05 + extra) + (filas - 1) * gap <= alto) break;
    }
    var wFinal = Math.min(150, (ancho - gap * (cols - 1)) / cols);
    var filas2 = Math.ceil(n / cols), cols2 = Math.ceil(n / filas2); // renglones parejos
    g.style.gridTemplateColumns = 'repeat(' + cols2 + ', ' + Math.floor(wFinal) + 'px)';
  }
  window.addEventListener('resize', function () { if (!probador.hidden) acomodar(tablero); });

  function pintarTablero(dir) {
    if (!tablero) return;
    if (!S.modo || probador.hidden) { tablero.classList.remove('en-pasos'); tablero.innerHTML = vistaInicio(); enlazarInicio(); return; }
    var lista = pasos();
    S.paso = Math.max(0, Math.min(lista.length - 1, S.paso));
    var id = lista[S.paso];
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
          if (n === 'siguiente') { if (pasos()[S.paso] === 'listo') cotizar(); else irA(S.paso + 1); }
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
    vigilarMas();
  }
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
    pintarTablero(S.paso > antes_ ? 1 : -1); verVistaDe(lista[S.paso]); guardarBorrador();
  }
  function enlazarComunes() {
    $$('.color[data-campo]', tablero).forEach(function (b) {
      b.addEventListener('click', function () {
        var campo = b.getAttribute('data-campo'), c = b.getAttribute('data-color') || null;
        if (campo === 'relleno' || campo === 'rellenoEspalda') { elegirTela(campo === 'relleno' ? 'frente' : 'espalda', c, b); return; }
        else if (campo === 'short') { S.d.short = S.d.short || {}; S.d.short.relleno = null; S.d.short.color = c; }
        else S.d[campo] = c;
        $$('.color[data-campo="' + campo + '"]', tablero).forEach(function (x) { x.classList.toggle('on', x === b); });
        dibujar(); guardarBorrador();
      });
    });
  }
  function reiniciar() {
    S.modo = null; S.paso = 0; S.baseId = null; S.d = clone(DISENO_LIBRE); S.equipos = []; S.esEquipo = false; S.jugadores = []; S.nombreEquipo = ''; S.avisos = {}; S.avisoLog = []; S.telas = {}; S.tallaUno = ''; S.patroSel = -1; S.mangaLado = 'izq';
    store.set('borrador', null);
    if (!probador.hidden) cerrarProbador();
    vitrina(); pintarTablero(); cambiarVista('front'); dibujar();
  }

  function vistaInicio() {
    return '<div class="paso"><h3>' + esc(T('inicio_t')) + '</h3><div class="caminos">' +
      (S.modo ? '<button type="button" class="camino camino-sigue" data-camino="seguir"><span class="ico">' + icono('lapiz') + '</span><div><b>' + esc(T('seguir_armando')) + '</b><span>' + esc(T('seguir_armando_p')) + '</span></div></button>' : '') +
      '<button type="button" class="camino" data-camino="catalogo"><span class="ico">' + icono('lista') + '</span><div><b>' + esc(T('inicio_a')) + '</b><span>' + esc(T('inicio_a_p')) + '</span></div></button>' +
      '<button type="button" class="camino" data-camino="libre"><span class="ico">' + icono('lapiz') + '</span><div><b>' + esc(T('inicio_b')) + '</b><span>' + esc(T('inicio_b_p')) + '</span></div></button>' +
      '</div></div>';
  }
  function enlazarInicio() {
    $$('[data-camino]', tablero).forEach(function (b) {
      b.addEventListener('click', function () {
        var m = b.getAttribute('data-camino');
        if (m !== 'seguir') {
          S.modo = m; S.paso = 0; S.equipos = []; S.esEquipo = false; S.jugadores = []; S.nombreEquipo = '';
          if (m === 'libre') { S.d = clone(DISENO_LIBRE); S.baseId = null; S.telas = {}; S.avisos = {}; S.patroSel = -1; S.mangaLado = 'izq'; }
          else { var primero = catalogoVisible()[0]; if (primero) usarBase(primero); }
        }
        abrirProbador(null, null);
      });
    });
  }

  function catalogoVisible() { return (TIENDA.catalogo || []).filter(function (u) { return !u.oculto && !u.borrado; }).sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); }); }
  function usarBase(u) {
    var nombre = S.d.nombre, numero = S.d.numero, ns = S.d.numeroShort;
    S.baseId = u.id;
    if (u.tipo === 'foto') S.d = { foto: clone(u.foto), colorTexto: u.colorTexto || '#111111', nombre: nombre, numero: numero };
    else { S.d = clone(u.diseno); S.d.nombre = nombre; S.d.numero = numero; if (ns != null && S.d.numeroShort == null) S.d.numeroShort = ns; }
    S.suave = true; // el siguiente dibujo cambia con un fundido suave
  }

  /* ---- títulos de cada paso (la parte de arriba, siempre corta) ---- */
  var CABEZAS = {
    diseno: function () { return '<h3>' + esc(T('p_diseno')) + '</h3>'; },
    relleno: function () { return '<h3>' + esc(T('p_relleno')) + '</h3>'; },
    espalda: function () { return '<h3>' + esc(T('p_espalda')) + '</h3>'; },
    detalles: function () { return '<h3>' + esc(T('p_detalles')) + '</h3>'; },
    logo: function () { return '<h3>' + esc(T('p_logo')) + '</h3>'; },
    patro: function () { return '<h3>' + esc(T('p_patro')) + '</h3>'; },
    manga: function () { return '<h3>' + esc(T('p_manga')) + '</h3>'; },
    dorsal: function () { return '<h3>' + esc(T('p_dorsal')) + '</h3>'; },
    equipo: function () { return '<h3>' + esc(T('p_equipo')) + '</h3>'; },
    listo: function () { return '<h3>' + esc(T('p_listo')) + '</h3>'; }
  };
  function filaTam(n) {
    n = n == null ? 2 : n;
    return '<div class="grupo fila-tam"><span class="etq">' + esc(T('tamano')) + '</span><div class="tam-btns"><button type="button" class="icon-btn" data-ltam="-1" aria-label="' + esc(T('mas_chico')) + '"' + (n <= 0 ? ' disabled' : '') + '>−</button><button type="button" class="icon-btn" data-ltam="1" aria-label="' + esc(T('mas_grande')) + '"' + (n >= 4 ? ' disabled' : '') + '>+</button></div></div>';
  }
  function enlazarTam(obj, alCambiar) {
    $$('[data-ltam]', tablero).forEach(function (b) {
      b.addEventListener('click', function () {
        var n = obj.tam == null ? 2 : obj.tam, nuevo = Math.max(0, Math.min(4, n + +b.getAttribute('data-ltam')));
        if (nuevo === n) return;
        obj.tam = nuevo;
        $$('[data-ltam]', tablero).forEach(function (x) { x.disabled = +x.getAttribute('data-ltam') < 0 ? nuevo <= 0 : nuevo >= 4; });
        if (alCambiar) alCambiar();
        dibujar(); guardarBorrador();
      });
    });
  }
  // a qué vista mirar según dónde va un patrocinador
  function mirarPatro(p) {
    if (!p) return;
    var v = p.pos === 'pecho' ? 'front' : p.pos === 'espalda' ? 'back' : 'manga', lado = p.pos === 'manga-der' ? 'der' : 'izq';
    if (v === 'manga' && S.vista === 'manga' && lado !== S.mangaLado) { S.mangaLado = lado; S.suave = true; dibujar(); return; }
    S.mangaLado = lado; cambiarVista(v);
  }
  var catDiseno = null;
  /* ---- contenido de cada paso ---- */
  var VISTAS = {
    diseno: function () {
      var todos = catalogoVisible(), cats = [];
      todos.forEach(function (u) { if (u.categoria && cats.indexOf(u.categoria) < 0) cats.push(u.categoria); });
      var orden = TIENDA.config.categorias || [];
      cats.sort(function (a, b) { return (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99); });
      var actual = todos.filter(function (u) { return u.id === S.baseId; })[0];
      if (!catDiseno || cats.indexOf(catDiseno) < 0) catDiseno = (actual && actual.categoria) || cats[0];
      var lista = cats.length > 1 ? todos.filter(function (u) { return u.categoria === catDiseno; }) : todos;
      var h = cats.length > 1 ? '<div class="chips llenar">' + cats.map(function (c) { return '<button type="button" class="chip' + (c === catDiseno ? ' on' : '') + '" data-cat-d="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' : '';
      return h + '<div class="mini-grid" id="mini-grid">' + lista.map(function (u) {
        return '<button type="button" class="mini' + (u.id === S.baseId ? ' on' : '') + '" data-base="' + esc(u.id) + '"><canvas width="300" height="315" data-mini="' + esc(u.id) + '"></canvas><span>' + esc(u.nombre) + '</span></button>';
      }).join('') + '</div>';
    },
    relleno: function () { return vistaTela('frente'); },
    espalda: function () { return vistaTela('espalda'); },
    detalles: function () {
      return '<div class="grupo g0"><span class="etq">' + esc(T('cuello')) + '</span>' + chipsColor('cuello', S.d.cuello, COLORES.slice(0, 8)) + '</div>' +
        '<div class="grupo"><span class="etq">' + esc(T('costados')) + '</span>' + chipsColor('costados', S.d.costados, COLORES.slice(0, 9), true) + '</div>';
    },
    logo: function () {
      var l = (S.d.logos || [])[0], a = S.avisos.logo, h = '';
      if (!l) return '<p class="nota-corta g0">' + esc(T('logo_consejo')) + '</p><span class="btn btn-oro archivo btn-ancho">' + esc(T('subir_logo')) + '<input type="file" accept="image/*" id="f-logo"></span>';
      if (a && a.length) return avisoHTML(a, S.avisos.logoZoom, 'logo');
      h += '<div class="logo-fila g0"><span class="prev"><img src="' + esc(l.src) + '" alt=""></span><span class="logo-txt">' + esc(S.avisos.logoFondo ? T(S.avisos.logoFondo === 'limpio' ? 'logo_fondo_ok' : 'logo_fondo_raro') : T('p_logo')) + '</span>' +
        '<span class="btn btn-linea btn-chico archivo">' + esc(T('cambiar')) + '<input type="file" accept="image/*" id="f-logo"></span></div>';
      h += '<div class="grupo"><span class="etq">' + esc(T('donde_va')) + '</span><div class="chips llenar">' +
        ['pecho-izq', 'pecho-der', 'centro', 'espalda'].map(function (p) {
          return '<button type="button" class="chip' + (l.pos === p ? ' on' : '') + '" data-pos="' + p + '">' + esc(T('pos_' + p.replace('-', '_'))) + '</button>';
        }).join('') + '</div></div>' + filaTam(l.tam);
      return h;
    },
    patro: function () {
      var lista = Kit.patros(S.d), sel = S.patroSel;
      var h = '<div class="pares g0">' + lista.map(function (p, i) {
        return '<div class="patro' + (i === sel ? ' sel' : '') + '" data-psel="' + i + '" role="button" tabindex="0" aria-pressed="' + (i === sel) + '"><span class="prev"><img src="' + esc(p.src) + '" alt=""></span>' +
          (i > 0 ? '<button type="button" class="icon-btn" data-sube="' + i + '" aria-label="' + esc(T('subir_orden')) + '">' + icono('sube') + '</button>' : '') +
          '<button type="button" class="icon-btn" data-quita="' + i + '" aria-label="' + esc(T('quitar')) + '">×</button></div>';
      }).join('') + (lista.length < 4 ? '<span class="patro patro-mas archivo">' + icono('mas') + esc(T('agregar_patro')) + '<input type="file" accept="image/*" id="f-patro"></span>' : '') + '</div>';
      if (lista[sel]) {
        // el logo tocado: dónde va y qué tan grande
        h += '<div class="grupo"><span class="etq">' + esc(T('donde_va')) + '</span><div class="chips llenar">' +
          ['manga-izq', 'manga-der', 'pecho', 'espalda'].map(function (q) {
            return '<button type="button" class="chip' + (lista[sel].pos === q ? ' on' : '') + '" data-ppos="' + q + '">' + esc(T('zp_' + q.replace('-', '_'))) + '</button>';
          }).join('') + '</div></div>' + filaTam(lista[sel].tam);
      } else if (lista.length) {
        h += '<div class="grupo"><span class="etq">' + esc(T('color_logos')) + '</span><div class="chips llenar">' +
          [['blanco', 'c_blanco'], ['negro', 'c_negro'], ['original', 'c_original']].map(function (c) {
            return '<button type="button" class="chip' + (colorPatroActual() === c[0] ? ' on' : '') + '" data-cpatro="' + c[0] + '">' + esc(T(c[1])) + '</button>';
          }).join('') + '</div></div><p class="nota-corta">' + esc(T('patro_toca')) + '</p>';
      } else h += '<p class="nota-corta">' + esc(T('p_patro_s')) + '</p>';
      return h;
    },
    manga: function () {
      var sh = S.d.short || {};
      return '<div class="chips llenar g0"><button type="button" class="chip' + (S.d.manga !== 'larga' ? ' on' : '') + '" data-manga="corta">' + esc(T('manga_corta')) + '</button>' +
        '<button type="button" class="chip' + (S.d.manga === 'larga' ? ' on' : '') + '" data-manga="larga">' + esc(T('manga_larga')) + '</button></div>' +
        '<div class="grupo"><span class="etq">' + esc(T('short_color')) + '</span><div class="chips llenar" style="margin-bottom:12px"><button type="button" class="chip' + (sh.mismo ? ' on' : '') + '" data-short-mismo>' + esc(T('mismo')) + '</button></div>' +
        chipsColor('short', sh.mismo ? null : sh.color, COLORES.slice(0, 8)) + '</div>';
    },
    dorsal: function () {
      return '<div class="fila2 g0"><div><label class="etq" for="f-nombre">' + esc(T('nombre_espalda')) + '</label><input class="campo" id="f-nombre" maxlength="16" autocomplete="off" placeholder="' + esc(T('ej_nombre')) + '" value="' + esc(S.d.nombre || '') + '"></div>' +
        '<div><label class="etq" for="f-numero">' + esc(T('numero')) + '</label><input class="campo" id="f-numero" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" placeholder="10" value="' + esc(S.d.numero || '') + '"></div></div>' +
        '<div class="grupo"><span class="etq">' + esc(T('color_letras')) + '</span>' + chipsColor('colorTexto', S.d.colorTexto, LETRAS) + '</div>' +
        (S.d.foto ? '' : '<label class="switch"><input type="checkbox" id="f-nshort"' + (S.d.numeroShort ? ' checked' : '') + '>' + esc(T('numero_short')) + '</label>');
    },
    equipo: function () {
      var h = '';
      if (S.equipos.length) h += '<div class="equipos g0">' + S.equipos.map(function (e, i) {
        return '<span class="eq-chip"><img src="' + esc(e.mini) + '" alt="">' + esc(e.nombre) + ' · ' + e.jugadores.length + '<button type="button" data-quita-eq="' + i + '" aria-label="' + esc(T('quitar')) + '">×</button></span>';
      }).join('') + '</div>';
      h += '<div class="chips llenar' + (S.equipos.length ? '' : ' g0') + '"><button type="button" class="chip' + (!S.esEquipo ? ' on' : '') + '" data-eq="no">' + esc(T('equipo_no')) + '</button><button type="button" class="chip' + (S.esEquipo ? ' on' : '') + '" data-eq="si">' + esc(T('equipo_si')) + '</button></div>';
      var tallas = TIENDA.config.tallas || [];
      if (!S.esEquipo) return h + '<div class="grupo"><label class="etq" for="f-talla1">' + esc(T('talla_uno')) + '</label><select class="campo" id="f-talla1"><option value="">' + esc(T('talla_luego')) + '</option>' + tallas.map(function (t) { return '<option' + (t === S.tallaUno ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></div><p class="nota-corta">' + esc(T('p_equipo_s')) + '</p>';
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
      var d = S.d, items = [];
      if (!d.foto) items.push(T(d.manga === 'larga' ? 'manga_larga' : 'manga_corta'));
      if (d.nombre || d.numero) items.push((d.nombre || '') + (d.numero ? ' · ' + d.numero : ''));
      var nEq = S.equipos.length + 1, nJug = S.equipos.reduce(function (s, e) { return s + e.jugadores.length; }, 0) + (S.esEquipo ? S.jugadores.filter(function (j) { return j.nombre || j.numero; }).length : 0);
      if (nEq > 1 || nJug) items.push(nEq + ' ' + T(nEq > 1 ? 'equipos' : 'equipo_1') + (nJug ? ' · ' + nJug + ' ' + T(nJug > 1 ? 'jugadores' : 'jugador_1') : ''));
      return '<div class="chips resumen-chips g0">' + items.map(function (t) { return '<span class="chip on-suave">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<p class="nota-corta">' + esc(T('p_listo_s')) + '</p>' +
        '<p class="nota">' + esc(T('guia_final')) + '</p>' +
        (((d.logos || []).length || (d.patrocinadores || []).length) ? '<p class="nota">' + esc(T('responsable_logo')) + '</p>' : '');
    }
  };
  function avisoHTML(lista, zoom, que) {
    var chica = lista.indexOf('chica') >= 0;
    return '<div class="aviso aviso-compacto g0">' + (zoom && chica ? '<img class="zoom" src="' + zoom + '" alt="">' : '') +
      '<div><p>' + lista.map(function (a) { return esc(T(a === 'chica' ? 'aviso_chica' : 'aviso_borrosa')); }).join(' ') + '</p>' +
      '<div class="acciones"><button type="button" class="btn btn-oro btn-chico" data-aviso-ok="' + que + '">' + esc(T('usar_asi')) + '</button><span class="btn btn-linea btn-chico archivo">' + esc(T('tomar_otra')) + '<input type="file" accept="image/*" data-otra="' + que + '"></span></div></div></div>';
  }
  function colorPatroActual() {
    if (S.colorPatro !== 'auto') return S.colorPatro;
    return S.d.colorPatrocinadores ? (S.d.colorPatrocinadores === '#FFFFFF' ? 'blanco' : 'negro') : 'original';
  }
  function autoColorPatro() {
    if (S.colorPatro !== 'auto' || !(S.d.patrocinadores || []).length) return;
    var luz = S.d.relleno && S.d.relleno.tipo === 'img' ? (S.d.relleno.luz || 200) : luzHex(S.d.relleno && S.d.relleno.color);
    S.d.colorPatrocinadores = luz > 150 ? '#1A1A1A' : '#FFFFFF';
  }
  function luzHex(hex) {
    var h = String(hex || '#ffffff').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h, 16); return ((n >> 16 & 255) * 299 + (n >> 8 & 255) * 587 + (n & 255) * 114) / 1000;
  }
  function pintarMiniDiseno(c) {
    var u = (TIENDA.catalogo || []).filter(function (x) { return x.id === c._id; })[0];
    if (!u) return;
    var tmp = document.createElement('canvas'); tmp.width = 300; tmp.height = 450;
    Kit.render(tmp, u.tipo === 'foto' ? { foto: u.foto } : u.diseno, 'front').then(function () {
      var g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
      if (u.tipo === 'foto') { var k = Math.min(300 / 300, 315 / 450); g.drawImage(tmp, (300 - 300 * k) / 2, 0, 300 * k, 450 * k); }
      else g.drawImage(tmp, 0, 10, 300, 315, 0, 0, 300, 315);
    });
  }

  /* ---- enlaces de cada paso ---- */
  var ENLACES = {
    diseno: function () {
      $$('[data-cat-d]', tablero).forEach(function (b) {
        b.addEventListener('click', function () { catDiseno = b.getAttribute('data-cat-d'); pintarTablero(); });
      });
      $$('[data-base]', tablero).forEach(function (b) {
        b.addEventListener('click', function () {
          var u = catalogoVisible().filter(function (x) { return x.id === b.getAttribute('data-base'); })[0];
          if (!u || u.id === S.baseId) return;
          usarBase(u);
          $$('[data-base]', tablero).forEach(function (x) { x.classList.toggle('on', x === b); });
          if (S.vista === 'manga' && S.d.foto) cambiarVista('front');
          dibujar(); guardarBorrador();
          var lista = pasos(), pts = $('#puntos');
          if (pts && pts.children.length !== lista.length) pintarTablero();
        });
      });
      $$('canvas[data-mini]', tablero).forEach(function (c) { c._id = c.getAttribute('data-mini'); pintarMiniDiseno(c); });
    },
    relleno: function () { enlazarArchivo('#f-tela', 'frente'); enlazarAvisos(); enlazarAjuste('frente'); },
    espalda: function () { enlazarArchivo('#f-tela', 'espalda'); enlazarAvisos(); enlazarAjuste('espalda'); },
    detalles: function () {},
    logo: function () {
      enlazarArchivo('#f-logo', 'logo');
      enlazarAvisos();
      $$('[data-pos]', tablero).forEach(function (b) {
        b.addEventListener('click', function () {
          S.d.logos[0].pos = b.getAttribute('data-pos');
          $$('[data-pos]', tablero).forEach(function (x) { x.classList.toggle('on', x === b); });
          cambiarVista(S.d.logos[0].pos === 'espalda' ? 'back' : 'front'); dibujar(); guardarBorrador();
        });
      });
      if (S.d.logos && S.d.logos[0]) enlazarTam(S.d.logos[0], function () { cambiarVista(S.d.logos[0].pos === 'espalda' ? 'back' : 'front'); });
    },
    patro: function () {
      enlazarArchivo('#f-patro', 'patro');
      // cada patrocinador guarda dónde va y su tamaño
      S.d.patrocinadores = Kit.patros(S.d).map(function (p) { return { src: p.src, pos: p.pos, tam: p.tam }; });
      var L = S.d.patrocinadores;
      function repinta() { pintarTablero(); dibujar(); guardarBorrador(); }
      $$('[data-psel]', tablero).forEach(function (c) {
        function elegir() { var i = +c.getAttribute('data-psel'); S.patroSel = S.patroSel === i ? -1 : i; pintarTablero(); if (S.patroSel >= 0) mirarPatro(L[S.patroSel]); }
        c.addEventListener('click', function (e) { if (e.target.closest('button')) return; elegir(); });
        c.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === c) { e.preventDefault(); elegir(); } });
      });
      $$('[data-sube]', tablero).forEach(function (b) { b.addEventListener('click', function () { var i = +b.getAttribute('data-sube'); var t = L[i - 1]; L[i - 1] = L[i]; L[i] = t; if (S.patroSel === i) S.patroSel = i - 1; else if (S.patroSel === i - 1) S.patroSel = i; repinta(); }); });
      $$('[data-quita]', tablero).forEach(function (b) { b.addEventListener('click', function () { var i = +b.getAttribute('data-quita'); L.splice(i, 1); if (S.patroSel === i) S.patroSel = -1; else if (S.patroSel > i) S.patroSel--; repinta(); }); });
      $$('[data-ppos]', tablero).forEach(function (b) {
        b.addEventListener('click', function () {
          var p = L[S.patroSel]; if (!p) return;
          p.pos = b.getAttribute('data-ppos');
          $$('[data-ppos]', tablero).forEach(function (x) { x.classList.toggle('on', x === b); });
          mirarPatro(p); dibujar(); guardarBorrador();
        });
      });
      if (L[S.patroSel]) enlazarTam(L[S.patroSel], function () { mirarPatro(L[S.patroSel]); });
      $$('[data-cpatro]', tablero).forEach(function (b) {
        b.addEventListener('click', function () {
          var c = b.getAttribute('data-cpatro'); S.colorPatro = c;
          S.d.colorPatrocinadores = c === 'blanco' ? '#FFFFFF' : c === 'negro' ? '#1A1A1A' : null;
          $$('[data-cpatro]', tablero).forEach(function (x) { x.classList.toggle('on', x === b); });
          dibujar(); guardarBorrador();
        });
      });
    },
    manga: function () {
      $$('[data-manga]', tablero).forEach(function (b) {
        b.addEventListener('click', function () {
          S.d.manga = b.getAttribute('data-manga');
          $$('[data-manga]', tablero).forEach(function (x) { x.classList.toggle('on', x === b); });
          S.suave = true; dibujar(); guardarBorrador();
        });
      });
      var m = $('[data-short-mismo]', tablero);
      if (m) m.addEventListener('click', function () {
        S.d.short = S.d.short || {}; S.d.short.mismo = true; S.d.short.relleno = S.d.relleno;
        m.classList.add('on'); $$('.color[data-campo="short"]', tablero).forEach(function (x) { x.classList.remove('on'); });
        dibujar(); guardarBorrador();
      });
      $$('.color[data-campo="short"]', tablero).forEach(function (b) { b.addEventListener('click', function () { if (S.d.short) S.d.short.mismo = false; if (m) m.classList.remove('on'); }); });
    },
    dorsal: function () {
      var n = $('#f-nombre'), num = $('#f-numero'), sh = $('#f-nshort');
      n.addEventListener('input', function () { S.d.nombre = n.value.toUpperCase(); dibujar(); guardarBorrador(); });
      num.addEventListener('input', function () { num.value = num.value.replace(/\D/g, '').slice(0, 3); S.d.numero = num.value; dibujar(); guardarBorrador(); });
      if (sh) sh.addEventListener('change', function () { S.d.numeroShort = sh.checked; if (sh.checked) cambiarVista('front'); dibujar(); guardarBorrador(); });
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
  /* ---- telas del cliente: una foto para el frente y otra para la espalda ----
     Elegir un color liso no borra la foto: la foto se queda como la primera bolita y se puede volver a ella.
     El tamaño del dibujo se cambia con − y +, sin barras que se arrastren. */
  var NIVELES = [{ corte: 1, rep: 2 }, { corte: 1, rep: 1 }, { corte: 1 }, { corte: 0.72 }, { corte: 0.5 }]; // el 2 es el normal
  function campoTela(lado) { return lado === 'espalda' ? 'rellenoEspalda' : 'relleno'; }
  function usarTela(lado, f) {
    S.d[campoTela(lado)] = f;
    if (lado === 'frente' && S.d.short && S.d.short.mismo) S.d.short.relleno = f;
    if (lado === 'frente') autoColorPatro();
  }
  function telaActiva(lado) {
    var t = S.telas[lado], f = S.d[campoTela(lado)];
    return !!(t && f && t.foto && f.src === t.foto.src);
  }
  function hacerFoto(t) {
    var n = NIVELES[t.nivel], c = hacerTela(t.fuente, t.recorte, !!n.rep);
    var f = { tipo: 'img', src: c.toDataURL('image/jpeg', 0.9), base: '#FFFFFF', luz: luzMedia(c), repetir: !!c.repetir };
    if (n.rep) f.escala = t.repOriginal ? (n.rep === 1 ? 380 : 260) : (n.rep === 1 ? 1000 : 640);
    return f;
  }
  function bolitaFoto(lado, campo) {
    var t = S.telas[lado];
    return '<button type="button" class="color foto' + (telaActiva(lado) ? ' on' : '') + '" style="background-image:url(' + t.foto.src + ')" data-color="=foto" data-campo="' + campo + '" aria-label="' + esc(T('tu_foto')) + '"></button>';
  }
  function vistaTela(lado) {
    var t = S.telas[lado], campo = campoTela(lado), f = S.d[campo], h = '';
    if (t && t.avisos && t.avisos.length) h += avisoHTML(t.avisos, t.zoom, lado);
    else if (t) {
      var R = t.recorte;
      h += '<div class="tela-ajuste' + (telaActiva(lado) ? '' : ' apagado') + '"><div class="ajuste-img" id="ajuste-img"><img src="' + t.fuenteURL + '" alt="" draggable="false"><span class="marco" id="marco" style="left:' + (R.x * 100) + '%;top:' + (R.y * 100) + '%;width:' + (R.w * 100) + '%;height:' + (R.h * 100) + '%" role="slider" aria-label="' + esc(T('tela_parte')) + '" tabindex="0"></span></div>' +
        '<div class="tela-lado"><p class="nota-corta">' + esc(T('tela_mueve_corto')) + '</p><span class="etq">' + esc(T('tela_tam')) + '</span>' +
        '<div class="tam-btns"><button type="button" class="icon-btn" data-tam="-1" aria-label="' + esc(T('mas_chico')) + '"' + (t.nivel <= 0 ? ' disabled' : '') + '>−</button><button type="button" class="icon-btn" data-tam="1" aria-label="' + esc(T('mas_grande')) + '"' + (t.nivel >= NIVELES.length - 1 ? ' disabled' : '') + '>+</button></div>' +
        '<span class="btn btn-linea btn-chico archivo">' + esc(T('cambiar_foto')) + '<input type="file" accept="image/*" id="f-tela"></span></div></div>';
    } else {
      h += '<div class="guia3"><figure class="si"><img src="/assets/tela-lila.jpg" alt="" width="450" height="436"><figcaption>' + esc(T('asi_si')) + '</figcaption></figure>' +
        '<figure class="no"><img src="/assets/tela-lila.jpg" alt="" width="450" height="436"><figcaption>' + esc(T('asi_no')) + '</figcaption></figure>' +
        '<ul class="reglas3"><li><i>' + icono('frente') + '</i>' + esc(T('regla_frente')) + '</li><li><i>' + icono('sol') + '</i>' + esc(T('regla_luz')) + '</li><li><i>' + icono('estira') + '</i>' + esc(T('regla_estirada')) + '</li></ul></div>' +
        '<span class="btn btn-oro archivo btn-ancho">' + esc(T(lado === 'espalda' ? 'subir_espalda' : 'subir_frente')) + '<input type="file" accept="image/*" id="f-tela"></span>';
    }
    // bolitas: [igual que el frente] [tu foto] y los colores lisos
    var valor = f && f.tipo === 'color' ? f.color : null;
    var g = '<div class="colores rejilla" data-tam="34" role="radiogroup">';
    if (lado === 'espalda') {
      var fr = S.d.relleno || {}, fondo = fr.tipo === 'img' ? 'background-image:url(' + (S.telas.frente && telaActiva('frente') ? S.telas.frente.foto.src : fr.src) + ')' : 'background:' + (fr.color || '#FFFFFF');
      g += '<button type="button" class="color igual' + (!f ? ' on' : '') + '" style="' + fondo + '" data-color="=frente" data-campo="' + campo + '" aria-label="' + esc(T('igual_frente')) + '"><b>=</b></button>';
    }
    if (t) g += bolitaFoto(lado, campo);
    COLORES.forEach(function (c) { g += '<button type="button" class="color' + (valor === c ? ' on' : '') + '" style="background:' + c + '" data-color="' + c + '" data-campo="' + campo + '" aria-label="' + c + '"></button>'; });
    g += '</div>';
    h += '<div class="grupo"><span class="etq">' + esc(T(lado === 'espalda' ? 'o_igual' : 'o_color')) + '</span>' + g + '</div>';
    return h;
  }
  function elegirTela(lado, c, boton) {
    var t = S.telas[lado];
    var f = c === '=foto' ? (t && t.foto) : c === '=frente' ? null : { tipo: 'color', color: c };
    usarTela(lado, f);
    $$('.color[data-campo="' + campoTela(lado) + '"]', tablero).forEach(function (x) { x.classList.toggle('on', x === boton); });
    var aj = $('.tela-ajuste', tablero); if (aj) aj.classList.toggle('apagado', c !== '=foto');
    if (t && t.avisos && t.avisos.length && c !== '=foto') { t.avisos = []; pintarTablero(); }
    dibujar(); guardarBorrador();
  }
  function rehacerTela(lado) {
    var t = S.telas[lado]; if (!t) return;
    t.foto = hacerFoto(t);
    usarTela(lado, t.foto);
    $$('.color[data-campo="' + campoTela(lado) + '"]', tablero).forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-color') === '=foto'); });
    var aj = $('.tela-ajuste', tablero); if (aj) aj.classList.remove('apagado');
    dibujar();
    // la tela final se sube una sola vez, al mandar el pedido
  }
  function enlazarAjuste(lado) {
    var t = S.telas[lado], caja = $('#ajuste-img'), marco = $('#marco');
    if (!caja || !t) return;
    function poner() {
      var R = t.recorte;
      R.x = Math.max(0, Math.min(1 - R.w, R.x)); R.y = Math.max(0, Math.min(1 - R.h, R.y));
      marco.style.left = R.x * 100 + '%'; marco.style.top = R.y * 100 + '%'; marco.style.width = R.w * 100 + '%'; marco.style.height = R.h * 100 + '%';
    }
    var arrastre = null;
    // se puede agarrar en cualquier parte de la foto: el recuadro brinca ahí y se arrastra
    caja.addEventListener('pointerdown', function (e) {
      e.preventDefault(); caja.setPointerCapture(e.pointerId);
      var r = caja.getBoundingClientRect(), R = t.recorte;
      if (e.target !== marco) { R.x = (e.clientX - r.left) / r.width - R.w / 2; R.y = (e.clientY - r.top) / r.height - R.h / 2; poner(); }
      arrastre = { x: e.clientX, y: e.clientY, R: { x: R.x, y: R.y }, w: r.width, h: r.height };
    });
    caja.addEventListener('pointermove', function (e) {
      if (!arrastre) return;
      t.recorte.x = arrastre.R.x + (e.clientX - arrastre.x) / arrastre.w;
      t.recorte.y = arrastre.R.y + (e.clientY - arrastre.y) / arrastre.h;
      poner();
    });
    function soltar() { if (arrastre) { arrastre = null; rehacerTela(lado); } }
    caja.addEventListener('pointerup', soltar); caja.addEventListener('pointercancel', soltar);
    marco.addEventListener('keydown', function (e) {
      var paso = 0.03, m = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
      if (!m) return; e.preventDefault(); t.recorte.x += m[0]; t.recorte.y += m[1]; poner(); rehacerTela(lado);
    });
    $$('[data-tam]', tablero).forEach(function (b) {
      b.addEventListener('click', function () {
        var nuevo = Math.max(0, Math.min(NIVELES.length - 1, t.nivel + +b.getAttribute('data-tam')));
        if (nuevo === t.nivel) return;
        t.nivel = nuevo;
        var R = t.recorte, cx = R.x + R.w / 2, cy = R.y + R.h / 2, k = NIVELES[nuevo].corte;
        R.w = Math.min(1, t.A.w * k); R.h = Math.min(1, t.A.h * k); R.x = cx - R.w / 2; R.y = cy - R.h / 2; poner();
        $$('[data-tam]', tablero).forEach(function (x) { x.disabled = +x.getAttribute('data-tam') < 0 ? t.nivel <= 0 : t.nivel >= NIVELES.length - 1; });
        rehacerTela(lado);
      });
    });
  }
  function enlazarAvisos() {
    $$('[data-aviso-ok]', tablero).forEach(function (b) {
      b.addEventListener('click', function () { var q = b.getAttribute('data-aviso-ok'); if (S.telas[q]) S.telas[q].avisos = []; else S.avisos[q] = []; pintarTablero(); });
    });
    $$('[data-otra]', tablero).forEach(function (inp) {
      inp.addEventListener('change', function () { if (inp.files && inp.files[0]) recibirArchivo(inp.files[0], inp.getAttribute('data-otra')); });
    });
  }
  function enlazarArchivo(sel, que) {
    var inp = $(sel, tablero);
    if (inp) inp.addEventListener('change', function () { if (inp.files && inp.files[0]) recibirArchivo(inp.files[0], que); });
  }
  function recibirArchivo(file, que) {
    toast(T('cargando'), true);
    var esTela = que === 'frente' || que === 'espalda';
    prepararImagen(file, esTela ? 'relleno' : 'logo').then(function (info) {
      quitarToast();
      S.avisoLog = S.avisoLog || [];
      info.avisos.forEach(function (a) { S.avisoLog.push(que + ':' + a); });
      if (esTela) {
        var t = { clave: info.local, fuente: info.fuente, fuenteURL: info.fuente.toDataURL('image/jpeg', 0.8), recorte: info.recorte, A: { w: info.recorte.w, h: info.recorte.h }, nivel: 2, repOriginal: !!info.repetir, avisos: info.avisos, zoom: info.zoom };
        t.foto = { tipo: 'img', src: info.local, base: '#FFFFFF', luz: info.luz, repetir: info.repetir };
        S.telas[que] = t; usarTela(que, t.foto);
      } else if (que === 'logo') {
        S.d.logos = [{ src: info.local, pos: (S.d.logos && S.d.logos[0] && S.d.logos[0].pos) || 'pecho-izq' }];
        S.avisos.logo = info.avisos; S.avisos.logoZoom = info.zoom; S.avisos.logoFondo = info.fondo === 'transparente' ? null : info.fondo;
      } else if (que === 'patro') {
        var prev = Kit.patros(S.d), ult = prev[prev.length - 1];
        S.d.patrocinadores = prev.map(function (p) { return { src: p.src, pos: p.pos, tam: p.tam }; }).concat([{ src: info.local, pos: ult ? ult.pos : 'manga-izq', tam: 2 }]).slice(0, 4);
        S.patroSel = S.d.patrocinadores.length - 1;
        autoColorPatro();
      }
      pintarTablero(); dibujar(); guardarBorrador();
      if (que === 'patro') { mirarPatro(S.d.patrocinadores[S.patroSel]); return; }
      cambiarVista((que === 'espalda' || (que === 'logo' && S.d.logos[0].pos === 'espalda')) ? 'back' : 'front');
    }).catch(function () { toast(T('error_guardar')); });
  }

  /* ---------- equipos ---------- */
  function miniatura(d) {
    var c = document.createElement('canvas'); c.width = 200; c.height = 300;
    return Kit.render(c, d, 'front').then(function () { return c.toDataURL('image/png'); });
  }
  function equipoActual() {
    var jug = S.esEquipo ? S.jugadores.filter(function (j) { return j.nombre || j.numero || j.talla; })
      : [{ nombre: S.d.nombre || '', numero: S.d.numero || '', talla: S.tallaUno || '' }];
    var base = S.modo === 'catalogo' && S.baseId ? (catalogoVisible().filter(function (u) { return u.id === S.baseId; })[0] || {}).nombre : '';
    return { nombre: (S.esEquipo && S.nombreEquipo) || T('sin_nombre'), diseno: clone(S.d), jugadores: clone(jug), base: base || '', archivos: archivosDe() };
  }
  // los archivos originales que el dueño necesita para imprimir, cada uno con su nombre
  function archivosDe() {
    var l = [];
    if (S.modo !== 'libre') return l;
    ['frente', 'espalda'].forEach(function (lado) { var t = S.telas[lado]; if (t && telaActiva(lado) && t.clave) l.push({ que: lado === 'frente' ? 'Tela del frente' : 'Tela de la espalda', local: t.clave }); });
    (S.d.logos || []).forEach(function (g) { l.push({ que: 'Logo del equipo', local: g.src }); });
    Kit.patros(S.d).forEach(function (p, i) { l.push({ que: 'Patrocinador ' + (i + 1), local: p.src }); });
    return l;
  }
  function guardarEquipoYOtro() {
    var e = equipoActual();
    miniatura(e.diseno).then(function (m) {
      e.mini = m; S.equipos.push(e);
      S.jugadores = []; S.nombreEquipo = ''; S.esEquipo = false; S.tallaUno = '';
      S.d.nombre = ''; S.d.numero = '';
      S.paso = 0; pintarTablero(-1); verVistaDe(pasos()[0]); dibujar(); guardarBorrador();
      toast(T('otro_equipo_ok'));
    });
  }

  /* ---------- cotizar: guardar folio y celebrar ---------- */
  function cambiarLocales(obj) {
    var txt = JSON.stringify(obj);
    Object.keys(S.remotos).forEach(function (loc) { txt = txt.split(loc).join(S.remotos[loc]); });
    return JSON.parse(txt);
  }
  function vistaJPG(d, v) {
    var c = document.createElement('canvas'); c.width = 800; c.height = 1200;
    var g = c.getContext('2d');
    return Kit.render(c, d, v).then(function () {
      var o = document.createElement('canvas'); o.width = 800; o.height = 1200;
      var og = o.getContext('2d'); var gr = og.createRadialGradient(400, 520, 60, 400, 600, 760);
      gr.addColorStop(0, '#22307A'); gr.addColorStop(1, '#0F1745'); og.fillStyle = gr; og.fillRect(0, 0, 800, 1200);
      og.drawImage(c, 0, 0); return o.toDataURL('image/jpeg', 0.88);
    });
  }
  var guardando = false;
  function cotizar() {
    if (guardando) return;
    guardando = true;
    var btn = $('#barra-sig'); btn.disabled = true; btn.textContent = T('guardando');
    var equipos = S.equipos.map(function (e) { return { nombre: e.nombre, diseno: e.diseno, jugadores: e.jugadores, base: e.base, archivos: e.archivos }; }).concat([equipoActual()]);
    Promise.all(S.pendientes).then(function () {
      if (JSON.stringify(equipos).indexOf('data:image') >= 0) {
        // alguna foto no subió: se reintenta aquí sin pedirle nada al cliente
        var faltan = [];
        JSON.stringify(equipos).replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+\/=]+/g, function (m) { if (!S.remotos[m]) faltan.push(m); return m; });
        return Promise.all(faltan.map(function (m) { return subirConReintento(m).then(function (u) { S.remotos[m] = u; }); }));
      }
    }).then(function () {
      return Promise.all(equipos.map(function (e) {
        var d = cambiarLocales(e.diseno);
        return Promise.all([vistaJPG(e.diseno, 'front'), vistaJPG(e.diseno, 'back')]).then(function (v) {
          return Promise.all([subirConReintento(v[0]), subirConReintento(v[1])]).then(function (u) {
            var orig = Object.keys(S.originales).filter(function (loc) { return JSON.stringify(e.diseno).indexOf(loc) >= 0; }).map(function (loc) { return S.originales[loc]; });
            var arch = (e.archivos || []).map(function (a) { return { que: a.que, url: S.originales[a.local] || S.remotos[a.local] || (/^data:/.test(a.local) ? '' : a.local) }; }).filter(function (a) { return a.url; });
            return { nombre: e.nombre, base: e.base || '', diseno: d, jugadores: e.jugadores, vistas: { frente: u[0], espalda: u[1] }, originales: orig, archivos: arch, avisos: (S.avisoLog || []) };
          });
        });
      }));
    }).then(function (listos) {
      return fetch('/api/folio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ equipos: listos, idioma: lang }) })
        .then(function (r) { if (!r.ok) throw new Error('folio'); return r.json(); });
    }).then(function (j) {
      guardando = false;
      var link = location.origin + '/?folio=' + j.id + '&k=' + j.clave;
      store.set('ultimoFolio', { id: j.id, link: link });
      // el diseño ya vive en su folio: la siguiente visita empieza limpia
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
    setTimeout(function () { $('#fiesta-wa').focus(); }, 900);
  }
  $('#fiesta-cerrar').addEventListener('click', function () { $('#fiesta').hidden = true; $('#fiesta-fx').innerHTML = ''; FIJAR.off(); reiniciar(); });

  /* ---------- catálogo de la página ---------- */
  var filtro = 'todos';
  function observar() {
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (ents) {
      ents.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); pintarMini(e.target); } });
    }, { rootMargin: '200px' }) : null;
    return function (c, id) { c._id = id; if (io) io.observe(c); else pintarMini(c); };
  }
  function pintarMini(c) {
    var u = (TIENDA.catalogo || []).filter(function (x) { return x.id === c._id; })[0];
    if (!u) return;
    var d = u.tipo === 'foto' ? { foto: u.foto } : u.diseno;
    Kit.render(c, d, 'front');
  }
  function pintarCatalogo() {
    var lista = $('#cat-lista'), fil = $('#cat-filtros');
    if (!lista) return;
    var todos = catalogoVisible();
    var cats = []; todos.forEach(function (u) { if (u.categoria && cats.indexOf(u.categoria) < 0) cats.push(u.categoria); });
    var orden = TIENDA.config.categorias || [];
    cats.sort(function (a, b) { return (orden.indexOf(a) + 1 || 99) - (orden.indexOf(b) + 1 || 99); });
    fil.innerHTML = ['todos'].concat(cats).map(function (c) { return '<button type="button" class="chip' + (filtro === c ? ' on' : '') + '" data-filtro="' + esc(c) + '">' + esc(c === 'todos' ? T('todos') : c) + '</button>'; }).join('');
    var vis = todos.filter(function (u) { return filtro === 'todos' || u.categoria === filtro; });
    var obs = observar();
    lista.innerHTML = vis.map(function (u) {
      return '<button type="button" class="cat-item" data-cat="' + esc(u.id) + '"><span class="cv"><canvas width="360" height="540" data-c="' + esc(u.id) + '"></canvas></span><b>' + esc(u.nombre) + '</b><small>' + (u.destacado ? '<span class="estrella">★</span> ' : '') + esc(u.categoria || '') + ' · ' + esc(T('personalizar')) + '</small></button>';
    }).join('');
    $$('canvas[data-c]', lista).forEach(function (c) { obs(c, c.getAttribute('data-c')); });
    $$('[data-filtro]', fil).forEach(function (b) { b.addEventListener('click', function () { filtro = b.getAttribute('data-filtro'); pintarCatalogo(); }); });
    $$('[data-cat]', lista).forEach(function (b) {
      b.addEventListener('click', function () {
        var u = todos.filter(function (x) { return x.id === b.getAttribute('data-cat'); })[0];
        if (u) abrirProbador(u, b);
      });
    });
  }
  function pintarDatos() {
    var c = TIENDA.config;
    var hp = $('#historia-p'); if (hp) hp.textContent = c.historia || T('hist_p');
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
  function pintarEquiposCasa() {
    var cont = $('#eq-casa'); if (!cont) return;
    var lista = catalogoVisible().filter(function (u) { return u.destacado; }).slice(0, 4);
    if (!lista.length) lista = catalogoVisible().slice(0, 2);
    cont.innerHTML = lista.map(function (u) {
      return '<button type="button" class="eq-casa-item" data-casa="' + esc(u.id) + '"><span class="cv"><canvas width="360" height="540" data-cc="' + esc(u.id) + '"></canvas></span><b>' + esc(u.nombre) + '</b><small>' + esc(T('eq_ver')) + ' →</small></button>';
    }).join('');
    var obs = observar();
    $$('canvas[data-cc]', cont).forEach(function (c) { obs(c, c.getAttribute('data-cc')); });
    $$('[data-casa]', cont).forEach(function (b) {
      b.addEventListener('click', function () {
        var u = lista.filter(function (x) { return x.id === b.getAttribute('data-casa'); })[0];
        if (u) abrirProbador(u, b);
      });
    });
  }

  /* ---------- creador a pantalla completa: uniforme fijo arriba, pasos abajo; la página de atrás no se mueve ---------- */
  var estudio = $('#estudio'), lugarEstudio = estudio.parentNode, probador = $('#probador'), hueco = document.createElement('div');
  var ancla = null;
  function abrirProbador(u, el) {
    ancla = el ? { el: el, top: el.getBoundingClientRect().top } : null;
    if (u) { S.modo = 'catalogo'; S.equipos = []; S.esEquipo = false; S.jugadores = []; S.nombreEquipo = ''; usarBase(u); S.paso = Math.min(1, pasos().length - 1); }
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
    // vuelves a ver exactamente lo que veías antes de abrir
    if (ancla && document.body.contains(ancla.el)) window.scrollTo({ top: window.scrollY + ancla.el.getBoundingClientRect().top - ancla.top, behavior: 'instant' });
    dibujar(); moverPulgar();
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
    var desde = escenario.getBoundingClientRect().height;
    probador.classList.toggle('grande', si);
    escenario.style.height = '';
    var hasta = si ? altoGrande() : escenario.getBoundingClientRect().height;
    pintarLupa();
    if (sinAnim) { escenario.style.height = si ? hasta + 'px' : ''; return; }
    escenario.classList.remove('creciendo');
    escenario.style.height = desde + 'px'; void escenario.offsetHeight;
    escenario.classList.add('creciendo');
    escenario.style.height = hasta + 'px';
    var listo = false;
    function fin() { if (listo) return; listo = true; escenario.classList.remove('creciendo'); if (!probador.classList.contains('grande')) escenario.style.height = ''; moverPulgar(); }
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
          S.modo = 'libre'; S.d = clone(e.diseno); S.paso = pasos().indexOf('dorsal');
          capa.hidden = true; FIJAR.off();
          history.replaceState(null, '', '/');
          abrirProbador(null, null); cambiarVista('back');
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

  /* ---------- borrador del cliente ---------- */
  function guardarBorrador() {
    // solo se guardan fotos que ya subieron (links); las locales pesan demasiado para el navegador
    var d = cambiarLocales(S.d);
    if (JSON.stringify(d).indexOf('data:image') >= 0) return;
    store.set('borrador', { modo: S.modo, paso: S.paso, baseId: S.baseId, d: d, tallaUno: S.tallaUno, esEquipo: S.esEquipo, nombreEquipo: S.nombreEquipo, jugadores: S.jugadores });
  }
  function cargarBorrador() {
    var b = store.get('borrador');
    if (!b || !b.d || !b.modo) return;
    S.modo = b.modo; S.paso = b.paso || 0; S.baseId = b.baseId; S.d = b.d; S.esEquipo = !!b.esEquipo; S.tallaUno = b.tallaUno || ''; S.nombreEquipo = b.nombreEquipo || ''; S.jugadores = b.jugadores || [];
  }

  /* ---------- avisos breves ---------- */
  var toastEl = null, toastT = 0;
  function toast(msg, fijo) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('ver');
    clearTimeout(toastT); if (!fijo) toastT = setTimeout(quitarToast, 2600);
  }
  function quitarToast() { clearTimeout(toastT); if (toastEl) toastEl.classList.remove('ver'); }

  /* ---------- arranque ---------- */
  function cargarTienda() {
    return fetch('/api/tienda', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (t) {
      if (Array.isArray(t.catalogo)) TIENDA.catalogo = t.catalogo;
      TIENDA.config = Object.assign({}, window.CONFIG_BASE, t.config || {});
    }).catch(function () { /* si no hay conexión, se queda el catálogo de arranque */ });
  }
  // lo que se ve antes de empezar: el primer uniforme del catálogo con un nombre de ejemplo
  function vitrina() {
    var u = catalogoVisible()[0];
    S.d = !u ? clone(DISENO_LIBRE) : u.tipo === 'foto' ? { foto: clone(u.foto), colorTexto: u.colorTexto } : clone(u.diseno);
    S.d.nombre = 'M SPORT'; S.d.numero = '10';
  }
  // pantalla fija: sin acercar ni alejar con los dedos (iPhone ignora la etiqueta del navegador)
  ['gesturestart', 'gesturechange'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  function iniciar() {
    if (!new URLSearchParams(location.search).has('folio')) window.scrollTo(0, 0);
    $('#marca-logo').insertAdjacentHTML('afterbegin', logoSVG('#1F2E7A', '#FFFFFF'));
    $('#portada-logo').innerHTML = logoSVG('#1F2E7A', '#FFFFFF');
    $('#portada-balon').innerHTML = BALON;
    intro();
    cargarBorrador();
    if (!S.modo) vitrina();
    aplicarIdioma(); dibujar(); setTimeout(moverPulgar, 60);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moverPulgar);
    cargarTienda().then(function () {
      if (!S.modo) vitrina();
      pintarCatalogo(); pintarDatos(); pintarTablero(); dibujar();
    });
    var q = new URLSearchParams(location.search);
    if (q.get('folio')) abrirFolio(q.get('folio'), q.get('k') || '');
  }

  window.APP = { patros: function (d) { return Kit.patros(d); }, T: T, esc: esc, clone: clone, logoSVG: logoSVG, folioHTML: folioHTML, TIENDA: TIENDA, cargarTienda: cargarTienda, pintarCatalogo: pintarCatalogo, pintarDatos: pintarDatos, pintarTablero: pintarTablero, prepararFotoDueno: null, subirConReintento: subirConReintento, cargarArchivo: cargarArchivo, aCanvas: aCanvas, nitidez: nitidez, toast: toast, lluvia: lluviaDePremios, dibujar: dibujar, S: S, get lang() { return lang; } };
  iniciar();
})();
