// "Conta local": tudo do cliente fica no próprio aparelho (localStorage), sem cadastro.
import { useSyncExternalStore } from 'react'

const KEY = 'kero:v1'
const listeners = new Set()

const empty = () => ({
  deviceId: (globalThis.crypto?.randomUUID?.() || String(Math.random()).slice(2) + Date.now()).replace(/-/g, ''),
  profile: { name: '', phone: '', email: '' },
  addresses: [],
  favorites: [],
  orders: [], // { code, channel, created_at, total, label }
  sessions: {}, // code -> { id, token, name }
  cart: [], // { key, product_id, qty, notes }
  staffToken: null,
  createdAt: Date.now(),
})

let memory = null
function read() {
  if (memory) return memory
  try {
    const raw = localStorage.getItem(KEY)
    memory = raw ? { ...empty(), ...JSON.parse(raw) } : empty()
  } catch {
    memory = empty()
  }
  if (!memory.deviceId) memory.deviceId = empty().deviceId
  return memory
}

function write(next) {
  memory = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* modo privado: segue só em memória */ }
  listeners.forEach((l) => l())
}

export const local = {
  get: read,
  update(fn) { const cur = read(); write({ ...cur, ...fn(cur) }) },
  reset() { const keep = read().deviceId; write({ ...empty(), deviceId: keep }) },
  subscribe(l) { listeners.add(l); return () => listeners.delete(l) },
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { memory = null; listeners.forEach((l) => l()) } })
}

export function useLocal(selector = (s) => s) {
  return selector(useSyncExternalStore(local.subscribe, read, read))
}

// ---- carrinho ----
const cartKey = (product_id, notes) => `${product_id}:${(notes || '').trim().toLowerCase()}`
export const cart = {
  add(product_id, qty = 1, notes = '') {
    local.update((s) => {
      const key = cartKey(product_id, notes)
      const found = s.cart.find((c) => c.key === key)
      return { cart: found ? s.cart.map((c) => (c.key === key ? { ...c, qty: Math.min(20, c.qty + qty) } : c)) : [...s.cart, { key, product_id, qty, notes: notes.trim() }] }
    })
  },
  setQty(key, qty) {
    local.update((s) => ({ cart: qty <= 0 ? s.cart.filter((c) => c.key !== key) : s.cart.map((c) => (c.key === key ? { ...c, qty: Math.min(20, qty) } : c)) }))
  },
  clear() { local.update(() => ({ cart: [] })) },
  set(items) { local.update(() => ({ cart: items.map((i) => ({ ...i, key: cartKey(i.product_id, i.notes) })) })) },
}

// ---- sessões em pedidos compartilhados ----
export const sessions = {
  get: (code) => read().sessions[code] || null,
  save(code, participant) { local.update((s) => ({ sessions: { ...s.sessions, [code]: participant } })) },
}

export function rememberOrder(entry) {
  local.update((s) => ({ orders: [entry, ...s.orders.filter((o) => o.code !== entry.code)].slice(0, 50) }))
}

export function toggleFavorite(id) {
  local.update((s) => ({ favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id] }))
}

export const staffToken = () => read().staffToken
export const setStaffToken = (t) => local.update(() => ({ staffToken: t }))
export const clearStaffToken = () => local.update(() => ({ staffToken: null }))
