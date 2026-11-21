import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeSplit } from '../shared/split.js'
import { crc16, buildBrCode } from '../server/pix.js'

test('crc16 CCITT-FALSE', () => assert.equal(crc16('123456789'), '29B1'))

test('BR Code tem CRC válido e campos obrigatórios', () => {
  const code = buildBrCode({ key: 'kero@exemplo.com', name: 'Kero Mais Lanches', city: 'São Paulo', amount: 3490, txid: 'KERO-ABC123' })
  assert.ok(code.startsWith('000201'))
  assert.ok(code.includes('br.gov.bcb.pix'))
  assert.ok(code.includes('540534.90'))
  assert.ok(code.includes('6009SAO PAULO'))
  assert.equal(code.slice(-4), crc16(code.slice(0, -4)))
})

const order = (over = {}) => ({
  participants: [{ id: 1 }, { id: 2 }, { id: 3 }],
  items: [
    { id: 10, unit_price: 3490, qty: 1, shares: [1], added_by: 1 },
    { id: 11, unit_price: 2990, qty: 1, shares: [1, 2, 3], added_by: 2 },
    { id: 12, unit_price: 690, qty: 2, shares: [3], added_by: 3 },
  ],
  payments: [],
  split_mode: 'consumo',
  service_pct: 10,
  delivery_fee: 0,
  ...over,
})

test('divisão por consumo soma exatamente o total', () => {
  const s = computeSplit(order())
  const sum = Object.values(s.perParticipant).reduce((a, p) => a + p.total, 0)
  assert.equal(sum, s.total)
  assert.equal(s.perParticipant[1].items, 3490 + 997)
  assert.equal(s.perParticipant[2].items, 997)
  assert.equal(s.perParticipant[3].items, 1380 + 996)
})

test('divisão igual e taxa de entrega', () => {
  const s = computeSplit(order({ split_mode: 'igual', service_pct: 0, delivery_fee: 600 }))
  const totals = Object.values(s.perParticipant).map((p) => p.total)
  assert.equal(totals.reduce((a, b) => a + b, 0), 3490 + 2990 + 1380 + 600)
  assert.ok(Math.max(...totals) - Math.min(...totals) <= 1)
})

test('pagamentos abatem o que falta', () => {
  const s0 = computeSplit(order())
  const s = computeSplit(order({ payments: [{ status: 'pago', allocations: { 1: s0.perParticipant[1].total } }, { status: 'pendente', allocations: { 2: 999 } }] }))
  assert.equal(s.perParticipant[1].due, 0)
  assert.equal(s.perParticipant[2].due, s.perParticipant[2].total)
  assert.equal(s.due, s.total - s0.perParticipant[1].total)
})
