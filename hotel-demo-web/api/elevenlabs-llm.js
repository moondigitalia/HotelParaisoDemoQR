const SYSTEM_PROMPT = require('./systemPrompt.js');

// Este endpoint traduce entre el formato que espera ElevenLabs (compatible con OpenAI)
// y la API de Anthropic — así el "cerebro" del agente (system prompt + base de
// conocimiento) vive únicamente en este repositorio, nunca duplicado dentro de
// ElevenLabs. En su dashboard, este endpoint se configura como "Custom LLM".

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en Vercel' });
    return;
  }

  try {
    // ElevenLabs manda las cosas en formato "OpenAI Chat Completions":
    // { messages: [{role, content}, ...], stream: bool, ... }
    const body = req.body || {};
    const incomingMessages = body.messages || [];

    // Filtramos cualquier mensaje "system" que ElevenLabs intente mandar (ej. si en su
    // dashboard alguien puso algo por accidente) — SIEMPRE usamos nuestro propio
    // system prompt, nunca el de ellos. Solo nos quedamos con los turnos user/assistant.
    const conversationMessages = incomingMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));

    // La API de Anthropic requiere que el primer turno sea de "user"
    if (conversationMessages.length === 0 || conversationMessages[0].role !== 'user') {
      conversationMessages.unshift({ role: 'user', content: '(inicio de llamada)' });
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500, // en llamadas conviene respuestas más cortas y directas
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

    // Respondemos en el formato "OpenAI Chat Completions" que ElevenLabs espera recibir
    res.status(200).json({
      id: 'chatcmpl-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'coral-hotel-paraiso',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: replyText },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
