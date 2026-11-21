import express from 'express'
import { db, getSetting, setSetting } from './db.js'
import * as O from './orders.js'
import { HttpError } from './orders.js'
import { checkPin, requireStaff } from './auth.js'
import { dashboard } from './stats.js'
import { mercadoPagoEnabled, mpGetStatus, mpVerifySignature } from './pix.js'
import { toStaff, toRoom } from './bus.js'

export const DEMO = process.env.DEMO_MODE !== 'false'
const api = express.Router()
api.use(express.json({ limit: '100kb' }))

const productRow = (p) => ({ ...p, tags: JSON.parse(p.tags), available: Boolean(p.available) })
const publicBase = () => process.env.PUBLIC_URL?.replace(/\/$/, '')

// ---------- público ----------

api.get('/config', (_req, res) => {
  const s = getSetting('store')
  res.json({
    name: s.name, delivery_fee: s.delivery_fee, service_pct: s.service_pct, prep_minutes: s.prep_minutes,
    address: s.address, phone: s.phone, hours: s.hours,
    demo: DEMO, pix_provider: mercadoPagoEnabled() ? 'mercadopago' : 'estatico', pix_ready: mercadoPagoEnabled() || Boolean(s.pix_key || process.env.PIX_KEY),
  })
})

api.get('/menu', (_req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY position, id').all().map(productRow))
})

api.post('/orders', (req, res) => {
  const { channel, is_group, customer, participant, items } = req.body || {}
  const { order, participant: me } = O.createOrder({ channel, is_group, customer, participant, items })
  O.notify(order, 'order:new')
  res.status(201).json({ order: O.publicOrder(O.loadOrder(order.id)), participant: me })
})

api.get('/orders/:code', (req, res) => {
  res.json(O.publicOrder(O.loadOrder(req.params.code)))
})

const withOrder = (fn) => async (req, res) => {
  const order = O.loadOrder(req.params.code)
  const me = O.authParticipant(order, req.body?.token)
  const kind = (await fn(order, me, req)) || 'order'
  const fresh = O.notify(order, kind)
  res.json(O.publicOrder(fresh))
}

api.post('/orders/:code/participants', (req, res) => {
  const order = O.loadOrder(req.params.code)
  if (order.channel === 'mesa') O.tableByToken(order.table_number, req.body?.table_token)
  const me = O.joinOrder(order, req.body || {})
  const fresh = O.notify(order)
  res.json({ participant: me, order: O.publicOrder(fresh) })
})

api.post('/orders/:code/items', withOrder((o, me, req) => O.addItems(o, me, req.body.items)))
api.post('/orders/:code/items/:id/delete', withOrder((o, me, req) => { O.removeItem(o, me, req.params.id) }))
api.post('/orders/:code/items/:id/shares', withOrder((o, _me, req) => { O.setShares(o, req.params.id, req.body.shares) }))
api.post('/orders/:code/split', withOrder((o, _me, req) => { O.setSplitMode(o, req.body.mode) }))
api.post('/orders/:code/service', withOrder((o, _me, req) => { O.setService(o, Boolean(req.body.on)) }))
api.post('/orders/:code/close', withOrder((o, me) => { O.closeOrder(o, me) }))
api.post('/orders/:code/reopen', withOrder((o) => { O.reopenOrder(o) }))

api.post('/orders/:code/payments', async (req, res) => {
  const order = O.loadOrder(req.params.code)
  const me = O.authParticipant(order, req.body?.token)
  const id = await O.createPayment(order, req.body.participant_ids, me.name, publicBase())
  const fresh = O.notify(order, 'payment')
  res.status(201).json({ payment_id: id, order: O.publicOrder(fresh) })
})

api.get('/payments/:id', async (req, res) => {
  const p = db.prepare('SELECT * FROM payments WHERE public_id = ?').get(req.params.id)
  if (!p) throw new HttpError(404, 'Pagamento não encontrado.')
  if (p.status === 'pendente' && p.provider === 'mercadopago' && p.provider_id) {
    const st = await mpGetStatus(p.provider_id).catch(() => null)
    if (st?.status === 'approved') O.notify(O.markPaid(p.public_id, 'provedor'), 'payment')
  }
  const fresh = db.prepare('SELECT status, paid_at FROM payments WHERE id = ?').get(p.id)
  res.json(fresh)
})

api.post('/payments/:id/simulate', (req, res) => {
  if (!DEMO) throw new HttpError(404, 'Indisponível.')
  const order = O.markPaid(req.params.id, 'demo')
  O.notify(order, 'payment')
  res.json({ ok: true })
})

// Webhook do Mercado Pago: confirma o Pix sem ninguém precisar olhar o extrato.
api.post('/webhooks/mercadopago', async (req, res) => {
  const dataId = req.query['data.id'] || req.body?.data?.id
  const type = req.query.type || req.body?.type
  if (!mpVerifySignature({ signature: req.get('x-signature'), requestId: req.get('x-request-id'), dataId })) {
    return res.status(401).json({ error: 'assinatura inválida' })
  }
  if (type === 'payment' && dataId && mercadoPagoEnabled()) {
    const st = await mpGetStatus(dataId)
    if (st.status === 'approved' && st.externalReference) {
      try { O.notify(O.markPaid(st.externalReference, 'provedor'), 'payment') } catch (e) { if (e.status !== 404) throw e }
    }
  }
  res.json({ ok: true })
})

// ---------- mesa ----------

api.post('/tables/:n/session', (req, res) => {
  const t = O.tableByToken(req.params.n, req.body?.table_token)
  const order = O.tableOrder(t.number, { create: true })
  res.json({ table: { number: t.number, seats: t.seats }, code: order.code })
})

api.post('/tables/:n/calls', (req, res) => {
  const t = O.tableByToken(req.params.n, req.body?.table_token)
  const reason = req.body?.reason
  if (!['atendimento', 'conta', 'talheres', 'limpeza'].includes(reason)) throw new HttpError(400, 'Escolha o motivo do chamado.')
  const order = O.tableOrder(t.number)
  O.createCall(t.number, order, reason, req.body?.name)
  if (order) O.notify(order, 'call:new')
  else toStaff('call:new', { table: t.number })
  res.json({ ok: true })
})

// ---------- equipe ----------

api.post('/staff/login', (req, res) => {
  res.json({ token: checkPin(req.ip, req.body?.pin) })
})

const staff = express.Router()
staff.use(requireStaff)

staff.get('/dashboard', (req, res) => res.json(dashboard(req.query.range)))

const orderSummary = (o) => ({
  code: o.code, channel: o.channel, table_number: o.table_number, status: o.status, is_group: o.is_group,
  customer: o.customer, created_at: o.created_at, updated_at: o.updated_at,
  people: o.participants.length, items: o.items.reduce((s, i) => s + i.qty, 0),
  total: o.split.total, paid: o.split.paid, due: o.split.due,
  pending_payments: o.payments.filter((p) => p.status === 'pendente').map((p) => ({ id: p.public_id, amount: p.amount, payer_name: p.payer_name, created_at: p.created_at })),
})

staff.get('/orders', (req, res) => {
  const view = req.query.view || 'ativos'
  let rows
  if (view === 'ativos') {
    rows = db.prepare(`SELECT id FROM orders WHERE status NOT IN ('finalizado','entregue','cancelado')
      AND (status != 'aberto' OR channel = 'mesa' OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = orders.id)) ORDER BY created_at DESC LIMIT 200`).all()
  } else {
    const since = view === 'hoje' ? new Date().setHours(0, 0, 0, 0) : Date.now() - 30 * 86400000
    rows = db.prepare('SELECT id FROM orders WHERE created_at >= ? ORDER BY created_at DESC LIMIT 300').all(since)
  }
  res.json(rows.map((r) => orderSummary(O.loadOrder(r.id))))
})

staff.get('/orders/:code', (req, res) => {
  const o = O.loadOrder(req.params.code)
  res.json({ ...O.publicOrder(o), customer: o.customer })
})

staff.post('/orders/:code/status', (req, res) => {
  const o = O.loadOrder(req.params.code)
  O.setOrderStatus(o, req.body?.status)
  res.json(O.publicOrder(O.notify(o)))
})

staff.post('/payments/:id/confirm', (req, res) => {
  const o = O.markPaid(req.params.id, 'equipe')
  res.json(O.publicOrder(O.notify(o, 'payment')))
})

staff.get('/tickets', (_req, res) => {
  const tickets = db.prepare(`SELECT t.*, o.code, o.channel, o.table_number, o.customer FROM tickets t JOIN orders o ON o.id = t.order_id
    WHERE (t.status != 'entregue' OR t.done_at > ?) AND o.status != 'cancelado' ORDER BY t.created_at`).all(Date.now() - 10 * 60000)
  const items = db.prepare(`SELECT i.ticket_id, i.name, i.qty, i.notes, p.name AS who FROM order_items i LEFT JOIN participants p ON p.id = i.added_by
    WHERE i.ticket_id IN (${tickets.map(() => '?').join(',') || 'NULL'})`).all(...tickets.map((t) => t.id))
  res.json(tickets.map((t) => ({
    id: t.id, round: t.round, status: t.status, created_at: t.created_at, started_at: t.started_at, ready_at: t.ready_at, done_at: t.done_at,
    code: t.code, channel: t.channel, table_number: t.table_number, customer_name: JSON.parse(t.customer).name || null,
    items: items.filter((i) => i.ticket_id === t.id),
  })))
})

staff.post('/tickets/:id/status', (req, res) => {
  const order = O.setTicketStatus(req.params.id, req.body?.status)
  O.notify(order, 'ticket')
  res.json({ ok: true })
})

staff.get('/tables', (_req, res) => {
  const tables = db.prepare('SELECT * FROM tables ORDER BY number').all()
  const calls = db.prepare("SELECT * FROM calls WHERE status = 'aberto' ORDER BY created_at").all()
  res.json(tables.map((t) => {
    const o = O.tableOrder(t.number)
    return {
      number: t.number, seats: t.seats, token: t.token,
      order: o ? orderSummary(o) : null,
      calls: calls.filter((c) => c.table_number === t.number),
    }
  }))
})

staff.post('/tables/:n/token', (req, res) => {
  const token = (globalThis.crypto.randomUUID().replace(/-/g, '')).slice(0, 8)
  db.prepare('UPDATE tables SET token = ? WHERE number = ?').run(token, Number(req.params.n))
  toStaff('tables')
  res.json({ token })
})

staff.get('/calls', (_req, res) => {
  res.json(db.prepare("SELECT * FROM calls WHERE status = 'aberto' OR resolved_at > ? ORDER BY created_at DESC").all(Date.now() - 30 * 60000))
})

staff.post('/calls/:id/resolve', (req, res) => {
  const c = db.prepare('SELECT * FROM calls WHERE id = ?').get(Number(req.params.id))
  if (!c) throw new HttpError(404, 'Chamado não encontrado.')
  db.prepare("UPDATE calls SET status = 'atendido', resolved_at = ? WHERE id = ?").run(Date.now(), c.id)
  if (c.order_id) O.notify(c.order_id, 'call:resolved')
  else toStaff('call:resolved')
  res.json({ ok: true })
})

staff.get('/products', (_req, res) => res.json(db.prepare('SELECT * FROM products ORDER BY position, id').all().map(productRow)))

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
  if (out.name === '') throw new HttpError(400, 'O nome não pode ficar vazio.')
  return out
}

staff.patch('/products/:id', (req, res) => {
  const f = productFields(req.body || {}, true)
  const keys = Object.keys(f)
  if (keys.length) db.prepare(`UPDATE products SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => f[k]), Number(req.params.id))
  toRoom('menu', 'menu', {})
  res.json(productRow(db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id))))
})

staff.post('/products', (req, res) => {
  const f = productFields(req.body || {}, false)
  const pos = db.prepare('SELECT COALESCE(MAX(position),0)+1 AS p FROM products').get().p
  const r = db.prepare('INSERT INTO products(name, description, category, price, art, available, position) VALUES (?,?,?,?,?,?,?)')
    .run(f.name, f.description || '', f.category, f.price, f.art || 'burger:classic', f.available ?? 1, pos)
  toRoom('menu', 'menu', {})
  res.status(201).json(productRow(db.prepare('SELECT * FROM products WHERE id = ?').get(Number(r.lastInsertRowid))))
})

staff.get('/settings', (_req, res) => res.json({ ...getSetting('store'), pix_provider: mercadoPagoEnabled() ? 'mercadopago' : 'estatico' }))

staff.patch('/settings', (req, res) => {
  const cur = getSetting('store')
  const b = req.body || {}
  const next = { ...cur }
  for (const k of ['name', 'pix_key', 'merchant_name', 'merchant_city', 'address', 'phone', 'hours']) if (b[k] !== undefined) next[k] = String(b[k]).trim().slice(0, 120)
  for (const k of ['delivery_fee', 'service_pct', 'prep_minutes']) if (b[k] !== undefined) {
    const v = Number(b[k]); if (!(v >= 0 && v <= 100000)) throw new HttpError(400, `Valor inválido em ${k}.`); next[k] = v
  }
  setSetting('store', next)
  res.json(next)
})

api.use('/staff', staff)

api.use((req, _res) => { throw new HttpError(404, 'Rota não encontrada.') })
api.use((err, _req, res, _next) => {
  if (!(err instanceof HttpError)) console.error(err)
  const status = err instanceof HttpError ? err.status : err.type === 'entity.parse.failed' ? 400 : 500
  res.status(status).json({ error: status === 500 ? 'Erro inesperado no servidor. Tente de novo.' : err.message })
})

export default api
