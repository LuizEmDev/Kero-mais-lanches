import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useStaffData } from '../../components/Staff.jsx'
import { Sheet, useToast } from '../../components/ui.jsx'
import Icon from '../../components/Icon.jsx'
import { Logo } from '../../components/Brand.jsx'
import { OrderSheet } from './Pedidos.jsx'
import { api } from '../../lib/api.js'
import { minutesSince, useNow } from '../../lib/hooks.js'
import { formatBRL } from '@shared/money.js'
import { CALL_REASONS } from '@shared/status.js'

const tableUrl = (t) => `${location.origin}${import.meta.env.BASE_URL}mesa/${t.number}?t=${t.token}`

export default function Salao() {
  const { data, reload } = useStaffData('/staff/tables', { kinds: ['order', 'call', 'payment', 'ticket', 'tables'] })
  const now = useNow(30000)
  const toast = useToast()
  const [order, setOrder] = useState(null)
  const [qr, setQr] = useState(null)
  const [printAll, setPrintAll] = useState(false)

  const resolve = async (id) => {
    try { await api(`/staff/calls/${id}/resolve`, { body: {}, staff: true }); reload() } catch (e) { toast(e.message, 'red') }
  }
  const calls = (data || []).flatMap((t) => t.calls.map((c) => ({ ...c, table: t.number }))).sort((a, b) => a.created_at - b.created_at)

  return (
    <div className="stack" style={{ '--gap': '20px' }}>
      <header className="row between wrap">
        <h1 className="display">Salão</h1>
        <button className="btn btn-ghost" onClick={() => setPrintAll(true)}><Icon name="qr" size={18} /> QR codes das mesas</button>
      </header>

      <section className={`calls ${calls.length ? 'has' : ''}`} aria-live="polite">
        <h2>Chamados</h2>
        {!calls.length ? <p className="muted">Nenhuma mesa chamando agora.</p> : (
          <ul>
            {calls.map((c) => (
              <li key={c.id}>
                <strong className="display">Mesa {c.table}</strong>
                <span>{CALL_REASONS[c.reason]}{c.requested_by ? `, por ${c.requested_by}` : ''}</span>
                <span className="muted num">há {minutesSince(c.created_at, now)} min</span>
                <button className="btn btn-sm btn-red" onClick={() => resolve(c.id)}>Atendido</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="tables-grid">
        {(data || []).map((t) => {
          const o = t.order
          const state = t.calls.length ? 'calling' : !o ? 'free' : o.status === 'aguardando_pagamento' ? 'closing' : o.people || o.items ? 'busy' : 'free'
          const label = { calling: 'Chamando', free: 'Livre', closing: 'Conta pedida', busy: 'Ocupada' }[state]
          return (
            <article key={t.number} className={`table-card st-${state}`}>
              <header>
                <strong className="display">{t.number}</strong>
                <span className="tag tag-soft">{label}</span>
              </header>
              {o && (o.people > 0 || o.items > 0) ? (
                <div className="tc-body">
                  <span><Icon name="users" size={16} /> {o.people} {o.people === 1 ? 'pessoa' : 'pessoas'}, {o.items} itens</span>
                  <span className="num">{formatBRL(o.total)}{o.paid > 0 ? `, pago ${formatBRL(o.paid)}` : ''}</span>
                  <span className="muted num">aberta há {minutesSince(o.created_at, now)} min</span>
                </div>
              ) : <div className="tc-body muted">{t.seats} lugares</div>}
              <footer className="row" style={{ '--gap': '6px' }}>
                {o && <button className="btn btn-sm btn-yellow" onClick={() => setOrder(o.code)}>Comanda</button>}
                <button className="btn btn-sm btn-ghost" onClick={() => setQr(t)} aria-label={`QR code da mesa ${t.number}`}><Icon name="qr" size={16} /> QR</button>
              </footer>
            </article>
          )
        })}
      </div>

      <OrderSheet code={order} onClose={() => { setOrder(null); reload() }} />
      <QrSheet table={qr} onClose={() => setQr(null)} onRotated={reload} />
      <PrintSheet open={printAll} tables={data || []} onClose={() => setPrintAll(false)} />
    </div>
  )
}

function QrImage({ url, size = 360 }) {
  const [src, setSrc] = useState(null)
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: size, color: { dark: '#2b1a0e', light: '#ffffff' } }).then(setSrc) }, [url, size])
  return src ? <img src={src} alt="" width={size / 2} height={size / 2} /> : null
}

function QrSheet({ table, onClose, onRotated }) {
  const toast = useToast()
  if (!table) return null
  const url = tableUrl(table)
  return (
    <Sheet open onClose={onClose} title={`QR code da mesa ${table.number}`}>
      <div className="stack" style={{ justifyItems: 'center', textAlign: 'center' }}>
        <QrImage url={url} />
        <code className="qr-url">{url}</code>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          <a className="btn btn-yellow" href={url} target="_blank" rel="noreferrer">Abrir como cliente</a>
          <button className="btn btn-ghost" onClick={async () => {
            if (!confirm('Gerar um QR novo invalida o antigo. Você vai precisar imprimir de novo. Continuar?')) return
            try { await api(`/staff/tables/${table.number}/token`, { body: {}, staff: true }); toast('QR novo gerado. Imprima e troque na mesa.'); onRotated(); onClose() } catch (e) { toast(e.message, 'red') }
          }}>Gerar QR novo</button>
        </div>
        <p className="muted">Gere um QR novo se alguém tirou foto do QR e está fazendo pedidos de fora da loja.</p>
      </div>
    </Sheet>
  )
}

function PrintSheet({ open, tables, onClose }) {
  if (!open) return null
  return (
    <Sheet open onClose={onClose} title="QR codes para imprimir">
      <div className="stack">
        <button className="btn btn-red" onClick={() => window.print()}>Imprimir</button>
        <div className="print-grid">
          {tables.map((t) => (
            <div key={t.number} className="print-card">
              <Logo size={26} />
              <strong className="display">Mesa {t.number}</strong>
              <QrImage url={tableUrl(t)} size={280} />
              <span>Aponte a câmera para pedir e pagar</span>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
