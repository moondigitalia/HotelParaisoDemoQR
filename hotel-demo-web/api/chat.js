const SYSTEM_PROMPT = require('./systemPrompt.js');

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
        // Cachea el system prompt (es grande) para que las llamadas siguientes sean más
        // rápidas y más baratas — Claude no reprocesa todo el documento cada vez.
        cache_control: { type: 'ephemeral' },
        system: SYSTEM_PROMPT,
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
