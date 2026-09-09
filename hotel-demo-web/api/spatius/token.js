const { AccessToken } = require('livekit-server-sdk')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const livekitUrl = process.env.LIVEKIT_URL
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    if (!livekitUrl || !apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Faltan variables de entorno de LiveKit en Vercel' })
    }
    const roomName = `coral-spatius-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const identity = `guest-${Math.random().toString(36).slice(2, 10)}`
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: '10m',
    })
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    })
    const token = await at.toJwt()
    return res.status(200).json({ token, url: livekitUrl, roomName })
  } catch (err) {
    console.error('Error generando token de Spatius:', err)
    return res.status(500).json({ error: 'No se pudo generar el token' })
  }
}
