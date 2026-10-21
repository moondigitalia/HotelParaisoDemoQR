// Puente U3M → Escala CRM. La clave vive solo aquí, como variable secreta (ESCALA_API_KEY).
// Recibe { origen, nombre, whatsapp, email?, notas?, campos?, tarea? } y guarda/actualiza el contacto:
//  - etiqueta según origen
//  - llena los campos personalizados que ya usa la escuela (sin borrar lo que el asesor capturó)
//  - evita duplicados: busca por teléfono y, si no, por nombre + teléfono capturado en el campo personalizado
//  - deja una nota con el detalle y, si se pide, una tarea para el asesor
const API = 'https://public-api.escala.com/v1/crm';
const NOTE_API = 'https://public-api.escala.com/v1/note';
const TAGS = { web: 'Pagina_Web', mileni: 'Mileni', radar: 'Radar_de_Carrera', referidos: 'Referidos' };
const TITULOS = { web: 'Registro desde la página web', mileni: 'Registro con Mileni (asesor virtual)', radar: 'Radar de Carrera', referidos: 'Referido (Recomienda y gana)' };
const ORIGINS = [/^https:\/\/u3m-demo(-[a-z0-9-]+)?\.vercel\.app$/, /^https:\/\/([a-z0-9-]+\.)?u3m-demo\.pages\.dev$/, /^https:\/\/(www\.)?u3m\.edu\.mx$/];

// Campos personalizados de la escuela (nombre interno en Escala)
const CF = {
  nombre: 'cf_contact_nombre_del_alumno_unvg_text',
  telefono: 'cf_contact_telefono_primario_numero_de_whatsapp_cats_number',
  carreras: 'cf_contact_carrera_de_interes_axxo_multi_select',
  modalidad: 'cf_contact_modalidad_wfsz_dropdown',
  como: 'cf_contact_como_se_entero_anfm_dropdown',
  referido_de: 'cf_contact_referido_de_binb_text',
  tutor_nombre: 'cf_contact_nombre_del_tutor_qscm_text',
  tutor_tel: 'cf_contact_numero_del_tutor_fklh_number',
  escuela: 'cf_contact_escuela_vehs_text',
  observaciones: 'cf_contact_observaciones_yvlg_text',
};
const CARRERAS = ['LAE', 'LAET', 'CNI', 'IIS', 'IGE', 'DG', 'DAJ', 'COM', 'PSI', 'EDU', 'ARQ', 'CAP', 'MKT', 'POR DEFINIR'];
const MODALIDADES = ['ESC', 'EJE'];
const COMO = ['Código QR', 'Sitio web', 'Referido alumno', 'Referido externo ', 'Referido Inscrito ', 'Referido colaborador', 'Referido profesor'];
// Asesores: Referidos va directo a Rafael Martínez; lo demás lo reparte el flujo "Asignación asesor - Web y Radar"
// entre estas tres. Si el flujo no alcanzara a asignar, el puente asigna por su cuenta (respaldo).
const RAFA = 'rmartinez@u3m.edu.mx';
const ASESORAS = ['admisiones05@u3m.edu.mx', 'admisiones03@u3m.edu.mx', 'admisiones04@u3m.edu.mx']; // Mariela, Paulina, Yelenyz
let opcionesComo = null;
const tagCache = {};

// Opciones reales de "Cómo se enteró" en Escala (si "Código QR" aún no existe allá, se usa "Sitio web")
async function comoValido(v) {
  if (!v) return '';
  // Vuelve a leer la lista si la que tenemos no trae la opción (por si la escuela la acaba de agregar)
  if (!opcionesComo || !opcionesComo.includes(v)) {
    const r = await esc('/custom-fields?size=100', 'GET');
    const f = (r.data.items || []).find((x) => x.internalName === CF.como);
    if (f && Array.isArray(f.options) && f.options.length) opcionesComo = f.options;
  }
  // Si no se pudo leer la lista, no dejamos el campo vacío: usamos lo de siempre
  if (!opcionesComo) return v === 'Código QR' ? 'Sitio web' : v;
  if (opcionesComo.includes(v)) return v;
  return v === 'Código QR' && opcionesComo.includes('Sitio web') ? 'Sitio web' : '';
}

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, max);
const diez = (v) => String(v == null ? '' : v).replace(/\D/g, '').slice(-10);
const vacio = (v) => v == null || v === '' || v === 0 || (Array.isArray(v) && !v.length);

async function esc(path, method, body, base) {
  const r = await fetch((base || API) + path, {
    method,
    headers: { 'x-api-key': process.env.ESCALA_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await r.json(); } catch (e) {}
  return { status: r.status, data };
}

async function tagId(name) {
  if (tagCache[name]) return tagCache[name];
  const s = await esc('/tags?name=' + encodeURIComponent(name) + '&size=50', 'GET');
  const hit = (s.data.items || []).find((t) => t.name === name);
  let id = hit && hit.id;
  if (!id) {
    const c = await esc('/tags', 'POST', { name, category: 'CONTACT' });
    if (c.status === 201 || c.status === 412) id = c.data.id;
    else throw new Error('tag ' + c.status + ' ' + JSON.stringify(c.data));
  }
  return (tagCache[name] = id);
}

// Busca si la persona ya existe: 1) por teléfono principal; 2) por nombre + teléfono guardado en el campo personalizado
async function buscar(tel, nombre) {
  // Escala solo encuentra el número escrito igualito: probamos las 3 formas en que la escuela lo guarda
  for (const v of ['52' + tel, tel, '521' + tel]) {
    const p = await esc('/contacts?phoneNumber=' + v + '&size=5', 'GET');
    const porTel = (p.data.items || [])[0];
    if (porTel) return porTel;
  }
  if (!nombre) return null;
  const n = await esc('/contacts?text=' + encodeURIComponent(nombre) + '&size=50', 'GET');
  return (n.data.items || []).find((c) => {
    const cu = c.custom || {};
    return diez(cu[CF.telefono]) === tel || diez((c.personal || {}).phoneNumber) === tel;
  }) || null;
}

// Arma los campos personalizados, sin pisar lo que ya capturó el asesor
function camposPara(b, nombre, tel, existente) {
  const prev = (existente && existente.custom) || {};
  const c = b.campos || {};
  const out = {};
  const pon = (k, v) => { if (!vacio(v) && vacio(prev[CF[k]])) out[CF[k]] = v; };
  pon('nombre', nombre.slice(0, 250));
  pon('telefono', Number(tel));
  const cs = (Array.isArray(c.carreras) ? c.carreras : []).filter((x) => CARRERAS.includes(x));
  if (cs.length) {
    // Carrera principal: la que la persona eligió; "POR DEFINIR" solo si no hay ninguna carrera
    const ya = Array.isArray(prev[CF.carreras]) ? prev[CF.carreras] : [];
    let union = ya.concat(cs.filter((x) => !ya.includes(x)));
    if (union.some((x) => x !== 'POR DEFINIR')) union = union.filter((x) => x !== 'POR DEFINIR');
    if (union.join() !== ya.join()) out[CF.carreras] = union;
  }
  if (MODALIDADES.includes(c.modalidad)) pon('modalidad', c.modalidad);
  if (COMO.includes(c.como)) pon('como', c.comoOk);
  pon('referido_de', clean(c.referido_de, 250));
  pon('tutor_nombre', clean(c.tutor_nombre, 250));
  if (diez(c.tutor_tel).length === 10) pon('tutor_tel', Number(diez(c.tutor_tel)));
  pon('escuela', clean(c.escuela, 250));
  const obs = clean(c.observaciones, 900);
  if (obs) {
    const ant = clean(prev[CF.observaciones], 3000);
    if (!ant) out[CF.observaciones] = obs;
    else if (!ant.includes(obs)) out[CF.observaciones] = (ant + ' | ' + obs).slice(0, 3900);
  }
  return out;
}

const sinAsesor = (a) => !a || a === 'unassigned';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Revisa que el contacto quede con asesor. El flujo de Escala suele asignarlo en segundos;
// si no lo hizo, el puente lo asigna (Referidos → Rafael Martínez; lo demás → una de las tres asesoras).
async function asegurarAsesor(id, origen) {
  for (let i = 0; i < 4; i++) {
    await espera(i === 0 ? 2500 : 3000);
    const c = await esc('/contacts/' + id, 'GET');
    const a = c.data && (c.data.entity || c.data).assignedTo;
    if (!sinAsesor(a)) return a;
  }
  const quien = origen === 'referidos' ? RAFA : ASESORAS[Math.floor(Math.random() * ASESORAS.length)];
  const u = await esc('/contacts/' + id, 'PUT', { assignedTo: quien, triggerWorkflow: false });
  if (u.status >= 300) console.error('escala asesor', u.status, JSON.stringify(u.data));
  console.log('asesor asignado por respaldo', origen);
  return quien;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (ORIGINS.some((re) => re.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (origin && !ORIGINS.some((re) => re.test(origin))) return res.status(403).json({ ok: false });
  if (!process.env.ESCALA_API_KEY) return res.status(500).json({ ok: false, error: 'sin clave' });

  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  if (b.website) return res.status(200).json({ ok: true }); // trampa para bots

  const tag = TAGS[b.origen];
  const nombre = clean(b.nombre, 200).replace(/\s+/g, ' ');
  const tel = diez(b.whatsapp);
  const email = clean(b.email, 200).toLowerCase();
  const emailOk = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email);
  if (!tag || !nombre || tel.length !== 10) return res.status(400).json({ ok: false, error: 'datos incompletos' });

  const fecha = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
  const notas = clean(b.notas, 3900) || 'Dejó sus datos para recibir informes.';

  try {
    if (b.campos) b.campos.comoOk = await comoValido(b.campos.como);
    const existente = await buscar(tel, nombre);
    const custom = camposPara(b, nombre, tel, existente);
    let id, nuevo = false;
    if (existente) {
      // Ya existe: solo completamos lo que falta (teléfono principal, correo y campos vacíos)
      id = existente.id;
      const ep = existente.personal || {};
      const personal = {};
      if (!ep.phoneNumber) personal.phoneNumber = '52' + tel;
      if (emailOk && !ep.email) personal.email = email;
      const cambio = {};
      if (b.origen === 'referidos' && sinAsesor(existente.assignedTo)) cambio.assignedTo = RAFA;
      if (Object.keys(personal).length) cambio.personal = personal;
      if (Object.keys(custom).length) cambio.custom = custom;
      if (Object.keys(cambio).length) {
        const u = await esc('/contacts/' + id, 'PUT', Object.assign({ triggerWorkflow: false }, cambio));
        if (u.status >= 300) console.error('escala actualizar', u.status, JSON.stringify(u.data));
      }
    } else {
      const partes = nombre.split(' ');
      const personal = { firstName: partes[0].slice(0, 100), phoneNumber: '52' + tel, country: 'México' };
      if (partes.length > 1) personal.lastName = partes.slice(1).join(' ').slice(0, 100);
      if (emailOk) personal.email = email;
      const contacto = { personal, status: 'lead', source: 'other', triggerWorkflow: false };
      if (b.origen === 'referidos') contacto.assignedTo = RAFA;
      if (Object.keys(custom).length) contacto.custom = custom;
      const up = await esc('/contacts/upsert', 'POST', contacto);
      id = up.data && up.data.id;
      if (!id || ![200, 201, 412].includes(up.status)) {
        console.error('escala upsert', up.status, JSON.stringify(up.data));
        return res.status(502).json({ ok: false, error: 'escala ' + up.status });
      }
      nuevo = up.status === 201;
    }
    const t = await esc('/contacts/' + id + '/tags', 'PUT', { addTags: [await tagId(tag)], triggerWorkflow: true }); // activa el flujo "Asignación asesor - Web y Radar"
    if (t.status !== 200) console.error('escala tags', t.status, JSON.stringify(t.data));
    const asesor = await asegurarAsesor(id, b.origen);
    const n = await esc('/annotations', 'POST', { contactId: id, title: clean(TITULOS[b.origen] + ' · ' + fecha, 256), description: notas }, NOTE_API);
    if (n.status >= 300) console.error('escala nota', n.status, JSON.stringify(n.data));
    let tarea;
    if (b.tarea && b.tarea.titulo) {
      const tk = await esc('/tasks', 'POST', {
        contactId: id, title: clean(b.tarea.titulo, 256), description: clean(b.tarea.descripcion, 3900) || notas,
        startAt: new Date().toISOString().slice(0, 19), status: 'pending',
      });
      tarea = tk.status < 300;
      if (!tarea) console.error('escala tarea', tk.status, JSON.stringify(tk.data));
    }
    return res.status(200).json({ ok: true, nuevo, yaExistia: !!existente, etiqueta: t.status === 200, nota: n.status < 300, tarea, asesor });
  } catch (e) {
    console.error('escala error', e && e.message);
    return res.status(502).json({ ok: false, error: 'sin conexión con Escala' });
  }
};
