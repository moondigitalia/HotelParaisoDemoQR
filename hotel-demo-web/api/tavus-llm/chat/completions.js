const SYSTEM_PROMPT = require('../../systemPrompt.js');

// Este endpoint es el "cerebro" del avatar de video (Tavus), y es prácticamente idéntico
// a api/elevenlabs-llm/chat/completions.js — Tavus también soporta "Custom LLM" compatible
// con OpenAI, streaming vía SSE, en la ruta /chat/completions, así que reutilizamos toda la
// lógica ya depurada (el fix de `role: assistant`, el tool calling, la fecha/hora dinámica).
// Igual que con ElevenLabs, el documento del hotel NUNCA se configura dentro de Tavus — el
// "Persona" de Tavus solo apunta su Custom LLM a esta URL.
//
// Se usa un secreto de autenticación PROPIO (TAVUS_SHARED_SECRET), separado del de
// ElevenLabs, para poder rotar o revocar el acceso de cada plataforma de forma independiente.

function fixAlternatingRoles(messages) {
  // Anthropic exige que los turnos alternen estrictamente user/assistant.
  // Si vienen dos seguidos del mismo rol (común en agentes de voz que arrastran
  // transcripciones parciales), los combinamos en uno solo.
  const fixed = [];
  for (const m of messages) {
    if (fixed.length > 0 && fixed[fixed.length - 1].role === m.role) {
      fixed[fixed.length - 1].content += '\n' + m.content;
    } else {
      fixed.push({ role: m.role, content: m.content });
    }
  }
  if (fixed.length === 0 || fixed[0].role !== 'user') {
    fixed.unshift({ role: 'user', content: '(inicio de llamada)' });
  }
  return fixed;
}

// Convierte las herramientas que manda ElevenLabs (formato OpenAI: { type: 'function',
// function: { name, description, parameters } }) al formato que espera Anthropic
// ({ name, description, input_schema }).
// Calcula la fecha y hora actual en Cancún (UTC-5 todo el año, no aplica horario de
// verano) para que Coral sepa qué día es "hoy" — sin esto, no tiene forma de saber si
// hoy es el día del buffet temático, una promoción, etc. Se calcula fresco en cada
// llamada (no se guarda en el documento estático) para que nunca quede desactualizado.
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

function toAnthropicTools(openAiTools) {
  if (!Array.isArray(openAiTools) || openAiTools.length === 0) return undefined;
  return openAiTools.map(t => {
    const fn = t.function || t;
    return {
      name: fn.name,
      description: fn.description || '',
      input_schema: fn.parameters || { type: 'object', properties: {} }
    };
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  // Verifica que la llamada venga realmente de tu agente de ElevenLabs, no de cualquiera
  // que descubra esta URL. ElevenLabs manda el secreto en el header "Authorization".
  const sharedSecret = process.env.TAVUS_SHARED_SECRET;
  const authHeader = req.headers['authorization'] || '';
  if (sharedSecret && authHeader !== `Bearer ${sharedSecret}`) {
    console.error('Rechazado por autenticación. Header recibido:', authHeader ? authHeader.slice(0, 15) + '...' : '(vacío)');
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Falta ANTHROPIC_API_KEY en las variables de entorno');
    res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en Vercel' });
    return;
  }

  const body = req.body || {};
  const incomingMessages = body.messages || [];
  const wantsStream = body.stream === true;
  const anthropicTools = toAnthropicTools(body.tools);

  const conversationMessages = fixAlternatingRoles(
    incomingMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))
  );

  const id = 'chatcmpl-' + Date.now();
  const created = Math.floor(Date.now() / 1000);

  const anthropicRequestBody = {
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
    messages: conversationMessages,
    ...(anthropicTools ? { tools: anthropicTools } : {})
  };

  if (wantsStream) {
    // ---------- Streaming REAL desde Anthropic ----------
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    try {
      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({ ...anthropicRequestBody, stream: true })
      });

      const reader = anthropicResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let isFirstChunk = true;
      let usedToolCall = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          let evt;
          try { evt = JSON.parse(jsonStr); } catch { continue; }

          if (evt.type === 'content_block_start' && evt.content_block && evt.content_block.type === 'tool_use') {
            // Claude decidió usar una herramienta (ej. terminar la llamada). Avisamos
            // a ElevenLabs con el formato de "tool_calls" que su cliente OpenAI espera.
            usedToolCall = true;
            const chunk = {
              id, object: 'chat.completion.chunk', created, model: 'coral-hotel-paraiso-avatar',
              choices: [{
                index: 0,
                delta: { tool_calls: [{ index: evt.index, id: evt.content_block.id, type: 'function', function: { name: evt.content_block.name, arguments: '' } }] },
                finish_reason: null
              }]
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          } else if (evt.type === 'content_block_delta' && evt.delta && evt.delta.type === 'input_json_delta') {
            // Argumentos de la herramienta llegando en pedacitos (JSON parcial).
            const chunk = {
              id, object: 'chat.completion.chunk', created, model: 'coral-hotel-paraiso-avatar',
              choices: [{
                index: 0,
                delta: { tool_calls: [{ index: evt.index, function: { arguments: evt.delta.partial_json || '' } }] },
                finish_reason: null
              }]
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          } else if (evt.type === 'content_block_delta' && evt.delta && evt.delta.text) {
            // El primer fragmento debe incluir role:'assistant' para que el
            // cliente OpenAI-compatible de ElevenLabs abra el mensaje correctamente.
            const delta = isFirstChunk
              ? { role: 'assistant', content: evt.delta.text }
              : { content: evt.delta.text };
            isFirstChunk = false;

            const chunk = {
              id, object: 'chat.completion.chunk', created, model: 'coral-hotel-paraiso-avatar',
              choices: [{ index: 0, delta, finish_reason: null }]
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        }
      }

      const stopChunk = {
        id, object: 'chat.completion.chunk', created, model: 'coral-hotel-paraiso-avatar',
        choices: [{ index: 0, delta: {}, finish_reason: usedToolCall ? 'tool_calls' : 'stop' }]
      };
      res.write(`data: ${JSON.stringify(stopChunk)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      console.error('Error en streaming:', err.message);
      res.write('data: [DONE]\n\n');
      res.end();
    }
    return;
  }

  // ---------- Modo normal (sin streaming) ----------
  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(anthropicRequestBody)
    });

    const data = await anthropicResponse.json();
    if (data.error) {
      res.status(500).json({ error: data.error.message || 'Error de Anthropic' });
      return;
    }

    const toolUseBlocks = (data.content || []).filter(b => b.type === 'tool_use');
    const textBlock = (data.content || []).find(b => b.type === 'text');

    let message;
    let finishReason;
    if (toolUseBlocks.length > 0) {
      message = {
        role: 'assistant',
        content: textBlock ? textBlock.text : null,
        tool_calls: toolUseBlocks.map(b => ({
          id: b.id,
          type: 'function',
          function: { name: b.name, arguments: JSON.stringify(b.input || {}) }
        }))
      };
      finishReason = 'tool_calls';
    } else {
      message = { role: 'assistant', content: textBlock ? textBlock.text : 'Disculpa, ¿puedes repetir tu pregunta?' };
      finishReason = 'stop';
    }

    res.status(200).json({
      id, object: 'chat.completion', created, model: 'coral-hotel-paraiso-avatar',
      choices: [{ index: 0, message, finish_reason: finishReason }],
      usage: {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      }
    });
  } catch (err) {
    console.error('Error en elevenlabs-llm/chat/completions:', err.message);
    res.status(500).json({ error: err.message });
  }
};
