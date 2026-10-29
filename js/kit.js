/* Dibujo del uniforme en 2D (canvas). Lienzo lógico 1000 x 1500: playera arriba, short abajo. */
(function () {
  'use strict';
  var W = 1000, H = 1500;
  var cache = {};
  function load(src) {
    if (!src) return Promise.resolve(null);
    if (cache[src]) return cache[src];
    cache[src] = new Promise(function (res) {
      var im = new Image();
      if (!/^data:|^blob:/.test(src)) im.crossOrigin = 'anonymous';
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = src;
    });
    return cache[src];
  }

  /* ---------- geometría ---------- */
  function sleevePts(manga) {
    return manga === 'larga'
      ? [[800, 140], [930, 520], [968, 905], [866, 926], [812, 565], [722, 350]]
      : [[800, 140], [935, 372], [826, 442], [724, 346]];
  }
  function rightSide(manga) {
    return [[592, 88]].concat(sleevePts(manga), [[738, 600], [744, 1010]]);
  }
  function mirror(p) { return [W - p[0], p[1]]; }
  function shirtPath(ctx, manga, back) {
    var R = rightSide(manga), i;
    var dip = back ? 112 : 168;
    ctx.beginPath();
    ctx.moveTo(R[0][0], R[0][1]);
    for (i = 1; i < R.length; i++) ctx.lineTo(R[i][0], R[i][1]);
    ctx.quadraticCurveTo(500, 1032, W - 744, 1010);
    for (i = R.length - 2; i >= 0; i--) { var m = mirror(R[i]); ctx.lineTo(m[0], m[1]); }
    ctx.bezierCurveTo(430, dip, 570, dip, 592, 88);
    ctx.closePath();
  }
  function neckPath(ctx, back) {
    var dip = back ? 112 : 168;
    ctx.beginPath(); ctx.moveTo(408, 88); ctx.bezierCurveTo(430, dip, 570, dip, 592, 88);
  }
  function shortPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(282, 1072); ctx.lineTo(718, 1072);
    ctx.lineTo(722, 1110); ctx.lineTo(752, 1442);
    ctx.quadraticCurveTo(640, 1462, 526, 1452);
    ctx.lineTo(500, 1312); ctx.lineTo(474, 1452);
    ctx.quadraticCurveTo(360, 1462, 248, 1442);
    ctx.lineTo(278, 1110); ctx.closePath();
  }

  /* ---------- rellenos ---------- */
  function drawCover(ctx, im, x, y, w, h) {
    var s = Math.max(w / im.width, h / im.height);
    var dw = im.width * s, dh = im.height * s;
    ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  function paintFill(ctx, fill, imgs, box) {
    var x = box[0], y = box[1], w = box[2], h = box[3];
    fill = fill || { tipo: 'color', color: '#FFFFFF' };
    if (fill.tipo === 'img' && imgs[fill.src]) {
      ctx.fillStyle = fill.base || '#ffffff'; ctx.fillRect(x, y, w, h);
      if (fill.repetir) {
        // tela hecha de un pedazo chico: se repite como estampado continuo
        var im = imgs[fill.src], pat = ctx.createPattern(im, 'repeat'), k = (fill.escala || 520) / im.width;
        ctx.save(); ctx.translate(x + w / 2, y + h * 0.3); ctx.scale(k, k);
        ctx.fillStyle = pat; ctx.fillRect((-w / 2) / k - im.width, (-h * 0.3) / k - im.height, w / k + im.width * 2, h / k + im.height * 2);
        ctx.restore();
      } else drawCover(ctx, imgs[fill.src], x, y, w, h);
      return;
    }
    var c = fill.colores || [fill.color || '#FFFFFF', '#1B2A6B'];
    ctx.fillStyle = c[0]; ctx.fillRect(x, y, w, h);
    if (fill.tipo === 'rayas') {
      ctx.fillStyle = c[1];
      var sw = w / 13;
      for (var i = 1; i < 13; i += 2) ctx.fillRect(x + i * sw, y, sw, h);
    } else if (fill.tipo === 'banda') {
      ctx.save(); ctx.translate(x + w / 2, y + h * 0.42); ctx.rotate(-0.62);
      ctx.fillStyle = c[1]; ctx.fillRect(-w, -h * 0.085, w * 2, h * 0.17);
      ctx.fillStyle = c[2] || c[0]; ctx.fillRect(-w, h * 0.085, w * 2, h * 0.03);
      ctx.restore();
    } else if (fill.tipo === 'degradado') {
      var g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    } else if (fill.tipo === 'aros') {
      ctx.fillStyle = c[1];
      var bh = h / 9;
      for (var j = 1; j < 9; j += 2) ctx.fillRect(x, y + j * bh, w, bh);
    }
  }

  /* ---------- sombreado de tela (2D, sin relieve exagerado) ---------- */
  var malla = null;
  function mesh(ctx, x0, y0, w, h) {
    if (!malla) {
      malla = document.createElement('canvas'); malla.width = malla.height = 6;
      var g = malla.getContext('2d'); g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, 0, 3, 1); g.fillRect(3, 3, 3, 1);
      g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(0, 2, 6, 1);
    }
    ctx.fillStyle = ctx.createPattern(malla, 'repeat'); ctx.fillRect(x0, y0, w, h);
  }
  function shade(ctx, x0, x1, y0, y1) {
    mesh(ctx, x0, y0, x1 - x0, y1 - y0);
    var g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, 'rgba(0,0,0,.20)'); g.addColorStop(0.18, 'rgba(0,0,0,.04)');
    g.addColorStop(0.5, 'rgba(255,255,255,.06)'); g.addColorStop(0.82, 'rgba(0,0,0,.04)'); g.addColorStop(1, 'rgba(0,0,0,.20)');
    ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    var v = ctx.createLinearGradient(0, y0, 0, y1);
    v.addColorStop(0, 'rgba(255,255,255,.07)'); v.addColorStop(0.75, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.12)');
    ctx.fillStyle = v; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  /* ---------- logo M Sport (sello) ---------- */
  function mPath(ctx, x, y, s) {
    // dos arcos altos y puntiagudos, como la M de la fachada
    function arch(cx) {
      ctx.moveTo(x + (cx - 18) * s, y + 92 * s);
      ctx.bezierCurveTo(x + (cx - 17) * s, y + 52 * s, x + (cx - 9) * s, y + 22 * s, x + cx * s, y + 9 * s);
      ctx.bezierCurveTo(x + (cx + 9) * s, y + 22 * s, x + (cx + 17) * s, y + 52 * s, x + (cx + 18) * s, y + 92 * s);
      ctx.lineTo(x + (cx + 9) * s, y + 92 * s);
      ctx.bezierCurveTo(x + (cx + 8) * s, y + 62 * s, x + (cx + 4) * s, y + 40 * s, x + cx * s, y + 31 * s);
      ctx.bezierCurveTo(x + (cx - 4) * s, y + 40 * s, x + (cx - 8) * s, y + 62 * s, x + (cx - 9) * s, y + 92 * s);
      ctx.closePath();
    }
    ctx.beginPath(); arch(33); arch(67);
  }
  function luz(hex) {
    var h = String(hex || '#000').replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h, 16); return ((n >> 16 & 255) * 299 + (n >> 8 & 255) * 587 + (n & 255) * 114) / 1000;
  }
  function drawSello(ctx, x, y, size, inner) {
    var s = size / 100, claro = luz(inner) > 150;
    var marco = claro ? '#111111' : '#FFFFFF', linea = claro ? '#111111' : '#FFFFFF';
    ctx.save();
    ctx.fillStyle = marco; ctx.fillRect(x, y, size, size);
    ctx.fillStyle = inner; ctx.fillRect(x + 7 * s, y + 7 * s, 86 * s, 86 * s);
    ctx.fillStyle = linea;
    ctx.save(); ctx.translate(x + 12 * s, y + 10 * s); mPath(ctx, 0, 0, 0.76 * s); ctx.fill(); ctx.restore();
    // grietas tipo balón
    ctx.strokeStyle = inner; ctx.lineWidth = Math.max(1, 2.2 * s);
    ctx.beginPath();
    ctx.moveTo(x + 30 * s, y + 46 * s); ctx.lineTo(x + 38 * s, y + 52 * s); ctx.lineTo(x + 34 * s, y + 62 * s);
    ctx.moveTo(x + 60 * s, y + 40 * s); ctx.lineTo(x + 66 * s, y + 50 * s); ctx.lineTo(x + 61 * s, y + 58 * s);
    ctx.stroke();
    ctx.font = 'italic 700 ' + Math.round(19 * s) + 'px Yellowtail, cursive';
    ctx.translate(x + 58 * s, y + 118 * s); ctx.rotate(-0.3);
    ctx.fillStyle = claro ? '#111111' : inner; ctx.fillText('Sport', 0, 0);
    ctx.restore();
  }

  /* ---------- texto de espalda ---------- */
  var NUM_FONT = '"Saira Extra Condensed", "Arial Narrow", sans-serif';
  var SELLO_Y = [0.6, 0.27, 0.44, 0.33, 0.52];
  // Busca dentro del trazo real de cada cifra un lugar donde el sello completo quepa sin salirse
  var spotCache = {};
  function selloSpot(ch, fs, hgt, k, pref, s0) {
    var key = ch + '|' + Math.round(fs) + '|' + k.toFixed(3) + '|' + pref + '|' + Math.round(s0);
    if (spotCache[key] !== undefined) return spotCache[key];
    var c = document.createElement('canvas'), g = c.getContext('2d');
    g.font = '700 ' + fs + 'px ' + NUM_FONT;
    var w = Math.ceil(g.measureText(ch).width) + 4, h = Math.ceil(hgt * 1.2);
    c.width = w; c.height = h;
    g.font = '700 ' + fs + 'px ' + NUM_FONT; g.textBaseline = 'top'; g.fillStyle = '#000';
    g.fillText(ch, 2, -fs * 0.06);
    var d = g.getImageData(0, 0, w, h).data, I = new Uint32Array((w + 1) * (h + 1)), x, y;
    for (y = 0; y < h; y++) { var fila = 0; for (x = 0; x < w; x++) { fila += d[(y * w + x) * 4 + 3] > 140 ? 1 : 0; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + fila; } }
    function suma(x0, y0, x1, y1) { return I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]; }
    var res = null;
    for (var sz = s0; sz >= s0 * 0.55 && !res; sz *= 0.9) {
      var sw = Math.round(sz / k), sh = Math.round(sz * 1.24), mejor = 1e9; // ancho en la cifra comprimida; alto con el "Sport"
      var pd = Math.max(2, Math.round(sz * 0.14)); // borde de tinta alrededor del sello, para que no corte la cifra
      for (y = pd; y + sh + pd <= h; y += 2) for (x = pd; x + sw + pd <= w; x += 2) {
        var aw = sw + 2 * pd, ah = sh + 2 * pd;
        if (suma(x - pd, y - pd, x + sw + pd, y + sh + pd) < aw * ah * 0.985) continue;
        var dist = Math.abs((y + sz / 2) - hgt * pref) + Math.abs((x + sw / 2) - w / 2) * 0.6;
        if (dist < mejor) { mejor = dist; res = { x: x - 2, y: y, s: sz }; }
      }
    }
    spotCache[key] = res; return res;
  }
  function drawNumber(ctx, num, cx, top, hgt, color, sello, maxW) {
    num = String(num || '').slice(0, 3);
    if (!num) return;
    var fs = hgt * 1.28;
    ctx.font = '700 ' + fs + 'px ' + NUM_FONT;
    var widths = [], total = 0, gap = fs * (num.length > 2 ? 0.05 : 0.03);
    for (var i = 0; i < num.length; i++) { widths[i] = ctx.measureText(num[i]).width; total += widths[i] + (i ? gap : 0); }
    var k = Math.min(1, maxW / total);
    ctx.save(); ctx.translate(cx, top); ctx.scale(k, 1);
    var x = -total / 2, starts = [];
    ctx.fillStyle = color; ctx.textBaseline = 'top';
    for (i = 0; i < num.length; i++) { ctx.fillText(num[i], x, -fs * 0.06); starts.push(x); x += widths[i] + gap; }
    ctx.restore();
    if (sello) {
      for (i = 0; i < num.length; i++) {
        var sp = selloSpot(num[i], fs, hgt, k, SELLO_Y[i % SELLO_Y.length], hgt * 0.17);
        if (!sp) continue;
        drawSello(ctx, cx + (starts[i] + sp.x) * k, top + sp.y, sp.s, color);
      }
    }
  }
  function drawName(ctx, name, cx, y, size, color, maxW) {
    name = String(name || '').toUpperCase().slice(0, 16);
    if (!name) return;
    ctx.save();
    ctx.font = '700 ' + size + 'px ' + NUM_FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color;
    var w = ctx.measureText(name).width, k = Math.min(1, maxW / w);
    ctx.translate(cx, y); ctx.scale(k, 1); ctx.fillText(name, 0, 0);
    ctx.restore();
  }

  /* ---------- logos ---------- */
  var POS = {
    'pecho-izq': { x: 628, y: 300, w: 120, view: 'front' },
    'pecho-der': { x: 372, y: 300, w: 120, view: 'front' },
    'centro': { x: 500, y: 330, w: 190, view: 'front' },
    'espalda': { x: 500, y: 180, w: 120, view: 'back' }
  };
  // tamaños que el cliente escoge con − y + (el 2 es el normal)
  var TAM = [0.6, 0.8, 1, 1.25, 1.5];
  function tamDe(n) { return TAM[n == null ? 2 : Math.max(0, Math.min(TAM.length - 1, n))]; }
  // patrocinadores: antes eran solo la imagen (siempre en la manga izquierda); ahora cada uno puede decir dónde va y qué tan grande
  function patros(d) {
    return (d.patrocinadores || []).map(function (s) { return typeof s === 'string' ? { src: s, pos: 'manga-izq', tam: 2 } : { src: s.src, pos: s.pos || 'manga-izq', tam: s.tam == null ? 2 : s.tam }; });
  }
  var tintCache = {};
  function tinted(im, color) {
    if (!color || !im) return im;
    var key = (im.src || '').slice(-80) + color;
    if (tintCache[key]) return tintCache[key];
    var c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    var g = c.getContext('2d'); g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    tintCache[key] = c; return c;
  }
  function drawLogoAt(ctx, im, cx, cy, maxW, maxH, rot) {
    if (!im) return;
    var s = Math.min(maxW / im.width, maxH / im.height);
    ctx.save(); ctx.translate(cx, cy); if (rot) ctx.rotate(rot);
    ctx.drawImage(im, -im.width * s / 2, -im.height * s / 2, im.width * s, im.height * s);
    ctx.restore();
  }
  function sleeveAxis(manga, side) {
    // side: 1 = manga a la derecha del dibujo, -1 = a la izquierda
    var a = manga === 'larga' ? [772, 215] : [786, 214], b = manga === 'larga' ? [917, 915] : [880, 407];
    if (side < 0) { a = mirror(a); b = mirror(b); }
    return { a: a, b: b };
  }

  /* ---------- render principal ---------- */
  function collect(d) {
    var list = [];
    if (d.relleno && d.relleno.tipo === 'img') list.push(d.relleno.src);
    if (d.rellenoEspalda && d.rellenoEspalda.tipo === 'img') list.push(d.rellenoEspalda.src);
    if (d.short && d.short.relleno && d.short.relleno.tipo === 'img') list.push(d.short.relleno.src);
    (d.logos || []).forEach(function (l) { list.push(l.src); });
    patros(d).forEach(function (s) { list.push(s.src); });
    if (d.foto) { list.push(d.foto.frente); list.push(d.foto.espalda); }
    return list.filter(Boolean);
  }

  var fontsP = null;
  function fonts() {
    if (!fontsP) {
      fontsP = (document.fonts && document.fonts.load)
        ? Promise.all([document.fonts.load('700 100px "Saira Extra Condensed"'), document.fonts.load('400 40px "Yellowtail"')]).catch(function () {})
        : Promise.resolve();
    }
    return fontsP;
  }
  function render(canvas, d, view, opt) {
    opt = opt || {};
    var srcs = collect(d);
    return Promise.all([fonts()].concat(srcs.map(load))).then(function (all) {
      var ims = all.slice(1);
      var imgs = {}; srcs.forEach(function (s, i) { imgs[s] = ims[i]; });
      var ctx = canvas.getContext('2d');
      var sc = canvas.width / W;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(sc, 0, 0, sc, 0, 0);
      if (d.foto) drawPhoto(ctx, d, view === 'manga' ? 'front' : view, imgs);
      else if (view === 'manga') {
        // acercamiento a la manga izquierda, donde van los patrocinadores
        var larga = d.manga === 'larga', z = larga ? 1.75 : 2.5;
        var cx = larga ? 840 : 830, cy = larga ? 520 : 300;
        if (opt.lado === 'der') cx = W - cx; // la otra manga
        ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-cx, -cy);
        drawKit(ctx, d, 'front', imgs);
      } else drawKit(ctx, d, view, imgs);
      return canvas;
    });
  }

  function drawPhoto(ctx, d, view, imgs) {
    var im = imgs[view === 'back' ? d.foto.espalda : d.foto.frente];
    if (im) {
      var s = Math.min(W / im.width, H / im.height);
      var dw = im.width * s, dh = im.height * s;
      ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
      if (view === 'back' && (d.nombre || d.numero)) {
        var top = (H - dh) / 2, y0 = top + dh * (d.foto.yNombre || 0.2);
        drawName(ctx, d.nombre, W / 2, y0, dh * 0.055, d.colorTexto || '#111', dw * 0.5);
        drawNumber(ctx, d.numero, W / 2, y0 + dh * 0.03, dh * 0.2, d.colorTexto || '#111', true, dw * 0.5);
      }
    }
  }

  function drawKit(ctx, d, view, imgs) {
    var back = view === 'back', manga = d.manga || 'corta';
    var acc = d.costados || null;
    // sombra suave del piso (plano)
    ctx.save();
    shirtPath(ctx, manga, back); ctx.clip();
    // la espalda puede llevar su propia tela; si no, usa la del frente
    paintFill(ctx, (back && d.rellenoEspalda) || d.relleno, imgs, [40, 60, 920, 980]);
    if (acc) {
      ctx.fillStyle = acc;
      var R = rightSide(manga);
      [1, -1].forEach(function (side) {
        var f = side > 0 ? function (p) { return p; } : mirror;
        var arm = f(R[R.length - 3]);
        var p1 = f([R[R.length - 3][0] + 40, R[R.length - 3][1] + 44]);
        var p2 = f([R[R.length - 2][0] + 10, 720]);
        var p3 = f([R[R.length - 2][0] - 26, 720]);
        ctx.beginPath(); ctx.moveTo(arm[0], arm[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.closePath(); ctx.fill();
        // puño o bastilla de manga
        var sp = sleevePts(manga), o = sp[sp.length - 4 + (manga === 'larga' ? 2 : 1)], inn = sp[sp.length - 3 + (manga === 'larga' ? 2 : 1)];
        if (manga === 'larga') { o = sp[2]; inn = sp[3]; } else { o = sp[1]; inn = sp[2]; }
        var A = f(o), B = f(inn);
        var dx = (side > 0 ? -1 : 1) * 0, ux = (sp[0][0] - o[0]), uy = (sp[0][1] - o[1]), L = Math.hypot(ux, uy);
        var t = manga === 'larga' ? 46 : 30; ux = ux / L * t; uy = uy / L * t;
        var A2 = f([o[0] + ux, o[1] + uy]), B2 = f([inn[0] + ux, inn[1] + uy]);
        ctx.beginPath(); ctx.moveTo(A[0] + dx, A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(B2[0], B2[1]); ctx.lineTo(A2[0], A2[1]); ctx.closePath(); ctx.fill();
      });
      // bastilla inferior
      ctx.fillRect(0, 996, W, 40);
    }
    shade(ctx, 60, 940, 60, 1040);
    // costuras
    ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 2; ctx.setLineDash([7, 7]);
    ctx.beginPath(); ctx.moveTo(800, 140); ctx.lineTo(724, 346); ctx.moveTo(200, 140); ctx.lineTo(276, 346); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // cuello
    ctx.save();
    neckPath(ctx, back); ctx.lineWidth = 30; ctx.lineCap = 'round'; ctx.strokeStyle = d.cuello || '#FFFFFF'; ctx.stroke();
    if (!back) { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.moveTo(420, 96); ctx.bezierCurveTo(440, 186, 560, 186, 580, 96); ctx.stroke(); }
    ctx.restore();
    // contorno
    ctx.save(); shirtPath(ctx, manga, back); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.stroke(); ctx.restore();

    // logos del frente / espalda
    (d.logos || []).forEach(function (l) {
      var p = POS[l.pos]; if (!p || (p.view === 'back') !== back) return;
      var k = tamDe(l.tam);
      drawLogoAt(ctx, imgs[l.src], p.x, p.y, p.w * k, p.w * k);
    });
    // patrocinadores: cada zona acomoda los suyos uno debajo de otro
    var todos = patros(d).map(function (p) { p.im = tinted(imgs[p.src], d.colorPatrocinadores); return p; }).filter(function (p) { return p.im; });
    var zona = function (pos) { return todos.filter(function (p) { return p.pos === pos; }); };
    ctx.save(); shirtPath(ctx, manga, back); ctx.clip();
    // mangas: centrados entre las dos orillas de la manga
    ['manga-izq', 'manga-der'].forEach(function (pos) {
      var lista = zona(pos); if (!lista.length) return;
      var sp = sleevePts(manga);
      var outer = manga === 'larga' ? [sp[0], sp[1], sp[2]] : [sp[0], sp[1]];
      var inner = manga === 'larga' ? [sp[5], sp[4], sp[3]] : [sp[3], sp[2]];
      var xAt = function (poly, y) {
        for (var i = 0; i < poly.length - 1; i++) {
          var p = poly[i], q = poly[i + 1];
          if ((y - p[1]) * (y - q[1]) <= 0 && p[1] !== q[1]) return p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]);
        }
        return y < poly[0][1] ? poly[0][0] : poly[poly.length - 1][0];
      };
      var y0 = manga === 'larga' ? 360 : 250, y1 = manga === 'larga' ? 760 : 372;
      var n = lista.length, step = (y1 - y0) / n;
      var maxW = manga === 'larga' ? 84 : 78, maxH = Math.min(manga === 'larga' ? 70 : 34, step * 0.72);
      // la manga izquierda de quien lo viste se ve a la derecha del frente y a la izquierda de la espalda
      var espejo = (pos === 'manga-izq') === back;
      lista.forEach(function (p, i) {
        var y = y0 + step * (i + 0.5);
        var xo = xAt(outer, y), xi = xAt(inner, y);
        var cx = (xo + xi) / 2, wide = Math.abs(xo - xi);
        var ang = Math.atan2(xAt(outer, y + 20) - xAt(outer, y - 20) + xAt(inner, y + 20) - xAt(inner, y - 20), 80);
        if (espejo) { cx = W - cx; ang = -ang; }
        var k = tamDe(p.tam);
        drawLogoAt(ctx, p.im, cx, y, Math.min(maxW * k, wide * 0.9), Math.min(maxH * k, step * 0.95), -ang);
      });
    });
    // pecho (frente) y espalda abajo del número
    [['pecho', false, 400, 600, 360, 110], ['espalda', true, 640, 860, 330, 96]].forEach(function (z) {
      if (z[1] !== back) return;
      var lista = zona(z[0]); if (!lista.length) return;
      var step = (z[3] - z[2]) / lista.length;
      lista.forEach(function (p, i) {
        var k = tamDe(p.tam);
        drawLogoAt(ctx, p.im, 500, z[2] + step * (i + 0.5), Math.min(z[4] * k, 600), Math.min(z[5] * k, step * 0.95));
      });
    });
    ctx.restore();
    // nombre y número
    if (back) {
      drawName(ctx, d.nombre, 500, 262, 60, d.colorTexto || '#111111', 400);
      drawNumber(ctx, d.numero, 500, 312, 290, d.colorTexto || '#111111', d.sello !== false, (String(d.numero || '').length > 2 ? 400 : 330));
    }
    // short
    ctx.save(); shortPath(ctx); ctx.clip();
    var sh = d.short || {};
    paintFill(ctx, sh.relleno || { tipo: 'color', color: sh.color || '#FFFFFF' }, imgs, [240, 1060, 520, 410]);
    ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(240, 1072, 520, 36);
    if (acc && sh.franja !== false) { ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(718, 1110); ctx.lineTo(748, 1442); ctx.lineTo(728, 1446); ctx.lineTo(700, 1110); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(282, 1110); ctx.lineTo(252, 1442); ctx.lineTo(272, 1446); ctx.lineTo(300, 1110); ctx.closePath(); ctx.fill(); }
    shade(ctx, 240, 760, 1060, 1470);
    ctx.restore();
    ctx.save(); shortPath(ctx); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.stroke(); ctx.restore();
    if (!back && d.numeroShort && d.numero) {
      drawNumber(ctx, d.numero, 340, 1356, 62, sh.colorNumero || d.colorTexto || '#111111', false, 90);
    }
  }

  window.Kit = { drawName: drawName, drawNumber: drawNumber, render: render, patros: patros, tamDe: tamDe, load: load, W: W, H: H, drawSello: drawSello, mPath: mPath };
})();
