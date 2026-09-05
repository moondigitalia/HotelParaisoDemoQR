const SYSTEM_PROMPT = require('../../systemPrompt.js');

// Este endpoint traduce entre el formato que espera ElevenLabs (compatible con OpenAI)
// y la API de Anthropic — así el "cerebro" del agente (system prompt + base de
// conocimiento) vive únicamente en este repositorio, nunca duplicado dentro de
// ElevenLabs. En su dashboard, este endpoint se configura como "Custom LLM".

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

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

  try {
    const body = req.body || {};
    const incomingMessages = body.messages || [];

    const conversationMessages = incomingMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));

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
    console.error('Error en elevenlabs-llm/chat/completions:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
};
