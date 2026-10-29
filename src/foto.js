/* Fotos del dueño: recorte automático del fondo liso y colores de la prenda (para los filtros). */
function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  /* 1. Recorte: el fondo liso de la foto se vuelve transparente, con orilla suave */
export function recortar(im) {
    var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    var esc = Math.min(1, 1400 / Math.max(iw, ih));
    var w = Math.round(iw * esc), h = Math.round(ih * esc), c = lienzo(w, h), g = c.getContext('2d');
    g.drawImage(im, 0, 0, w, h);
    var data = g.getImageData(0, 0, w, h), d = data.data, x, y, k;
    // color del fondo: promedio de las orillas
    var r = 0, gg = 0, b = 0, n = 0;
    for (x = 0; x < w; x += 2) { [x, (h - 1) * w + x].forEach(function (q) { r += d[q * 4]; gg += d[q * 4 + 1]; b += d[q * 4 + 2]; n++; }); }
    for (y = 0; y < h; y += 2) { [y * w, y * w + w - 1].forEach(function (q) { r += d[q * 4]; gg += d[q * 4 + 1]; b += d[q * 4 + 2]; n++; }); }
    r /= n; gg /= n; b /= n;
    var dist = new Float32Array(w * h);
    for (k = 0; k < w * h; k++) dist[k] = Math.abs(d[k * 4] - r) + Math.abs(d[k * 4 + 1] - gg) + Math.abs(d[k * 4 + 2] - b);
    // se llena desde las orillas todo lo que parece fondo
    var fondo = new Uint8Array(w * h), cola = [], tol = 70;
    for (x = 0; x < w; x++) cola.push(x, (h - 1) * w + x);
    for (y = 0; y < h; y++) cola.push(y * w, y * w + w - 1);
    while (cola.length) {
      k = cola.pop();
      if (fondo[k] || dist[k] > tol) continue;
      fondo[k] = 1;
      var cx = k % w, cy = (k - cx) / w;
      if (cx > 0) cola.push(k - 1); if (cx < w - 1) cola.push(k + 1);
      if (cy > 0) cola.push(k - w); if (cy < h - 1) cola.push(k + w);
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
