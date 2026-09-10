// Endpoint chico y liviano: solo entrega el texto del documento base del hotel,
// SIN llamar a Claude. Pensado para que el agente de Avatar 2 en LiveKit Cloud
// lo use UNA VEZ al iniciar cada llamada, en vez de pasar por Vercel en cada
// respuesta como antes -- seguimos con una sola fuente de verdad del contenido
// (este archivo sigue viviendo solo aqui, igual que siempre), pero sin el viaje
// de ida y vuelta completo (LiveKit -> Vercel -> Claude -> Vercel -> LiveKit)
// repetido en cada mensaje.
const SYSTEM_PROMPT = require('../systemPrompt.js');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
          res.status(405).json({ error: 'Metodo no permitido' });
          return;
    }

    // Mismo secreto que ya usa el endpoint de chat de Spatius, para que solo
    // nuestro propio agente pueda leer el documento, no cualquiera.
    const sharedSecret = process.env.SPATIUS_LLM_SHARED_SECRET;
    const authHeader = req.headers['authorization'] || '';
    if (sharedSecret && authHeader !== `Bearer ${sharedSecret}`) {
          res.status(401).json({ error: 'No autorizado' });
          return;
    }

    res.status(200).json({ systemPrompt: SYSTEM_PROMPT });
};
