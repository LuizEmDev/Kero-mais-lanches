import { distribute } from './money.js'

/**
 * Calcula quanto cada participante de um pedido deve pagar.
 *
 * order = {
 *   participants: [{ id }],
 *   items: [{ id, unit_price, qty, shares: [participantId], added_by }],
 *   payments: [{ status, allocations: { [participantId]: cents } }],
 *   split_mode: 'consumo' | 'igual',
 *   service_pct: number,   // taxa de serviço (mesa), em %
 *   delivery_fee: cents,   // taxa de entrega, dividida igualmente
 * }
 *
 * No modo "consumo", cada item é dividido igualmente entre as pessoas marcadas nele
 * e a taxa de serviço incide sobre o consumo de cada um.
 * No modo "igual", o total do pedido é dividido igualmente entre todos.
 * A soma das partes é sempre exatamente o total do pedido.
 */
export function computeSplit(order) {
  const pids = order.participants.map((p) => p.id)
  const pct = Number(order.service_pct) || 0
  const deliveryFee = Number(order.delivery_fee) || 0
  const per = {}
  for (const id of pids) per[id] = { items: 0, service: 0, delivery: 0, total: 0, paid: 0, due: 0, lines: [] }

  let subtotal = 0
  for (const item of order.items) {
    const amount = item.unit_price * item.qty
    subtotal += amount
    let owners = (item.shares || []).filter((id) => per[id])
    if (!owners.length) owners = per[item.added_by] ? [item.added_by] : pids
    const parts = distribute(amount, owners)
    for (const id of owners) {
      per[id].lines.push({ item_id: item.id, amount: parts[id], of: owners.length })
    }
    if (order.split_mode !== 'igual') for (const id of owners) per[id].items += parts[id]
  }

  let service = 0
  if (order.split_mode === 'igual') {
    service = Math.round((subtotal * pct) / 100)
    const it = distribute(subtotal, pids)
    const sv = distribute(service, pids)
    for (const id of pids) {
      per[id].items = it[id]
      per[id].service = sv[id]
    }
  } else {
    // Taxa calculada sobre o total e repartida na proporção do consumo (maiores restos),
    // para a soma das partes bater com a taxa da conta inteira.
    service = Math.round((subtotal * pct) / 100)
    const raw = pids.map((id) => ({ id, exact: subtotal ? (service * per[id].items) / subtotal : 0 }))
    let left = service
    for (const r of raw) { r.floor = Math.floor(r.exact); left -= r.floor }
    raw.sort((a, b) => (b.exact - b.floor) - (a.exact - a.floor))
    for (const r of raw) { per[r.id].service = r.floor + (left > 0 ? 1 : 0); if (left > 0) left-- }
  }

  const dl = distribute(deliveryFee, pids)
  for (const id of pids) per[id].delivery = dl[id] || 0

  for (const p of order.payments || []) {
    if (p.status !== 'pago') continue
    for (const [id, cents] of Object.entries(p.allocations || {})) if (per[id]) per[id].paid += cents
  }

  let total = 0
  let paid = 0
  for (const id of pids) {
    const r = per[id]
    r.total = r.items + r.service + r.delivery
    r.due = Math.max(0, r.total - r.paid)
    total += r.total
    paid += r.paid
  }

  return {
    subtotal,
    service,
    delivery: pids.length ? deliveryFee : 0,
    total,
    paid,
    due: Math.max(0, total - paid),
    perParticipant: per,
  }
}
