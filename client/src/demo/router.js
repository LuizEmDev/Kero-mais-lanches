// Servidor da demonstração: as mesmas rotas de server/api.js, atendidas dentro do
// navegador com a mesma regra de negócio (server/orders.js) e o mesmo banco (SQLite em WASM).
import { db, getSetting, setSetting } from '../../../server/db.js'
import * as O from '../../../server/orders.js'
import { HttpError } from '../../../server/orders.js'
import { dashboard } from '../../../server/stats.js'
import { toStaff, toRoom } from '../../../server/bus.js'

const STAFF_TOKEN = 'demo-equipe'
const PIN = '1234'
const routes = []
const on = (method, path, handler, staff = false) => {
  const keys = []
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)' }) + '$')
  routes.push({ method, re, keys, handler, staff })
}
const productRow = (p) => ({ ...p, tags: JSON.parse(p.tags), available: Boolean(p.available) })

// ---------- público ----------
on('GET', '/config', () => {
  const s = getSetting('store')
  return { name: s.name, delivery_fee: s.delivery_fee, service_pct: s.service_pct, prep_minutes: s.prep_minutes, address: s.address, phone: s.phone, hours: s.hours, demo: true, static_demo: true, pix_provider: 'estatico', pix_ready: true }
})
on('GET', '/menu', () => db.prepare('SELECT * FROM products ORDER BY position, id').all().map(productRow))
on('POST', '/orders', ({ body }) => {
  const { order, participant } = O.createOrder(body || {})
  O.notify(order, 'order:new')
  return { order: O.publicOrder(O.loadOrder(order.id)), participant }
})
on('GET', '/orders/:code', ({ params }) => O.publicOrder(O.loadOrder(params.code)))
on('POST', '/orders/:code/participants', ({ params, body }) => {
  const order = O.loadOrder(params.code)
  if (order.channel === 'mesa') O.tableByToken(order.table_number, body?.table_token)
  const me = O.joinOrder(order, body || {})
  return { participant: me, order: O.publicOrder(O.notify(order)) }
})
const withOrder = (fn) => async ({ params, body }) => {
  const order = O.loadOrder(params.code)
  const me = O.authParticipant(order, body?.token)
  const kind = (await fn(order, me, { params, body })) || 'order'
  return O.publicOrder(O.notify(order, kind))
}
on('POST', '/orders/:code/items', withOrder((o, me, r) => O.addItems(o, me, r.body.items)))
on('POST', '/orders/:code/items/:id/delete', withOrder((o, me, r) => { O.removeItem(o, me, r.params.id) }))
on('POST', '/orders/:code/items/:id/shares', withOrder((o, _me, r) => { O.setShares(o, r.params.id, r.body.shares) }))
on('POST', '/orders/:code/split', withOrder((o, _me, r) => { O.setSplitMode(o, r.body.mode) }))
on('POST', '/orders/:code/service', withOrder((o, _me, r) => { O.setService(o, Boolean(r.body.on)) }))
on('POST', '/orders/:code/close', withOrder((o, me) => { O.closeOrder(o, me) }))
on('POST', '/orders/:code/reopen', withOrder((o) => { O.reopenOrder(o) }))
on('POST', '/orders/:code/payments', async ({ params, body }) => {
  const order = O.loadOrder(params.code)
  const me = O.authParticipant(order, body?.token)
  const id = await O.createPayment(order, body.participant_ids, me.name)
  return { payment_id: id, order: O.publicOrder(O.notify(order, 'payment')) }
})
on('GET', '/payments/:id', ({ params }) => {
  const p = db.prepare('SELECT status, paid_at FROM payments WHERE public_id = ?').get(params.id)
  if (!p) throw new HttpError(404, 'Pagamento não encontrado.')
  return p
})
on('POST', '/payments/:id/simulate', ({ params }) => { O.notify(O.markPaid(params.id, 'demo'), 'payment'); return { ok: true } })
on('POST', '/tables/:n/session', ({ params, body }) => {
  const t = O.tableByToken(params.n, body?.table_token)
  return { table: { number: t.number, seats: t.seats }, code: O.tableOrder(t.number, { create: true }).code }
})
on('POST', '/tables/:n/calls', ({ params, body }) => {
  const t = O.tableByToken(params.n, body?.table_token)
  if (!['atendimento', 'conta', 'talheres', 'limpeza'].includes(body?.reason)) throw new HttpError(400, 'Escolha o motivo do chamado.')
  const order = O.tableOrder(t.number)
  O.createCall(t.number, order, body.reason, body?.name)
  if (order) O.notify(order, 'call:new')
  else toStaff('call:new', { table: t.number })
  return { ok: true }
})
on('POST', '/staff/login', ({ body }) => {
  if (String(body?.pin) !== PIN) throw new HttpError(401, 'PIN incorreto. Na demonstração o PIN é 1234.')
  return { token: STAFF_TOKEN }
})

// ---------- equipe ----------
on('GET', '/staff/dashboard', ({ query }) => dashboard(query.range), true)
const orderSummary = (o) => ({
  code: o.code, channel: o.channel, table_number: o.table_number, status: o.status, is_group: o.is_group,
  customer: o.customer, created_at: o.created_at, updated_at: o.updated_at,
  people: o.participants.length, items: o.items.reduce((s, i) => s + i.qty, 0),
  total: o.split.total, paid: o.split.paid, due: o.split.due,
  pending_payments: o.payments.filter((p) => p.status === 'pendente').map((p) => ({ id: p.public_id, amount: p.amount, payer_name: p.payer_name, created_at: p.created_at })),
})
on('GET', '/staff/orders', ({ query }) => {
  const view = query.view || 'ativos'
  let rows
  if (view === 'ativos') {
    rows = db.prepare(`SELECT id FROM orders WHERE status NOT IN ('finalizado','entregue','cancelado')
      AND (status != 'aberto' OR channel = 'mesa' OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = orders.id)) ORDER BY created_at DESC LIMIT 200`).all()
  } else {
    const since = view === 'hoje' ? new Date().setHours(0, 0, 0, 0) : Date.now() - 30 * 86400000
    rows = db.prepare('SELECT id FROM orders WHERE created_at >= ? ORDER BY created_at DESC LIMIT 300').all(since)
  }
  return rows.map((r) => orderSummary(O.loadOrder(r.id)))
}, true)
on('GET', '/staff/orders/:code', ({ params }) => { const o = O.loadOrder(params.code); return { ...O.publicOrder(o), customer: o.customer } }, true)
on('POST', '/staff/orders/:code/status', ({ params, body }) => { const o = O.loadOrder(params.code); O.setOrderStatus(o, body?.status); return O.publicOrder(O.notify(o)) }, true)
on('POST', '/staff/payments/:id/confirm', ({ params }) => O.publicOrder(O.notify(O.markPaid(params.id, 'equipe'), 'payment')), true)
on('GET', '/staff/tickets', () => {
  const tickets = db.prepare(`SELECT t.*, o.code, o.channel, o.table_number, o.customer FROM tickets t JOIN orders o ON o.id = t.order_id
    WHERE (t.status != 'entregue' OR t.done_at > ?) AND o.status != 'cancelado' ORDER BY t.created_at`).all(Date.now() - 10 * 60000)
  const items = tickets.length ? db.prepare(`SELECT i.ticket_id, i.name, i.qty, i.notes, p.name AS who FROM order_items i LEFT JOIN participants p ON p.id = i.added_by
    WHERE i.ticket_id IN (${tickets.map(() => '?').join(',')})`).all(...tickets.map((t) => t.id)) : []
  return tickets.map((t) => ({
    id: t.id, round: t.round, status: t.status, created_at: t.created_at, started_at: t.started_at, ready_at: t.ready_at, done_at: t.done_at,
    code: t.code, channel: t.channel, table_number: t.table_number, customer_name: JSON.parse(t.customer).name || null,
    items: items.filter((i) => i.ticket_id === t.id),
  }))
}, true)
on('POST', '/staff/tickets/:id/status', ({ params, body }) => { O.notify(O.setTicketStatus(params.id, body?.status), 'ticket'); return { ok: true } }, true)
on('GET', '/staff/tables', () => {
  const calls = db.prepare("SELECT * FROM calls WHERE status = 'aberto' ORDER BY created_at").all()
  return db.prepare('SELECT * FROM tables ORDER BY number').all().map((t) => {
    const o = O.tableOrder(t.number)
    return { number: t.number, seats: t.seats, token: t.token, order: o ? orderSummary(o) : null, calls: calls.filter((c) => c.table_number === t.number) }
  })
}, true)
on('POST', '/staff/tables/:n/token', ({ params }) => {
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  db.prepare('UPDATE tables SET token = ? WHERE number = ?').run(token, Number(params.n))
  toStaff('tables')
  return { token }
}, true)
on('GET', '/staff/calls', () => db.prepare("SELECT * FROM calls WHERE status = 'aberto' OR resolved_at > ? ORDER BY created_at DESC").all(Date.now() - 30 * 60000), true)
on('POST', '/staff/calls/:id/resolve', ({ params }) => {
  const c = db.prepare('SELECT * FROM calls WHERE id = ?').get(Number(params.id))
  if (!c) throw new HttpError(404, 'Chamado não encontrado.')
  db.prepare("UPDATE calls SET status = 'atendido', resolved_at = ? WHERE id = ?").run(Date.now(), c.id)
  if (c.order_id) O.notify(c.order_id, 'call:resolved')
  else toStaff('call:resolved')
  return { ok: true }
}, true)
on('GET', '/staff/products', () => db.prepare('SELECT * FROM products ORDER BY position, id').all().map(productRow), true)
const CATEGORIES = ['lanches', 'dogs', 'porcoes', 'bebidas', 'sobremesas']
function productFields(b, partial) {
  const out = {}
  if (b.name !== undefined) out.name = String(b.name).trim().slice(0, 60)
  if (b.description !== undefined) out.description = String(b.description).trim().slice(0, 240)
  if (b.price !== undefined) { out.price = Math.round(Number(b.price)); if (!(out.price > 0 && out.price < 100000)) throw new HttpError(400, 'Preço inválido.') }
  if (b.category !== undefined) { if (!CATEGORIES.includes(b.category)) throw new HttpError(400, 'Categoria inválida.'); out.category = b.category }
  if (b.available !== undefined) out.available = b.available ? 1 : 0
  if (b.art !== undefined) out.art = String(b.art).slice(0, 30)
  if (!partial && (!out.name || !out.price || !out.category)) throw new HttpError(400, 'Nome, preço e categoria são obrigatórios.')
  return out
}
on('PATCH', '/staff/products/:id', ({ params, body }) => {
  const f = productFields(body || {}, true)
  const keys = Object.keys(f)
  if (keys.length) db.prepare(`UPDATE products SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => f[k]), Number(params.id))
  toRoom('menu', 'menu', {})
  return productRow(db.prepare('SELECT * FROM products WHERE id = ?').get(Number(params.id)))
}, true)
on('POST', '/staff/products', ({ body }) => {
  const f = productFields(body || {}, false)
  const pos = db.prepare('SELECT COALESCE(MAX(position),0)+1 AS p FROM products').get().p
  const r = db.prepare('INSERT INTO products(name, description, category, price, art, available, position) VALUES (?,?,?,?,?,?,?)')
    .run(f.name, f.description || '', f.category, f.price, f.art || 'burger:classic', f.available ?? 1, pos)
  toRoom('menu', 'menu', {})
  return productRow(db.prepare('SELECT * FROM products WHERE id = ?').get(Number(r.lastInsertRowid)))
}, true)
// Na demonstração a foto fica guardada no próprio banco do navegador.
on('PUT', '/staff/products/:id/image', async ({ params, body }) => {
  if (!(body instanceof Blob) || !body.type.startsWith('image/')) throw new HttpError(400, 'Envie uma foto em JPG, PNG ou WebP.')
  if (body.size > 600000) throw new HttpError(400, 'Foto grande demais para a demonstração.')
  const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(body) })
  db.prepare('UPDATE products SET image = ? WHERE id = ?').run(url, Number(params.id))
  toRoom('menu', 'menu', {})
  return productRow(db.prepare('SELECT * FROM products WHERE id = ?').get(Number(params.id)))
}, true)
on('DELETE', '/staff/products/:id/image', ({ params }) => {
  db.prepare('UPDATE products SET image = NULL WHERE id = ?').run(Number(params.id))
  toRoom('menu', 'menu', {})
  return productRow(db.prepare('SELECT * FROM products WHERE id = ?').get(Number(params.id)))
}, true)
on('GET', '/staff/settings', () => ({ ...getSetting('store'), pix_provider: 'estatico' }), true)
on('PATCH', '/staff/settings', ({ body }) => {
  const next = { ...getSetting('store') }
  for (const k of ['name', 'pix_key', 'merchant_name', 'merchant_city', 'address', 'phone', 'hours']) if (body?.[k] !== undefined) next[k] = String(body[k]).trim().slice(0, 120)
  for (const k of ['delivery_fee', 'service_pct', 'prep_minutes']) if (body?.[k] !== undefined) {
    const v = Number(body[k]); if (!(v >= 0 && v <= 100000)) throw new HttpError(400, `Valor inválido em ${k}.`); next[k] = v
  }
  setSetting('store', next)
  return next
}, true)

/** Atende uma chamada à API como se fosse o servidor. Devolve { status, data }. */
export async function handle(method, url, { body, headers = {} } = {}) {
  const u = new URL(url, 'http://demo')
  const path = u.pathname.replace(/^\/api/, '')
  for (const r of routes) {
    if (r.method !== method) continue
    const m = path.match(r.re)
    if (!m) continue
    try {
      if (r.staff && (headers.Authorization || headers.authorization) !== `Bearer ${STAFF_TOKEN}`) throw new HttpError(401, 'Entre com o PIN da equipe.')
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]))
      const data = await r.handler({ params, body, query: Object.fromEntries(u.searchParams), headers })
      return { status: method === 'POST' && path === '/orders' ? 201 : 200, data }
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e)
      return { status: e instanceof HttpError ? e.status : 500, data: { error: e instanceof HttpError ? e.message : 'Erro inesperado. Tente de novo.' } }
    }
  }
  return { status: 404, data: { error: 'Rota não encontrada.' } }
}
