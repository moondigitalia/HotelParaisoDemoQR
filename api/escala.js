// Puente U3M → Escala CRM. La clave vive solo aquí, como variable secreta (ESCALA_API_KEY).
// Recibe { origen: 'web'|'mileni'|'radar', nombre, whatsapp, email?, notas? } y guarda/actualiza el contacto con su etiqueta.
const API = 'https://public-api.escala.com/v1/crm';
const NOTE_API = 'https://public-api.escala.com/v1/note';
const TAGS = { web: 'MOON_PaginaWeb', mileni: 'MOON_Mileni', radar: 'MOON_Radar', referidos: 'MOON_Referidos' };
const ORIGINS = [/^https:\/\/u3m-demo(-[a-z0-9-]+)?\.vercel\.app$/, /^https:\/\/([a-z0-9-]+\.)?u3m-demo\.pages\.dev$/, /^https:\/\/(www\.)?u3m\.edu\.mx$/];
const tagCache = {};

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

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
  const nombre = clean(b.nombre, 200);
  const tel = String(b.whatsapp || '').replace(/\D/g, '').slice(-10);
  const email = clean(b.email, 200).toLowerCase();
  const emailOk = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email);
  if (!tag || !nombre || tel.length !== 10) return res.status(400).json({ ok: false, error: 'datos incompletos' });

  const partes = nombre.split(/\s+/);
  const personal = { firstName: partes[0].slice(0, 100), phoneNumber: '52' + tel, country: 'México' };
  if (partes.length > 1) personal.lastName = partes.slice(1).join(' ').slice(0, 100);
  if (emailOk) personal.email = email;

  const fecha = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
  const TITULOS = { web: 'Registro desde la página web', mileni: 'Registro con Mileni (asesora virtual)', radar: 'Radar de Carrera', referidos: 'Referido (Recomienda y gana)' };
  const notas = clean(b.notas, 3900) || 'Dejó sus datos para recibir informes.';
  const contacto = { personal, status: 'lead', source: 'other', triggerWorkflow: false };

  try {
    const up = await esc('/contacts/upsert', 'POST', contacto);
    const id = up.data && up.data.id;
    if (!id || ![200, 201, 412].includes(up.status)) {
      console.error('escala upsert', up.status, JSON.stringify(up.data));
      return res.status(502).json({ ok: false, error: 'escala ' + up.status });
    }
    const t = await esc('/contacts/' + id + '/tags', 'PUT', { addTags: [await tagId(tag)] });
    if (t.status !== 200) console.error('escala tags', t.status, JSON.stringify(t.data));
    const n = await esc('/annotations', 'POST', { contactId: id, title: clean(TITULOS[b.origen] + ' · ' + fecha, 256), description: notas }, NOTE_API);
    if (n.status >= 300) console.error('escala nota', n.status, JSON.stringify(n.data));
    // Recordatorio (tarea) para el asesor, cuando la página lo pide (ej. enviar el resultado al familiar)
    let tarea;
    if (b.tarea && b.tarea.titulo) {
      const tk = await esc('/tasks', 'POST', {
        contactId: id, title: clean(b.tarea.titulo, 256), description: clean(b.tarea.descripcion, 3900) || notas,
        startAt: new Date().toISOString().slice(0, 19), status: 'pending',
      });
      tarea = tk.status < 300;
      if (!tarea) console.error('escala tarea', tk.status, JSON.stringify(tk.data));
    }
    if (b.revisar === 'moon-tags') { // diagnóstico temporal
      const g = await esc('/contacts/' + id, 'GET');
      return res.status(200).json({ tagId: await tagId(tag), put: t, contacto: g.data && (g.data.tags || g.data.entity && g.data.entity.tags || Object.keys(g.data)) });
    }
    return res.status(200).json({ ok: true, nuevo: up.status === 201, etiqueta: t.status === 200, nota: n.status < 300, tarea });
  } catch (e) {
    console.error('escala error', e && e.message);
    return res.status(502).json({ ok: false, error: 'sin conexión con Escala' });
  }
};
