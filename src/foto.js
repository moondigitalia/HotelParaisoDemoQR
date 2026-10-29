/* Fotos del dueño: recorte automático del fondo liso y colores de la prenda (para los filtros). */
function lienzo(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  /* 1. Recorte: el fondo liso de la foto se vuelve transparente, con orilla suave */
export function recortar(im, ia) {
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
    // con la IA: lo que ella ve como prenda nunca es fondo (cuellos y puños blancos sobre piso claro),
    // y lo que ella ve claramente como fondo sí lo es (una mano, un balón, otra cosa en la foto)
    if (ia) for (k = 0; k < w * h; k++) { if (ia[k] > 0.35) fondo[k] = 0; else if (ia[k] < 0.06) fondo[k] = 1; }
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
    if (ia) {
      // con la IA, todo hueco encerrado por la prenda es prenda (una franja blanca no puede ser un agujero)
      var fuera = new Uint8Array(w * h), cf = [];
      for (x = 0; x < w; x++) cf.push(x, (h - 1) * w + x); for (y = 0; y < h; y++) cf.push(y * w, y * w + w - 1);
      while (cf.length) { k = cf.pop(); if (fuera[k] || etiqueta[k] === mejor) continue; fuera[k] = 1; var fx = k % w, fy = (k - fx) / w;
        if (fx > 0) cf.push(k - 1); if (fx < w - 1) cf.push(k + 1); if (fy > 0) cf.push(k - w); if (fy < h - 1) cf.push(k + w); }
      for (k = 0; k < w * h; k++) if (!fuera[k] && etiqueta[k] !== mejor) { etiqueta[k] = mejor; fondo[k] = 0; d[k * 4 + 3] = 255; var hx = k % w, hy = (k - hx) / w; if (hx < x0) x0 = hx; if (hx > x1) x1 = hx; if (hy < y0) y0 = hy; if (hy > y1) y1 = hy; }
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

/* IA en el celular del dueño: separa la prenda del fondo aunque tenga partes del mismo color que el piso.
   Modelo U²-Net chico (4.6 MB, licencia Apache 2.0) con ONNX Runtime (MIT). Se baja solo la primera vez que el
   dueño sube una foto; no cuesta créditos ni manda la foto a ningún lado. */
let sesionIA = null;
function cargarScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
async function sesion() {
  if (sesionIA) return sesionIA;
  sesionIA = (async () => {
    if (!window.ort) await cargarScript('/assets/ia/ort.wasm.min.js');
    window.ort.env.wasm.wasmPaths = '/assets/ia/'; window.ort.env.wasm.numThreads = 1;
    return window.ort.InferenceSession.create('/assets/ia/u2netp.onnx', { executionProviders: ['wasm'] });
  })();
  sesionIA.catch(() => { sesionIA = null; });
  return sesionIA;
}
export async function mascaraIA(im, w, h) {
  const S = 320, ses = await sesion(), c = lienzo(S, S), g = c.getContext('2d');
  g.drawImage(im, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S).data, t = new Float32Array(3 * S * S), m = [0.485, 0.456, 0.406], de = [0.229, 0.224, 0.225];
  for (let i = 0; i < S * S; i++) for (let k = 0; k < 3; k++) t[k * S * S + i] = (d[i * 4 + k] / 255 - m[k]) / de[k];
  const out = await ses.run({ [ses.inputNames[0]]: new window.ort.Tensor('float32', t, [1, 3, S, S]) });
  const v = out[ses.outputNames[0]].data; let mn = 1e9, mx = -1e9;
  for (let i = 0; i < S * S; i++) { if (v[i] < mn) mn = v[i]; if (v[i] > mx) mx = v[i]; }
  const mc = lienzo(S, S), mg = mc.getContext('2d'), md = mg.createImageData(S, S);
  for (let i = 0; i < S * S; i++) { const a = Math.round(255 * (v[i] - mn) / Math.max(1e-6, mx - mn)); md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = a; md.data[i * 4 + 3] = 255; }
  mg.putImageData(md, 0, 0);
  const big = lienzo(w, h), bg = big.getContext('2d'); bg.imageSmoothingQuality = 'high'; bg.drawImage(mc, 0, 0, w, h);
  const bd = bg.getImageData(0, 0, w, h).data, r = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) r[i] = bd[i * 4] / 255;
  return r;
}
// recorte con IA; si la IA no carga (teléfono muy viejo, sin internet), queda el recorte por color
export async function recortarIA(im) {
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, esc = Math.min(1, 1400 / Math.max(iw, ih));
  try { return recortar(im, await mascaraIA(im, Math.round(iw * esc), Math.round(ih * esc))); }
  catch (e) { return recortar(im); }
}

/* Playera y short en la misma foto: se separan donde termina el dobladillo de la playera (la orilla de la
   silueta se mete de golpe hacia adentro, de los dos lados). Devuelve null si es una sola prenda. */
export function separarConjunto(c) {
  const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
  if (H < W * 1.05) return null;
  const op = (x, y) => d[(y * W + x) * 4 + 3] > 128;
  const L = new Float32Array(H), R = new Float32Array(H), col = [];
  for (let y = 0; y < H; y++) {
    let a = -1, b = -1, r = 0, g = 0, bb = 0, n = 0;
    for (let x = 0; x < W; x++) if (op(x, y)) { if (a < 0) a = x; b = x; if (x % 3 === 0) { const i = (y * W + x) * 4; r += d[i]; g += d[i + 1]; bb += d[i + 2]; n++; } }
    L[y] = a; R[y] = b; col.push(n ? [r / n, g / n, bb / n] : null);
  }
  // un short de verdad tiene las dos piernas: abajo, al centro, hay un hueco entre ellas
  const piernas = (y0) => {
    let filas = 0;
    for (let y = H - 1; y > y0 + (H - y0) * 0.5; y--) {
      let sale = false, hueco = 0, vuelve = false, run = 0;
      for (let x = Math.round(W * 0.3); x < Math.round(W * 0.7); x++) {
        const o = op(x, y);
        if (o && !sale) sale = true; else if (!o && sale) { run++; } else if (o && run) { hueco = Math.max(hueco, run); if (hueco > W * 0.025) { vuelve = true; break; } run = 0; }
      }
      if (vuelve) filas++;
    }
    // o el short se abre hacia abajo (las piernas): una playera mantiene su ancho hasta el dobladillo
    const ancho = (y) => { y = Math.min(H - 1, Math.max(0, Math.round(y))); return R[y] - L[y]; };
    const arriba = ancho(y0 + (H - y0) * 0.12), abajo = Math.max(ancho(y0 + (H - y0) * 0.85), ancho(y0 + (H - y0) * 0.92));
    return filas > H * 0.015 || abajo > arriba * 1.25;
  };
  const k = Math.max(3, Math.round(H * 0.012)), cand = [];
  const prom = (y0, y1) => { const t = [0, 0, 0]; let n = 0; for (let y = y0; y < y1; y++) if (col[y]) { t[0] += col[y][0]; t[1] += col[y][1]; t[2] += col[y][2]; n++; } return n ? t.map((v) => v / n) : null; };
  for (let y = Math.round(H * 0.4); y < Math.round(H * 0.78); y++) {
    if (L[y - k] < 0 || L[y + k] < 0) continue;
    // 1) el dobladillo: las dos orillas se meten de golpe
    const s = Math.min(L[y + k] - L[y - k], R[y - k] - R[y + k]);
    // 2) cambia el color de golpe (playera amarilla, short negro)
    const ar = prom(y - 4 * k, y - k), ab = prom(y + k, y + 4 * k);
    const cc = ar && ab ? Math.abs(ar[0] - ab[0]) + Math.abs(ar[1] - ab[1]) + Math.abs(ar[2] - ab[2]) : 0;
    cand.push({ y, p: Math.max(s / (W * 0.04), cc / 140), pc: cc / 140 });
  }
  cand.sort((a, b) => b.p - a.p);
  // del dobladillo a la cintura del short el ancho cambia poco; de la manga al torso cambia muchísimo (eso no es un corte)
  const anchoEn = (y) => R[y] - L[y];
  const elegido = cand.find((c2) => c2.p >= 1 && anchoEn(c2.y - k) < anchoEn(c2.y + k) * 1.7 && (c2.pc >= 1.5 || piernas(c2.y)));
  if (!elegido) return null;
  const corte = elegido.y;
  const parte = (y0, y1) => { const o = lienzo(W, y1 - y0); o.getContext('2d').drawImage(c, 0, -y0); return recortar(o); };
  return { playera: parte(0, corte), short: parte(corte + 1, H) };
}

/* Misma playera, otro color: el color principal pasa al color nuevo; si el nuevo se parece al segundo color
   de la playera (azul con blanco → blanco), ese segundo color toma el principal: se intercambian.
   El rojo, el negro y los escudos que no son de esos dos colores se quedan igual. Las arrugas se conservan. */
export function coloresBase(c) {
  const A = colorPrincipal(c), t = lienzo(60, Math.max(1, Math.round(60 * c.height / c.width))), g = t.getContext('2d');
  g.drawImage(c, 0, 0, t.width, t.height);
  const d = g.getImageData(0, 0, t.width, t.height).data, cajas = {}; let mejor = null;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    if (Math.abs(d[i] - A[0]) + Math.abs(d[i + 1] - A[1]) + Math.abs(d[i + 2] - A[2]) < 120) continue;
    const key = (d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5), cj = cajas[key] = cajas[key] || { n: 0, r: 0, g: 0, b: 0 };
    cj.n++; cj.r += d[i]; cj.g += d[i + 1]; cj.b += d[i + 2]; if (!mejor || cj.n > mejor.n) mejor = cj;
  }
  return { A, B: mejor ? [mejor.r / mejor.n, mejor.g / mejor.n, mejor.b / mejor.n].map(Math.round) : null };
}
export function recolorear(c, base, T) {
  const { A, B } = base, W = c.width, H = c.height, o = lienzo(W, H), g = o.getContext('2d');
  g.drawImage(c, 0, 0); const img = g.getImageData(0, 0, W, H), d = img.data;
  const dist = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]);
  const cambiaB = B && dist(T, B) < 160, B2 = cambiaB ? A : B;
  const lum = (p) => p[0] * 0.3 + p[1] * 0.59 + p[2] * 0.11, lA = Math.max(1, lum(A)), lB = B ? Math.max(1, lum(B)) : 1;
  const ss = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const sombra = (l, ref, col) => { const f = Math.min(1.08, Math.max(0.55, l / ref)); const blanco = lum(col) > 200; return blanco ? col.map((v) => Math.min(255, v * (0.9 + 0.1 * f))) : col.map((v) => Math.min(255, v * f)); };
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const p = [d[i], d[i + 1], d[i + 2]], l = lum(p);
    // qué tanto es "A" contra "B": proyección sobre la línea entre los dos colores
    let t = 1, lejos;
    if (B) { const v = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], vv = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
      t = Math.min(1, Math.max(0, ((p[0] - A[0]) * v[0] + (p[1] - A[1]) * v[1] + (p[2] - A[2]) * v[2]) / vv));
      const q = [A[0] + t * v[0], A[1] + t * v[1], A[2] + t * v[2]]; lejos = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      t = 1 - ss(0.35, 0.65, t);   // 1 = color A, 0 = color B
    } else lejos = Math.hypot(p[0] - A[0], p[1] - A[1], p[2] - A[2]) * 0.6;
    const k = 1 - ss(45, 85, lejos); if (k <= 0) continue;
    const nA = sombra(l, lA, T), nB = cambiaB ? sombra(l, lB, B2) : p;
    for (let j = 0; j < 3; j++) d[i + j] = Math.round(p[j] * (1 - k) + (nA[j] * t + nB[j] * (1 - t)) * k);
  }
  g.putImageData(img, 0, 0); return o;
}

// ¿la foto trae a una persona con la playera puesta? (cara y brazos arriba): así no queda bien en 3D
export function tienePersona(c) {
  const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, Math.round(H * 0.22)).data; let piel = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) {
    if (d[i + 3] < 200) continue; n++;
    const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 15 && mx - mn > 15 && r < 250 && g < 220) piel++;
  }
  return n > 0 && piel / n > 0.16;
}
