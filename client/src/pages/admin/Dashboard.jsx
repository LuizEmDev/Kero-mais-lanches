import { useState } from 'react'
import { useStaffData } from '../../components/Staff.jsx'
import { BarChart, HBars } from '../../components/Charts.jsx'
import { formatBRL } from '@shared/money.js'
import { CHANNEL_LABEL } from '@shared/status.js'
import { dayLabel } from '../../lib/hooks.js'

const RANGES = [['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias']]
const short = (c, compact) => (compact ? (c >= 100000 ? `R$ ${+(c / 100000).toFixed(1)}k` : `R$ ${Math.round(c / 100)}`) : formatBRL(c))

function Delta({ cur, prev, invert = false, unit = '' }) {
  if (prev === null || prev === undefined || !prev) return <span className="delta muted">sem base de comparação</span>
  const pct = Math.round(((cur - prev) / prev) * 100)
  const good = invert ? pct <= 0 : pct >= 0
  return <span className={`delta ${good ? 'up' : 'down'}`}>{pct > 0 ? '+' : ''}{pct}%{unit} vs período anterior</span>
}

export default function Dashboard() {
  const [range, setRange] = useState('hoje')
  const { data, loading } = useStaffData(`/staff/dashboard?range=${range}`, { kinds: ['payment', 'order', 'ticket', 'call'], poll: 60000 })
  if (!data) return <div className="empty"><div className="spinner"><span /></div></div>
  const { current: c, previous: p, live } = data
  // Mostra o horário de funcionamento e qualquer hora fora dele que tenha tido venda.
  const active = data.hourly.filter((h) => h.today || h.usual).map((h) => h.hour)
  const h0 = Math.min(17, ...active)
  const h1 = Math.max(23, ...active)
  const hoursOpen = data.hourly.filter((h) => h.hour >= h0 && h.hour <= h1)

  return (
    <div className={`dash stack ${loading ? 'is-loading' : ''}`} style={{ '--gap': '22px' }}>
      <header className="row between wrap">
        <h1 className="display">Visão geral</h1>
        <div className="seg" role="group" aria-label="Período">
          {RANGES.map(([k, l]) => <button key={k} aria-pressed={range === k} onClick={() => setRange(k)}>{l}</button>)}
        </div>
      </header>

      <section className="kpis" aria-label="Indicadores do período">
        <div className="kpi kpi-hero"><span>Faturamento</span><strong className="display num">{formatBRL(c.revenue)}</strong><Delta cur={c.revenue} prev={p.revenue} /></div>
        <div className="kpi"><span>Pedidos</span><strong className="display num">{c.orders}</strong><Delta cur={c.orders} prev={p.orders} /></div>
        <div className="kpi"><span>Ticket médio</span><strong className="display num">{formatBRL(c.avg_ticket)}</strong><Delta cur={c.avg_ticket} prev={p.avg_ticket} /></div>
        <div className="kpi"><span>Tempo de preparo</span><strong className="display num">{c.prep_minutes ?? '–'}<small> min</small></strong><Delta cur={c.prep_minutes || 0} prev={p.prep_minutes} invert /></div>
      </section>

      <section className="live" aria-label="Agora na loja">
        <div><strong className="num">{live.open_tables}</strong><span>mesas abertas</span></div>
        <div className={live.open_calls ? 'alert' : ''}><strong className="num">{live.open_calls}</strong><span>chamados</span></div>
        <div><strong className="num">{live.tickets.novo || 0}</strong><span>na fila</span></div>
        <div><strong className="num">{live.tickets.preparando || 0}</strong><span>na chapa</span></div>
        <div><strong className="num">{live.awaiting_payment}</strong><span>esperando Pix</span></div>
        <div><strong className="num">{live.out_for_delivery}</strong><span>em entrega</span></div>
      </section>

      <div className="dash-grid">
        <section className="panel">
          <BarChart
            title={`Faturamento por dia, últimos ${data.daily.length} dias`}
            data={data.daily} value={(d) => d.revenue}
            label={(d, compact) => (compact ? new Date(d.day).getDate().toString() : dayLabel(d.day))}
            format={short}
          />
        </section>
        <section className="panel">
          <BarChart
            title="Faturamento por hora hoje"
            highlight="Hoje" refLabel="Média dos últimos 7 dias"
            data={hoursOpen} value={(d) => d.today} refValue={(d) => d.usual}
            label={(d, compact) => (compact ? `${d.hour}h` : `${d.hour}h às ${d.hour + 1}h`)}
            format={short}
          />
        </section>
        <section className="panel">
          <HBars title={range === '30d' ? 'Mais vendidos, últimos 30 dias' : 'Mais vendidos, últimos 7 dias'} rows={data.top.map((t) => ({ key: t.product_id, label: t.name, value: t.qty, revenue: t.revenue }))} format={(v) => `${v} un.`} sub={(r) => formatBRL(r.revenue)} />
        </section>
        <section className="panel">
          <HBars title="Faturamento por canal" rows={data.channels.map((ch) => ({ key: ch.channel, label: CHANNEL_LABEL[ch.channel], value: ch.revenue, orders: ch.orders }))} format={formatBRL} sub={(r) => `${r.orders} ${r.orders === 1 ? 'pedido' : 'pedidos'}`} />
        </section>
      </div>
    </div>
  )
}
