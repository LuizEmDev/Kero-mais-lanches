import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
import { useRoom } from './socket.js'
import { sessions, local } from './local.js'

/** Pedido compartilhado em tempo real + a identidade deste aparelho dentro dele. */
export function useSharedOrder(code) {
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [session, setSession] = useState(() => (code ? sessions.get(code) : null))

  const load = useCallback(() => {
    if (!code) return
    api(`/orders/${code}`).then((o) => { setOrder(o); setError(null) }).catch((e) => setError(e))
  }, [code])

  useEffect(() => { setSession(code ? sessions.get(code) : null); setOrder(null); load() }, [code, load])
  useRoom(code ? `order:${code}` : null, { order: (o) => setOrder(o), connect: load })

  const me = order && session ? order.participants.find((p) => p.id === session.id) || null : null

  const join = useCallback(async (name, extra = {}) => {
    const r = await api(`/orders/${code}/participants`, { body: { name, device_id: local.get().deviceId, ...extra } })
    sessions.save(code, r.participant)
    setSession(r.participant)
    setOrder(r.order)
    return r.participant
  }, [code])

  /** Ações do participante: o servidor devolve o pedido atualizado. */
  const act = useCallback(async (path, body = {}) => {
    const o = await api(`/orders/${code}${path}`, { body: { ...body, token: session?.token } })
    if (o?.code) setOrder(o)
    return o
  }, [code, session])

  const pay = useCallback(async (participant_ids) => {
    const r = await api(`/orders/${code}/payments`, { body: { participant_ids, token: session?.token } })
    setOrder(r.order)
    return r.payment_id
  }, [code, session])

  return { order, error, me, session, join, act, pay, reload: load }
}
