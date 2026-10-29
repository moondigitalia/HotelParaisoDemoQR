/* Motor 3D del probador: uniforme sobre maniquí invisible, con la foto real del dueño pegada encima,
   calcetas y tacos en los pies, en un estudio oscuro con luz.
   Hecho para gama baja y alta: modelos de ~250 KB, se dibuja solo cuando algo cambia (no hay animación
   constante) y la calidad se ajusta al teléfono. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

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
// el cuadro de manga más grande que hay en la foto: se usa como tela de las mangas
function telaManga(c, fx0) {
  const g = c.getContext('2d'), W = c.width, H = c.height, d = g.getImageData(0, 0, W, H).data;
  const xMax = Math.floor(W * fx0) - 4; let mejor = null;
  for (let lado = 8; lado < Math.min(xMax, H * 0.4); lado += 6) {
    let hallado = null;
    for (let y = Math.floor(H * 0.04); y + lado < H * 0.5 && !hallado; y += 6)
      for (let x = 0; x + lado < xMax && !hallado; x += 6) {
        let ok = true;
        for (let yy = y; yy < y + lado && ok; yy += 4) for (let xx = x; xx < x + lado && ok; xx += 4) if (d[(yy * W + xx) * 4 + 3] < 200) ok = false;
        if (ok) hallado = [x, y, lado];
      }
    if (hallado) mejor = hallado; else break;
  }
  const o = document.createElement('canvas'); o.width = o.height = 256; const og = o.getContext('2d');
  if (mejor) og.drawImage(c, mejor[0], mejor[1], mejor[2], mejor[2], 0, 0, 256, 256);
  else { og.fillStyle = '#eeeeee'; og.fillRect(0, 0, 256, 256); }
  return o;
}
function textura(c, repetir) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
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
  const r = new THREE.WebGLRenderer({ canvas, antialias: !baja, preserveDrawingBuffer: true, alpha: false, powerPreference: baja ? 'low-power' : 'default' });
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
  const pmrem = new THREE.PMREMGenerator(r); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35;
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
    manga: 'corta', taco: 'negro', vista: 0, // vista: 0 frente, PI espalda
    fotos: { frente: null, espalda: null, short: null }, colorShort: '#f2f2f4', colorCalceta: '#f2f2f4',
    dorsal: { nombre: '', numero: '', color: '#111111', sello: true }
  };
  let kit = null, kitMesh = null, tacos = [], zonas = null, uni = null;
  const corte = { value: -1 };

  // uniformes del material del uniforme (se comparten entre recompilaciones)
  uni = {
    uFoto: { value: null }, uEspalda: { value: null }, uManga: { value: null }, uShortTex: { value: null },
    uCaja: { value: new THREE.Vector4() }, uTorsoF: { value: new THREE.Vector2(0, 1) }, uTorsoB: { value: new THREE.Vector2(0, 1) },
    uShortCaja: { value: new THREE.Vector4() }, uZonas: { value: new THREE.Vector3() }, uShortBot: { value: 0 },
    uShort: { value: new THREE.Color() }, uSock: { value: new THREE.Color() }, uHayShort: { value: 0 }, uCorte: corte
  };
  const matKit = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.0, side: THREE.DoubleSide });
  matKit.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMundo; varying vec3 vNormMundo;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMundo = (modelMatrix * vec4(transformed,1.0)).xyz; vNormMundo = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uCorte; uniform sampler2D uFoto; uniform sampler2D uEspalda; uniform sampler2D uManga; uniform sampler2D uShortTex;
uniform vec4 uCaja; uniform vec2 uTorsoF; uniform vec2 uTorsoB; uniform vec4 uShortCaja; uniform vec3 uZonas; uniform float uShortBot;
uniform vec3 uShort; uniform vec3 uSock; uniform float uHayShort;
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
  vec2 uv = vec2(tor.x + ux * tor.y, (vMundo.y - uCaja.y) / uCaja.w);
  vec4 f = atras ? texture2D(uEspalda, uv) : texture2D(uFoto, uv);
  vec3 manga = texture2D(uManga, vMundo.xy * 3.2).rgb;
  base = mix(manga, f.rgb, smoothstep(0.35, 0.9, f.a));
} else if (t > uShortBot) {
  base = uShort;
  if (uHayShort > 0.5) {
    float sx = (vMundo.x - uShortCaja.x) / uShortCaja.z; if (atras) sx = 1.0 - sx;
    vec4 s = texture2D(uShortTex, vec2(sx, (vMundo.y - uShortCaja.y) / uShortCaja.w));
    base = mix(uShort, s.rgb, s.a);
  }
} else { base = uSock; }
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
    let tx0 = 1e9, tx1 = -1e9, sx0 = 1e9, sx1 = -1e9;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(kitMesh.matrixWorld);
      if (Math.abs(v.y - yTor) < 0.012 && v.z > 0) { tx0 = Math.min(tx0, v.x); tx1 = Math.max(tx1, v.x); }
      if (v.y < shortTop && v.y > shortBot) { sx0 = Math.min(sx0, v.x); sx1 = Math.max(sx1, v.x); }
    }
    uni.uCaja.value.set(tx0, shirtBot - 0.01 * zonas.YH, tx1 - tx0, zonas.top - shirtBot + 0.01 * zonas.YH);
    uni.uShortCaja.value.set(sx0, shortBot, sx1 - sx0, shortTop - shortBot);
  }
  async function ponerTacos() {
    const T = TACOS[E.taco];
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
    const col = { value: [new THREE.Color(T.cuerpo), new THREE.Color(T.suela), new THREE.Color(T.tachones)] };
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
  let espaldaBase = null;
  function aplicarFotos() {
    const f = E.fotos.frente;
    if (f) {
      uni.uFoto.value = textura(f);
      const [fx0, fw] = torsoFoto(f, 0.30); uni.uTorsoF.value.set(fx0, fw);
      uni.uManga.value = textura(telaManga(f, fx0), true);
    }
    pintarEspalda();
    const s = E.fotos.short;
    uni.uHayShort.value = s ? 1 : 0; if (s) uni.uShortTex.value = textura(s);
    uni.uShort.value.set(E.colorShort); uni.uSock.value.set(E.colorCalceta);
    pedir();
  }
  // la espalda lleva el nombre y el número del cliente encima de la foto
  function pintarEspalda() {
    const src = E.fotos.espalda || E.fotos.frente; if (!src) return;
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d');
    if (!E.fotos.espalda) { g.translate(c.width, 0); g.scale(-1, 1); }
    g.drawImage(src, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
    const [bx0, bw] = torsoFoto(c, 0.30);
    const cx = (bx0 + bw / 2) * c.width, ancho = bw * c.width, d = E.dorsal;
    if (window.Kit && (d.nombre || d.numero)) {
      const H = c.height;
      window.Kit.drawName(g, d.nombre, cx, H * 0.24, H * 0.075, d.color, ancho * 0.72);
      window.Kit.drawNumber(g, d.numero, cx, H * 0.29, H * 0.33, d.color, d.sello !== false, ancho * 0.72);
    }
    uni.uEspalda.value = textura(c);
    const [ex0, ew] = torsoFoto(c, 0.30); uni.uTorsoB.value.set(ex0, ew);
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
    const arriba = Math.min(m[0], h * 0.25), abajo = Math.min(m[1], h * 0.15), hin = Math.max(1, h - arriba - abajo);
    cam.aspect = w / hin;
    if (arriba || abajo) cam.setViewOffset(w, hin, 0, -arriba, w, h); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); encuadrarFondo(w / h);
    // encuadre: el uniforme completo, con aire
    const dist = 6.2 * Math.max(1, (2 / 3) / cam.aspect);
    cam.position.set(Math.sin(E.vista) * dist, 1.0, Math.cos(E.vista) * dist); cam.lookAt(0, 0.92, 0);
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

  const api = {
    async uniforme(o) {
      E.fotos.frente = canvasDe(o.frente); E.fotos.espalda = canvasDe(o.espalda); E.fotos.short = canvasDe(o.short);
      if (o.colorShort) E.colorShort = o.colorShort; if (o.colorCalceta) E.colorCalceta = o.colorCalceta;
      const m = o.manga || E.manga;
      if (!kit || m !== E.manga) { E.manga = m; await ponerModelo(); } else aplicarFotos();
    },
    async manga(m) { if (m === E.manga && kit) return; E.manga = m; await ponerModelo(); },
    async taco(t) { if (t === E.taco) return; E.taco = t; tacos.forEach((g) => raiz.remove(g)); tacos = []; await ponerTacos(); pedir(); },
    dorsal(d) { Object.assign(E.dorsal, d); pintarEspalda(); pedir(); },
    // con "reducir movimiento" también gira igual (estándar de Moon: se ve y se siente igual)
    vista(v, animar) { const dest = v === 'espalda' ? Math.PI : 0; if (animar === false) { E.vista = dest; pedir(); } else girarA(dest); },
    redibujar: pedir,
    // imagen para el folio o el catálogo
    foto(w, h, v) {
      const antes = E.vista; E.vista = v === 'espalda' ? Math.PI : 0;
      const pw = canvas.style.width, ph = canvas.style.height, ratio = r.getPixelRatio();
      r.setPixelRatio(1); r.setSize(w, h, false); encuadre(w, h, [0, 0]);
      r.render(scene, cam);
      const url = canvas.toDataURL('image/jpeg', 0.88);
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
