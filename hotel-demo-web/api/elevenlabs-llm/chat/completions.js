const SYSTEM_PROMPT = require('../../systemPrompt.js');

// Este endpoint traduce entre el formato que espera ElevenLabs (compatible con OpenAI)
// y la API de Anthropic — así el "cerebro" del agente (system prompt + base de
// conocimiento) vive únicamente en este repositorio, nunca duplicado dentro de
// ElevenLabs. En su dashboard, este endpoint se configura como "Custom LLM".
//
// Soporta modo normal (una respuesta completa) y modo "streaming" (respuesta en
// pedacitos) porque los agentes de voz en tiempo real casi siempre piden streaming
// para poder empezar a hablar antes de que termine de generarse todo el texto.

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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  // Verifica que la llamada venga realmente de tu agente de ElevenLabs, no de cualquiera
  // que descubra esta URL. ElevenLabs manda el secreto en el header "Authorization".
  const sharedSecret = process.env.ELEVENLABS_SHARED_SECRET;
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

  const conversationMessages = fixAlternatingRoles(
    incomingMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))
  );

  const id = 'chatcmpl-' + Date.now();
  const created = Math.floor(Date.now() / 1000);

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
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          cache_control: { type: 'ephemeral' },
          system: SYSTEM_PROMPT,
          messages: conversationMessages,
          stream: true
        })
      });

      const reader = anthropicResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let isFirstChunk = true;

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

          if (evt.type === 'content_block_delta' && evt.delta && evt.delta.text) {
            // El primer fragmento debe incluir role:'assistant' para que el
            // cliente OpenAI-compatible de ElevenLabs abra el mensaje correctamente.
            const delta = isFirstChunk
              ? { role: 'assistant', content: evt.delta.text }
              : { content: evt.delta.text };
            isFirstChunk = false;

            const chunk = {
              id, object: 'chat.completion.chunk', created, model: 'coral-hotel-paraiso',
              choices: [{ index: 0, delta, finish_reason: null }]
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        }
      }

      const stopChunk = {
        id, object: 'chat.completion.chunk', created, model: 'coral-hotel-paraiso',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
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
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        cache_control: { type: 'ephemeral' },
        system: SYSTEM_PROMPT,
        messages: conversationMessages
      })
    });

    const data = await anthropicResponse.json();
    if (data.error) {
      res.status(500).json({ error: data.error.message || 'Error de Anthropic' });
      return;
    }

    const textBlock = (data.content || []).find(b => b.type === 'text');
    const replyText = textBlock ? textBlock.text : 'Disculpa, ¿puedes repetir tu pregunta?';

    res.status(200).json({
      id, object: 'chat.completion', created, model: 'coral-hotel-paraiso',
      choices: [{ index: 0, message: { role: 'assistant', content: replyText }, finish_reason: 'stop' }],
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
