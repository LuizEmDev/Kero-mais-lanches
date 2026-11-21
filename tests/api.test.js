import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const uploads = mkdtempSync(join(tmpdir(), 'kero-up-'))

const PORT = 3999
const base = `http://localhost:${PORT}/api`
let srv
const call = async (path, body, token) => {
  const res = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.error), { status: res.status })
  return data
}

before(async () => {
  srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
    env: { ...process.env, PORT, DB_FILE: ':memory:', NODE_ENV: 'test', STAFF_PIN: '9999', PIX_KEY: 'kero@exemplo.com', DEMO_MODE: 'true', UPLOAD_DIR: uploads },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  await new Promise((r) => srv.stdout.on('data', (d) => String(d).includes('rodando') && r()))
})
after(() => srv.kill())

test('entrega em grupo: cada um paga a sua parte e o pedido vai para a cozinha', async () => {
  const menu = await call('/menu')
  const [a, b] = menu
  const { order, participant: host } = await call('/orders', {
    channel: 'entrega', is_group: true,
    customer: { name: 'Ana', phone: '11999990000', address: { rua: 'Rua A', numero: '10', bairro: 'Centro' } },
    participant: { name: 'Ana', device_id: 'device-ana-123' },
    items: [{ product_id: a.id, qty: 1 }],
  })
  assert.equal(order.status, 'aberto')
  const { participant: bruno } = await call(`/orders/${order.code}/participants`, { name: 'Bruno', device_id: 'device-bruno-1' })
  await call(`/orders/${order.code}/items`, { token: bruno.token, items: [{ product_id: b.id, qty: 2 }] })
  await assert.rejects(call(`/orders/${order.code}/close`, { token: bruno.token }), { status: 403 })
  let o = await call(`/orders/${order.code}/close`, { token: host.token })
  assert.equal(o.status, 'aguardando_pagamento')
  assert.equal(o.split.total, a.price + b.price * 2 + 600)

  const p1 = await call(`/orders/${order.code}/payments`, { token: host.token, participant_ids: [host.id] })
  o = await call(`/orders/${order.code}`)
  const pay = o.payments.find((p) => p.id === p1.payment_id)
  assert.ok(pay.brcode.startsWith('000201'))
  await call(`/payments/${p1.payment_id}/simulate`, {})
  o = await call(`/orders/${order.code}`)
  assert.equal(o.status, 'aguardando_pagamento')
  assert.equal(o.split.perParticipant[host.id].due, 0)

  const p2 = await call(`/orders/${order.code}/payments`, { token: host.token, participant_ids: [bruno.id] })
  const { token } = await call('/staff/login', { pin: '9999' })
  o = await call(`/staff/payments/${p2.payment_id}/confirm`, {}, token)
  assert.equal(o.status, 'recebido')

  const tickets = await call('/staff/tickets', null, token)
  const t = tickets.find((x) => x.code === order.code)
  assert.equal(t.items.length, 2)
  await call(`/staff/tickets/${t.id}/status`, { status: 'preparando' }, token)
  await call(`/staff/tickets/${t.id}/status`, { status: 'pronto' }, token)
  await call(`/staff/tickets/${t.id}/status`, { status: 'entregue' }, token)
  o = await call(`/orders/${order.code}`)
  assert.equal(o.status, 'saiu_entrega')
})

test('mesa: pedido vai direto para a cozinha, chamado e conta dividida', async () => {
  const { token } = await call('/staff/login', { pin: '9999' })
  const tables = await call('/staff/tables', null, token)
  const t5 = tables.find((t) => t.number === 5)
  await assert.rejects(call('/tables/5/session', { table_token: 'errado' }), { status: 403 })
  const { code } = await call('/tables/5/session', { table_token: t5.token })
  const { participant: c } = await call(`/orders/${code}/participants`, { name: 'Carla', device_id: 'device-carla-1', table_token: t5.token })
  const { participant: d } = await call(`/orders/${code}/participants`, { name: 'Diego', device_id: 'device-diego-1', table_token: t5.token })
  const menu = await call('/menu')
  let o = await call(`/orders/${code}/items`, { token: c.token, items: [{ product_id: menu[0].id, qty: 1, shares: [c.id, d.id] }] })
  assert.equal(o.items[0].status, 'novo')
  await call('/tables/5/calls', { table_token: t5.token, reason: 'talheres', name: 'Diego' })
  o = await call(`/orders/${code}`)
  assert.equal(o.calls.length, 1)
  const svc = Math.round(menu[0].price * 0.1)
  assert.equal(o.split.total, menu[0].price + svc)
  o = await call(`/orders/${code}/close`, { token: d.token })
  const pay = await call(`/orders/${code}/payments`, { token: d.token, participant_ids: [c.id, d.id] })
  await call(`/payments/${pay.payment_id}/simulate`, {})
  o = await call(`/orders/${code}`)
  assert.equal(o.status, 'finalizado')
  const dash = await call('/staff/dashboard?range=hoje', null, token)
  assert.ok(dash.current.revenue >= o.split.total)
})

test('foto real do produto: envia, aparece no cardápio e remove', async () => {
  const { token } = await call('/staff/login', { pin: '9999' })
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(32)])
  const put = (body, type) => fetch(`${base}/staff/products/1/image`, { method: 'PUT', headers: { 'Content-Type': type, Authorization: `Bearer ${token}` }, body })
  assert.equal((await put(Buffer.from('não é imagem'), 'image/webp')).status, 400)
  const ok = await (await put(webp, 'image/webp')).json()
  assert.match(ok.image, /^\/uploads\/products\/1-\d+\.webp$/)
  assert.ok(existsSync(join(uploads, ok.image.replace('/uploads/', ''))))
  const menu = await call('/menu')
  assert.equal(menu.find((p) => p.id === 1).image, ok.image)
  const served = await fetch(`http://localhost:${PORT}${ok.image}`)
  assert.equal(served.status, 200)
  const del = await (await fetch(`${base}/staff/products/1/image`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })).json()
  assert.equal(del.image, null)
  assert.ok(!existsSync(join(uploads, ok.image.replace('/uploads/', ''))))
})
