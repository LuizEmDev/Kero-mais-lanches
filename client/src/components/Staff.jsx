import { useCallback, useEffect, useRef, useState } from 'react'
import { Logo } from './Brand.jsx'
import { api } from '../lib/api.js'
import { setStaffToken, useLocal } from '../lib/local.js'
import { useRoom } from '../lib/socket.js'

export function StaffGate({ children, title = 'Área da equipe' }) {
  const token = useLocal((s) => s.staffToken)
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  if (token) return children
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try { const r = await api('/staff/login', { body: { pin } }); setStaffToken(r.token) } catch (err) { setError(err.message); setPin('') }
    setBusy(false)
  }
  return (
    <div className="staff-gate">
      <form className="panel stack" onSubmit={submit}>
        <Logo size={40} />
        <h1 className="display">{title}</h1>
        <label className="field"><span>PIN da equipe</span>
          <input className="input pin-input num" type="password" inputMode="numeric" autoComplete="current-password" required autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))} />
        </label>
        {error && <p className="error-box" role="alert">{error}</p>}
        <button className="btn btn-red btn-lg btn-block" disabled={busy || !pin}>Entrar</button>
      </form>
    </div>
  )
}

/** Dados da equipe que se atualizam sozinhos quando algo muda na loja. */
export function useStaffData(path, { kinds, poll = 30000 } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const timer = useRef(null)
  const load = useCallback(() => {
    if (!path) return Promise.resolve()
    setLoading(true)
    return api(path, { staff: true }).then((d) => { setData(d); setError(null) }).catch(setError).finally(() => setLoading(false))
  }, [path])
  useEffect(() => { load(); const t = setInterval(load, poll); return () => clearInterval(t) }, [load, poll])
  useRoom('staff', {
    staff: (ev) => {
      if (kinds && !kinds.some((k) => ev.kind.startsWith(k))) return
      clearTimeout(timer.current)
      timer.current = setTimeout(load, 150)
    },
  })
  return { data, error, loading, reload: load, setData }
}

// Sons curtos gerados na hora (sem arquivos): dois tons para pedido novo, três para chamado.
let ctx = null
export function beep(pattern = [880, 1320]) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    pattern.forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      o.type = 'triangle'
      const t = ctx.currentTime + i * 0.18
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      o.connect(g).connect(ctx.destination)
      o.start(t); o.stop(t + 0.17)
    })
  } catch { /* sem áudio */ }
}
export const unlockAudio = () => { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume() } catch { /* */ } }
