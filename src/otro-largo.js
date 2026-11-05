/* EL OTRO LARGO DE MANGA, sacado del molde que sí hay (sin pedirle nada al dueño ni gastar):
   casi todos los uniformes de manga larga son la misma manga de la corta, solo más larga. Así se arma:
   - frente, espalda y short: la misma pieza, de su caja en un molde a su caja en el otro;
   - la manga, renglón por renglón y en metros reales: del hombro hacia abajo es la misma tela que la corta; lo que la manga
     larga tiene de más sigue con el renglón de la corta justo arriba de su puño (las franjas que bajan siguen bajando, sin
     estirarse ni cortarse); y al final va el puño de la corta, del mismo alto. Al revés (corta desde larga): el hombro de
     la larga y, al final, su puño.
   - alrededor del brazo: en metros desde el centro de la pieza (la cara de afuera), así los logos no se deforman. */
let info = null;
function datos() {
  if (!info) info = fetch('/assets/molde/mangas.json?v=' + (window.VERSION || '1')).then((r) => r.json()).catch(() => { info = null; return null; });
  return info;
}

// el alto del puño (en pixeles desde abajo de la pieza): la orilla de arriba del puño es el último cambio que cruza todo el
// ancho de la manga, cerca de su final (una franja que da la vuelta). Las franjas que bajan no cuentan (no cambian de un
// renglón al siguiente). Si la manga no tiene puño distinto, 0.
export function altoPuno(px, w, h, fila) {
  const K = 31, val = (x, y) => { const i = (y * w + Math.max(0, Math.min(w - 1, x))) * 4; return [px[i], px[i + 1], px[i + 2]]; };
  const renglon = (y) => { const [a, b] = fila(y), c = w / 2, out = []; for (let j = 0; j < K; j++) { const f = -0.85 + 1.7 * j / (K - 1); out.push(val(Math.round(f < 0 ? c + f * (c - a) : c + f * (b - c)), y)); } return out; };
  // columna por columna: el cambio más alto cerca del final (la orilla del puño puede ir en curva). Si al menos la mitad de
  // las columnas cambian, el puño empieza en el más alto de esos cambios (casi todas las columnas ya están en el puño)
  const ini = Math.round(h * 0.97), fin = Math.round(h * 0.68), altos = [];
  const R = []; for (let y = fin; y <= Math.min(h - 1, ini + 2); y++) R[y] = renglon(y);
  for (let j = 0; j < K; j++) {
    let tope = -1;
    for (let y = fin; y <= ini; y++) { const a = R[y][j], b = R[y + 2][j]; if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 70) { tope = y; break; } }
    if (tope >= 0) altos.push(tope);
  }
  if (altos.length < K * 0.5) return 0;
  altos.sort((a, b) => a - b);
  return h - altos[Math.floor(altos.length * 0.1)];
}

export async function otroLargo(src, de, a) {
  const D = await datos(); if (!D || !src || !D[de] || !D[a]) return null;
  const S = src.width, fS = S / D[de].tam, fT = S / D[a].tam;
  const out = document.createElement('canvas'); out.width = out.height = S;
  const g = out.getContext('2d'); g.imageSmoothingEnabled = true;
  g.drawImage(src, 0, 0, S, S);   // de fondo, la misma tela alrededor (la costura del 3D nunca toma gris)
  const caja = (m, k, f) => D[m].piezas[k].map((v) => v * f);
  for (const k of ['frente', 'espalda', 'short']) {
    const s = caja(de, k, fS), t = caja(a, k, fT), ms = 0.02, mx = (s[2] - s[0]) * ms, my = (s[3] - s[1]) * ms, nx = (t[2] - t[0]) * ms, ny = (t[3] - t[1]) * ms;
    g.drawImage(src, s[0] - mx, s[1] - my, s[2] - s[0] + 2 * mx, s[3] - s[1] + 2 * my, t[0] - nx, t[1] - ny, t[2] - t[0] + 2 * nx, t[3] - t[1] + 2 * ny);
  }
  const sd = src.getContext('2d').getImageData(0, 0, S, S).data;
  for (const k of ['mangaI', 'mangaD']) {
    const s = caja(de, k, fS).map(Math.round), t = caja(a, k, fT).map(Math.round);
    const ws = s[2] - s[0], hs = s[3] - s[1], wt = t[2] - t[0], ht = t[3] - t[1];
    const fila = (m, f, w, h) => (y) => { const F = D[m].filas[k], r = Math.max(0, Math.min(63, Math.floor(y / h * 64))); return [F[r][0] * f, F[r][1] * f]; };
    const filaS = fila(de, fS, ws, hs), filaT = fila(a, fT, wt, ht);
    // la pieza de la fuente en su propio arreglo (para medir su puño)
    const pz = new Uint8ClampedArray(ws * hs * 4);
    for (let y = 0; y < hs; y++) pz.set(sd.subarray(((s[1] + y) * S + s[0]) * 4, ((s[1] + y) * S + s[0] + ws) * 4), y * ws * 4);
    const kS = D[de].escala * fS, kT = D[a].escala * fT;   // pixeles por metro
    const puno = altoPuno(pz, ws, hs, filaS) / kS;          // metros
    const Ls = hs / kS, Lt = ht / kT, arriba = Math.max(0, Ls - puno - 3 / kS);
    const od = g.getImageData(t[0], t[1], wt, ht), o = od.data;
    for (let y = 0; y < ht; y++) {
      const tT = (y + 0.5) / kT, tS = tT >= Lt - puno ? Ls - (Lt - tT) : Math.min(tT, arriba);
      const ys = Math.max(0, Math.min(hs - 1, Math.round(tS * kS - 0.5)));
      const [aS, bS] = filaS(ys), cT = wt / 2, cS = ws / 2;
      for (let x = 0; x < wt; x++) {
        // en metros desde la cara de afuera (los parches y logos no se deforman); lo que pase de la orilla de la fuente
        // toma su orilla (la costura de abajo del brazo, que no se ve)
        const xs = Math.max(0, Math.min(ws - 1, Math.round(Math.max(aS, Math.min(bS, cS + (x + 0.5 - cT) * kS / kT)))));
        const i = (ys * ws + xs) * 4, j = (y * wt + x) * 4;
        o[j] = pz[i]; o[j + 1] = pz[i + 1]; o[j + 2] = pz[i + 2]; o[j + 3] = 255;
      }
    }
    g.putImageData(od, t[0], t[1]);
  }
  return out;
}
