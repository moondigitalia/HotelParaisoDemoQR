/* Fotos del dueño: recorte automático del fondo liso y colores de la prenda (para los filtros). */
function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  /* 1. Recorte: el fondo liso de la foto se vuelve transparente, con orilla suave */
export function recortar(im) {
    var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    var esc = Math.min(1, 1400 / Math.max(iw, ih));
    var w = Math.round(iw * esc), h = Math.round(ih * esc), c = lienzo(w, h), g = c.getContext('2d');
    g.drawImage(im, 0, 0, w, h);
    var data = g.getImageData(0, 0, w, h), d = data.data, x, y, k;
    // si la foto ya viene recortada (PNG con fondo transparente), solo se ajusta a la prenda
    var transp = 0, orilla = 0;
    for (x = 0; x < w; x += 3) { orilla += 2; if (d[x * 4 + 3] < 20) transp++; if (d[((h - 1) * w + x) * 4 + 3] < 20) transp++; }
    if (transp > orilla * 0.8) {
      var ax0 = w, ay0 = h, ax1 = 0, ay1 = 0;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 40) { if (x < ax0) ax0 = x; if (x > ax1) ax1 = x; if (y < ay0) ay0 = y; if (y > ay1) ay1 = y; }
      var oc = lienzo(ax1 - ax0 + 1, ay1 - ay0 + 1); oc.getContext('2d').drawImage(c, -ax0, -ay0); return oc;
    }
    // color del fondo: el color que más se repite en las orillas (si la prenda toca la orilla, no lo ensucia)
    var cajas = {}, mejorCaja = null;
    var contar = function (q) {
      var key = (d[q * 4] >> 4) + ',' + (d[q * 4 + 1] >> 4) + ',' + (d[q * 4 + 2] >> 4), cj = cajas[key] = cajas[key] || { n: 0, r: 0, g: 0, b: 0 };
      cj.n++; cj.r += d[q * 4]; cj.g += d[q * 4 + 1]; cj.b += d[q * 4 + 2]; if (!mejorCaja || cj.n > mejorCaja.n) mejorCaja = cj;
    };
    for (x = 0; x < w; x += 2) { contar(x); contar((h - 1) * w + x); }
    for (y = 0; y < h; y += 2) { contar(y * w); contar(y * w + w - 1); }
    var r = mejorCaja.r / mejorCaja.n, gg = mejorCaja.g / mejorCaja.n, b = mejorCaja.b / mejorCaja.n;
    var dist = new Float32Array(w * h);
    for (k = 0; k < w * h; k++) dist[k] = Math.abs(d[k * 4] - r) + Math.abs(d[k * 4 + 1] - gg) + Math.abs(d[k * 4 + 2] - b);
    // se llena desde las orillas todo lo que parece fondo. Avanza solo a pasitos (el piso cambia suave);
    // la orilla de la prenda es un salto, aunque sea un cuello blanco sobre un piso gris claro
    var fondo = new Uint8Array(w * h), cola = [], tol = 70, paso = 20;
    var salto = function (p, q) { return Math.abs(d[p * 4] - d[q * 4]) + Math.abs(d[p * 4 + 1] - d[q * 4 + 1]) + Math.abs(d[p * 4 + 2] - d[q * 4 + 2]); };
    for (x = 0; x < w; x++) cola.push(x, (h - 1) * w + x);
    for (y = 0; y < h; y++) cola.push(y * w, y * w + w - 1);
    cola = cola.filter(function (q) { return dist[q] <= tol; });
    cola.forEach(function (q) { fondo[q] = 1; });
    while (cola.length) {
      k = cola.pop();
      var cx = k % w, cy = (k - cx) / w;
      [cx > 0 ? k - 1 : -1, cx < w - 1 ? k + 1 : -1, cy > 0 ? k - w : -1, cy < h - 1 ? k + w : -1].forEach(function (q) {
        if (q < 0 || fondo[q] || dist[q] > tol || salto(k, q) > paso) return;
        fondo[q] = 1; cola.push(q);
      });
    }
    // la sombra que deja la prenda en el piso también es fondo: gris, sin color y en degradado suave desde el fondo
    // (se avanza solo de a poquito en brillo, así la orilla de una playera gris o blanca, que es un salto, la frena)
    var lum = function (q) { return d[q * 4] * 0.3 + d[q * 4 + 1] * 0.59 + d[q * 4 + 2] * 0.11; };
    var croma = function (q) { var a = d[q * 4], b2 = d[q * 4 + 1], c2 = d[q * 4 + 2]; return Math.max(a, b2, c2) - Math.min(a, b2, c2); };
    // (una sombra siempre es más oscura que el piso: lo más claro, como un cuello blanco, nunca se toma por sombra)
    var lumFondo = r * 0.3 + gg * 0.59 + b * 0.11;
    var tope = Math.round(Math.max(w, h) * 0.035), prof = new Uint16Array(w * h), frente = [];
    for (k = 0; k < w * h; k++) if (fondo[k]) frente.push(k);
    while (frente.length) {
      var sig = [];
      for (var fi = 0; fi < frente.length; fi++) {
        k = frente[fi]; var kx = k % w, lk = lum(k);
        [kx > 0 ? k - 1 : -1, kx < w - 1 ? k + 1 : -1, k - w, k + w].forEach(function (q) {
          if (q < 0 || q >= w * h || fondo[q]) return;
          if (prof[k] >= tope || croma(q) > 22 || Math.abs(lum(q) - lk) > 14 || lum(q) > lumFondo + 4) return;
          fondo[q] = 1; prof[q] = prof[k] + 1; sig.push(q);
        });
      }
      frente = sig;
    }
    // la prenda es la pieza más grande que queda (se descartan basuritas)
    var etiqueta = new Int32Array(w * h), mejor = 0, mejorTam = 0, actual = 0;
    for (k = 0; k < w * h; k++) {
      if (fondo[k] || etiqueta[k]) continue;
      actual++; var tam = 0; cola = [k]; etiqueta[k] = actual;
      while (cola.length) {
        var q = cola.pop(); tam++;
        var qx = q % w, qy = (q - qx) / w;
        [qx > 0 ? q - 1 : -1, qx < w - 1 ? q + 1 : -1, qy > 0 ? q - w : -1, qy < h - 1 ? q + w : -1].forEach(function (v) { if (v >= 0 && !fondo[v] && !etiqueta[v]) { etiqueta[v] = actual; cola.push(v); } });
      }
      if (tam > mejorTam) { mejorTam = tam; mejor = actual; }
    }
    var x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (k = 0; k < w * h; k++) {
      var dentro = etiqueta[k] === mejor;
      if (!dentro) { d[k * 4 + 3] = 0; continue; }
      // orilla suave: lo que se parece un poco al fondo se transparenta un poco
      var a = Math.min(1, Math.max(0, (dist[k] - tol * 0.6) / (tol * 0.9)));
      d[k * 4 + 3] = Math.round(255 * Math.max(a, 0.0));
      var px = k % w, py = (k - px) / w;
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
    // los huecos dentro de la prenda (pixeles oscuros que sí son tela) se recuperan
    for (k = 0; k < w * h; k++) if (etiqueta[k] === mejor && !fondo[k]) d[k * 4 + 3] = Math.max(d[k * 4 + 3], 255);
    // orilla limpia: se quitan 2 pixeles del borde (ahí queda mezclado el color del piso y se ven rayas grises)
    for (var vuelta = 0; vuelta < 2; vuelta++) {
      var quitar = [];
      for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
        k = y * w + x; if (!d[k * 4 + 3]) continue;
        if (!d[(k - 1) * 4 + 3] || !d[(k + 1) * 4 + 3] || !d[(k - w) * 4 + 3] || !d[(k + w) * 4 + 3]) quitar.push(k);
      }
      quitar.forEach(function (q) { d[q * 4 + 3] = 0; });
    }
    g.putImageData(data, 0, 0);
    var o = lienzo(x1 - x0 + 1, y1 - y0 + 1); o.getContext('2d').drawImage(c, -x0, -y0);
    return o;
  }

  /* color principal de la prenda (sin sombras ni brillos extremos) */
export function colorPrincipal(c) {
    var t = lienzo(60, Math.max(1, Math.round(60 * c.height / c.width))), g = t.getContext('2d');
    g.drawImage(c, 0, 0, t.width, t.height);
    var d = g.getImageData(0, 0, t.width, t.height).data, cajas = {}, mejor = null;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      var lum = (d[i] + d[i + 1] + d[i + 2]) / 3; if (lum < 25) continue;
      var key = (d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5);
      var cj = cajas[key] = cajas[key] || { n: 0, r: 0, g: 0, b: 0 };
      cj.n++; cj.r += d[i]; cj.g += d[i + 1]; cj.b += d[i + 2];
      if (!mejor || cj.n > mejor.n) mejor = cj;
    }
    return mejor ? [mejor.r / mejor.n, mejor.g / mejor.n, mejor.b / mejor.n].map(Math.round) : [230, 230, 230];
  }


// nombres de color de la prenda (los que ocupan al menos 12% de la tela), para que el buscador los encuentre
export function coloresDe(c) {
  const t = lienzo(64, Math.max(1, Math.round(64 * c.height / c.width))), g = t.getContext('2d');
  g.drawImage(c, 0, 0, t.width, t.height);
  const d = g.getImageData(0, 0, t.width, t.height).data, cuenta = {}; let total = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, s = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
    let h = 0; if (mx !== mn) { h = mx === r ? ((gg - b) / (mx - mn)) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4; h *= 60; if (h < 0) h += 360; }
    let n;
    if (l > 0.86 && s < 0.35) n = 'blanco'; else if (l < 0.16) n = 'negro'; else if (s < 0.14) n = 'gris';
    else if (h < 14 || h >= 345) n = l > 0.7 ? 'rosa' : 'rojo'; else if (h < 40) n = (l < 0.45 && s < 0.7) ? 'dorado' : 'naranja'; else if (h < 65) n = 'amarillo';
    else if (h < 160) n = 'verde'; else if (h < 200) n = 'celeste'; else if (h < 232) n = 'azul'; else if (h < 290) n = (h < 245 && l < 0.45) ? 'azul' : 'morado'; else if (h < 345) n = l > 0.55 ? 'rosa' : 'morado';
    cuenta[n] = (cuenta[n] || 0) + 1; total++;
  }
  return Object.keys(cuenta).filter((k) => cuenta[k] / total >= 0.12).sort((a, b) => cuenta[b] - cuenta[a]).slice(0, 3);
}

// el short en la foto se abre hacia abajo (trapecio); se endereza renglón por renglón para que las franjas
// queden derechas sobre el modelo y no se vea fondo en las orillas
export function enderezarShort(c) {
  const W = c.width, H = c.height, g = c.getContext('2d'), d = g.getImageData(0, 0, W, H).data;
  const izq = new Float32Array(H), der = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    let a = -1, b = -1;
    for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 160) { if (a < 0) a = x; b = x; }
    izq[y] = a; der[y] = b;
  }
  // orillas suaves: promedio de renglones vecinos (sin dejar que un renglón vacío las jale)
  const suave = (arr) => arr.map((_, y) => { let s = 0, n = 0; for (let k = -6; k <= 6; k++) { const v = arr[y + k]; if (v >= 0 && y + k >= 0 && y + k < H) { s += v; n++; } } return n ? s / n : -1; });
  const L = suave(izq), R = suave(der);
  const o = document.createElement('canvas'); o.width = W; o.height = H; const og = o.getContext('2d');
  for (let y = 0; y < H; y++) if (L[y] >= 0 && R[y] > L[y]) og.drawImage(c, L[y] + 1, y, R[y] - L[y] - 2, 1, 0, y, W, 1);
  return o;
}
