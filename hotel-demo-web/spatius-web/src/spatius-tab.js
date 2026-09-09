import { AvatarPlayer, LiveKitProvider } from '@spatius/avatarkit-rtc'
import { AvatarSDK, AvatarView, AvatarManager, DrivingServiceMode } from '@spatius/avatarkit'

const SPATIUS_APP_ID = 'app_mtt391z9_10etzfs'
const SPATIUS_AVATAR_ID = '8b86dda1-98ed-4acd-8a4e-b1a00ba69268'

let session = null
export function mountSpatiusTab({ container, frameEl, startBtn, statusEl }) {
  startBtn.addEventListener('click', () => {
    if (session) {
      stopAvatar(statusEl, startBtn, frameEl)
    } else {
      startAvatar(container, statusEl, startBtn, frameEl)
    }
  })
}
async function startAvatar(container, statusEl, startBtn, frameEl) {
  startBtn.disabled = true
  statusEl.textContent = 'Conectando con Coral...'
  try {
    const res = await fetch('/api/spatius/token', { method: 'POST' })
    if (!res.ok) throw new Error('No se pudo obtener el token de LiveKit')
    const { url, token, roomName } = await res.json()
    await AvatarSDK.initialize(SPATIUS_APP_ID, { drivingServiceMode: DrivingServiceMode.rtc })
    const avatar = await AvatarManager.shared.load(SPATIUS_AVATAR_ID)
    const avatarView = new AvatarView(avatar, container)
    const provider = new LiveKitProvider()
    const player = new AvatarPlayer(provider, avatarView)
    await player.connect({ url, token, roomName })
    await player.startPublishing()
    session = {
      player,
      async dispose() {
        await player.stopPublishing()
        await player.disconnect()
        avatarView.dispose()
      },
    }
    statusEl.textContent = 'Conversacion en curso'
    startBtn.textContent = 'Terminar'
    startBtn.className = 'call-btn end'
    frameEl.classList.add('live')
  } catch (err) {
    console.error('Error iniciando avatar de Spatius:', err)
    statusEl.textContent = 'No se pudo conectar con el avatar.'
  } finally {
    startBtn.disabled = false
  }
}
async function stopAvatar(statusEl, startBtn, frameEl) {
  if (session) {
    await session.dispose()
    session = null
  }
  statusEl.textContent = 'Toca para hablar con Coral'
  startBtn.textContent = 'Iniciar videollamada'
  startBtn.className = 'call-btn start'
  frameEl.classList.remove('live')
}
