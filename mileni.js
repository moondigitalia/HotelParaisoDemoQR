// Chat de Mileni (asesor virtual U3M) — ElevenLabs Agents, solo texto.
const AGENT_ID = 'agent_1401m3pnkh09fvaryxg1nanmg9ns';
const WA_URL = 'https://wa.me/522299096832';

const $ = (s) => document.querySelector(s);
const chat = $('#chat'), msgs = $('#msgs'), form = $('#chat-form'), input = $('#chat-in'),
  send = $('#chat-send'), statusEl = $('#chat-status'), launcher = $('#launcher'), quick = $('#quick');

let conv = null, connecting = null, typingEl = null, pending = [], gotFirst = false, sdk = null;

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
  typing(true);
  connecting = (async () => {
    const { Conversation } = await loadSdk();
    const c = await Conversation.startSession({
      agentId: AGENT_ID,
      connectionType: 'websocket',
      textOnly: true,
      overrides: { conversation: { textOnly: true } },
      onConnect: () => setStatus('● En línea'),
      onDisconnect: () => { conv = null; connecting = null; gotFirst = false; setStatus('● En línea'); },
      onError: (m) => { console.warn('[Mileni]', m); },
      onMessage: ({ message, source }) => {
        if (source === 'user') return;
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

function open(q) {
  chat.classList.add('open');
  launcher.style.display = 'none';
  if (!msgs.children.length) connect().catch(() => {});
  if (q) sendText(q); else setTimeout(() => input.focus(), 50);
}
function close() {
  chat.classList.remove('open');
  launcher.style.display = '';
  const b = document.getElementById('bubble'); if (b) b.remove();
}

form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value; input.value = ''; sendText(q); });
input.addEventListener('input', () => { try { conv && conv.sendUserActivity && conv.sendUserActivity(); } catch (e) {} });
$('#chat-close').addEventListener('click', close);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && chat.classList.contains('open')) close(); });

window.Mileni = { open, close };
(window.__mileniQueue || []).forEach((q) => open(q));
window.__mileniQueue = [];
