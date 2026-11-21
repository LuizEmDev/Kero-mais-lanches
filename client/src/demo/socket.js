// Socket de mentira para a demonstração: entrega os eventos do "servidor" (que roda
// nesta página) e de outras abas do mesmo navegador, via BroadcastChannel.
const listeners = new Map()
const rooms = new Map()
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('kero-demo') : null

export const fakeSocket = {
  connected: true,
  on(ev, f) { if (!listeners.has(ev)) listeners.set(ev, new Set()); listeners.get(ev).add(f); return this },
  off(ev, f) { listeners.get(ev)?.delete(f); return this },
  emit(ev, data = {}) {
    if (ev === 'join') rooms.set(data.room, (rooms.get(data.room) || 0) + 1)
    if (ev === 'leave') { const n = (rooms.get(data.room) || 1) - 1; n > 0 ? rooms.set(data.room, n) : rooms.delete(data.room) }
    return this
  },
}

function deliver(room, ev, payload) {
  if (!rooms.has(room)) return
  listeners.get(ev)?.forEach((f) => { try { f(payload) } catch (e) { console.error(e) } })
}

/** "io" usado pelo servidor da demonstração (server/bus.js). */
export function fakeIO(flush) {
  return {
    to: (room) => ({
      emit(ev, payload) {
        setTimeout(() => deliver(room, ev, payload), 0)
        flush()
        channel?.postMessage({ room, ev, payload })
      },
    }),
  }
}

export function listenOtherTabs(onRemote) {
  if (!channel) return
  channel.onmessage = ({ data }) => { onRemote(); deliver(data.room, data.ev, data.payload) }
}
