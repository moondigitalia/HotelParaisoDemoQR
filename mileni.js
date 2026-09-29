// Chat de Mileni (asesor virtual U3M) — ElevenLabs Agents: texto + modo voz.
const AGENT_ID = 'agent_1401m3pnkh09fvaryxg1nanmg9ns';
const WA_URL = 'https://wa.me/522299096832';

const $ = (s) => document.querySelector(s);
const chat = $('#chat'), msgs = $('#msgs'), form = $('#chat-form'), input = $('#chat-in'),
  send = $('#chat-send'), statusEl = $('#chat-status'), launcher = $('#launcher'), quick = $('#quick');

let conv = null, connecting = null, typingEl = null, pending = [], gotFirst = false, sdk = null, skipGreeting = false;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function md(text) {
  let h = esc(text.trim());
  h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  h = h.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  h = h.replace(/^\s*[-*]\s+/gm, '• ');
  h = h.replace(/(229\s?909\s?6832)/g, `<a href="${WA_URL}" target="_blank" rel="noopener">$1</a>`);
  return h;
}
function add(role, text, html) {
  const d = document.createElement('div');
  d.className = 'msg ' + role;
  if (html) d.innerHTML = html; else d.textContent = text;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
  return d;
}
function typing(on) {
  if (on && !typingEl) { typingEl = document.createElement('div'); typingEl.className = 'typing'; typingEl.innerHTML = '<i></i><i></i><i></i>'; msgs.appendChild(typingEl); }
  if (!on && typingEl) { typingEl.remove(); typingEl = null; }
  msgs.scrollTop = msgs.scrollHeight;
}
function setStatus(t, ok = true) { statusEl.textContent = t; statusEl.style.color = ok ? '#9CC43C' : '#F4C542'; }

async function loadSdk() {
  if (sdk) return sdk;
  const urls = ['https://esm.sh/@elevenlabs/client@0', 'https://cdn.jsdelivr.net/npm/@elevenlabs/client@0/+esm'];
  let last;
  for (const u of urls) { try { sdk = await import(u); return sdk; } catch (e) { last = e; } }
  throw last;
}

async function connect() {
  if (conv) return conv;
  if (connecting) return connecting;
  setStatus('● Conectando…', false);
  skipGreeting = !!msgs.querySelector('.msg.ai');
  typing(true);
  connecting = (async () => {
    const { Conversation } = await loadSdk();
    const c = await Conversation.startSession({
      agentId: AGENT_ID,
      connectionType: 'websocket',
      textOnly: true,
      overrides: { conversation: { textOnly: true } },
      clientTools,
      onConnect: () => setStatus('● En línea'),
      onDisconnect: (d) => {
        const hadPending = !!typingEl; typing(false);
        conv = null; connecting = null; gotFirst = false; setStatus('● En línea');
        if (hadPending) add('sys', null, 'Mileni no está disponible en este momento. Escríbenos por <a href="' + WA_URL + '" target="_blank" rel="noopener">WhatsApp al 229 909 6832</a> y un asesor te atiende.');
        console.warn('[Mileni] desconectado', d);
      },
      onError: (m) => { console.warn('[Mileni]', m); },
      onMessage: ({ message, source }) => {
        if (source === 'user') return;
        if (!gotFirst && skipGreeting) { gotFirst = true; skipGreeting = false; flush(); return; }
        typing(false);
        add('ai', null, md(message));
        if (!gotFirst) { gotFirst = true; flush(); }
      },
    });
    conv = c;
    // si el agente no manda saludo, liberamos la cola igual
    setTimeout(() => { if (!gotFirst) { gotFirst = true; typing(false); flush(); } }, 4000);
    return c;
  })();
  try { return await connecting; }
  catch (e) {
    console.error('[Mileni] no se pudo conectar', e);
    connecting = null; typing(false); setStatus('● Sin conexión', false);
    add('sys', null, 'No pude conectarme en este momento. Escríbenos por <a href="' + WA_URL + '" target="_blank" rel="noopener">WhatsApp al 229 909 6832</a> y un asesor te atiende.');
    throw e;
  }
}
function flush() {
  while (pending.length) { const q = pending.shift(); deliver(q); }
}
function deliver(q) {
  try { conv.sendUserMessage(q); typing(true); }
  catch (e) { console.error(e); typing(false); add('sys', null, 'Se perdió la conexión. Intenta de nuevo.'); conv = null; }
}
async function sendText(q) {
  q = (q || '').trim(); if (!q) return;
  add('me', q);
  quick.style.display = 'none';
  if (conv && gotFirst) { deliver(q); return; }
  pending.push(q);
  try { await connect(); } catch (e) { pending = []; }
}


// ───────── Prospectos ─────────
// Herramienta de cliente "registrar_prospecto": Mileni la llama cuando tiene nombre + WhatsApp.
// Demo: muestra la ficha en el chat y la guarda en este navegador. En producción se envía a Escala.
const INTERES = { alto: 'Interés alto', medio: 'Interés medio', bajo: 'Explorando' };
const QUIEN = { aspirante: 'Aspirante', papa_mama: 'Papá / mamá', otro: 'Otro' };
function fmtTel(t) {
  const d = String(t || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6) : (t || '');
}
function registrarProspecto(p) {
  p = p || {};
  const tel = String(p.whatsapp || '').replace(/\D/g, '');
  if (!p.nombre || tel.length < 10) return 'Faltan datos: pide el nombre y un WhatsApp de 10 dígitos antes de registrar.';
  const folio = 'U3M-' + Date.now().toString(36).slice(-5).toUpperCase();
  const lead = { folio, fecha: new Date().toISOString(), canal: voiceConv || voiceStarting ? 'voz' : 'texto', ...p, whatsapp: tel.slice(-10) };
  try { const k = 'u3m_prospectos'; const arr = JSON.parse(localStorage.getItem(k) || '[]'); arr.push(lead); localStorage.setItem(k, JSON.stringify(arr)); } catch (e) {}
  const rows = [
    ['Nombre', p.nombre], ['WhatsApp', fmtTel(tel)], ['Carrera', p.carrera], ['Promedio', p.promedio],
    ['Modalidad', p.modalidad], ['Quién', QUIEN[p.quien]], ['Notas', p.notas],
  ].filter((r) => r[1]);
  const lvl = INTERES[p.interes] ? `<span class="lead-lvl ${esc(p.interes)}">${INTERES[p.interes]}</span>` : '';
  add('lead', null,
    `<div class="lead-h"><b>Ficha enviada a Admisiones</b>${lvl}</div>` +
    `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` +
    `<div class="lead-f">Folio ${folio} · Un asesor te escribe por WhatsApp</div>`);
  return 'Prospecto registrado con folio ' + folio + '. Confírmale a la persona que un asesor le escribirá por WhatsApp.';
}
// Herramienta "mostrar_radar": tarjeta con botón al test vocacional (también dentro de la llamada).
let radarShown = false;
function mostrarRadar() {
  if (!radarShown) {
    radarShown = true;
    add('radar', null,
      '<div class="radar-k">Test vocacional · gratis</div>' +
      '<b>Radar de Carrera U3M</b>' +
      '<p>7 preguntas rápidas, unos 2 minutos. Te mandamos por WhatsApp las carreras que más van contigo.</p>' +
      '<a class="radar-btn" href="radar" target="_blank" rel="noopener">Hacer el Radar →</a>');
  }
  const vr = document.getElementById('v-radar'); if (vr) vr.hidden = false;
  return 'Listo, el botón del Radar de Carrera ya está en la pantalla de la persona.';
}
const clientTools = { registrar_prospecto: registrarProspecto, mostrar_radar: mostrarRadar };

// En celular: el chat ocupa exactamente el espacio visible arriba del teclado.
const vv = window.visualViewport;
function fitChat() {
  if (!chat.classList.contains('open') || window.innerWidth > 640 || !vv) { chat.style.height = ''; chat.style.transform = ''; return; }
  if (vv.height > window.innerHeight - 40 && vv.offsetTop < 2) { chat.style.height = ''; chat.style.transform = ''; return; }
  chat.style.height = vv.height + 'px';
  chat.style.transform = 'translateY(' + vv.offsetTop + 'px)';
  msgs.scrollTop = msgs.scrollHeight;
}
if (vv) { vv.addEventListener('resize', fitChat); vv.addEventListener('scroll', fitChat); }
input.addEventListener('focus', () => setTimeout(fitChat, 300));

// En celular bloqueamos la página de atrás: no se ve ni se puede scrollear mientras el chat está abierto.
let lockY = 0;
function lockPage() {
  if (window.innerWidth > 640 || document.documentElement.classList.contains('chat-lock')) return;
  lockY = window.scrollY;
  document.body.style.top = -lockY + 'px';
  document.documentElement.classList.add('chat-lock');
}
function unlockPage() {
  if (!document.documentElement.classList.contains('chat-lock')) return;
  document.documentElement.classList.remove('chat-lock');
  document.body.style.top = '';
  window.scrollTo({ top: lockY, behavior: 'instant' });
}
// iOS ignora a veces overflow:hidden; frenamos el arrastre fuera de la lista de mensajes.
chat.addEventListener('touchmove', (e) => {
  if (window.innerWidth > 640) return;
  const sc = e.target.closest('.msgs, .quick');
  if (!sc) { e.preventDefault(); return; }
  if (sc.classList.contains('msgs') && sc.scrollHeight <= sc.clientHeight) e.preventDefault();
}, { passive: false });

function open(q) {
  chat.classList.add('open');
  document.body.classList.add('chat-open');
  lockPage();
  fitChat();
  launcher.style.display = 'none';
  if (!msgs.children.length) connect().catch(() => {});
  if (q) sendText(q); else if (window.innerWidth > 640) setTimeout(() => input.focus(), 50);
}
function close() {
  chat.classList.remove('open');
  document.body.classList.remove('chat-open');
  unlockPage();
  chat.style.height = ''; chat.style.transform = '';
  launcher.style.display = '';
  const b = document.getElementById('bubble'); if (b) b.remove();
  if (voiceConv || voiceStarting) stopVoice();
}

form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value; input.value = ''; sendText(q); });
input.addEventListener('input', () => { try { conv && conv.sendUserActivity && conv.sendUserActivity(); } catch (e) {} });
$('#chat-close').addEventListener('click', close);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && chat.classList.contains('open')) close(); });

// ───────── Modo voz ─────────
// Sesión WebRTC aparte de la de texto. Mileni "respira" (halo azul marino) y el halo
// crece con el volumen de su voz o de la tuya. Límite de 3 minutos por llamada (demo).
const VOICE_MAX = 180;
const voice = $('#voice'), orb = $('#orb'), vStatus = $('#v-status'),
  vTime = $('#v-time'), vMute = $('#v-mute'), mic = $('#chat-mic');
let voiceConv = null, voiceStarting = false, vMode = 'listening', raf = 0, lvl = 0, vTimer = 0, vLeft = 0, muted = false;

function vState(cls, text) {
  voice.className = 'voice ' + cls;
  vStatus.textContent = text;
}
function loop() {
  let target = 0;
  if (voiceConv) {
    try {
      target = vMode === 'speaking' ? voiceConv.getOutputVolume() * 1.6 : (muted ? 0 : voiceConv.getInputVolume() * 1.1);
    } catch (e) { target = 0; }
  }
  target = Math.min(1, target || 0);
  lvl += (target - lvl) * (target > lvl ? 0.35 : 0.12);
  orb.style.setProperty('--lvl', lvl.toFixed(3));
  raf = requestAnimationFrame(loop);
}
const fmt = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

async function startVoice() {
  if (voiceConv || voiceStarting) return;
  voiceStarting = true;
  // cerramos la sesión de texto para no tener dos conversaciones abiertas
  typing(false); pending = [];
  if (conv) { const c = conv; conv = null; connecting = null; gotFirst = false; try { await c.endSession(); } catch (e) {} }
  chat.classList.add('in-voice'); voice.hidden = false;
  muted = false; vMute.setAttribute('aria-pressed', 'false'); vMute.textContent = 'Silenciar';
  vTime.textContent = '';
  const vr0 = document.getElementById('v-radar'); if (vr0) vr0.hidden = true;
  vState('connecting', 'Conectando con Mileni…');
  setStatus('● Llamada de voz', true);
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  try {
    const { Conversation } = await loadSdk();
    if (!voiceStarting) return; // el usuario colgó mientras cargaba
    const c = await Conversation.startSession({
      agentId: AGENT_ID,
      connectionType: 'webrtc',
      dynamicVariables: { modo: 'voz' },
      clientTools,
      overrides: { agent: { firstMessage: msgs.querySelector('.msg.me')
        ? '¡Aquí estoy! Ahora platicamos por voz. ¿Qué más quieres saber?'
        : '¡Hola! Soy Mileni, de la Universidad Tercer Milenio. ¿En qué te puedo ayudar?' } },
      onConnect: () => {
        vState('listening', 'Te escucho…');
        vLeft = VOICE_MAX; vTime.textContent = 'Tiempo restante ' + fmt(vLeft);
        clearInterval(vTimer);
        vTimer = setInterval(() => {
          vLeft--; vTime.textContent = 'Tiempo restante ' + fmt(Math.max(0, vLeft));
          if (vLeft <= 0) stopVoice('Las llamadas de voz duran hasta 3 minutos. Puedes seguir escribiendo o volver a llamar a Mileni.');
        }, 1000);
      },
      onDisconnect: () => { if (voiceConv) stopVoice(); },
      onError: (m) => console.warn('[Mileni voz]', m),
      onModeChange: ({ mode }) => {
        vMode = mode;
        if (!voiceConv) return;
        if (mode === 'speaking') vState('speaking', 'Mileni está hablando…');
        else vState('listening', muted ? 'Micrófono silenciado' : 'Te escucho…');
      },
      onMessage: ({ message, source }) => {
        if (!message) return;
        // la transcripción no se muestra en la pantalla de llamada; queda en el chat al colgar
        if (source === 'user') add('me', message); else add('ai', null, md(message));
        quick.style.display = 'none';
      },
    });
    if (!voiceStarting) { try { await c.endSession(); } catch (e) {} return; }
    voiceConv = c;
  } catch (e) {
    console.error('[Mileni voz] no se pudo iniciar', e);
    const denied = e && (e.name === 'NotAllowedError' || /permission|denied/i.test(e.message || ''));
    stopVoice(denied
      ? 'Para hablar con Mileni necesitas permitir el micrófono en tu navegador. También puedes escribirle aquí abajo.'
      : 'No pude iniciar la llamada de voz. Puedes escribirle a Mileni aquí abajo o mandar WhatsApp al <a href="' + WA_URL + '" target="_blank" rel="noopener">229 909 6832</a>.');
  } finally { voiceStarting = false; }
}

function stopVoice(note) {
  const c = voiceConv; voiceConv = null; voiceStarting = false;
  clearInterval(vTimer); cancelAnimationFrame(raf); lvl = 0; orb.style.setProperty('--lvl', 0);
  if (c) { try { c.endSession(); } catch (e) {} }
  chat.classList.remove('in-voice'); voice.hidden = true;
  setStatus('● En línea');
  const html = note || 'Llamada de voz terminada. Puedes seguir escribiendo aquí.';
  const last = msgs.lastElementChild;
  if (!(last && last.classList.contains('sys') && last.innerHTML === html)) add('sys', null, html);
}

mic.addEventListener('click', startVoice);
$('#v-end').addEventListener('click', () => stopVoice());
vMute.addEventListener('click', () => {
  if (!voiceConv) return;
  muted = !muted;
  try { voiceConv.setMicMuted(muted); } catch (e) {}
  vMute.setAttribute('aria-pressed', String(muted));
  vMute.textContent = muted ? 'Activar mic' : 'Silenciar';
  if (vMode !== 'speaking') vState('listening', muted ? 'Micrófono silenciado' : 'Te escucho…');
});

window.Mileni = { open, close };
(window.__mileniQueue || []).forEach((q) => open(q));
window.__mileniQueue = [];
