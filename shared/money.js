// Valores sempre em centavos (inteiros) para não acumular erro de ponto flutuante.
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatBRL(cents) {
  return brl.format((cents || 0) / 100)
}

/** Divide `amount` centavos entre `ids`, distribuindo o resto 1 centavo por vez. */
export function distribute(amount, ids) {
  const out = {}
  const n = ids.length
  if (!n) return out
  const base = Math.floor(amount / n)
  let rest = amount - base * n
  for (const id of ids) {
    out[id] = base + (rest > 0 ? 1 : 0)
    if (rest > 0) rest--
  }
  return out
}
