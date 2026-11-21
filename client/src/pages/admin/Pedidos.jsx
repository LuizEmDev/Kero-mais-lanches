import { useState } from 'react'
import { useStaffData } from '../../components/Staff.jsx'
import { Sheet, useToast } from '../../components/ui.jsx'
import { ItemsByPerson, StatusTimeline } from '../../components/Order.jsx'
import { api } from '../../lib/api.js'
import { clock, dayLabel, minutesSince, useNow } from '../../lib/hooks.js'
import { formatBRL } from '@shared/money.js'
import { ORDER_STATUS, CHANNEL_LABEL } from '@shared/status.js'

const VIEWS = [['ativos', 'Em andamento'], ['hoje', 'Hoje'], ['30d', '30 dias']]
const NEXT = {
  recebido: [['preparando', 'Marcar na chapa']],
  preparando: [['pronto', 'Marcar pronto']],
  pronto: [['saiu_entrega', 'Saiu para entrega'], ['entregue', 'Entregue']],
  saiu_entrega: [['entregue', 'Entregue']],
}

export default function Pedidos() {
  const [view, setView] = useState('ativos')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const { data } = useStaffData(`/staff/orders?view=${view}`, { kinds: ['order', 'payment', 'ticket', 'call'] })
  const now = useNow(30000)
  const term = q.trim().toLowerCase()
  const rows = (data || []).filter((o) => !term || o.code.toLowerCase().includes(term) || (o.customer?.name || '').toLowerCase().includes(term) || String(o.table_number || '') === term)

  return (
    <div className="stack" style={{ '--gap': '18px' }}>
      <header className="row between wrap">
        <h1 className="display">Pedidos</h1>
        <div className="seg" role="group" aria-label="Filtro">{VIEWS.map(([k, l]) => <button key={k} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>)}</div>
      </header>
      <input className="input" type="search" placeholder="Buscar por código, nome ou número da mesa" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar pedidos" />
      {!rows.length ? <div className="empty"><p>{data ? 'Nenhum pedido aqui.' : 'Carregando...'}</p></div> : (
        <div className="orders-table" role="table" aria-label="Lista de pedidos">
          {rows.map((o) => (
            <button key={o.code} className="order-row" role="row" onClick={() => setOpen(o.code)}>
              <span role="cell" className="or-main">
                <strong>{o.channel === 'mesa' ? `Mesa ${o.table_number}` : o.customer?.name || CHANNEL_LABEL[o.channel]}</strong>
                <small className="muted">{CHANNEL_LABEL[o.channel]}{o.is_group && o.channel !== 'mesa' ? ' em grupo' : ''} <span className="num">#{o.code}</span>, {view === 'ativos' ? `há ${minutesSince(o.created_at, now)} min` : `${dayLabel(o.created_at)} ${clock(o.created_at)}`}</small>
              </span>
              <span role="cell"><span className={`tag ${o.status === 'aguardando_pagamento' ? 'tag-red' : o.status === 'pronto' ? 'tag-green' : 'tag-soft'}`}>{ORDER_STATUS[o.status]}</span></span>
              <span role="cell" className="or-money num">{formatBRL(o.total)}{o.due > 0 && o.paid > 0 && <small className="muted">faltam {formatBRL(o.due)}</small>}</span>
              {o.pending_payments.length > 0 && <span role="cell" className="tag">Pix pendente</span>}
            </button>
          ))}
        </div>
      )}
      <OrderSheet code={open} onClose={() => setOpen(null)} />
    </div>
  )
}

export function OrderSheet({ code, onClose }) {
  const { data: o, reload } = useStaffData(code ? `/staff/orders/${code}` : null, { kinds: ['order', 'payment', 'ticket'] })
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!code) return null
  const run = async (fn, ok) => {
    setBusy(true)
    try { await fn(); if (ok) toast(ok, 'green'); reload() } catch (e) { toast(e.message, 'red') }
    setBusy(false)
  }
  const setStatus = (status, ok) => run(() => api(`/staff/orders/${code}/status`, { body: { status }, staff: true }), ok)
  return (
    <Sheet open onClose={onClose} title={o ? (o.channel === 'mesa' ? `Mesa ${o.table_number}` : `Pedido #${o.code}`) : 'Pedido'}>
      {!o || o.code !== code ? <div className="spinner"><span /></div> : (
        <div className="stack" style={{ '--gap': '18px' }}>
          <p><span className="tag tag-ink">{ORDER_STATUS[o.status]}</span> <span className="muted">criado às {clock(o.created_at)}</span></p>
          {o.channel !== 'mesa' && (
            <div className="customer-box">
              <strong>{o.customer.name}</strong>
              <a href={`tel:${o.customer.phone}`}>{o.customer.phone}</a>
              {o.customer.address && <span>{o.customer.address.rua}, {o.customer.address.numero} {o.customer.address.complemento}, {o.customer.address.bairro}{o.customer.address.referencia ? ` (${o.customer.address.referencia})` : ''}</span>}
            </div>
          )}
          {o.channel !== 'mesa' && ['recebido', 'preparando', 'pronto', 'saiu_entrega', 'entregue'].includes(o.status) && <StatusTimeline order={o} />}
          <ItemsByPerson order={o} showStatus />
          <dl className="totals">
            <div><dt>Total</dt><dd className="num">{formatBRL(o.split.total)}</dd></div>
            <div><dt>Pago</dt><dd className="num">{formatBRL(o.split.paid)}</dd></div>
            <div className="grand"><dt>Falta</dt><dd className="num">{formatBRL(o.split.due)}</dd></div>
          </dl>
          {o.payments.filter((p) => p.status === 'pendente').map((p) => (
            <div key={p.id} className="pending-pay">
              <span>Pix de <strong className="num">{formatBRL(p.amount)}</strong>{p.payer_name ? ` gerado por ${p.payer_name}` : ''} às {clock(p.created_at)}</span>
              <button className="btn btn-sm btn-red" disabled={busy} onClick={() => run(() => api(`/staff/payments/${p.id}/confirm`, { body: {}, staff: true }), 'Pagamento confirmado')}>Confirmar Pix recebido</button>
            </div>
          ))}
          <div className="row wrap">
            {(NEXT[o.status] || []).filter(([s]) => o.channel === 'entrega' || s !== 'saiu_entrega').map(([s, l]) => (
              <button key={s} className="btn btn-yellow" disabled={busy} onClick={() => setStatus(s, l)}>{l}</button>
            ))}
            {o.channel === 'mesa' && ['aberto', 'aguardando_pagamento'].includes(o.status) && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => { if (o.split.due === 0 || confirm(`Ainda faltam ${formatBRL(o.split.due)}. Encerrar a mesa mesmo assim?`)) setStatus('finalizado', 'Mesa liberada') }}>Encerrar mesa</button>
            )}
            {!['cancelado', 'finalizado', 'entregue'].includes(o.status) && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => confirm('Cancelar este pedido? Pix pendentes deixam de valer.') && setStatus('cancelado', 'Pedido cancelado')}>Cancelar pedido</button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  )
}
