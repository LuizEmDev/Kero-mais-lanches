import { randomBytes } from 'node:crypto'
import { db, tx, getSetting } from './db.js'
import { newCode, newToken } from './ids.js'
import { computeSplit } from '../shared/split.js'
import { buildBrCode, mercadoPagoEnabled, mpCreatePix } from './pix.js'
import { toRoom, toStaff } from './bus.js'

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

const now = () => Date.now()
const PAYMENT_TTL = 30 * 60000
const OPEN_TABLE = ['aberto', 'aguardando_pagamento']

// ---------- leitura ----------

export function loadOrder(ref) {
  const row = typeof ref === 'number'
    ? db.prepare('SELECT * FROM orders WHERE id = ?').get(ref)
    : db.prepare('SELECT * FROM orders WHERE code = ?').get(String(ref).toUpperCase())
  if (!row) throw new HttpError(404, 'Pedido não encontrado. Confira o código.')

  db.prepare("UPDATE payments SET status = 'expirado' WHERE order_id = ? AND status = 'pendente' AND expires_at < ?").run(row.id, now())

  const participants = db.prepare('SELECT id, name, is_host, device_id, token, created_at FROM participants WHERE order_id = ? ORDER BY id').all(row.id)
  const tickets = db.prepare('SELECT * FROM tickets WHERE order_id = ? ORDER BY round').all(row.id)
  const tStatus = Object.fromEntries(tickets.map((t) => [t.id, t.status]))
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').all(row.id).map((i) => ({
    ...i,
    shares: JSON.parse(i.shares),
    status: i.ticket_id ? tStatus[i.ticket_id] : 'pendente',
  }))
  const payments = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id').all(row.id).map((p) => ({ ...p, allocations: JSON.parse(p.allocations) }))
  const calls = row.table_number
    ? db.prepare("SELECT * FROM calls WHERE order_id = ? AND (status = 'aberto' OR resolved_at > ?) ORDER BY id").all(row.id, now() - 5 * 60000)
    : []
  const order = { ...row, is_group: Boolean(row.is_group), customer: JSON.parse(row.customer), participants, tickets, items, payments, calls }
  order.split = computeSplit(order)
  return order
}

/** Versão do pedido que pode ir para qualquer pessoa com o código (sem tokens). */
export function publicOrder(o) {
  return {
    code: o.code,
    channel: o.channel,
    is_group: o.is_group,
    table_number: o.table_number,
    status: o.status,
    split_mode: o.split_mode,
    service_pct: o.service_pct,
    delivery_fee: o.delivery_fee,
    customer: { name: o.customer.name, address: o.customer.address ? { bairro: o.customer.address.bairro } : undefined },
    created_at: o.created_at,
    updated_at: o.updated_at,
    paid_at: o.paid_at,
    participants: o.participants.map(({ id, name, is_host }) => ({ id, name, is_host: Boolean(is_host) })),
    tickets: o.tickets.map(({ id, round, status, created_at, started_at, ready_at, done_at }) => ({ id, round, status, created_at, started_at, ready_at, done_at })),
    items: o.items.map(({ id, product_id, name, unit_price, qty, notes, added_by, shares, status, ticket_id, created_at }) => ({ id, product_id, name, unit_price, qty, notes, added_by, shares, status, ticket_id, created_at })),
    payments: o.payments.map(({ public_id, amount, allocations, payer_name, status, provider, brcode, qr_base64, created_at, expires_at, paid_at }) =>
      ({ id: public_id, amount, allocations, payer_name, status, provider, brcode, qr_base64, created_at, expires_at, paid_at })),
    calls: o.calls.map(({ id, reason, requested_by, status, created_at, resolved_at }) => ({ id, reason, requested_by, status, created_at, resolved_at })),
    split: o.split,
    prep_minutes: getSetting('store').prep_minutes,
  }
}

export function notify(orderOrId, kind = 'order') {
  const o = typeof orderOrId === 'object' ? loadOrder(orderOrId.id) : loadOrder(orderOrId)
  toRoom(`order:${o.code}`, 'order', publicOrder(o))
  if (o.table_number) toRoom(`table:${o.table_number}`, 'table', { code: o.code, status: o.status })
  toStaff(kind, { code: o.code })
  return o
}

// ---------- participantes ----------

export function authParticipant(order, token) {
  const p = token && order.participants.find((x) => x.token === token)
  if (!p) throw new HttpError(403, 'Entre no pedido com seu nome antes de continuar.')
  return p
}

export function joinOrder(order, { name, device_id }) {
  const clean = String(name || '').trim().slice(0, 30)
  if (!clean) throw new HttpError(400, 'Digite seu nome para entrar no pedido.')
  if (!device_id || String(device_id).length < 8) throw new HttpError(400, 'Identificador do aparelho ausente.')
  const existing = order.participants.find((p) => p.device_id === device_id)
  if (existing) {
    if (existing.name !== clean) db.prepare('UPDATE participants SET name = ? WHERE id = ?').run(clean, existing.id)
    return { id: existing.id, name: clean, token: existing.token }
  }
  if (['finalizado', 'cancelado', 'entregue'].includes(order.status)) throw new HttpError(409, 'Este pedido já foi encerrado.')
  if (order.participants.length >= 20) throw new HttpError(409, 'Este pedido já tem 20 pessoas.')
  const token = newToken()
  const r = db.prepare('INSERT INTO participants(order_id, name, device_id, token, is_host, created_at) VALUES (?,?,?,?,?,?)')
    .run(order.id, clean, device_id, token, order.participants.length ? 0 : 1, now())
  touch(order.id)
  return { id: Number(r.lastInsertRowid), name: clean, token }
}

// ---------- itens ----------

function validateItems(order, raw) {
  if (!Array.isArray(raw) || !raw.length) throw new HttpError(400, 'Adicione pelo menos um item.')
  if (raw.length > 40) throw new HttpError(400, 'Muitos itens de uma vez.')
  const pids = new Set(order.participants.map((p) => p.id))
  return raw.map((it) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(it.product_id))
    if (!product) throw new HttpError(400, 'Um dos itens não existe mais no cardápio.')
    if (!product.available) throw new HttpError(409, `${product.name} acabou por hoje. Remova do carrinho para continuar.`)
    const qty = Math.trunc(Number(it.qty))
    if (!(qty >= 1 && qty <= 20)) throw new HttpError(400, 'Quantidade deve ser entre 1 e 20.')
    const shares = Array.isArray(it.shares) ? [...new Set(it.shares.map(Number))].filter((id) => pids.has(id)) : []
    return { product, qty, notes: String(it.notes || '').trim().slice(0, 140), shares }
  })
}

export function addItems(order, participant, rawItems) {
  if (order.status !== 'aberto') {
    throw new HttpError(409, order.channel === 'mesa' ? 'A conta está fechada. Reabra a comanda para pedir mais.' : 'Este pedido já foi fechado para pagamento.')
  }
  const items = validateItems(order, rawItems)
  tx(() => {
    let ticketId = null
    if (order.channel === 'mesa') {
      const round = (db.prepare('SELECT MAX(round) AS r FROM tickets WHERE order_id = ?').get(order.id).r || 0) + 1
      ticketId = Number(db.prepare('INSERT INTO tickets(order_id, round, status, created_at) VALUES (?,?,?,?)').run(order.id, round, 'novo', now()).lastInsertRowid)
    }
    const ins = db.prepare('INSERT INTO order_items(order_id, ticket_id, product_id, name, unit_price, qty, notes, added_by, shares, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    for (const it of items) {
      const shares = it.shares.length ? it.shares : [participant.id]
      ins.run(order.id, ticketId, it.product.id, it.product.name, it.product.price, it.qty, it.notes, participant.id, JSON.stringify(shares), now())
    }
    touch(order.id)
  })
  return order.channel === 'mesa' ? 'kitchen' : 'order'
}

export function removeItem(order, participant, itemId) {
  const item = order.items.find((i) => i.id === Number(itemId))
  if (!item) throw new HttpError(404, 'Item não encontrado.')
  if (item.added_by !== participant.id) throw new HttpError(403, 'Só quem pediu o item pode removê-lo.')
  if (!['pendente', 'novo'].includes(item.status)) throw new HttpError(409, 'A cozinha já começou a preparar este item.')
  if (order.status !== 'aberto') throw new HttpError(409, 'O pedido já foi fechado.')
  tx(() => {
    db.prepare('DELETE FROM order_items WHERE id = ?').run(item.id)
    if (item.ticket_id && !db.prepare('SELECT 1 FROM order_items WHERE ticket_id = ?').get(item.ticket_id)) {
      db.prepare('DELETE FROM tickets WHERE id = ?').run(item.ticket_id)
    }
    touch(order.id)
  })
}

export function setShares(order, itemId, shares) {
  const item = order.items.find((i) => i.id === Number(itemId))
  if (!item) throw new HttpError(404, 'Item não encontrado.')
  if (['finalizado', 'cancelado', 'entregue'].includes(order.status)) throw new HttpError(409, 'O pedido já foi encerrado.')
  const pids = new Set(order.participants.map((p) => p.id))
  const clean = [...new Set((shares || []).map(Number))].filter((id) => pids.has(id))
  if (!clean.length) throw new HttpError(400, 'Escolha pelo menos uma pessoa para este item.')
  db.prepare('UPDATE order_items SET shares = ? WHERE id = ?').run(JSON.stringify(clean), item.id)
  touch(order.id)
}

export function setSplitMode(order, mode) {
  if (!['consumo', 'igual'].includes(mode)) throw new HttpError(400, 'Modo de divisão inválido.')
  if (order.payments.some((p) => p.status === 'pago')) throw new HttpError(409, 'Alguém já pagou. A forma de dividir não pode mais mudar.')
  db.prepare('UPDATE orders SET split_mode = ? WHERE id = ?').run(mode, order.id)
  db.prepare("UPDATE payments SET status = 'cancelado' WHERE order_id = ? AND status = 'pendente'").run(order.id)
  touch(order.id)
}

export function setService(order, on) {
  if (order.channel !== 'mesa') throw new HttpError(400, 'Taxa de serviço só existe na mesa.')
  if (order.payments.some((p) => p.status === 'pago')) throw new HttpError(409, 'Alguém já pagou. A taxa não pode mais mudar.')
  db.prepare('UPDATE orders SET service_pct = ? WHERE id = ?').run(on ? getSetting('store').service_pct : 0, order.id)
  db.prepare("UPDATE payments SET status = 'cancelado' WHERE order_id = ? AND status = 'pendente'").run(order.id)
  touch(order.id)
}

export function closeOrder(order, participant) {
  if (order.status !== 'aberto') throw new HttpError(409, 'O pedido já está fechado.')
  if (!order.items.length) throw new HttpError(400, 'Adicione itens antes de fechar.')
  if (order.channel !== 'mesa' && !participant.is_host) throw new HttpError(403, 'Só quem criou o pedido em grupo pode fechá-lo.')
  db.prepare("UPDATE orders SET status = 'aguardando_pagamento' WHERE id = ?").run(order.id)
  touch(order.id)
}

export function reopenOrder(order) {
  if (order.channel !== 'mesa' || order.status !== 'aguardando_pagamento') throw new HttpError(409, 'Só dá para reabrir a comanda de uma mesa com a conta pedida.')
  db.prepare("UPDATE orders SET status = 'aberto' WHERE id = ?").run(order.id)
  db.prepare("UPDATE payments SET status = 'cancelado' WHERE order_id = ? AND status = 'pendente'").run(order.id)
  touch(order.id)
}

// ---------- criação ----------

export function createOrder({ channel, is_group, customer, participant, items }) {
  if (!['entrega', 'retirada'].includes(channel)) throw new HttpError(400, 'Escolha entrega ou retirada.')
  const store = getSetting('store')
  const c = sanitizeCustomer(customer, channel)
  const code = uniqueCode()
  const t = now()
  const id = tx(() => {
    const r = db.prepare(`INSERT INTO orders(code, channel, is_group, status, delivery_fee, customer, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?)`).run(code, channel, is_group ? 1 : 0, 'aberto', channel === 'entrega' ? store.delivery_fee : 0, JSON.stringify(c), t, t)
    return Number(r.lastInsertRowid)
  })
  let order = loadOrder(id)
  const me = joinOrder(order, { name: participant?.name || c.name, device_id: participant?.device_id })
  if (Array.isArray(items) && items.length) {
    order = loadOrder(id)
    addItems(order, order.participants.find((p) => p.id === me.id), items)
  }
  if (!is_group) {
    if (!items?.length) throw new HttpError(400, 'Seu carrinho está vazio.')
    db.prepare("UPDATE orders SET status = 'aguardando_pagamento' WHERE id = ?").run(id)
  }
  return { order: loadOrder(id), participant: me }
}

function sanitizeCustomer(c = {}, channel) {
  const s = (v, max) => String(v || '').trim().slice(0, max)
  const out = { name: s(c.name, 40), phone: s(c.phone, 20).replace(/[^\d()+\- ]/g, ''), email: s(c.email, 80) }
  if (!out.name) throw new HttpError(400, 'Informe seu nome.')
  if (out.phone.replace(/\D/g, '').length < 10) throw new HttpError(400, 'Informe um telefone com DDD para a gente avisar sobre o pedido.')
  if (channel === 'entrega') {
    const a = c.address || {}
    out.address = { cep: s(a.cep, 9), rua: s(a.rua, 80), numero: s(a.numero, 10), complemento: s(a.complemento, 40), bairro: s(a.bairro, 40), referencia: s(a.referencia, 80) }
    if (!out.address.rua || !out.address.numero || !out.address.bairro) throw new HttpError(400, 'Preencha rua, número e bairro para a entrega.')
  }
  return out
}

function uniqueCode() {
  for (;;) {
    const c = newCode()
    if (!db.prepare('SELECT 1 FROM orders WHERE code = ?').get(c)) return c
  }
}

function touch(orderId) {
  db.prepare('UPDATE orders SET updated_at = ? WHERE id = ?').run(now(), orderId)
}

// ---------- mesas ----------

export function tableByToken(number, token) {
  const t = db.prepare('SELECT * FROM tables WHERE number = ?').get(Number(number))
  if (!t) throw new HttpError(404, 'Mesa não encontrada.')
  if (t.token !== token) throw new HttpError(403, 'Leia o QR code que está na mesa para fazer pedidos.')
  return t
}

export function tableOrder(number, { create = false } = {}) {
  const row = db.prepare(`SELECT id FROM orders WHERE channel = 'mesa' AND table_number = ? AND status IN ('aberto','aguardando_pagamento') ORDER BY id DESC`).get(number)
  if (row) return loadOrder(row.id)
  if (!create) return null
  const store = getSetting('store')
  const t = now()
  const r = db.prepare(`INSERT INTO orders(code, channel, is_group, table_number, status, service_pct, customer, created_at, updated_at)
    VALUES (?, 'mesa', 1, ?, 'aberto', ?, '{}', ?, ?)`).run(uniqueCode(), number, store.service_pct, t, t)
  return loadOrder(Number(r.lastInsertRowid))
}

export function createCall(number, order, reason, by) {
  const open = db.prepare("SELECT id FROM calls WHERE table_number = ? AND reason = ? AND status = 'aberto'").get(number, reason)
  if (open) return open.id
  return Number(db.prepare('INSERT INTO calls(table_number, order_id, reason, requested_by, created_at) VALUES (?,?,?,?,?)')
    .run(number, order?.id ?? null, reason, String(by || '').slice(0, 30), now()).lastInsertRowid)
}

// ---------- pagamentos ----------

export async function createPayment(order, participantIds, payerName, publicBaseUrl) {
  if (['cancelado', 'finalizado'].includes(order.status)) throw new HttpError(409, 'Este pedido foi encerrado.')
  if (order.status === 'aberto' && order.channel !== 'mesa') throw new HttpError(409, 'Feche o pedido antes de pagar.')
  const ids = [...new Set((participantIds || []).map(Number))].filter((id) => order.split.perParticipant[id])
  if (!ids.length) throw new HttpError(400, 'Escolha de quem é a parte que você vai pagar.')
  const allocations = {}
  let amount = 0
  for (const id of ids) {
    const due = order.split.perParticipant[id].due
    if (due > 0) { allocations[id] = due; amount += due }
  }
  if (amount <= 0) throw new HttpError(409, 'Essa parte já está paga.')

  // Reaproveita uma cobrança pendente idêntica (evita QR codes duplicados ao recarregar).
  const same = order.payments.find((p) => p.status === 'pendente' && p.amount === amount && JSON.stringify(p.allocations) === JSON.stringify(allocations) && p.expires_at > now() + 60000)
  if (same) return same.public_id

  // Cancela cobranças pendentes que cobriam as mesmas pessoas.
  for (const p of order.payments) {
    if (p.status === 'pendente' && Object.keys(p.allocations).some((k) => allocations[k] !== undefined)) {
      db.prepare("UPDATE payments SET status = 'cancelado' WHERE id = ?").run(p.id)
    }
  }

  const store = getSetting('store')
  const publicId = randomBytes(9).toString('hex')
  const txid = `KERO${order.code}${publicId.slice(0, 8)}`.toUpperCase()
  const expiresAt = now() + PAYMENT_TTL
  let provider = 'estatico'
  let brcode
  let providerId = null
  let qrBase64 = null

  if (mercadoPagoEnabled()) {
    provider = 'mercadopago'
    const mp = await mpCreatePix({
      amount,
      description: `Kero+ pedido ${order.code}`,
      externalReference: publicId,
      payerEmail: order.customer.email,
      expiresAt,
      notificationUrl: publicBaseUrl ? `${publicBaseUrl}/api/webhooks/mercadopago` : undefined,
    })
    brcode = mp.brcode
    providerId = mp.providerId
    qrBase64 = mp.qrBase64
  } else {
    const key = store.pix_key || process.env.PIX_KEY
    if (!key) throw new HttpError(503, 'A loja ainda não cadastrou a chave Pix. Chame um atendente ou configure em Admin, Ajustes.')
    brcode = buildBrCode({ key, name: store.merchant_name, city: store.merchant_city, amount, txid, description: `Pedido ${order.code}` })
  }

  db.prepare(`INSERT INTO payments(order_id, public_id, amount, allocations, payer_name, status, provider, provider_id, txid, brcode, qr_base64, created_at, expires_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(order.id, publicId, amount, JSON.stringify(allocations), String(payerName || '').slice(0, 30), 'pendente', provider, providerId, txid, brcode, qrBase64, now(), expiresAt)
  touch(order.id)
  return publicId
}

export function markPaid(publicId, confirmedBy) {
  const p = db.prepare('SELECT * FROM payments WHERE public_id = ?').get(publicId)
  if (!p) throw new HttpError(404, 'Pagamento não encontrado.')
  if (p.status === 'pago') return loadOrder(p.order_id)
  if (p.status === 'cancelado' && confirmedBy === 'provedor') {
    // O cliente pagou um QR antigo: o dinheiro entrou, então vale.
  } else if (p.status !== 'pendente' && p.status !== 'expirado') {
    throw new HttpError(409, 'Esta cobrança foi substituída por outra.')
  }
  db.prepare("UPDATE payments SET status = 'pago', paid_at = ?, confirmed_by = ? WHERE id = ?").run(now(), confirmedBy, p.id)
  const order = loadOrder(p.order_id)
  maybeComplete(order)
  return loadOrder(p.order_id)
}

function maybeComplete(order) {
  if (order.split.total <= 0 || order.split.due > 0) return
  // Mesa com a comanda ainda aberta continua aberta: o grupo pode pedir mais depois de pagar.
  if (order.status === 'aguardando_pagamento') {
    if (order.channel === 'mesa') {
      db.prepare("UPDATE orders SET status = 'finalizado', paid_at = ?, closed_at = ? WHERE id = ?").run(now(), now(), order.id)
      db.prepare("UPDATE calls SET status = 'atendido', resolved_at = ? WHERE order_id = ? AND status = 'aberto'").run(now(), order.id)
    } else {
      tx(() => {
        const ticket = Number(db.prepare("INSERT INTO tickets(order_id, round, status, created_at) VALUES (?, 1, 'novo', ?)").run(order.id, now()).lastInsertRowid)
        db.prepare('UPDATE order_items SET ticket_id = ? WHERE order_id = ? AND ticket_id IS NULL').run(ticket, order.id)
        db.prepare("UPDATE orders SET status = 'recebido', paid_at = ? WHERE id = ?").run(now(), order.id)
      })
    }
  }
}

// ---------- cozinha ----------

const TICKET_FLOW = ['novo', 'preparando', 'pronto', 'entregue']

export function setTicketStatus(id, status) {
  const t = db.prepare('SELECT * FROM tickets WHERE id = ?').get(Number(id))
  if (!t) throw new HttpError(404, 'Comanda não encontrada.')
  if (!TICKET_FLOW.includes(status)) throw new HttpError(400, 'Status inválido.')
  const col = { preparando: 'started_at', pronto: 'ready_at', entregue: 'done_at' }[status]
  db.prepare(`UPDATE tickets SET status = ?${col ? `, ${col} = COALESCE(${col}, ?)` : ''} WHERE id = ?`).run(...(col ? [status, now(), t.id] : [status, t.id]))

  const order = loadOrder(t.order_id)
  if (order.channel !== 'mesa' && ['recebido', 'preparando', 'pronto'].includes(order.status)) {
    const next = { preparando: 'preparando', pronto: 'pronto', entregue: order.channel === 'entrega' ? 'saiu_entrega' : 'entregue' }[status]
    if (next) db.prepare('UPDATE orders SET status = ?, updated_at = ?, closed_at = CASE WHEN ? = \'entregue\' THEN ? ELSE closed_at END WHERE id = ?').run(next, now(), next, now(), order.id)
  }
  touch(order.id)
  return order
}

const STAFF_STATUS = ['recebido', 'preparando', 'pronto', 'saiu_entrega', 'entregue', 'finalizado', 'cancelado', 'aberto']

export function setOrderStatus(order, status) {
  if (!STAFF_STATUS.includes(status)) throw new HttpError(400, 'Status inválido.')
  const closing = ['entregue', 'finalizado', 'cancelado'].includes(status)
  db.prepare('UPDATE orders SET status = ?, closed_at = ? WHERE id = ?').run(status, closing ? now() : null, order.id)
  if (status === 'cancelado') db.prepare("UPDATE payments SET status = 'cancelado' WHERE order_id = ? AND status = 'pendente'").run(order.id)
  if (closing) {
    db.prepare("UPDATE tickets SET status = 'entregue', done_at = COALESCE(done_at, ?) WHERE order_id = ? AND status != 'entregue'").run(now(), order.id)
    if (order.table_number) db.prepare("UPDATE calls SET status = 'atendido', resolved_at = ? WHERE order_id = ? AND status = 'aberto'").run(now(), order.id)
  }
  touch(order.id)
}

export { OPEN_TABLE }
