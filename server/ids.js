import { randomBytes, randomInt } from 'node:crypto'

// Sem 0/O/1/I/L para o código ser fácil de ditar no balcão.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export function newCode(len = 6) {
  let s = ''
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return s
}
export const newToken = () => randomBytes(18).toString('base64url')
