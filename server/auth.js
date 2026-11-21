// Acesso da equipe (cozinha e admin) por PIN. O token é assinado com HMAC e vale 16 horas.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { getSetting, setSetting } from './db.js'
import { HttpError } from './orders.js'

const TTL = 16 * 3600000
function secret() {
  let s = process.env.SESSION_SECRET || getSetting('session_secret')
  if (!s) { s = randomBytes(32).toString('hex'); setSetting('session_secret', s) }
  return s
}
export const staffPin = () => process.env.STAFF_PIN || '1234'

const sign = (payload) => createHmac('sha256', secret()).update(payload).digest('base64url')

export function issueToken() {
  const payload = String(Date.now() + TTL)
  return `${payload}.${sign(payload)}`
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  const a = Buffer.from(sign(payload))
  const b = Buffer.from(sig)
  return a.length === b.length && timingSafeEqual(a, b) && Number(payload) > Date.now()
}

const attempts = new Map()
export function checkPin(ip, pin) {
  const t = Date.now()
  const rec = attempts.get(ip) || { n: 0, since: t }
  if (t - rec.since > 10 * 60000) { rec.n = 0; rec.since = t }
  if (rec.n >= 10) throw new HttpError(429, 'Muitas tentativas. Espere 10 minutos e tente de novo.')
  const a = Buffer.from(String(pin || ''))
  const b = Buffer.from(staffPin())
  const ok = a.length === b.length && timingSafeEqual(a, b)
  if (!ok) { rec.n++; attempts.set(ip, rec); throw new HttpError(401, 'PIN incorreto.') }
  attempts.delete(ip)
  return issueToken()
}

export function requireStaff(req, _res, next) {
  const token = (req.get('authorization') || '').replace(/^Bearer /, '')
  if (!verifyToken(token)) throw new HttpError(401, 'Entre com o PIN da equipe.')
  next()
}
