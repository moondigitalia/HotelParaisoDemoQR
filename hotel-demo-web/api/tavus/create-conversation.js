// Crea una nueva sesión de video con Tavus y regresa la URL de la sala para que el
// navegador se una. La API key de Tavus nunca se expone al navegador — vive solo aquí,
// como variable de entorno en Vercel.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const apiKey = process.env.TAVUS_API_KEY;
  const palId = process.env.TAVUS_PAL_ID; // ya definido: p8f7220c58d0
  if (!apiKey || !palId) {
    res.status(500).json({ error: 'Falta configurar TAVUS_API_KEY o TAVUS_PAL_ID en Vercel' });
    return;
  }

  try {
    const response = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        pal_id: palId,
        conversation_name: 'Coral - Hotel Paraíso Cancún',
        // Sin esto, Coral se queda callada esperando a que el huésped hable primero — el
        // huésped no tiene forma de saber si la llamada ya empezó o no.
        custom_greeting: '¡Hola! Soy Coral, el asistente virtual del Hotel Paraíso Cancún. ¿En qué puedo ayudarte hoy?'
      })
    });

    const data = await response.json();

    if (!response.ok || !data.conversation_url) {
      console.error('Error de Tavus al crear conversación:', data);
      res.status(500).json({ error: data.message || 'No se pudo iniciar la videollamada con Tavus' });
      return;
    }

    res.status(200).json({
      conversation_url: data.conversation_url,
      conversation_id: data.conversation_id
    });
  } catch (err) {
    console.error('Error en api/tavus/create-conversation:', err.message);
    res.status(500).json({ error: err.message });
  }
};
