import { db } from './db.js'

const DAY = 86400000
const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }

function kpis(from, to) {
  const rev = db.prepare(`SELECT COALESCE(SUM(p.amount),0) AS revenue, COUNT(DISTINCT p.order_id) AS paid_orders
    FROM payments p JOIN orders o ON o.id = p.order_id
    WHERE p.status = 'pago' AND p.paid_at >= ? AND p.paid_at < ? AND o.status != 'cancelado'`).get(from, to)
  const orders = db.prepare(`SELECT COUNT(*) AS n FROM orders o WHERE created_at >= ? AND created_at < ? AND status != 'cancelado'
    AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id)`).get(from, to).n
  const prep = db.prepare(`SELECT AVG(ready_at - created_at) AS ms FROM tickets WHERE ready_at >= ? AND ready_at < ?`).get(from, to).ms
  const people = db.prepare(`SELECT COUNT(*) AS n FROM participants pa JOIN orders o ON o.id = pa.order_id WHERE o.created_at >= ? AND o.created_at < ? AND o.status != 'cancelado'`).get(from, to).n
  return {
    revenue: rev.revenue,
    orders,
    avg_ticket: rev.paid_orders ? Math.round(rev.revenue / rev.paid_orders) : 0,
    prep_minutes: prep ? Math.round(prep / 60000) : null,
    people,
  }
}

export function dashboard(range = 'hoje') {
  const now = Date.now()
  const today = startOfDay(now)
  const days = range === '30d' ? 30 : range === '7d' ? 7 : 1
  const from = range === 'hoje' ? today : today - (days - 1) * DAY
  const prevFrom = from - days * DAY

  const current = kpis(from, now + 1)
  // Comparação justa: mesmo intervalo de horas no período anterior.
  const previous = kpis(prevFrom, prevFrom + (now - from) + 1)

  const chartDays = Math.max(14, days)
  const dailyRows = db.prepare(`SELECT p.paid_at AS t, p.amount AS a, p.order_id AS o FROM payments p JOIN orders o ON o.id = p.order_id
    WHERE p.status = 'pago' AND p.paid_at >= ? AND o.status != 'cancelado'`).all(today - (chartDays - 1) * DAY)
  const daily = []
  for (let i = chartDays - 1; i >= 0; i--) {
    const d0 = today - i * DAY
    const rows = dailyRows.filter((r) => r.t >= d0 && r.t < d0 + DAY)
    daily.push({ day: d0, revenue: rows.reduce((s, r) => s + r.a, 0), orders: new Set(rows.map((r) => r.o)).size })
  }

  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, today: 0, usual: 0 }))
  for (const r of dailyRows) {
    const h = new Date(r.t).getHours()
    if (r.t >= today) hourly[h].today += r.a
    else if (r.t >= today - 7 * DAY) hourly[h].usual += r.a / 7
  }
  hourly.forEach((h) => { h.usual = Math.round(h.usual) })

  const top = db.prepare(`SELECT i.product_id, i.name, SUM(i.qty) AS qty, SUM(i.qty * i.unit_price) AS revenue
    FROM order_items i JOIN orders o ON o.id = i.order_id
    WHERE o.created_at >= ? AND o.status != 'cancelado' AND i.ticket_id IS NOT NULL
    GROUP BY i.product_id ORDER BY qty DESC LIMIT 8`).all(Math.min(from, today - 6 * DAY))

  const channels = db.prepare(`SELECT o.channel, COUNT(DISTINCT o.id) AS orders, COALESCE(SUM(p.amount),0) AS revenue
    FROM orders o JOIN payments p ON p.order_id = o.id AND p.status = 'pago'
    WHERE p.paid_at >= ? AND o.status != 'cancelado' GROUP BY o.channel`).all(from)

  const live = {
    open_tables: db.prepare("SELECT COUNT(*) AS n FROM orders WHERE channel = 'mesa' AND status IN ('aberto','aguardando_pagamento')").get().n,
    open_calls: db.prepare("SELECT COUNT(*) AS n FROM calls WHERE status = 'aberto'").get().n,
    tickets: Object.fromEntries(db.prepare("SELECT status, COUNT(*) AS n FROM tickets WHERE status != 'entregue' GROUP BY status").all().map((r) => [r.status, r.n])),
    awaiting_payment: db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'aguardando_pagamento'").get().n,
    out_for_delivery: db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'saiu_entrega'").get().n,
  }

  return { range, from, current, previous, daily, hourly, top, channels, live }
}
