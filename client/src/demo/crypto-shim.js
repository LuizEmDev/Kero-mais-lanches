// Substitui "node:crypto" no navegador (só o que o servidor usa).
const bytes = (n) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return b }
export function randomBytes(n) {
  const b = bytes(n)
  return {
    toString(enc) {
      if (enc === 'hex') return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
      const s = btoa(String.fromCharCode(...b))
      return enc === 'base64url' ? s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : s
    },
  }
}
export function randomInt(max) { return Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * max) }
export const randomUUID = () => crypto.randomUUID()
export function createHmac() { throw new Error('Indisponível na demonstração') }
export const timingSafeEqual = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
export default { randomBytes, randomInt, randomUUID, createHmac, timingSafeEqual }
