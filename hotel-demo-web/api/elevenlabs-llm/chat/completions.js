const SYSTEM_PROMPT = require('../../systemPrompt.js');

// Este endpoint traduce entre el formato que espera ElevenLabs (compatible con OpenAI)
// y la API de Anthropic. Soporta modo normal (una respuesta completa) y modo "streaming"
// (respuesta en pedacitos) porque los agentes de voz en tiempo real casi siempre piden
// streaming para poder empezar a hablar antes de que termine de generarse todo el texto.

function fixAlternatingRoles(messages) {
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

  const sharedSecret = process.env.ELEVENLABS_SHARED_SECRET;
  const authHeader = req.headers['authorization'] || '';
  if (sharedSecret && authHeader !== `Bearer ${sharedSecret}`) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en Vercel' });
    return;
  }

  try {
    const body = req.body || {};
    const incomingMessages = body.messages || [];
    const wantsStream = body.stream === true;

    const conversationMessages = fixAlternatingRoles(
      incomingMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))
    );

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
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
    const id = 'chatcmpl-' + Date.now();
    const created = Math.floor(Date.now() / 1000);

    if (wantsStream) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

      const chunk1 = {
        id, object: 'chat.completion.chunk', created, model: 'coral-hotel-paraiso',
        choices: [{ index: 0, delta: { role: 'assistant', content: replyText }, finish_reason: null }]
      };
      const chunk2 = {
        id, object: 'chat.completion.chunk', created, model: 'coral-hotel-paraiso',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
      };

      res.write(`data: ${JSON.stringify(chunk1)}\n\n`);
      res.write(`data: ${JSON.stringify(chunk2)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    res.status(200).json({
      id,
      object: 'chat.completion',
      created,
      model: 'coral-hotel-paraiso',
      choices: [
        { index: 0, message: { role: 'assistant', content: replyText }, finish_reason: 'stop' }
      ],
      usage: {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      }
    });
  } catch (err) {
    console.error('Error en elevenlabs-llm/chat/completions:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
};
