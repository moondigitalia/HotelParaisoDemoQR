const SYSTEM_PROMPT = require('./systemPrompt.js');

// Calcula la fecha y hora actual en Cancún (UTC-5 todo el año, no aplica horario de
// verano) para que Coral sepa qué día es "hoy" — sin esto, no tiene forma de saber si
// hoy es el día del buffet temático, una promoción, etc. Se calcula fresco en cada
// llamada (no se guarda en el documento estático) para que nunca quede desactualizado.
// (Misma función que en api/elevenlabs-llm/chat/completions.js — si la cambias, cámbiala
// en ambos archivos.)
function getFechaHoraCancun() {
  const fecha = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Cancun', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date());
  const hora = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Cancun', hour: 'numeric', minute: '2-digit', hour12: true
  }).format(new Date());
  return `CONTEXTO DE FECHA Y HORA ACTUAL: hoy es ${fecha}, son las ${hora} (hora de Cancún, UTC-5). ` +
    `Usa este dato para responder cualquier pregunta sobre "hoy", "este fin de semana", el día de la semana, ` +
    `o promociones/menús que cambian según el día (ej. el buffet temático de la sección 4). Esta fecha es real ` +
    `y viene del sistema — nunca digas que no sabes qué día es ni la contradigas.`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en Vercel (Settings → Environment Variables)' });
    return;
  }

  try {
    const { history } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        // Si tu cuenta requiere otra versión, ajusta este header según docs.claude.com
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        // Verifica en tu cuenta de Anthropic (console.anthropic.com) qué nombre de modelo
        // tienes disponible; ajusta este valor si es distinto.
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        // El documento grande va en su propio bloque con cache_control explícito, para
        // que siga aprovechando el caché normalmente. El bloque de fecha/hora va DESPUÉS,
        // sin cache_control — cambia en cada llamada, pero al no tener cache_control no
        // rompe el caché del bloque anterior (el caché se busca por prefijo, y el prefijo
        // hasta el primer bloque sigue siendo idéntico).
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: getFechaHoraCancun() }
        ],
        messages: history
      })
    });

    const data = await response.json();

    if (data.error) {
      res.status(200).json({ reply: null, error: data.error.message || 'Error de la API de Anthropic' });
      return;
    }

    const textBlock = (data.content || []).find(b => b.type === 'text');
    const reply = textBlock ? textBlock.text : 'Disculpa, no pude procesar eso. ¿Puedes reformular tu pregunta?';

    res.status(200).json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
