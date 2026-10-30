/* Motor 3D del probador: uniforme sobre maniquí invisible, con la foto real del dueño pegada encima,
   calcetas y tacos en los pies, en un estudio oscuro con luz.
   Hecho para gama baja y alta: modelos de ~250 KB, se dibuja solo cuando algo cambia (no hay animación
   constante) y la calidad se ajusta al teléfono. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { enderezarShort, limpiarTela, coloresBase } from './foto.js';

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
  new THREE.TextureLoader().load(base + 'campo.webp', (t) => { t.colorSpace = THREE.SRGBColorSpace; campo = t; scene.background = t; pedir(); });
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
    fotos: { frente: null, espalda: null, short: null }, colorShort: '#f2f2f4', colorCalceta: '#f2f2f4', colorFranja: '',
    dorsal: { nombre: '', numero: '', color: '#111111', sello: true }
  };
  let kit = null, kitMesh = null, tacos = [], zonas = null, uni = null, tacoCol = null;
  const corte = { value: -1 };

  // uniformes del material del uniforme (se comparten entre recompilaciones)
  uni = {
    uFoto: { value: null }, uEspalda: { value: null }, uManga: { value: null }, uShortTex: { value: null }, uDorsal: { value: null }, uShortNum: { value: null }, uHayNum: { value: 0 },
    uCaja: { value: new THREE.Vector4() }, uTorsoF: { value: new THREE.Vector2(0, 1) }, uTorsoB: { value: new THREE.Vector2(0, 1) },
    uAjF: { value: new THREE.Vector3(1, 0, 0) }, uAjB: { value: new THREE.Vector3(1, 0, 0) }, uAjS: { value: new THREE.Vector3(1, 0, 0) },
    uShortCaja: { value: new THREE.Vector4() }, uZonas: { value: new THREE.Vector3() }, uShortBot: { value: 0 },
    uShort: { value: new THREE.Color() }, uSock: { value: new THREE.Color() }, uHayShort: { value: 0 }, uCorte: corte,
    uFranja: { value: new THREE.Color() }, uHayFranja: { value: 0 }, uSockTop: { value: 0 }, uFranjaAlto: { value: 0 }
  };
  const matKit = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.0, side: THREE.DoubleSide });
  matKit.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMundo; varying vec3 vNormMundo;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMundo = (modelMatrix * vec4(transformed,1.0)).xyz; vNormMundo = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uCorte; uniform sampler2D uFoto; uniform sampler2D uEspalda; uniform sampler2D uManga; uniform sampler2D uShortTex; uniform sampler2D uDorsal; uniform sampler2D uShortNum; uniform float uHayNum;
uniform vec3 uAjF; uniform vec3 uAjB; uniform vec3 uAjS; uniform vec4 uCaja; uniform vec2 uTorsoF; uniform vec2 uTorsoB; uniform vec4 uShortCaja; uniform vec3 uZonas; uniform float uShortBot;
uniform vec3 uShort; uniform vec3 uSock; uniform float uHayShort; uniform vec3 uFranja; uniform float uHayFranja; uniform float uSockTop; uniform float uFranjaAlto;
varying vec3 vMundo; varying vec3 vNormMundo;`)
      .replace('#include <map_fragment>', `
if (vMundo.y < uCorte) discard;
float t = (vMundo.y - uZonas.x) / uZonas.y;
vec3 base;
// el uniforme no se mueve (gira la cámara): lo que mira hacia atrás usa la foto de la espalda
bool atras = vNormMundo.z < 0.0;
if (t > uZonas.z - 0.01) {
  float ux = (vMundo.x - uCaja.x) / uCaja.z; if (atras) ux = 1.0 - ux;
  vec2 tor = atras ? uTorsoB : uTorsoF;
  vec2 uv = vec2(tor.x + ux * tor.y, (vMundo.y - uCaja.y) / uCaja.w), uv0 = uv;
  vec3 aj = atras ? uAjB : uAjF; uv = (uv - 0.5) / aj.x + 0.5 - aj.yz;   // lo que el dueño acomodó: más grande/chica y movida (el nombre y número no se mueven)
  vec4 f = atras ? texture2D(uEspalda, uv) : texture2D(uFoto, uv);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) f.a = 0.0;
  vec3 manga = texture2D(uManga, vMundo.xy * 3.2).rgb;
  base = mix(manga, f.rgb / max(f.a, 0.004), smoothstep(0.35, 0.9, f.a));
  if (atras) { vec4 nd = texture2D(uDorsal, uv0); base = mix(base, nd.rgb / max(nd.a, 0.004), nd.a); }
} else if (t > uShortBot) {
  base = uShort;
  if (uHayShort > 0.5) {
    // el short: la foto es solo del frente, así que va solo en lo que mira al frente.
    // Los lados y atrás van del color que más tiene el short: la foto no los muestra y estirarla los duplica en rayas.
    float sx = clamp(((vMundo.x - uShortCaja.x) / uShortCaja.z - 0.06) / 0.88, 0.0, 1.0);
    vec2 suv = (vec2(sx, (vMundo.y - uShortCaja.y) / uShortCaja.w) - 0.5) / uAjS.x + 0.5 - uAjS.yz;
    vec4 s = texture2D(uShortTex, suv);
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) s.a = 0.0;
    float deFrente = normalize(vNormMundo).z;
    s.a *= smoothstep(0.5, 0.68, deFrente);
    base = mix(uShort, s.rgb / max(s.a, 0.004), s.a);
    if (!atras && uHayNum > 0.5) { vec4 ns = texture2D(uShortNum, vec2(sx, (vMundo.y - uShortCaja.y) / uShortCaja.w)); base = mix(base, ns.rgb / max(ns.a, 0.004), ns.a); }
  }
} else {
  base = uSock;
  if (uHayFranja > 0.5 && vMundo.y > uSockTop - uFranjaAlto) base = uFranja;
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
  let espaldaBase = null, espaldaLimpia = null, espaldaLimpiaDe = null;
  function aplicarFotos() {
    const f = E.fotos.frente;
    if (f) {
      poner(uni.uFoto, textura(f));
      const [fx0, fw] = E.torso || torsoFoto(f, 0.30); uni.uTorsoF.value.set(fx0, fw);
      poner(uni.uManga, textura(telaManga(f, fx0), true));
    }
    pintarEspalda();
    pintarShort();
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
      if (s) shortBase = enderezarShort(s);
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
  }
  // la espalda lleva el nombre y el número del cliente encima de la foto
  function pintarEspalda() {
    const src = E.fotos.espalda || E.fotos.frente; if (!src) return;
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d');
    if (!E.fotos.espalda) { g.translate(c.width, 0); g.scale(-1, 1); }
    g.drawImage(src, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
    if (!E.fotos.espalda) {   // la espalda sale del frente: sin escudo, marca ni patrocinadores (y nada al revés)
      if (!espaldaLimpia || espaldaLimpiaDe !== src) { espaldaLimpia = limpiarTela(c, coloresBase(c)); espaldaLimpiaDe = src; }
      g.clearRect(0, 0, c.width, c.height); g.drawImage(espaldaLimpia, 0, 0);
    }
    const [bx0, bw] = E.torso ? (E.fotos.espalda ? E.torso : [1 - E.torso[0] - E.torso[1], E.torso[1]]) : torsoFoto(c, 0.30);
    const cx = (bx0 + bw / 2) * c.width, ancho = bw * c.width, d = E.dorsal;
    // nombre y número en su propia capa: se quedan en su lugar aunque el dueño mueva o agrande la foto
    const cd = document.createElement('canvas'); cd.width = c.width; cd.height = c.height; const gd = cd.getContext('2d');
    if (window.Kit && (d.nombre || d.numero)) {
      const H = c.height, dy = huecoDorsal(src, c, cx, ancho);
      window.Kit.drawName(gd, d.nombre, cx, H * (0.2 + dy), H * 0.075, d.color, ancho * 0.72);
      window.Kit.drawNumber(gd, d.numero, cx, H * (0.245 + dy), H * 0.31, d.color, d.sello !== false, ancho * 0.72);
    }
    poner(uni.uEspalda, textura(c)); poner(uni.uDorsal, textura(cd));
    const [ex0, ew] = [bx0, bw]; uni.uTorsoB.value.set(ex0, ew);
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
    cam.updateProjectionMatrix(); encuadrarFondo(w / h);
    // encuadre: el uniforme completo, con aire; con "zoom" la cámara baja a los pies para ver los tacos de cerca
    const distC = 5.7 * Math.max(1, (2 / 3) / cam.aspect), distP = 2.5 * Math.max(1, 1.2 / cam.aspect), z = E.zoom;
    const dist = distC + (distP - distC) * z, ang = E.vista + 0.55 * z, alto = 1.0 + (0.55 - 1.0) * z, mira = 0.92 + (0.24 - 0.92) * z;
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
  let pendiente = false, animando = null;
  function dibujar() {
    pendiente = false;
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
  function poner(u, t) { if (u.value && u.value !== t && u.value.dispose) u.value.dispose(); u.value = t; }
  const api = {
    async uniforme(o) {
      E.fotos.frente = canvasDe(o.frente); E.fotos.espalda = canvasDe(o.espalda); E.fotos.short = canvasDe(o.short);
      if (o.colorShort) E.colorShort = o.colorShort; if (o.colorCalceta) E.colorCalceta = o.colorCalceta; E.colorFranja = o.colorFranja || ''; E.numeroShort = !!o.numeroShort; E.torso = Array.isArray(o.torso) ? o.torso : null;
      api.ajuste(o.ajuste);
      const m = o.manga || E.manga;
      if (!kit || m !== E.manga) { E.manga = m; await ponerModelo(); } else aplicarFotos();
    },
    async manga(m) { if (m === E.manga && kit) return; E.manga = m; await ponerModelo(); },
    // cambiar el color de los tacos ya puestos es solo pintarlos (instantáneo, sirve para la barra de colores)
    async taco(t) { if (t === E.taco) return; E.taco = t; if (tacos.length && tacoCol) { tacoCol.value = coloresTaco(t); pedir(); return; } tacos.forEach((g) => raiz.remove(g)); tacos = []; await ponerTacos(); pedir(); },
    dorsal(d) {
      Object.assign(E.dorsal, d);
      if (dorsalPend) return; dorsalPend = true;
      requestAnimationFrame(() => { if (!dorsalPend) return; dorsalPend = false; pintarEspalda(); pintarShort(); pedir(); });
    },
    // con "reducir movimiento" también gira igual (estándar de Moon: se ve y se siente igual)
    enfoque(que) { zoomA(que === 'tacos' ? 1 : 0); },
    // frente o espalda: gira por el lado más corto (después de deslizar el dedo el ángulo puede ir en 2π, 3π…)
    vista(v, animar) { const b = v === 'espalda' ? Math.PI : 0, dest = b + Math.round((E.vista - b) / (2 * Math.PI)) * 2 * Math.PI; if (animar === false) { E.vista = dest; pedir(); } else girarA(dest); },
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
      canvas.addEventListener('click', (e) => { if (tragar) { tragar = false; e.stopPropagation(); e.preventDefault(); } }, true);
    },
    // acomodo de cada foto: [tamaño, mover a los lados, mover arriba/abajo]; instantáneo (solo se repinta)
    ajuste(aj) {
      aj = aj || {};
      [['frente', uni.uAjF], ['espalda', uni.uAjB], ['short', uni.uAjS]].forEach(([k, u]) => { const v = Array.isArray(aj[k]) ? aj[k] : [1, 0, 0]; u.value.set(+v[0] || 1, +v[1] || 0, +v[2] || 0); });
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
