/* Motor 3D del probador: uniforme sobre maniquí invisible, con la foto real del dueño pegada encima,
   calcetas y tacos en los pies, en un estudio oscuro con luz.
   Hecho para gama baja y alta: modelos de ~250 KB, se dibuja solo cuando algo cambia (no hay animación
   constante) y la calidad se ajusta al teléfono. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { enderezarShort, limpiarTela, coloresBase, quitarPielOrillas } from './foto.js';

// alturas de cada parte en cada modelo (0 = abajo, 1 = arriba), medidas sobre las imágenes con que se hicieron
const MODELOS = {
  corta: { url: 'corta.glb', hem: 0.592, shortBot: 0.398 },
  larga: { url: 'larga.glb', hem: 0.569, shortBot: 0.388 }
};
export const TACOS = {
  negro: { cuerpo: 0x141518, suela: 0x1d2024, tachones: 0x2b8a94 },
  rosa: { cuerpo: 0xf6588a, suela: 0xf1eef3, tachones: 0xc9f23a },
  turquesa: { cuerpo: 0xf4f6f8, suela: 0xd4f1f4, tachones: 0x16b0b5 }
};
// el taco del cliente es de un solo color: la suela y los tachones son el mismo color, apenas más oscuros (como la luz real)
const COLOR_TACO = { negro: '#141518', blanco: '#f2f3f5', dorado: '#c9a23a', rojo: '#d7262e', azul: '#1f4fd1' };
function coloresTaco(t) {
  if (TACOS[t]) return [TACOS[t].cuerpo, TACOS[t].suela, TACOS[t].tachones].map((v) => new THREE.Color(v));
  const hex = COLOR_TACO[t] || (/^#[0-9a-f]{6}$/i.test(t || '') ? t : COLOR_TACO.negro), c = new THREE.Color(hex);
  return [c, c.clone().multiplyScalar(0.82), c.clone().multiplyScalar(0.68)];
}
const ALTO = 1.8, LARGO_TACO = 0.40;

function gamaBaja() {
  const mem = navigator.deviceMemory || 4, cpu = navigator.hardwareConcurrency || 4;
  return mem <= 3 || cpu <= 4;
}
const cache = {};
function cargarGLB(url) {
  if (!cache[url]) cache[url] = new Promise((ok, no) => { const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder); l.load(url, (g) => ok(g.scene), undefined, no); });
  return cache[url].then((s) => s.clone(true));
}
function canvasDe(img) {
  if (!img) return null;
  if (img instanceof HTMLCanvasElement) return img;
  const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
  c.getContext('2d').drawImage(img, 0, 0); return c;
}
// ancho del torso de la foto a cierta altura (0 abajo, 1 arriba)
// "renglones": por cada altura de la playera, hasta dónde llega a la izquierda y a la derecha. Se guarda en una
// imagencita de 2×128 (cada número en dos bytes) que el 3D lee para pegar cada renglón de la foto en el mismo renglón del modelo.
const RENG = 128;
// suaviza los renglones (la orilla de una foto es dentada; sin suavizar, la manga sale con rayitas)
function suave(v) { const o = new Float32Array(v.length), k = 4; for (let r = 0; r < v.length; r++) { const w = []; for (let j = Math.max(0, r - k); j <= Math.min(v.length - 1, r + k); j++) w.push(v[j]); w.sort((p, q) => p - q); o[r] = w[w.length >> 1]; } const o2 = new Float32Array(v.length); for (let r = 0; r < v.length; r++) { let t = 0, n = 0; for (let j = Math.max(0, r - 2); j <= Math.min(v.length - 1, r + 2); j++) { t += o[j]; n++; } o2[r] = t / n; } return o2; }
// una sola imagencita de 6×128 para todo (modelo, foto de frente y foto de espalda: izquierda y derecha de cada uno);
// una sola, porque los celulares viejos solo aguantan pocas imágenes a la vez en el 3D
function texRenglones(renCanvas, col, izq, der, de, a) {   // valores en [de, a]; col 0 = modelo, 1 = frente, 2 = espalda
  izq = suave(izq); der = suave(der);
  const g = renCanvas.getContext('2d'), im = g.createImageData(2, RENG);
  const cod = (v, k) => { const q = Math.round(Math.max(0, Math.min(1, (v - de) / (a - de))) * 65535); im.data[k] = q >> 8; im.data[k + 1] = q & 255; im.data[k + 2] = 0; im.data[k + 3] = 255; };
  for (let r = 0; r < RENG; r++) { cod(izq[r], r * 8); cod(der[r], r * 8 + 4); }
  g.putImageData(im, col * 2, 0);
}
// la foto: por renglón, lo más a la izquierda y a la derecha que tiene tela (sin tela: el torso, para que ahí no haya manga)
function renglonesFoto(c, tor) {
  const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data, L = new Float32Array(RENG), R = new Float32Array(RENG);
  for (let r = 0; r < RENG; r++) {
    const y = Math.min(H - 1, Math.floor((r + 0.5) / RENG * H)); let a = -1, b = -1;
    for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 128) { a = x; break; }
    for (let x = W - 1; x >= 0; x--) if (d[(y * W + x) * 4 + 3] > 128) { b = x; break; }
    L[r] = a < 0 ? tor[0] : a / W; R[r] = b < 0 ? tor[0] + tor[1] : (b + 1) / W;
  }
  return [L, R];
}
// la espalda completada con el frente: donde el frente (volteado como espejo y a la medida del torso de la espalda) tiene tela
// y la espalda no, se pone la tela del frente. Solo si falta un pedazo de verdad; las orillas finas no se tocan.
function completarConFrente(b, f) {
  const BW = b.width, BH = b.height, FW = f.width, FH = f.height;
  const [tbx, tbw] = torsoFoto(b, 0.30), [tfx, tfw] = torsoFoto(f, 0.30);
  if (tbw <= 0 || tfw <= 0) return b;
  const sx = (tbw * BW) / (tfw * FW), cb = (tbx + tbw / 2) * BW, cf = (tfx + tfw / 2) * FW, sy = FH / BH;
  const fd = f.getContext('2d').getImageData(0, 0, FW, FH).data, fa = (x, y) => (x < 0 || y < 0 || x >= FW || y >= FH) ? 0 : fd[(y * FW + x) * 4 + 3];
  let f0 = FW, f1 = -1; for (let y = 0; y < FH; y += 2) for (let x = 0; x < FW; x++) if (fd[(y * FW + x) * 4 + 3] > 128) { if (x < f0) f0 = x; if (x > f1) f1 = x; }
  if (f1 < 0) return b;
  const e0 = Math.floor(cb - (f1 - cf) * sx), e1 = Math.ceil(cb - (f0 - cf) * sx), ox = Math.max(0, -e0), W = Math.max(BW, e1 + 1) + ox;
  const o = document.createElement('canvas'); o.width = W; o.height = BH; const g = o.getContext('2d'); g.drawImage(b, ox, 0);
  const od = g.getImageData(0, 0, W, BH), d = od.data, m = Math.max(2, Math.round(FW * 0.008)); let puestos = 0, total = 0;
  for (let y = 0; y < BH; y++) {
    const yf = Math.min(FH - 1, Math.round(y * sy));
    for (let x = 0; x < W; x++) {
      const xf = Math.round(cf - (x - ox - cb) / sx); if (fa(xf, yf) <= 128) continue; total++;
      const k = (y * W + x) * 4; if (d[k + 3] > 128) continue;
      // solo lo que está bien adentro de la silueta del frente (las orillas no coinciden al pixel)
      if (fa(xf - m, yf) <= 128 || fa(xf + m, yf) <= 128 || fa(xf, yf - m) <= 128 || fa(xf, Math.min(FH - 1, yf + m)) <= 128) continue;
      const j = (yf * FW + xf) * 4; d[k] = fd[j]; d[k + 1] = fd[j + 1]; d[k + 2] = fd[j + 2]; d[k + 3] = 255; puestos++;
    }
  }
  if (!total || puestos / total < 0.015) return b;
  g.putImageData(od, 0, 0); return o;
}
function torsoFoto(c, alt) {
  const g = c.getContext('2d'), y = Math.round(c.height * (1 - alt)), d = g.getImageData(0, y, c.width, 1).data; let a = -1, b = -1;
  for (let x = 0; x < c.width; x++) if (d[x * 4 + 3] > 128) { if (a < 0) a = x; b = x; }
  if (a < 0) return [0, 1];
  return [a / c.width, (b - a) / c.width];
}
// tela para las mangas y costados: el cuadro más liso de la manga de la foto (sin letras ni logos)
function telaManga(c, fx0) {
  const g = c.getContext('2d'), W = c.width, H = c.height, d = g.getImageData(0, 0, W, H).data;
  const xMax = Math.floor(W * fx0) - 4, lado = Math.max(16, Math.round(W * 0.05)); let mejor = null, menor = 1e9;
  const prueba = (x0, x1) => {
    for (let y = Math.floor(H * 0.04); y + lado < H * 0.6; y += 4)
      for (let x = Math.max(0, x0); x + lado < x1; x += 4) {
        let n = 0, s1 = 0, s2 = 0, ok = true;
        for (let yy = y; yy < y + lado && ok; yy += 3) for (let xx = x; xx < x + lado; xx += 3) {
          const i = (yy * W + xx) * 4; if (d[i + 3] < 230) { ok = false; break; }
          const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; s1 += l; s2 += l * l; n++;
        }
        if (!ok) continue;
        const v = s2 / n - (s1 / n) * (s1 / n); if (v < menor) { menor = v; mejor = [x, y]; }
      }
  };
  prueba(0, xMax);
  if (!mejor) prueba(Math.floor(W * fx0), W);
  const o = document.createElement('canvas'); o.width = o.height = 256; const og = o.getContext('2d');
  if (mejor) og.drawImage(c, mejor[0], mejor[1], lado, lado, 0, 0, 256, 256);
  else { og.fillStyle = '#eeeeee'; og.fillRect(0, 0, 256, 256); }
  return o;
}
// premultiplyAlpha: al mezclar pixeles en la orilla de la prenda no se cuela el negro de lo transparente
function textura(c, repetir) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.premultiplyAlpha = true;
  if (repetir) t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
  return t;
}
// ---- el fondo nunca choca con el uniforme ----
// cada fondo guardado en 4x6 cuadros de color (lo que queda detrás del uniforme); se compara con el color principal de la playera
const FONDOS_COLOR = {
  'dia': 'acc5e1cddbe8c4d3e2b4c7dd4b57574b58574a57564b58574c5958515d5c54605d525e5da0b558a4b9618ea63890a83f94a94395aa4a8ba2368da43c7e933680963e768d2f788f31',
  'atardecer': 'd8bcc0ebcfccdbaea8cba19fecb8a6f9d7c8fddac5f7c8b0b3896ac7976fd6a57ac09673756131907243a98041896b39484e1750541c45490743480b2c360a313b0e262f06252f06',
  'noche': '18213919233e1a26431c274445506a2e3c602c3a5f45516e808a9c535f7b4c57727d8799535a616b737a69717750585e587d3875995861873c5f833f2d4d15385c1d24450c22410b',
  'nublado': '575f638f969bb5bcc1b2babf13191a282727746e6e54595d231d193f2f28544d4a4145472e31203138282830212f392b223c21274226274226233d220d240e0f270f1028100e250e',
  'azulnoche': '010d1801060c01060c010d192e5573142a3b1228372c53712643571d36451c34422844573b57523c58533c58513a57515f91326b9c47598c265e8f324775244b7a2c39651435610e',
  'naranja': '53414f574455483c503530417d553a724d35684431613f317a50346e472c6c452b774e33877531937e3a8e7b348e7a384e6716566e1b3d5707465f112c430b2e450c203507203507',
  'lluvia': '24323c30404c32414f26333e35414876858d7c8c95404e5720282c3b45493b454a232c3036483c3d51433f5347394b3f3f5844324e3637533a4b63521b2a1e142617152819203125',
  'techado': 'bebfb9c2c1bac1c1babdbeb7c4c4c0cbccc9cbcccac1c2bf90948faeb0acaeaea990928d6e7471898d8a898d8a6e757265833b7d965c7491466c87494e7220547729436b06456c0e',
  'blanco': '7ba7d97ea4cf7ca2cf79a3d9535546494a39484a395354443c4b523e4e5541505645535894a1559da9658a984999a76096a64597a9457084196f841b8695338c9c38798a277d8f2d',
  'dorado': '211405170e02140c02190f048459296541185134136444227252284a32143b2710634523594411695115755b1f584411564705534505735d0f715b0f2e28052e2806463b09443809',
  'g-azul': '1d2e8a1f32941f32951d2e8a21359c253cae253cae21359d2237a1273fb72740b72237a11f32942237a22237a21f32951a297e1c2d871c2d871a297e14206516226b16226b142065',
  'g-negro': '2b2e3a30323f30333f2b2e3a3436433b3e4c3b3e4c3436433538453e42513e425136384530323f36384636394630333f2629342a2d382a2d392629341c1d271e202a1f202a1c1d27',
  'g-blanco': 'e7e8eeeaecf1ebecf1e7e8ededeff3f4f6f7f4f6f8eeeff3eff1f4f8f9faf8f9faeff1f4ebecf0eff1f4f0f1f4ebecf1e2e4eae6e7ede6e7ede2e4ead8dbe4dbdde6dbdde6d8dbe4',
  'g-dorado': 'eeb72ff1bd35f1bd34eeb72ff3c039f8c942f8c942f3c039f4c33bface47face47f4c33bf1bc34f4c33cf4c33cf1bd34ebb229edb62dedb62debb229e4a51be6a81ee6a91ee4a51b',
  'g-rojo': 'b8272bc12b2ec12b2eb8272bc82d30d63335d63335c82d30cc2f31de3637de3637cc2f31c12b2ecc2f31cc2f31c12b2eaf2328b6262bb6262baf23289a1b219f1d239f1d239a1b21'
};
function hexA(h) { return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function cuadros(h) { const r = []; for (let i = 0; i < h.length; i += 6) r.push(hexA(h.slice(i, i + 6))); return r; }
// distancia de color como la ve el ojo (CIELAB)
function lab(c) {
  const f = (v) => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; };
  const r = f(c[0]), g = f(c[1]), b = f(c[2]);
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const k = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); x = k(x); y = k(y); z = k(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function dE(a, b) { const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); }
// qué tanto del fondo se parece al uniforme (0 nada, 1 todo)
// dos colores chocan si casi son el mismo, o si son de la misma familia (azul con azul aunque uno sea claro y otro oscuro)
function parecidos(a, b) {
  if (dE(a, b) < 24) return true;
  const A = lab(a), B = lab(b), ca = Math.hypot(A[1], A[2]), cb = Math.hypot(B[1], B[2]);
  if (ca < 25 || cb < 25) return false;
  let dh = Math.abs(Math.atan2(A[2], A[1]) - Math.atan2(B[2], B[1])) * 180 / Math.PI; if (dh > 180) dh = 360 - dh;
  return dh < 18;
}
function choque(cs, col) { let n = 0; cs.forEach((c) => { if (parecidos(c, col)) n++; }); return n / cs.length; }
// los cuadros de color de una imagen ya cargada (la foto propia del dueño o el estadio de siempre)
function cuadrosDe(img) {
  try {
    const c = document.createElement('canvas'); c.width = 4; c.height = 6; const g = c.getContext('2d');
    const w = img.width, h = img.height; g.drawImage(img, w * 0.15, h * 0.1, w * 0.7, h * 0.8, 0, 0, 4, 6);
    const d = g.getImageData(0, 0, 4, 6).data, r = []; for (let i = 0; i < d.length; i += 4) r.push([d[i], d[i + 1], d[i + 2]]); return r;
  } catch (e) { return null; }
}
// el color principal de la tela: el grupo de colores que más se repite en la foto (sin lo transparente)
function colorTela(c) {
  const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data, cub = new Map(), paso = Math.max(1, Math.floor(Math.sqrt(W * H / 9000)));
  for (let y = 0; y < H; y += paso) for (let x = 0; x < W; x += paso) {
    const i = (y * W + x) * 4; if (d[i + 3] < 230) continue;
    const k = (d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4), v = cub.get(k) || [0, 0, 0, 0];
    v[0] += d[i]; v[1] += d[i + 1]; v[2] += d[i + 2]; v[3]++; cub.set(k, v);
  }
  let m = null; cub.forEach((v) => { if (!m || v[3] > m[3]) m = v; });
  return m ? [m[0] / m[3], m[1] / m[3], m[2] / m[3]] : null;
}
function fondoEstudio() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 768; const g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 300, 20, 256, 340, 520); gr.addColorStop(0, '#3b3c43'); gr.addColorStop(.5, '#17181c'); gr.addColorStop(1, '#050506');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 768);
  return textura(c);
}

export async function crear(canvas, opt = {}) {
  const base = opt.base || '/assets/3d/';
  const baja = opt.baja != null ? opt.baja : gamaBaja();
  const r = new THREE.WebGLRenderer({ canvas, antialias: !baja, preserveDrawingBuffer: false, alpha: true, powerPreference: baja ? 'low-power' : 'default' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, baja ? 1.25 : 2));
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.0;
  r.shadowMap.enabled = true; r.shadowMap.type = baja ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = fondoEstudio();
  // fondo de cancha: pasto, luces y tribuna desenfocada; se acomoda como "cover" según el tamaño del visor
  let campo = null;
  // el fondo puede ser el estadio de siempre o la foto que puso el dueño en su panel
  // el fondo que eligió el dueño se respeta; solo si choca con el uniforme que se ve, se cambia (para ese uniforme) por el que más contrasta
  let fondoPedido = '', fondoPuesto = '', colorUni = null; const cuadrosPedido = {};
  function fondoParaUniforme() {
    if (!colorUni || !fondoPedido) return fondoPedido;
    const cp = cuadrosPedido[fondoPedido]; if (!cp) return fondoPedido;
    if (choque(cp, colorUni) < 0.34) return fondoPedido;
    let mejor = fondoPedido, menor = choque(cp, colorUni), lejos = 0;
    Object.keys(FONDOS_COLOR).forEach((k) => {
      const cs = cuadros(FONDOS_COLOR[k]), ch = choque(cs, colorUni), dm = cs.reduce((a, c) => a + dE(c, colorUni), 0) / cs.length;
      if (ch < menor - 0.001 || (Math.abs(ch - menor) < 0.001 && dm > lejos)) { mejor = '/assets/fondos/' + k + '.webp'; menor = ch; lejos = dm; }
    });
    return mejor;
  }
  function ponerFondo(url) {
    fondoPedido = url; const k = (url.match(/fondos\/([\w-]+)\.webp/) || [])[1];
    if (k && FONDOS_COLOR[k]) cuadrosPedido[url] = cuadros(FONDOS_COLOR[k]);
    revisarFondo();
  }
  function revisarFondo() { const u = fondoParaUniforme(); if (u !== fondoPuesto) ponerCampo(u); }
  function ponerCampo(url) {
    fondoPuesto = url;
    new THREE.TextureLoader().load(url, (t) => {
      if (url !== fondoPuesto) { t.dispose(); return; }
      if (url === fondoPedido && !cuadrosPedido[url]) { const cs = cuadrosDe(t.image); if (cs) { cuadrosPedido[url] = cs; const u = fondoParaUniforme(); if (u !== url) { t.dispose(); ponerCampo(u); return; } } } t.colorSpace = THREE.SRGBColorSpace; if (campo && campo !== t) campo.dispose(); campo = t; scene.background = t; if (ultimoAspecto) encuadrarFondo(ultimoAspecto); pedir(); }, undefined, () => { if (url !== base + 'campo.webp') ponerCampo(base + 'campo.webp'); });
  }
  let ultimoAspecto = 0;
  ponerFondo(opt.campo || base + 'campo.webp');
  function encuadrarFondo(aspecto) {
    if (!campo || !campo.image) return;
    const ai = campo.image.width / campo.image.height;
    if (aspecto > ai) { const k = ai / aspecto; campo.repeat.set(1, k); campo.offset.set(0, (1 - k) * 0.42); }
    else { const k = aspecto / ai; campo.repeat.set(k, 1); campo.offset.set((1 - k) / 2, 0); }
  }
  // luz de ambiente: en teléfonos sencillos una luz de cielo/piso (instantánea) en lugar del cuarto de reflejos (pesado de preparar)
  if (baja) scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a4a2a, 0.9));
  else { const pmrem = new THREE.PMREMGenerator(r); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35; pmrem.dispose(); }
  const cam = new THREE.PerspectiveCamera(22, 2 / 3, 0.1, 100);
  const key = new THREE.SpotLight(0xffffff, 42, 0, Math.PI / 6, 0.6, 1.2); key.position.set(1.2, 5, 4); key.castShadow = true; key.shadow.mapSize.set(baja ? 1024 : 2048, baja ? 1024 : 2048); key.shadow.radius = 6; key.shadow.blurSamples = 12; scene.add(key);
  const rimL = new THREE.DirectionalLight(0x9fb4ff, 1.4); rimL.position.set(-4, 2, -3); scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0xffffff, 1.0); rimR.position.set(4, 1.5, -2); scene.add(rimR);
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.2 })); piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso);
  const raiz = new THREE.Group(); scene.add(raiz);
  // sombra de contacto: suave y chica bajo los pies, para que el uniforme pise el pasto sin robar atención
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sg = sc.getContext('2d');
  const rg = sg.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, 'rgba(0,0,0,0.55)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = rg; sg.fillRect(0, 0, 128, 128);
  const contacto = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, opacity: 0.5 }));
  contacto.rotation.x = -Math.PI / 2; contacto.position.set(0, 0.002, 0.08); scene.add(contacto);

  // estado
  const E = {
    manga: 'corta', taco: 'negro', vista: 0, zoom: 0, // vista: 0 frente, PI espalda; zoom: 0 completo, 1 tacos de cerca
    fotos: { frente: null, espalda: null, short: null }, colorShort: '#f2f2f4', colorCalceta: '#f2f2f4', colorFranja: '', foco: { k: 1, m: 0.92, a: 1 }, ajNom: [1, 0, 0, 1], ajNum: [1, 0, 0, 1], sel: '',
    dorsal: { nombre: '', numero: '', color: '#111111', sello: true }
  };
  let kit = null, kitMesh = null, tacos = [], zonas = null, uni = null, tacoCol = null, hemModelo = null, hemFoto = null; const HEMC = 96;
  const corte = { value: -1 };

  // uniformes del material del uniforme (se comparten entre recompilaciones)
  uni = {
    uFoto: { value: null }, uEspalda: { value: null }, uManga: { value: null }, uShortTex: { value: null }, uDorsal: { value: null }, uShortNum: { value: null }, uHayNum: { value: 0 },
    uCaja: { value: new THREE.Vector4() }, uTorsoF: { value: new THREE.Vector2(0, 1) }, uTorsoB: { value: new THREE.Vector2(0, 1) }, uRen: { value: null }, uHayRen: { value: 0 },
    uAjF: { value: new THREE.Vector3(1, 0, 0) }, uAjB: { value: new THREE.Vector3(1, 0, 0) }, uAjS: { value: new THREE.Vector3(1, 0, 0) },
    uShortCaja: { value: new THREE.Vector4() }, uZonas: { value: new THREE.Vector3() }, uShortBot: { value: 0 },
    uShort: { value: new THREE.Color() }, uSock: { value: new THREE.Color() }, uHayShort: { value: 0 }, uCorte: corte,
    uFranja: { value: new THREE.Color() }, uHayFranja: { value: 0 }, uSockTop: { value: 0 }, uFranjaAlto: { value: 0 },
    uSel: { value: 0 }, uSelCaja: { value: new THREE.Vector4(0, 0, 0, 0) }, uDentro: { value: new THREE.Color(0.9, 0.9, 0.9) }, uHem: { value: null }, uHayHem: { value: 0 },
    uMangaI: { value: null }, uMangaD: { value: null }, uHayMI: { value: 0 }, uHayMD: { value: 0 },
    uCajaMI: { value: new THREE.Vector4(0, 0, 1, 1) }, uCajaMD: { value: new THREE.Vector4(0, 0, 1, 1) },
    uMSI: { value: new THREE.Vector3() }, uMAI: { value: new THREE.Vector3(0, -1, 0) }, uMOI: { value: new THREE.Vector3(-1, 0, 0) }, uMFI: { value: new THREE.Vector3(0, 0, 1) },
    uOtroLargo: { value: 0 }, uMRI: { value: new THREE.Vector3(1, 0.05, 1) }, uMRD: { value: new THREE.Vector3(1, 0.05, 1) }, uMSD: { value: new THREE.Vector3() }, uMAD: { value: new THREE.Vector3(0, -1, 0) }, uMOD: { value: new THREE.Vector3(1, 0, 0) }, uMFD: { value: new THREE.Vector3(0, 0, 1) }, uAjMI: { value: new THREE.Vector3(1, 0, 0) }, uAjMD: { value: new THREE.Vector3(1, 0, 0) }
  };
  const matKit = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.0, side: THREE.DoubleSide });
  matKit.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMundo; varying vec3 vNormMundo;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMundo = (modelMatrix * vec4(transformed,1.0)).xyz; vNormMundo = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uCorte; uniform sampler2D uFoto; uniform sampler2D uEspalda; uniform sampler2D uManga; uniform sampler2D uShortTex; uniform sampler2D uDorsal; uniform sampler2D uShortNum; uniform float uHayNum;
uniform vec3 uAjF; uniform vec3 uAjB; uniform vec3 uAjS; uniform vec4 uCaja; uniform vec2 uTorsoF; uniform vec2 uTorsoB; uniform sampler2D uRen; uniform float uHayRen; uniform vec4 uShortCaja; uniform vec3 uZonas; uniform float uShortBot;
uniform float uSel; uniform vec4 uSelCaja; uniform vec3 uDentro; uniform sampler2D uHem; uniform float uHayHem;
uniform sampler2D uMangaI; uniform sampler2D uMangaD; uniform float uHayMI; uniform float uHayMD; uniform vec4 uCajaMI; uniform vec4 uCajaMD; uniform vec3 uAjMI; uniform vec3 uAjMD;
uniform float uOtroLargo; uniform vec3 uMRI; uniform vec3 uMRD; uniform vec3 uMSI; uniform vec3 uMAI; uniform vec3 uMOI; uniform vec3 uMFI; uniform vec3 uMSD; uniform vec3 uMAD; uniform vec3 uMOD; uniform vec3 uMFD;
uniform vec3 uShort; uniform vec3 uSock; uniform float uHayShort; uniform vec3 uFranja; uniform float uHayFranja; uniform float uSockTop; uniform float uFranjaAlto;
varying vec3 vMundo; varying vec3 vNormMundo;
// de dónde de la foto sale cada punto de la playera, renglón por renglón: el torso del modelo con el torso de la foto y lo que
// sobra a cada lado (la manga a esa altura) con lo que sobra a ese lado en la foto, hasta su orilla (el puño).
float leer2(float x, float v) { vec4 p = texture2D(uRen, vec2(x, v)); return (p.r * 255.0 + p.g * 0.99609375) * 0.00390631; }
float xFoto(float u, float m0, float m1, vec2 tor, vec2 ph) {
  float t1 = tor.x + tor.y;
  if (u < 0.0) return (tor.x - ph.x > 0.02 && m0 < -0.01) ? tor.x - (tor.x - ph.x) * (u / m0) : tor.x + u * tor.y;
  if (u > 1.0) return (ph.y - t1 > 0.02 && m1 > 1.01) ? t1 + (ph.y - t1) * ((u - 1.0) / (m1 - 1.0)) : tor.x + u * tor.y;
  return tor.x + u * tor.y;
}
// una cara de la playera (frente o espalda) en este punto: de dónde sale de su foto, el puño limpio, la tela y el nombre/número
vec3 caraPlayera(bool atras, out vec2 uvSalida) {
  float ux = (vMundo.x - uCaja.x) / uCaja.z, vy = (vMundo.y - uCaja.y) / uCaja.w;
  vec2 tor = atras ? uTorsoB : uTorsoF;
  vec2 uv = vec2(tor.x + (atras ? 1.0 - ux : ux) * tor.y, vy);
  bool hayManga = false;   // en este renglón el modelo tiene manga de ese lado (no es el costado del cuerpo)
  if (uHayRen > 0.5) {
    float vr = clamp(vy, 0.002, 0.998), m0 = leer2(0.5 / 6.0, vr) * 4.0 - 1.5, m1 = leer2(1.5 / 6.0, vr) * 4.0 - 1.5;
    if (atras) { ux = 1.0 - ux; float k = m0; m0 = 1.0 - m1; m1 = 1.0 - k; }
    hayManga = (ux < 0.0 && m0 < -0.12) || (ux > 1.0 && m1 > 1.12);
    vec2 ph = atras ? vec2(leer2(4.5 / 6.0, vr), leer2(5.5 / 6.0, vr)) : vec2(leer2(2.5 / 6.0, vr), leer2(3.5 / 6.0, vr));
    uv.x = xFoto(ux, m0, m1, tor, ph);
  }
  vec2 uv0 = uv; uvSalida = uv0;
  vec3 aj = atras ? uAjB : uAjF; uv = (uv - 0.5) / aj.x + 0.5 - aj.yz;   // lo que el dueño acomodó: más grande/chica y movida (el nombre y número no se mueven)
  vec4 f = atras ? texture2D(uEspalda, uv) : texture2D(uFoto, uv);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) f.a = 0.0;
  // la punta de la manga (el borde grueso del puño) cae justo en la orilla de la foto, donde hay sombra, fondo o nada:
  // ahí se toma la tela un poco más adentro del puño (su color real: blanco si el puño es blanco), nunca la orilla sucia
  if (hayManga && f.a < 0.9 && normalize(vNormMundo).y < -0.35) {   // solo el borde del puño (mira hacia abajo), no la orilla de arriba de la manga
    vec2 haciaDentro = normalize(vec2(0.5, 0.62) - uv);
    for (int i = 1; i <= 8; i++) {
      vec2 q = uv + haciaDentro * (0.009 * float(i));
      vec4 g = atras ? texture2D(uEspalda, q) : texture2D(uFoto, q);
      if (q.x >= 0.0 && q.x <= 1.0 && q.y >= 0.0 && q.y <= 1.0 && g.a > 0.92) { f = g; break; }
    }
  }
  vec3 manga = texture2D(uManga, vMundo.xy * 3.2).rgb;
  vec3 c = mix(manga, f.rgb / max(f.a, 0.004), smoothstep(0.35, 0.9, f.a));
  if (atras) { vec4 nd = texture2D(uDorsal, uv0); c = mix(c, nd.rgb / max(nd.a, 0.004), nd.a); }
  return c;
}
`)
      .replace('#include <map_fragment>', `
if (vMundo.y < uCorte) discard;
float t = (vMundo.y - uZonas.x) / uZonas.y;
vec3 base; vec2 uvSel = vec2(-1.0); float zona = 0.0; float mangaLado = 0.0;   // zona: 1 playera, 2 short, 3 calcetas (para iluminar la pieza escogida en el panel)
// el uniforme no se mueve (gira la cámara): lo que mira hacia atrás usa la foto de la espalda
bool atras = vNormMundo.z < 0.0;
if (t > uZonas.z - 0.01) {
  // los costados: una foto plana no los muestra. En vez de cambiar de golpe de la foto del frente a la de la espalda en la
  // costura (ahí se veía el corte y lo estirado), en una franja del costado se mezclan las dos, suave, según hacia dónde mira la tela
  float nz = normalize(vNormMundo).z, franja = 0.28;
  vec2 uvF = vec2(-1.0), uvB = vec2(-1.0);
  if (nz > franja) base = caraPlayera(false, uvF);
  else if (nz < -franja) base = caraPlayera(true, uvB);
  else { vec3 cf = caraPlayera(false, uvF), cb = caraPlayera(true, uvB); base = mix(cb, cf, smoothstep(-franja, franja, nz)); }
  uvSel = atras ? uvB : uvF; zona = 1.0;
  // la manga con su propia foto (tomada de lado): se pone en la cara de afuera de la manga, de un lado al otro, sin cortes;
  // hacia el frente y la espalda se mezcla suave con esas fotos. Sin foto de manga, todo queda como antes.
  if (uHayRen > 0.5) {
    float uxM = (vMundo.x - uCaja.x) / uCaja.z, vrM = clamp((vMundo.y - uCaja.y) / uCaja.w, 0.002, 0.998);
    float m0M = leer2(0.5 / 6.0, vrM) * 4.0 - 1.5, m1M = leer2(1.5 / 6.0, vrM) * 4.0 - 1.5;
    if (uxM < 0.0 && m0M < -0.12) mangaLado = 1.0; else if (uxM > 1.0 && m1M > 1.12) mangaLado = 2.0;
    // fotos de manga corta en manga larga: arriba la manga sale de la foto; el resto del brazo (que la foto no muestra) es la
    // tela de la misma playera, así su puño no aparece como brazalete a media manga
    if (uOtroLargo > 0.5 && mangaLado > 0.5) {
      vec3 S1 = mangaLado == 1.0 ? uMSI : uMSD, A1 = mangaLado == 1.0 ? uMAI : uMAD;
      float tB = dot(vMundo - S1, A1) / max(dot(A1, A1), 1e-6);
      base = mix(base, texture2D(uManga, vMundo.xy * 3.2).rgb, smoothstep(0.2, 0.32, tB));
    }
    if ((mangaLado == 1.0 && uHayMI > 0.5) || (mangaLado == 2.0 && uHayMD > 0.5)) {
      // la manga es un tubo: a lo largo va del hombro (arriba de la foto) al puño (abajo); alrededor, la foto cubre la mitad
      // de afuera (de la costura del frente a la de atrás), con su centro en la cara de afuera, donde van los parches
      bool izq = mangaLado == 1.0;
      vec3 S0 = izq ? uMSI : uMSD, AX = izq ? uMAI : uMAD, O = izq ? uMOI : uMOD, F = izq ? uMFI : uMFD; vec3 ajm = izq ? uAjMI : uAjMD;
      vec3 q = vMundo - S0; float L2 = max(dot(AX, AX), 1e-6), tA = dot(q, AX) / L2;
      vec3 rr = q - AX * tA; float fi = atan(dot(rr, F), dot(rr, O));   // 0 = cara de afuera; + hacia el frente
      float su = izq ? 0.5 + fi / 3.14159265 : 0.5 - fi / 3.14159265;   // izquierda: el frente a la derecha de su foto; derecha: a la izquierda
      // la foto se estira al largo de la manga solo si es de ese mismo largo; si es de la otra (foto de manga corta con
      // manga larga), va desde el hombro con sus proporciones reales y el resto del brazo sale de las fotos de frente y espalda
      vec3 MR = izq ? uMRI : uMRD;   // x: 1 estirar, 0 proporción real; y: radio de la manga; z: alto/ancho de la foto
      float tF = MR.x > 0.5 ? tA : tA * sqrt(L2) / max(MR.z * 3.14159265 * MR.y, 0.01);
      vec2 um = (vec2(su, 1.0 - tF) - 0.5) / ajm.x + 0.5 - ajm.yz;
      vec4 g = izq ? texture2D(uMangaI, um) : texture2D(uMangaD, um);
      if (um.x < 0.0 || um.x > 1.0 || um.y < 0.0 || um.y > 1.0) g.a = 0.0;
      float w = (1.0 - smoothstep(1.25, 1.57, abs(fi))) * smoothstep(0.35, 0.9, g.a) * smoothstep(-0.04, 0.06, tA) * smoothstep(0.03, 0.09, izq ? -uxM : uxM - 1.0);
      if (MR.x < 0.5) w *= 1.0 - smoothstep(0.76, 0.84, tF);   // foto de otro largo: su puño no se pone a media manga
      base = mix(base, g.rgb / max(g.a, 0.004), w);
    }
  }
} else if (t > uShortBot) {
  base = uShort; zona = 2.0;
  if (uHayShort > 0.5) {
    // el short: la foto es solo del frente, así que va solo en lo que mira al frente.
    // Los lados y atrás van del color que más tiene el short: la foto no los muestra y estirarla los duplica en rayas.
    float cx = (vMundo.x - uShortCaja.x) / uShortCaja.z, sx = clamp((cx - 0.06) / 0.88, 0.0, 1.0), sv = (vMundo.y - uShortCaja.y) / uShortCaja.w;
    // la orilla de abajo: columna por columna, la orilla de la foto (a veces en diagonal) cae justo en la orilla del modelo
    if (uHayHem > 0.5) { vec2 hm = texture2D(uHem, vec2(clamp(cx, 0.0, 1.0), 0.5)).rg; float o = hm.r - hm.g, w = max(0.45, abs(o) * 1.8); sv += o * (1.0 - clamp((sv - hm.g) / w, 0.0, 1.0)); }   // solo en la parte de abajo y sin doblar nunca la foto: lo de arriba no se mueve
    vec2 suv = (vec2(sx, sv) - 0.5) / uAjS.x + 0.5 - uAjS.yz;
    vec4 s = texture2D(uShortTex, suv);
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) s.a = 0.0;
    float deFrente = normalize(vNormMundo).z;
    s.a *= smoothstep(0.5, 0.68, deFrente);
    base = mix(uShort, s.rgb / max(s.a, 0.004), s.a);
    if (!atras && uHayNum > 0.5) { vec4 ns = texture2D(uShortNum, vec2(sx, (vMundo.y - uShortCaja.y) / uShortCaja.w)); base = mix(base, ns.rgb / max(ns.a, 0.004), ns.a); }
  }
} else {
  base = uSock; zona = 3.0;
  if (uHayFranja > 0.5 && vMundo.y > uSockTop - uFranjaAlto) base = uFranja;
}
// por dentro (lo que se asoma por las mangas, el cuello y abajo): el color de la tela, sin el dibujo de afuera, un poco más oscuro
if (!gl_FrontFacing) base = (zona == 1.0 ? uDentro : (zona == 2.0 ? uShort : uSock)) * 0.8;
// panel: la pieza escogida se ve normal y todo lo demás en blanco y negro, apagado
if (uSel > 0.5) {
  bool on = (uSel < 1.5 && zona == 1.0 && !atras) || (uSel > 1.5 && uSel < 2.5 && zona == 1.0 && atras) || (uSel > 2.5 && uSel < 3.5 && zona == 2.0) || (uSel > 5.5 && uSel < 6.5 && zona == 3.0) || (uSel > 6.5 && uSel < 7.5 && mangaLado == 1.0) || (uSel > 7.5 && mangaLado == 2.0);
  float halo = 0.0;
  if (uSel > 3.5 && zona == 1.0 && atras && uvSel.x > uSelCaja.x && uvSel.x < uSelCaja.z && uvSel.y > uSelCaja.y && uvSel.y < uSelCaja.w) {
    // nombre o número: solo las letras quedan encendidas, con un contorno dorado alrededor (nada de cuadros)
    float a0 = texture2D(uDorsal, uvSel).a, o = 0.007, o2 = 0.005;
    float g = max(max(texture2D(uDorsal, uvSel + vec2(o, 0.0)).a, texture2D(uDorsal, uvSel - vec2(o, 0.0)).a), max(texture2D(uDorsal, uvSel + vec2(0.0, o)).a, texture2D(uDorsal, uvSel - vec2(0.0, o)).a));
    g = max(g, max(max(texture2D(uDorsal, uvSel + vec2(o2, o2)).a, texture2D(uDorsal, uvSel - vec2(o2, o2)).a), max(texture2D(uDorsal, uvSel + vec2(o2, -o2)).a, texture2D(uDorsal, uvSel + vec2(-o2, o2)).a)));
    on = a0 > 0.4; halo = on ? 0.0 : smoothstep(0.15, 0.6, g);
  }
  if (!on) base = vec3(dot(base, vec3(0.299, 0.587, 0.114))) * 0.42;
  base = mix(base, vec3(1.0, 0.776, 0.102), halo);
}
diffuseColor.rgb *= base;`);
  };

  async function ponerModelo() {
    if (kit) raiz.remove(kit);
    tacos.forEach((t) => raiz.remove(t)); tacos = [];
    const M = MODELOS[E.manga];
    kit = await cargarGLB(base + M.url);
    kit.traverse((o) => { if (o.isMesh) kitMesh = o; });
    const box = new THREE.Box3().setFromObject(kit), size = box.getSize(new THREE.Vector3());
    kit.scale.setScalar(ALTO / size.y); kit.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(kit);
    kit.position.x -= (b2.min.x + b2.max.x) / 2; kit.position.z -= (b2.min.z + b2.max.z) / 2; kit.position.y -= b2.min.y - 0.05;
    kit.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(kit);
    zonas = { Y0: bb.min.y, YH: bb.max.y - bb.min.y, hem: M.hem, shortBot: M.shortBot, top: bb.max.y };
    uni.uZonas.value.set(zonas.Y0, zonas.YH, M.hem); uni.uShortBot.value = M.shortBot;
    kitMesh.material = matKit; kitMesh.castShadow = true; kitMesh.receiveShadow = true;
    raiz.add(kit);
    medirZonas();
    await ponerTacos();
    aplicarFotos();
  }
  // medidas del modelo para pegar la foto: torso y short
  function medirZonas() {
    const pos = kitMesh.geometry.attributes.position, v = new THREE.Vector3();
    const shirtBot = zonas.Y0 + zonas.hem * zonas.YH, yTor = shirtBot + (zonas.top - shirtBot) * 0.30;
    const shortTop = shirtBot, shortBot = zonas.Y0 + zonas.shortBot * zonas.YH;
    let sx0 = 1e9, sx1 = -1e9; const xs = [];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(kitMesh.matrixWorld);
      if (Math.abs(v.y - yTor) < 0.012 && v.z > 0) xs.push(v.x);
      if (v.y < shortTop && v.y > shortBot) { sx0 = Math.min(sx0, v.x); sx1 = Math.max(sx1, v.x); }
    }
    // el ancho del torso sin los brazos: desde el centro hacia afuera hasta el primer hueco (en manga larga
    // los brazos cuelgan junto al cuerpo y no deben contar, si no la foto se estira)
    xs.sort((a, b) => a - b);
    const hueco = 0.04 * zonas.YH; let c = 0; while (c < xs.length - 1 && xs[c] < 0) c++;
    let i0 = c, i1 = c;
    while (i0 > 0 && xs[i0] - xs[i0 - 1] < hueco) i0--;
    while (i1 < xs.length - 1 && xs[i1 + 1] - xs[i1] < hueco) i1++;
    const tx0 = xs[i0], tx1 = xs[i1];
    uni.uCaja.value.set(tx0, shirtBot - 0.01 * zonas.YH, tx1 - tx0, zonas.top - shirtBot + 0.01 * zonas.YH);
    uni.uShortCaja.value.set(sx0, shortBot, sx1 - sx0, shortTop - shortBot);
    // la orilla de abajo del short del modelo, columna por columna (0 = abajo de la caja, 1 = arriba): ahí cae la orilla de la foto
    // cada manga vista de su lado (de frente a espalda y de arriba a abajo): ahí cae su propia foto
    const cm = [[1e9, 1e9, -1e9, -1e9], [1e9, 1e9, -1e9, -1e9]];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(kitMesh.matrixWorld);
      if (v.y < shirtBot) continue;
      const fuera = 0.07 * (tx1 - tx0), k = v.x < tx0 - fuera ? 0 : v.x > tx1 + fuera ? 1 : -1; if (k < 0) continue;   // solo la manga (no el costado del pecho)
      const b = cm[k]; b[0] = Math.min(b[0], v.z); b[1] = Math.min(b[1], v.y); b[2] = Math.max(b[2], v.z); b[3] = Math.max(b[3], v.y);
    }
    [[uni.uCajaMI, cm[0]], [uni.uCajaMD, cm[1]]].forEach(([u, b]) => { if (b[2] > b[0]) u.value.set(b[0], b[1], b[2] - b[0], b[3] - b[1]); });
    // el tubo de cada manga. Se toma solo la mitad de afuera de la manga (ahí no hay pecho ni short): su parte más baja es el
    // puño y la más alta el hombro. Así sale igual en manga corta y en larga (las dos cuelgan y terminan arriba del dobladillo)
    [[-1, uni.uMSI, uni.uMAI, uni.uMOI, uni.uMFI], [1, uni.uMSD, uni.uMAD, uni.uMOD, uni.uMFD]].forEach(([lado, uS, uA, uO, uF]) => {
      const fuera = 0.07 * (tx1 - tx0), lim = lado < 0 ? tx0 - fuera : tx1 + fuera, arriba = [];
      let ext = lim;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(kitMesh.matrixWorld);
        if (v.y < shirtBot + 0.017 * zonas.YH) continue;
        arriba.push(v.clone()); if (lado < 0 ? v.x < ext : v.x > ext) ext = v.x;
      }
      const lim2 = lim + (ext - lim) * 0.45, manga = arriba.filter((p) => (lado < 0 ? p.x < lim2 : p.x > lim2));
      if (manga.length < 30) return;
      const ys = manga.map((p) => p.y).sort((x, y) => x - y), lo = ys[Math.floor(ys.length * 0.06)], hi = ys[Math.floor(ys.length * 0.94)];
      const media = (l) => { const c0 = new THREE.Vector3(); l.forEach((p) => c0.add(p)); return c0.multiplyScalar(1 / Math.max(1, l.length)); };
      const puno = media(manga.filter((p) => p.y <= lo)), hombro = media(manga.filter((p) => p.y >= hi)), ax = puno.clone().sub(hombro);
      if (ax.length() < 0.03) return;
      const n = ax.clone().normalize();
      const U = new THREE.Vector3(lado, 1, 0).normalize(), o = U.sub(n.clone().multiplyScalar(U.dot(n))).normalize();
      const Z = new THREE.Vector3(0, 0, 1), f = Z.sub(n.clone().multiplyScalar(Z.dot(n))).sub(o.clone().multiplyScalar(Z.dot(o))).normalize();
      uS.value.copy(hombro); uA.value.copy(ax); uO.value.copy(o); uF.value.copy(f);
      let rr = 0; manga.forEach((p) => { const q = p.clone().sub(hombro); rr += q.sub(n.clone().multiplyScalar(q.dot(n))).length(); });
      (lado < 0 ? uni.uMRI : uni.uMRD).value.y = rr / manga.length;
    });
    pintarMangas();
    hemModelo = new Float32Array(HEMC).fill(-1);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(kitMesh.matrixWorld);
      if (v.z <= 0 || v.y > shortTop || v.y < shortBot - 0.02 * zonas.YH) continue;
      const k = Math.min(HEMC - 1, Math.max(0, Math.floor((v.x - sx0) / (sx1 - sx0) * HEMC))), t = Math.max(0, (v.y - shortBot) / (shortTop - shortBot));
      if (hemModelo[k] < 0 || t < hemModelo[k]) hemModelo[k] = t;
    }
    pintarHem();
    // el modelo por renglón (en la medida del torso: 0 = orilla izquierda del torso, 1 = la derecha)
    const cy = uni.uCaja.value.y, ch = uni.uCaja.value.w, tw = tx1 - tx0, L = new Float32Array(RENG).fill(1e9), R = new Float32Array(RENG).fill(-1e9);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(kitMesh.matrixWorld); const vv = (v.y - cy) / ch; if (vv < 0 || vv > 1) continue;
      const r = Math.min(RENG - 1, Math.floor((1 - vv) * RENG)), u = (v.x - tx0) / tw; if (u < L[r]) L[r] = u; if (u > R[r]) R[r] = u;
    }
    for (let r = 0; r < RENG; r++) if (L[r] > R[r]) { let k = 1; while (k < RENG && !((r - k >= 0 && L[r - k] <= R[r - k]) || (r + k < RENG && L[r + k] <= R[r + k]))) k++; const q = r - k >= 0 && L[r - k] <= R[r - k] ? r - k : r + k; if (q >= 0 && q < RENG) { L[r] = L[q]; R[r] = R[q]; } else { L[r] = 0; R[r] = 1; } }
    texRenglones(renCanvas, 0, L, R, -1.5, 2.5); renListo.m = true; subirRen(); modeloRen = { L: suave(L), R: suave(R) };
    // la calceta empieza donde termina el hueco de la rodilla: su punto más alto bajo el short
    let top = -1e9; const lim = shortBot - 0.01 * zonas.YH;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(kitMesh.matrixWorld); if (v.y < lim && v.y > top) top = v.y; }
    uni.uSockTop.value = top; uni.uFranjaAlto.value = (top - zonas.Y0) * 0.13;
  }
  async function ponerTacos() {
    const modelo = await cargarGLB(base + 'taco.glb');
    let tm; modelo.traverse((o) => { if (o.isMesh) tm = o; });
    modelo.updateMatrixWorld(true);
    // la punta del modelo: el talón es donde el taco es más alto
    const tbb = new THREE.Box3().setFromObject(modelo), tp = tm.geometry.attributes.position, tv = new THREE.Vector3();
    let sx = 0, n = 0; const yAlto = tbb.min.y + (tbb.max.y - tbb.min.y) * 0.75;
    for (let i = 0; i < tp.count; i += 3) { tv.fromBufferAttribute(tp, i).applyMatrix4(tm.matrixWorld); if (tv.y > yAlto) { sx += tv.x; n++; } }
    const puntaMasX = (sx / n) < (tbb.min.x + tbb.max.x) / 2;
    tm.geometry.computeBoundingBox(); const gb = tm.geometry.boundingBox;
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.05 });
    const col = tacoCol = { value: coloresTaco(E.taco) };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uCol = col; sh.uniforms.uAlt = { value: new THREE.Vector2(gb.min.y, gb.max.y - gb.min.y) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vAltura; uniform vec2 uAlt;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvAltura = (position.y - uAlt.x) / uAlt.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAltura; uniform vec3 uCol[3];').replace('#include <map_fragment>', 'vec3 c = vAltura < 0.075 ? uCol[2] : (vAltura < 0.17 ? uCol[1] : uCol[0]); diffuseColor.rgb *= c;');
    };
    tm.material = mat; tm.castShadow = true;
    const pos = kitMesh.geometry.attributes.position, q = new THREE.Vector3();
    corte.value = -1;
    for (const lado of [-1, 1]) {
      const g = new THREE.Group(), t = modelo.clone(true); g.add(t);
      let b = new THREE.Box3().setFromObject(t); const sz = b.getSize(new THREE.Vector3());
      t.scale.multiplyScalar(LARGO_TACO / Math.max(sz.x, sz.z));
      if (!puntaMasX) t.rotation.y = Math.PI;
      if (lado < 0) t.scale.z *= -1;               // pie izquierdo: espejo de lado a lado, nunca de punta a talón
      g.rotation.y = -Math.PI / 2 + lado * 0.28;   // la punta al frente y un poco hacia afuera
      g.updateMatrixWorld(true);
      b = new THREE.Box3().setFromObject(g);
      let mm; g.traverse((o) => { if (o.isMesh) mm = o; });
      const gp = mm.geometry.attributes.position, boca = new THREE.Vector3(); let nb = 0;
      const yb = b.max.y - (b.max.y - b.min.y) * 0.12;
      for (let i = 0; i < gp.count; i += 2) { q.fromBufferAttribute(gp, i).applyMatrix4(mm.matrixWorld); if (q.y > yb) { boca.add(q); nb++; } }
      boca.multiplyScalar(1 / nb);
      const subir = -b.min.y, alturaBoca = b.max.y + subir;
      const cal = new THREE.Vector3(); let nc = 0;
      for (let i = 0; i < pos.count; i += 2) { q.fromBufferAttribute(pos, i).applyMatrix4(kitMesh.matrixWorld); if (Math.sign(q.x) === lado && Math.abs(q.y - alturaBoca) < 0.03) { cal.add(q); nc++; } }
      cal.multiplyScalar(1 / Math.max(1, nc));
      g.position.set(cal.x - boca.x, subir, cal.z - boca.z);
      corte.value = Math.max(corte.value, alturaBoca - (b.max.y - b.min.y) * 0.12);
      g.userData = { lado, boca: boca.clone().add(g.position), calceta: cal };
      raiz.add(g); tacos.push(g);
    }
  }

  // ---- fotos ----
  let espaldaBase = null, espaldaLimpia = null, espaldaLimpiaDe = null, completa = null, completaDe = null, completaCon = null;
  function aplicarFotos() {
    const f = E.fotos.frente;
    if (f) {
      poner(uni.uFoto, textura(f));
      const [fx0, fw] = E.torso || torsoFoto(f, 0.30); uni.uTorsoF.value.set(fx0, fw); texRenglones(renCanvas, 1, ...renglonesFoto(f, [fx0, fw]), 0, 1); renListo.f = true; subirRen();
      const tm = telaManga(f, fx0); poner(uni.uManga, textura(tm, true));
      // por dentro de la playera: el color de su tela, un poco más oscuro (como se ve una playera real por dentro)
      const cp = colorTela(tm) || colorTela(f); if (cp) uni.uDentro.value.setRGB(cp[0] / 255, cp[1] / 255, cp[2] / 255, THREE.SRGBColorSpace);
      colorUni = colorTela(f) || cp; revisarFondo();
    }
    pintarEspalda();
    pintarShort();
    pintarMangas();
    uni.uOtroLargo.value = E.mangaFotos === 'corta' && E.manga === 'larga' ? 1 : 0;
    uni.uShort.value.set(E.colorShort); uni.uSock.value.set(E.colorCalceta);
    uni.uHayFranja.value = E.colorFranja ? 1 : 0; if (E.colorFranja) uni.uFranja.value.set(E.colorFranja);
    pedir();
  }
  // dónde va el nombre: si la espalda ya trae un patrocinador arriba (ej. "Nutri"), el nombre y el número bajan
  // hasta el hueco más limpio. Se mide cuánto "dibujo horizontal" hay (letras y logos; las rayas verticales no cuentan).
  const huecos = new WeakMap();
  function huecoDorsal(src, c, cx, ancho) {
    if (huecos.has(src)) return huecos.get(src);
    const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
    if (!d) return 0;
    const x0 = Math.max(0, Math.round(cx - ancho * 0.3)), x1 = Math.min(W - 1, Math.round(cx + ancho * 0.3));
    const fila = new Float32Array(H);
    for (let y = 1; y < H; y++) { let e = 0; for (let x = x0; x <= x1; x += 2) { const i = (y * W + x) * 4, j = i - W * 4; if (d[i + 3] < 200 || d[j + 3] < 200) continue; e += Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]); } fila[y] = e; }   // solo tela: lo transparente cada navegador lo guarda distinto (Safari lo pone negro) y movía el número
    const banda = (a, b) => { let e = 0; for (let y = Math.max(1, Math.round(a * H)); y < Math.min(H, Math.round(b * H)); y++) e += fila[y]; return e / Math.max(1, (b - a) * H); };
    let mejor = 0, menor = 1e18;
    for (let dy = -0.02; dy <= 0.101; dy += 0.01) {
      const costo = banda(0.15 + dy, 0.22 + dy) * 2 + banda(0.245 + dy, 0.56 + dy) + Math.abs(dy) * 4000;
      if (costo < menor) { menor = costo; mejor = dy; }
    }
    huecos.set(src, mejor); return mejor;
  }
  // el short: su foto (enderezada) y, si el uniforme lo lleva, el número chico abajo en la pierna
  let shortBase = null, shortBaseDe = null;
  function pintarShort() {
    const s = E.fotos.short, d = E.dorsal;
    if (!s && !E.numeroShort) { uni.uHayShort.value = 0; return; }
    if (shortBaseDe !== s || !shortBase) {
      if (s) shortBase = enderezarShort(quitarPielOrillas(s));
      else { shortBase = document.createElement('canvas'); shortBase.width = 600; shortBase.height = 440; }
      shortBaseDe = s;
    }
    const c = document.createElement('canvas'); c.width = shortBase.width; c.height = shortBase.height; const g = c.getContext('2d');
    if (s) g.drawImage(shortBase, 0, 0); else { g.fillStyle = E.colorShort; g.fillRect(0, 0, c.width, c.height); }
    // el número chico va en su propia capa: si el dueño acomoda la foto del short, el número no se mueve
    const cn = document.createElement('canvas'); cn.width = c.width; cn.height = c.height;
    const hay = E.numeroShort && d.numero && window.Kit; if (hay) window.Kit.drawNumber(cn.getContext('2d'), d.numero, c.width * 0.17, c.height * 0.74, c.height * 0.11, d.color, false, c.width * 0.11);
    uni.uHayNum.value = hay ? 1 : 0; poner(uni.uShortNum, textura(cn));
    uni.uHayShort.value = 1; poner(uni.uShortTex, textura(c));
    hemFoto = s ? orillaFoto(shortBase) : null; pintarHem();
  }
  // la orilla de abajo de la foto del short, columna por columna (0 = abajo de la foto): el punto más bajo con tela
  function orillaFoto(cv) {
    const W = cv.width, H = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, H).data, r = new Float32Array(HEMC).fill(-1);
    for (let k = 0; k < HEMC; k++) {
      const sx = Math.min(1, Math.max(0, ((k + 0.5) / HEMC - 0.06) / 0.88)), x = Math.min(W - 1, Math.round(sx * (W - 1)));
      for (let y = H - 1; y >= 0; y--) if (d[(y * W + x) * 4 + 3] > 140) { r[k] = (H - 1 - y) / H; break; }
    }
    return r;
  }
  // une las dos orillas en una tira (rojo: la de la foto, verde: la del modelo); sin datos, se queda como antes
  function pintarHem() {
    if (!hemFoto || !hemModelo) { uni.uHayHem.value = 0; return; }
    const lisa = (a) => { const o = Float32Array.from(a); for (let k = 0; k < HEMC; k++) { if (o[k] >= 0) continue; let j = 1; while (j < HEMC && !(k - j >= 0 && a[k - j] >= 0) && !(k + j < HEMC && a[k + j] >= 0)) j++; o[k] = k - j >= 0 && a[k - j] >= 0 ? a[k - j] : (k + j < HEMC && a[k + j] >= 0 ? a[k + j] : 0); }
      const m = Float32Array.from(o); for (let k = 0; k < HEMC; k++) { const w = [o[k - 1], o[k], o[k + 1]].filter((x) => x !== undefined).sort((p, q) => p - q); m[k] = w[(w.length - 1) >> 1]; } return m; };
    const pf = lisa(hemFoto), pm = lisa(hemModelo), dt = new Uint8Array(HEMC * 4);
    for (let k = 0; k < HEMC; k++) { dt[k * 4] = Math.round(Math.min(0.9, pf[k]) * 255); dt[k * 4 + 1] = Math.round(Math.min(0.9, pm[k]) * 255); dt[k * 4 + 3] = 255; }
    const t = new THREE.DataTexture(dt, HEMC, 1, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    poner(uni.uHem, t); uni.uHayHem.value = 1;
  }
  // la foto de cada manga, derecha: el hombro arriba y el puño abajo. Si llega acostada (la playera extendida en el piso),
  // se para sola (la izquierda con el puño a la izquierda, la derecha con el puño a la derecha); el dueño la puede girar
  const giroManga = { mangaI: -1, mangaD: -1 }, mangaDe = { mangaI: null, mangaD: null };
  function girada(c, vueltas) {
    vueltas = ((vueltas % 4) + 4) % 4; if (!vueltas) return c;
    const o = document.createElement('canvas'), par = vueltas % 2 === 1; o.width = par ? c.height : c.width; o.height = par ? c.width : c.height;
    const g = o.getContext('2d'); g.translate(o.width / 2, o.height / 2); g.rotate(vueltas * Math.PI / 2); g.drawImage(c, -c.width / 2, -c.height / 2); return o;
  }
  function vueltasManga(lado) {
    const c = E.fotos[lado]; if (!c) return 0;
    const aj = E.ajMangas && E.ajMangas[lado]; if (aj && aj[3] != null) return +aj[3] || 0;
    if (c.width <= c.height * 1.15) return 0;
    return lado === 'mangaI' ? 3 : 1;   // acostada: el puño queda abajo
  }
  function pintarMangas() {
    [['mangaI', uni.uMangaI, uni.uHayMI], ['mangaD', uni.uMangaD, uni.uHayMD]].forEach(([lado, tx, hay]) => {
      const c = E.fotos[lado]; if (!c) { hay.value = 0; mangaDe[lado] = null; return; }
      const vu = vueltasManga(lado);
      if (mangaDe[lado] !== c || giroManga[lado] !== vu) { poner(tx, textura(girada(c, vu))); mangaDe[lado] = c; giroManga[lado] = vu; }
      hay.value = 1;
      const MR = (lado === 'mangaI' ? uni.uMRI : uni.uMRD).value;
      MR.z = (vu % 2 ? c.width : c.height) / Math.max(1, vu % 2 ? c.height : c.width); MR.x = !E.mangaFotos || E.mangaFotos === E.manga ? 1 : 0;
    });
  }
  // la espalda lleva el nombre y el número del cliente encima de la foto
  function pintarEspalda() {
    let src = E.fotos.espalda || E.fotos.frente; if (!src) return;
    // la espalda y el frente tienen la misma silueta: si a la foto de la espalda la IA le comió mangas (blanco sobre fondo blanco), se completan con las del frente
    if (E.fotos.espalda && E.fotos.frente) { if (completaDe !== E.fotos.espalda || completaCon !== E.fotos.frente) { completa = completarConFrente(E.fotos.espalda, E.fotos.frente); completaDe = E.fotos.espalda; completaCon = E.fotos.frente; } src = completa; }
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d');
    if (!E.fotos.espalda) { g.translate(c.width, 0); g.scale(-1, 1); }
    g.drawImage(src, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
    if (!E.fotos.espalda) {   // la espalda sale del frente: sin escudo, marca ni patrocinadores (y nada al revés)
      if (!espaldaLimpia || espaldaLimpiaDe !== src) { espaldaLimpia = limpiarTela(c, coloresBase(c)); espaldaLimpiaDe = src; }
      g.clearRect(0, 0, c.width, c.height); g.drawImage(espaldaLimpia, 0, 0);
    }
    const [bx0, bw] = E.torso ? (E.fotos.espalda ? E.torso : [1 - E.torso[0] - E.torso[1], E.torso[1]]) : torsoFoto(c, 0.30);
    const cx = (bx0 + bw / 2) * c.width, ancho = bw * c.width, d = E.dorsal;
    dorsalBase = { src, c, cx, ancho };
    poner(uni.uEspalda, textura(c)); pintarDorsal();
    const [ex0, ew] = [bx0, bw]; uni.uTorsoB.value.set(ex0, ew); texRenglones(renCanvas, 2, ...renglonesFoto(c, [ex0, ew]), 0, 1); renListo.b = true; subirRen();
  }

  // nombre y número: cada uno en su lugar y con lo que el dueño le acomodó (tamaño, ancho y posición, por separado).
  // Van en su propia capa: si el dueño mueve la foto, no se mueven; si mueve el número, la foto no se vuelve a calcular.
  let dorsalBase = null, modeloRen = null; const cajas = { nombre: null, numero: null };
  function pintarDorsal() {
    if (!dorsalBase) return;
    const { src, c, cx, ancho } = dorsalBase, d = E.dorsal, W = c.width, H = c.height;
    const cd = document.createElement('canvas'); cd.width = W; cd.height = H; const gd = cd.getContext('2d');
    cajas.nombre = cajas.numero = null;
    if (window.Kit && (d.nombre || d.numero)) {
      const dy = huecoDorsal(src, c, cx, ancho);
      const [ns, nx, ny, na] = E.ajNom, [ms, mx, my, ma] = E.ajNum;
      const yN = H * (0.2 + dy - ny), tN = H * 0.075 * ns, wN = ancho * 0.72 * ns * na, xN = cx + mx * 0 + nx * W;
      gd.save(); gd.translate(xN, 0); gd.scale(na, 1); gd.translate(-xN, 0);
      if (d.nombre) window.Kit.drawName(gd, d.nombre, xN, yN, tN, d.color, ancho * 0.72 * ns);
      gd.restore();
      const yM = H * (0.245 + dy - my), tM = H * 0.31 * ms, wM = ancho * 0.72 * ms * ma, xM = cx + mx * W;
      gd.save(); gd.translate(xM, 0); gd.scale(ma, 1); gd.translate(-xM, 0);
      if (d.numero) window.Kit.drawNumber(gd, d.numero, xM, yM, tM, d.color, d.sello !== false, ancho * 0.72 * ms);
      gd.restore();
      // dónde quedó cada uno (en la medida de la foto, 0 abajo y 1 arriba) para encontrarlo al tocarlo y para iluminarlo
      const caja = (x0, y0, x1, y1) => [x0 / W, 1 - y1 / H, x1 / W, 1 - y0 / H];
      if (d.nombre) cajas.nombre = caja(xN - wN / 2 - 0.02 * W, yN - tN * 1.15, xN + wN / 2 + 0.02 * W, yN + tN * 0.35);
      if (d.numero) cajas.numero = caja(xM - wM / 2 - 0.02 * W, yM - 0.01 * H, xM + wM / 2 + 0.02 * W, yM + tM * 1.02);
    }
    poner(uni.uDorsal, textura(cd)); marcarSel();
  }
  const SEL = { frente: 1, espalda: 2, short: 3, nombre: 4, numero: 5, calcetas: 6, mangaI: 7, mangaD: 8 };
  function marcarSel() {
    uni.uSel.value = SEL[E.sel] || 0;
    const k = cajas[E.sel]; if (k) uni.uSelCaja.value.set(k[0], k[1], k[2], k[3]); else uni.uSelCaja.value.set(0, 0, 0, 0);
    pedir();
  }
  // ---- dibujar: solo cuando algo cambia ----
  // El campo llena todo el lienzo; el uniforme se acomoda en la zona libre (la página dice cuánto aire dejar
  // arriba y abajo con --aire-arriba / --aire-abajo, para que los botones encimados no le tapen nada).
  let aireCache = null;
  function aire() {
    const w = canvas.clientWidth, h = canvas.clientHeight, k = w + 'x' + h;
    if (!aireCache || aireCache.k !== k) {
      const cs = getComputedStyle(canvas);
      aireCache = { k, v: [parseFloat(cs.getPropertyValue('--aire-arriba')) || 0, parseFloat(cs.getPropertyValue('--aire-abajo')) || 0] };
    }
    return aireCache.v;
  }
  function encuadre(w, h, m) {
    const arriba = Math.min(m[0], h * 0.45), abajo = Math.min(m[1], h * 0.15), hin = Math.max(1, h - arriba - abajo);
    cam.aspect = w / hin;
    if (arriba || abajo) cam.setViewOffset(w, hin, 0, -arriba, w, h); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); ultimoAspecto = w / h; encuadrarFondo(w / h);
    // encuadre: el uniforme completo, con aire; con "zoom" la cámara baja a los pies para ver los tacos de cerca
    const distC = 5.7 * Math.max(1, (2 / 3) / cam.aspect), distP = 2.5 * Math.max(1, 1.2 / cam.aspect), z = E.zoom;
    // F: el acercamiento a una pieza que el dueño está editando (k = qué tan cerca, m = a qué altura mira, a = altura de la cámara)
    const F = E.foco, dist = distC * F.k + (distP - distC * F.k) * z, ang = E.vista + 0.55 * z, alto = F.a + (0.55 - F.a) * z, mira = F.m + (0.24 - F.m) * z;
    cam.position.set(Math.sin(ang) * dist, alto, Math.cos(ang) * dist); cam.lookAt(0, mira, 0.04 * z);
  }
  // acercar a los tacos y regresar al uniforme completo, con su propio tiempo (sin brincos)
  let animZoom = null;
  function zoomA(destino, ms) {
    if (animZoom) cancelAnimationFrame(animZoom);
    if (Math.abs(E.zoom - destino) < 0.001) return;
    const desde = E.zoom, t0 = performance.now(); ms = ms || 700;
    const paso = (ahora) => {
      const k = Math.min(1, (ahora - t0) / ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      E.zoom = desde + (destino - desde) * e; dibujar();
      animZoom = k < 1 ? requestAnimationFrame(paso) : null;
    };
    animZoom = requestAnimationFrame(paso);
  }
  // acercarse suave a la pieza que el dueño está editando (y regresar al uniforme completo al terminar)
  let animFoco = null;
  function enfocar(p) {
    const Z = zonas; let dest = { k: 1, m: 0.92, a: 1 };
    if (Z && p) {
      const hemY = Z.Y0 + Z.hem * Z.YH, shortY = Z.Y0 + Z.shortBot * Z.YH;
      if (p === 'calcetas') { const y = Z.Y0 + (shortY - Z.Y0) * 0.55; dest = { k: 0.5, m: y, a: y + 0.08 }; }
      else if (p === 'short') dest = { k: 0.5, m: (hemY + shortY) / 2, a: (hemY + shortY) / 2 + 0.05 };
      else if (p === 'nombre' || p === 'numero') { const y = hemY + (Z.top - hemY) * 0.62; dest = { k: 0.42, m: y, a: y + 0.04 }; }
      else if (p === 'mangaI' || p === 'mangaD') { const y = (p === 'mangaI' ? uni.uMSI : uni.uMSD).value.y + (p === 'mangaI' ? uni.uMAI : uni.uMAD).value.y * 0.5; dest = { k: 0.62, m: y, a: y + 0.05 }; }
      else { const y = (hemY + Z.top) / 2; dest = { k: 0.62, m: y, a: y + 0.05 }; }
    }
    if (animFoco) cancelAnimationFrame(animFoco);
    const desde = Object.assign({}, E.foco), t0 = performance.now(), ms = 520;
    const paso = (ahora) => {
      const k = Math.min(1, (ahora - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      E.foco = { k: desde.k + (dest.k - desde.k) * e, m: desde.m + (dest.m - desde.m) * e, a: desde.a + (dest.a - desde.a) * e }; pedir();
      animFoco = k < 1 ? requestAnimationFrame(paso) : null;
    };
    animFoco = requestAnimationFrame(paso);
  }
  let pendiente = false, animando = null;
  // mientras se cambia de uniforme no se dibuja nada: la pantalla se queda con el anterior y luego cambia de un jalón al nuevo
  // (sin ver los pasos a medias: playera nueva con short viejo, luego el nombre, luego los tacos…)
  let congelado = false, debeDibujo = false;
  function dibujar() {
    pendiente = false;
    if (congelado) { debeDibujo = true; return; }
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    if (canvas.width !== Math.round(w * r.getPixelRatio()) || canvas.height !== Math.round(h * r.getPixelRatio())) r.setSize(w, h, false);
    encuadre(w, h, aire());
    key.position.set(Math.sin(E.vista) * 2.2 + Math.cos(E.vista) * 0.5, 7, Math.cos(E.vista) * 2.2 - Math.sin(E.vista) * 0.5);
    r.render(scene, cam);
  }
  function pedir() { if (!pendiente) { pendiente = true; requestAnimationFrame(dibujar); } }
  function girarA(destino, ms) {
    if (animando) cancelAnimationFrame(animando.id);
    const desde = E.vista, t0 = performance.now(); ms = ms || 650;
    const paso = (ahora) => {
      const k = Math.min(1, (ahora - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      E.vista = desde + (destino - desde) * e; dibujar();
      if (k < 1) animando = { id: requestAnimationFrame(paso) }; else animando = null;
    };
    animando = { id: requestAnimationFrame(paso) };
  }

  // Cuando cambia el tamaño del lienzo (ver en grande, girar el teléfono, barra del navegador que aparece o se esconde),
  // se vuelve a dibujar a su medida real; si no, el navegador estira la imagen vieja y el uniforme se ve deforme.
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => pedir()) : null;
  if (ro) ro.observe(canvas);

  let dorsalPend = false;
  const renListo = { m: false, f: false, b: false }, renCanvas = document.createElement('canvas'); renCanvas.width = 6; renCanvas.height = RENG;
  function subirRen() {
    if (!uni.uRen.value) { const t = new THREE.CanvasTexture(renCanvas); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; uni.uRen.value = t; }
    else uni.uRen.value.needsUpdate = true;
    uni.uHayRen.value = renListo.m && renListo.f && renListo.b ? 1 : 0;
  }
  function poner(u, t) { if (u.value && u.value !== t && u.value.dispose) u.value.dispose(); u.value = t; }
  const api = {
    async uniforme(o) {
      E.fotos.frente = canvasDe(o.frente); E.fotos.espalda = canvasDe(o.espalda); E.fotos.short = canvasDe(o.short); E.fotos.mangaI = canvasDe(o.mangaI); E.fotos.mangaD = canvasDe(o.mangaD); E.mangaFotos = o.mangaFotos || '';
      if (o.colorShort) E.colorShort = o.colorShort; if (o.colorCalceta) E.colorCalceta = o.colorCalceta; E.colorFranja = o.colorFranja || ''; E.numeroShort = !!o.numeroShort; E.torso = Array.isArray(o.torso) ? o.torso : null;
      api.ajuste(o.ajuste);
      const m = o.manga || E.manga;
      if (!kit || m !== E.manga) { E.manga = m; await ponerModelo(); } else aplicarFotos();
    },
    async manga(m) { if (m === E.manga && kit) return; E.manga = m; await ponerModelo(); },
    // cuántos cuartos de vuelta lleva la foto de una manga (para el botón Girar del panel)
    vueltasManga(lado) { return vueltasManga(lado); },
    // cambiar el color de los tacos ya puestos es solo pintarlos (instantáneo, sirve para la barra de colores)
    async taco(t) { if (t === E.taco) return; E.taco = t; if (tacos.length && tacoCol) { tacoCol.value = coloresTaco(t); pedir(); return; } tacos.forEach((g) => raiz.remove(g)); tacos = []; await ponerTacos(); pedir(); },
    dorsal(d) {
      Object.assign(E.dorsal, d);
      if (dorsalPend) return; dorsalPend = true;
      requestAnimationFrame(() => { if (!dorsalPend) return; dorsalPend = false; if (dorsalBase) pintarDorsal(); else pintarEspalda(); pintarShort(); pedir(); });
    },
    // con "reducir movimiento" también gira igual (estándar de Moon: se ve y se siente igual)
    enfoque(que) { zoomA(que === 'tacos' ? 1 : 0); },
    // frente o espalda: gira por el lado más corto (después de deslizar el dedo el ángulo puede ir en 2π, 3π…)
    vista(v, animar) { const b = v === 'espalda' ? Math.PI : v === 'mangaI' ? -Math.PI / 2 : v === 'mangaD' ? Math.PI / 2 : 0, dest = b + Math.round((E.vista - b) / (2 * Math.PI)) * 2 * Math.PI; if (animar === false) { E.vista = dest; pedir(); } else girarA(dest); },
    // deslizar el dedo a los lados: el uniforme gira pegado al dedo y al soltar se acomoda de frente o de espalda
    // (con la velocidad del dedo: un deslizón rápido y corto también lo voltea). Arriba-abajo no se toca: sigue siendo de la página.
    deslizable(alCambiar) {
      let x0 = 0, y0 = 0, a0 = 0, id = null, activo = false, decidido = false, ultX = 0, ultT = 0, vel = 0, tragar = false;
      const ancho = () => canvas.clientWidth || 300;
      canvas.style.touchAction = 'pan-y';
      canvas.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        x0 = ultX = e.clientX; y0 = e.clientY; ultT = performance.now(); a0 = E.vista; id = e.pointerId; activo = true; decidido = false; vel = 0;
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!activo || e.pointerId !== id) return;
        const dx = e.clientX - x0, dy = e.clientY - y0;
        if (!decidido) {
          // solo un deslizamiento claro de lado y dentro del cuadro del 3D lo gira: un roce o subir la pantalla no
          if (Math.abs(dy) > 10 && Math.abs(dy) * 1.2 > Math.abs(dx)) { activo = false; return; }
          if (Math.abs(dx) < 16 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
          decidido = true; try { canvas.setPointerCapture(id); } catch (_) {}
          if (animando) { cancelAnimationFrame(animando.id); animando = null; } a0 = E.vista - dx / ancho() * Math.PI;
        }
        const t = performance.now(); vel = vel * 0.4 + 0.6 * (e.clientX - ultX) / Math.max(8, t - ultT); ultX = e.clientX; ultT = t;
        E.vista = a0 + dx / ancho() * Math.PI; pedir();
      });
      const fin = (e) => {
        if (!activo || e.pointerId !== id) return; activo = false;
        if (!decidido) return;
        tragar = true; setTimeout(() => { tragar = false; }, 350);
        if (performance.now() - ultT > 90) vel = 0;   // si el dedo se quedó quieto antes de soltar, no hay empujón
        // se voltea si el dedo llevó el uniforme casi un tercio de vuelta, o si fue un deslizón rápido hacia ese lado
        const base = Math.round(a0 / Math.PI) * Math.PI, movido = E.vista - base;
        const voltea = Math.abs(movido) > Math.PI * 0.3 || (Math.abs(vel) > 0.15 && Math.sign(vel) === Math.sign(movido) && Math.abs(movido) > Math.PI * 0.04);
        const destino = voltea ? base + Math.sign(movido) * Math.PI : base;
        girarA(destino, 300 + 200 * Math.min(1, Math.abs(destino - E.vista) / Math.PI));
        if (alCambiar) alCambiar(Math.abs(Math.round(destino / Math.PI)) % 2 ? 'espalda' : 'frente');
      };
      canvas.addEventListener('pointerup', fin); canvas.addEventListener('pointercancel', fin);
      // el toque que termina un deslizón no cuenta como toque (no abre ni cierra la pantalla grande)
      canvas.addEventListener('click', (e) => { if (tragar) { tragar = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    },
    // acomodo de cada foto: [tamaño, mover a los lados, mover arriba/abajo]; instantáneo (solo se repinta)
    // panel: ilumina una pieza ('frente', 'espalda', 'short', 'nombre', 'numero' o '' para ninguna)
    seleccionar(p) { E.sel = p || ''; marcarSel(); enfocar(E.sel); },
    // panel: qué pieza hay bajo el dedo (o null si tocó fuera del uniforme)
    piezaEn(px, py) {
      // el rayo del dedo toca el uniforme de verdad (el punto exacto y hacia dónde mira la tela): así funciona de frente, de
      // espalda y de lado. Con la silueta del modelo, renglón por renglón, se sabe si es la playera, una manga, el short o fuera
      if (!zonas || !modeloRen || !kitMesh) return null;
      const rc = canvas.getBoundingClientRect(), v = new THREE.Vector2(((px - rc.left) / rc.width) * 2 - 1, -((py - rc.top) / rc.height) * 2 + 1);
      cam.updateMatrixWorld(); const ray = new THREE.Raycaster(); ray.setFromCamera(v, cam);
      const hit = ray.intersectObject(kitMesh, false)[0];
      let p = new THREE.Vector3(), atras = Math.cos(E.vista) < 0;
      if (hit) { p.copy(hit.point); if (hit.face) atras = hit.face.normal.clone().transformDirection(kitMesh.matrixWorld).z < 0; }
      else if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), p)) return null;
      const t = (p.y - zonas.Y0) / zonas.YH, C = uni.uCaja.value;
      if (t > zonas.hem - 0.01) {
        const vv = (p.y - C.y) / C.w; if (vv > 1.02) return null;
        const r = Math.max(0, Math.min(RENG - 1, Math.floor((1 - vv) * RENG))), u = (p.x - C.x) / C.z;
        if (!hit && (u < modeloRen.L[r] - 0.04 || u > modeloRen.R[r] + 0.04)) return null;
        if (u < 0 && modeloRen.L[r] < -0.12) return 'mangaI';
        if (u > 1 && modeloRen.R[r] > 1.12) return 'mangaD';
        if (!atras) return 'frente';
        const tor = uni.uTorsoB.value, x = tor.x + (1 - u) * tor.y, dentro = (k) => k && x > k[0] && x < k[2] && vv > k[1] && vv < k[3];
        if (dentro(cajas.numero)) return 'numero';
        if (dentro(cajas.nombre)) return 'nombre';
        return 'espalda';
      }
      const S = uni.uShortCaja.value;
      if (t > zonas.shortBot) return p.x > S.x - 0.03 && p.x < S.x + S.z + 0.03 ? 'short' : null;
      return t > 0 && p.x > S.x && p.x < S.x + S.z ? 'calcetas' : null;
    },
    fondo(url) { ponerFondo(url || base + 'campo.webp'); },
    // true si el fondo elegido chocaba con este uniforme y se puso otro
    fondoCambiado() { return fondoPuesto !== fondoPedido; },
    congelar(si) { congelado = !!si; if (!si && debeDibujo) { debeDibujo = false; pedir(); } },
    ajuste(aj) {
      aj = aj || {};
      // nombre y número: [tamaño, mover a los lados, mover arriba/abajo, ancho], cada uno por su lado
      const leer = (v) => Array.isArray(v) && v.length === 4 ? [+v[0] || 1, +v[1] || 0, +v[2] || 0, +v[3] || 1] : [1, 0, 0, 1];
      const nn = leer(aj.nombre), mm = leer(aj.numero);
      if (nn.join() !== E.ajNom.join() || mm.join() !== E.ajNum.join()) { E.ajNom = nn; E.ajNum = mm; pintarDorsal(); }
      [['frente', uni.uAjF], ['espalda', uni.uAjB], ['short', uni.uAjS], ['mangaI', uni.uAjMI], ['mangaD', uni.uAjMD]].forEach(([k, u]) => { const v = Array.isArray(aj[k]) ? aj[k] : [1, 0, 0]; u.value.set(+v[0] || 1, +v[1] || 0, +v[2] || 0); });
      // mangas: [tamaño, mover, mover, vueltas]; si cambian las vueltas, la foto se vuelve a parar
      E.ajMangas = { mangaI: Array.isArray(aj.mangaI) ? aj.mangaI : null, mangaD: Array.isArray(aj.mangaD) ? aj.mangaD : null };
      if (kit) pintarMangas();
      pedir();
    },
    redibujar: pedir,
    // imagen para el folio o el catálogo
    // transparente: solo el uniforme con su sombra, sin el estadio (la página lo pone encima del mismo estadio mientras carga el 3D)
    foto(w, h, v, transparente) {
      if (dorsalPend) { dorsalPend = false; pintarEspalda(); pintarShort(); }   // la foto lleva el nombre recién escrito
      const antes = E.vista; E.vista = v === 'espalda' ? Math.PI : 0;
      const pw = canvas.style.width, ph = canvas.style.height, ratio = r.getPixelRatio();
      const z0 = E.zoom; E.zoom = 0; r.setPixelRatio(1); r.setSize(w, h, false); encuadre(w, h, [0, 0]); E.zoom = z0;
      const fondo = scene.background;
      if (transparente) { scene.background = null; r.setClearColor(0x000000, 0); }
      r.render(scene, cam);
      let url = transparente ? canvas.toDataURL('image/webp', 0.9) : canvas.toDataURL('image/jpeg', 0.88);
      if (transparente && url.indexOf('image/webp') < 0) url = canvas.toDataURL('image/png');   // Safari no hace webp
      scene.background = fondo;
      r.setPixelRatio(ratio); E.vista = antes; canvas.style.width = pw; canvas.style.height = ph; dibujar();
      return url;
    },
    // medidas para las pruebas automáticas
    revisar() {
      return tacos.map((g) => {
        const punta = new THREE.Vector3(1, 0, 0).applyQuaternion(g.quaternion);
        return { lado: g.userData.lado, puntaZ: +punta.z.toFixed(2), puntaX: +punta.x.toFixed(2), separacion: +g.userData.boca.distanceTo(new THREE.Vector3(g.userData.calceta.x, g.userData.boca.y, g.userData.calceta.z)).toFixed(3), corte: +corte.value.toFixed(3), bocaY: +g.userData.boca.y.toFixed(3) };
      });
    },
    gamaBaja: baja,
    destruir() { if (ro) ro.disconnect(); r.dispose(); r.forceContextLoss(); }
  };
  return api;
}
