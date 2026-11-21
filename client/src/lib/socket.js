import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { staffToken } from './local.js'
import { fakeSocket } from '../demo/socket.js'

let socket = null
export function getSocket() {
  if (!socket) socket = import.meta.env.VITE_STATIC_DEMO ? fakeSocket : io({ transports: ['websocket', 'polling'] })
  return socket
}

/** Entra numa sala e escuta eventos. Reentra automaticamente se a conexão cair. */
export function useRoom(room, handlers) {
  const ref = useRef(handlers)
  ref.current = handlers
  useEffect(() => {
    if (!room) return
    const s = getSocket()
    const join = () => s.emit('join', { room, token: room === 'staff' ? staffToken() : undefined })
    join()
    s.on('connect', join)
    const names = Object.keys(ref.current)
    const bound = names.map((n) => [n, (...a) => ref.current[n]?.(...a)])
    bound.forEach(([n, f]) => s.on(n, f))
    return () => {
      s.emit('leave', { room })
      s.off('connect', join)
      bound.forEach(([n, f]) => s.off(n, f))
    }
  }, [room])
}
