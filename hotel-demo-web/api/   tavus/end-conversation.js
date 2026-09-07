// Termina una sesión de video en Tavus cuando el huésped cuelga desde nuestra interfaz —
// para que Tavus deje de contar minutos de inmediato, en vez de esperar a que la sesión
// expire sola por inactividad.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const { conversation_id } = req.body || {};
  if (!conversation_id) {
    res.status(400).json({ error: 'Falta conversation_id' });
    return;
  }

  const apiKey = process.env.TAVUS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar TAVUS_API_KEY en Vercel' });
    return;
  }

  try {
    const response = await fetch(`https://tavusapi.com/v2/conversations/${conversation_id}/end`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey }
    });
    res.status(200).json({ ended: response.ok });
  } catch (err) {
    console.error('Error en api/tavus/end-conversation:', err.message);
    res.status(500).json({ error: err.message });
  }
};
