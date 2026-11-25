import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import Icon from './Icon.jsx'
import { Sheet, Qty, useToast } from './ui.jsx'
import { formatBRL } from '@shared/money.js'
import { ORDER_STATUS, DELIVERY_FLOW, PICKUP_FLOW, TICKET_STATUS } from '@shared/status.js'
import { api } from '../lib/api.js'
import { useNow, clock } from '../lib/hooks.js'

const AVATAR = ['#e8361f', '#2b1a0e', '#1d7f45', '#f2b600', '#7a3fa0', '#2b7fc2', '#c2240f', '#8a4d29']
export const avatarColor = (id) => AVATAR[id % AVATAR.length]

export function Avatar({ p, size = 34, ring = false }) {
  return (
    <span className={`avatar ${ring ? 'ring' : ''}`} style={{ width: size, height: size, background: avatarColor(p.id), fontSize: size * 0.42 }} title={p.name} aria-hidden="true">
      {p.name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

export function People({ order, me }) {
  return (
    <ul className="people" aria-label="Pessoas no pedido">
      {order.participants.map((p) => {
        const s = order.split.perParticipant[p.id]
        const paid = s && s.total > 0 && s.due === 0
        return (
          <li key={p.id} className={paid ? 'paid' : ''}>
            <Avatar p={p} ring={me?.id === p.id} />
            <span>{p.name}{me?.id === p.id ? ' (você)' : ''}</span>
            {paid && <span className="tag tag-green">pagou</span>}
          </li>
        )
      })}
    </ul>
  )
}

// ---------- itens agrupados por pessoa ----------
const ITEM_STATUS_TAG = { pendente: ['tag-soft', 'no pedido'], novo: ['tag-soft', TICKET_STATUS.novo], preparando: ['', 'na chapa'], pronto: ['tag-green', 'pronto'], entregue: ['tag-green', 'entregue'] }

export function ItemsByPerson({ order, me, onRemove, onShares, showStatus = false }) {
  const [editing, setEditing] = useState(null)
  const names = Object.fromEntries(order.participants.map((p) => [p.id, p]))
  if (!order.items.length) return <div className="empty"><p>Nenhum item ainda. Escolha no cardápio e envie.</p></div>
  const groups = order.participants.map((p) => ({ p, items: order.items.filter((i) => i.added_by === p.id) })).filter((g) => g.items.length)
  const editable = !['finalizado', 'cancelado', 'entregue'].includes(order.status) && order.participants.length > 1
  return (
    <div className="items-by-person">
      {groups.map(({ p, items }) => (
        <section key={p.id} className="ibp-group">
          <h4 className="row"><Avatar p={p} size={26} /> {p.name}{me?.id === p.id ? ' (você)' : ''}</h4>
          <ul>
            {items.map((it) => {
              const shared = it.shares.length > 1
              const [tone, label] = ITEM_STATUS_TAG[it.status] || ITEM_STATUS_TAG.pendente
              const removable = me?.id === it.added_by && ['pendente', 'novo'].includes(it.status) && order.status === 'aberto'
              return (
                <li key={it.id} className="ibp-item">
                  <div className="ibp-main">
                    <span className="ibp-name"><span className="num">{it.qty}×</span> {it.name}</span>
                    {it.notes && <small className="muted">{it.notes}</small>}
                    {shared && <small className="ibp-shared"><Icon name="split" size={14} /> dividido entre {it.shares.map((id) => names[id]?.name).filter(Boolean).join(', ')}</small>}
                  </div>
                  <div className="ibp-side">
                    <span className="num">{formatBRL(it.unit_price * it.qty)}</span>
                    {showStatus && <span className={`tag ${tone}`}>{label}</span>}
                    <div className="row" style={{ '--gap': '4px' }}>
                      {editable && onShares && <button className="link-btn" onClick={() => setEditing(it)}>Dividir</button>}
                      {removable && onRemove && <button className="link-btn danger" onClick={() => onRemove(it)}>Remover</button>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <ShareSheet item={editing} order={order} onClose={() => setEditing(null)} onSave={(ids) => { onShares(editing, ids); setEditing(null) }} />
    </div>
  )
}

export function ShareSheet({ item, order, onClose, onSave }) {
  const [sel, setSel] = useState([])
  useEffect(() => { if (item) setSel(item.shares?.length ? item.shares : []) }, [item])
  if (!item) return null
  const each = sel.length ? Math.ceil((item.unit_price * item.qty) / sel.length) : 0
  return (
    <Sheet open onClose={onClose} title="Quem vai dividir?">
      <div className="stack">
        <p><strong>{item.qty}× {item.name}</strong> <span className="num muted">{formatBRL(item.unit_price * item.qty)}</span></p>
        <div className="row wrap">
          {order.participants.map((p) => (
            <button key={p.id} className="chip" aria-pressed={sel.includes(p.id)} onClick={() => setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))}>
              <Avatar p={p} size={22} /> {p.name}
            </button>
          ))}
        </div>
        <button className="link-btn" onClick={() => setSel(order.participants.map((p) => p.id))}>Marcar a mesa toda</button>
        <p className="muted">{sel.length ? `Cada pessoa paga cerca de ${formatBRL(each)} deste item.` : 'Escolha pelo menos uma pessoa.'}</p>
        <button className="btn btn-red btn-block" disabled={!sel.length} onClick={() => onSave(sel)}>Salvar divisão</button>
      </div>
    </Sheet>
  )
}

// ---------- resumo da conta e pagamento ----------
export function SplitSummary({ order, me, onPay, onMode, onService, canPay }) {
  const s = order.split
  const mine = me ? s.perParticipant[me.id] : null
  const [others, setOthers] = useState(false)
  const paidAny = order.payments.some((p) => p.status === 'pago')
  return (
    <div className="split stack">
      <div className="row between wrap">
        <h3 className="display">A conta</h3>
        {order.participants.length > 1 && onMode && (
          <div className="seg" role="group" aria-label="Como dividir">
            <button aria-pressed={order.split_mode === 'consumo'} disabled={paidAny} onClick={() => onMode('consumo')}>Pelo que cada um pediu</button>
            <button aria-pressed={order.split_mode === 'igual'} disabled={paidAny} onClick={() => onMode('igual')}>Igual para todos</button>
          </div>
        )}
      </div>
      <dl className="totals">
        <div><dt>Itens</dt><dd className="num">{formatBRL(s.subtotal)}</dd></div>
        {order.channel === 'mesa' && (
          <div>
            <dt>
              Serviço ({order.service_pct || 10}%)
              {onService && !paidAny && <button className="link-btn" onClick={() => onService(!(order.service_pct > 0))}>{order.service_pct > 0 ? 'tirar' : 'incluir'}</button>}
            </dt>
            <dd className="num">{formatBRL(s.service)}</dd>
          </div>
        )}
        {s.delivery > 0 && <div><dt>Entrega</dt><dd className="num">{formatBRL(s.delivery)}</dd></div>}
        <div className="grand"><dt>Total</dt><dd className="num">{formatBRL(s.total)}</dd></div>
        {s.paid > 0 && <div className="paid-row"><dt>Já pago</dt><dd className="num">{formatBRL(s.paid)}</dd></div>}
      </dl>

      {order.participants.length > 1 && (
        <ul className="shares">
          {order.participants.map((p) => {
            const r = s.perParticipant[p.id]
            return (
              <li key={p.id} className={r.due === 0 && r.total > 0 ? 'done' : ''}>
                <span className="row"><Avatar p={p} size={26} /> {p.name}{me?.id === p.id ? ' (você)' : ''}</span>
                <span className="num">{r.due === 0 && r.total > 0 ? <span className="tag tag-green">pago</span> : formatBRL(r.due)}</span>
              </li>
            )
          })}
        </ul>
      )}

      {canPay && mine && (
        <div className="stack" style={{ '--gap': '10px' }}>
          {mine.due > 0 ? (
            <button className="btn btn-red btn-lg btn-block" onClick={() => onPay([me.id])}>Pagar minha parte: <span className="num">{formatBRL(mine.due)}</span></button>
          ) : mine.total > 0 ? (
            <p className="ok-box">Sua parte está paga.</p>
          ) : null}
          {s.due > mine.due && <button className="btn btn-ghost btn-block" onClick={() => setOthers(true)}>Pagar por outras pessoas</button>}
        </div>
      )}
      <PayOthersSheet open={others} order={order} me={me} onClose={() => setOthers(false)} onPay={(ids) => { setOthers(false); onPay(ids) }} />
    </div>
  )
}

function PayOthersSheet({ open, order, me, onClose, onPay }) {
  const [sel, setSel] = useState([])
  const due = order.participants.filter((p) => order.split.perParticipant[p.id].due > 0)
  useEffect(() => { if (open) setSel(due.map((p) => p.id)) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = sel.reduce((a, id) => a + (order.split.perParticipant[id]?.due || 0), 0)
  return (
    <Sheet open={open} onClose={onClose} title="De quem você vai pagar?">
      <div className="stack">
        <ul className="pick-list">
          {due.map((p) => (
            <li key={p.id}>
              <label className="row between">
                <span className="row"><input type="checkbox" checked={sel.includes(p.id)} onChange={() => setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} /> <Avatar p={p} size={26} /> {p.name}{me?.id === p.id ? ' (você)' : ''}</span>
                <span className="num">{formatBRL(order.split.perParticipant[p.id].due)}</span>
              </label>
            </li>
          ))}
        </ul>
        <button className="btn btn-red btn-lg btn-block" disabled={!sel.length} onClick={() => onPay(sel)}>Pagar <span className="num">{formatBRL(total)}</span> no Pix</button>
      </div>
    </Sheet>
  )
}

// ---------- Pix ----------
export function PixPayment({ order, paymentId, demo, onClose }) {
  const payment = order.payments.find((p) => p.id === paymentId)
  const [img, setImg] = useState(null)
  const [copied, setCopied] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const now = useNow(1000)
  const toast = useToast()

  useEffect(() => {
    if (!payment) return
    if (payment.qr_base64) setImg(`data:image/png;base64,${payment.qr_base64}`)
    else if (payment.brcode) QRCode.toDataURL(payment.brcode, { margin: 1, width: 560, color: { dark: '#2b1a0e', light: '#ffffff' } }).then(setImg)
  }, [payment?.brcode, payment?.qr_base64]) // eslint-disable-line react-hooks/exhaustive-deps

  // O socket avisa quando o pagamento cai; a consulta periódica cobre conexões instáveis.
  useEffect(() => {
    if (!payment || payment.status !== 'pendente') return
    const t = setInterval(() => api(`/payments/${payment.id}`).catch(() => {}), 6000)
    return () => clearInterval(t)
  }, [payment?.id, payment?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!payment) return null
  const left = Math.max(0, payment.expires_at - now)
  const mm = String(Math.floor(left / 60000)).padStart(2, '0')
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')

  const copy = async () => {
    try { await navigator.clipboard.writeText(payment.brcode); setCopied(true); setTimeout(() => setCopied(false), 2500) }
    catch { toast('Não deu para copiar. Segure o código e copie manualmente.', 'red') }
  }

  return (
    <Sheet open onClose={onClose} title={payment.status === 'pago' ? 'Pagamento confirmado' : 'Pague com Pix'}>
      {payment.status === 'pago' ? (
        <div className="pix-ok">
          <div className="pix-receipt">
            <p className="muted">Pix recebido</p>
            <p className="display pix-ok-amount num">{formatBRL(payment.amount)}</p>
            <span className="stamp" aria-hidden="true">pago</span>
          </div>
          <p className="muted">{order.split.due > 0 ? `Ainda faltam ${formatBRL(order.split.due)} de outras pessoas.` : order.channel === 'mesa' ? 'Conta fechada. Valeu pela visita!' : 'Todo mundo pagou. Seu pedido foi para a cozinha.'}</p>
          <button className="btn btn-red btn-block" onClick={onClose} data-autofocus>Voltar ao pedido</button>
        </div>
      ) : payment.status !== 'pendente' ? (
        <div className="stack">
          <p className="error-box">{payment.status === 'expirado' ? 'Este QR code expirou. Gere um novo para pagar.' : 'Este QR code foi substituído por outro mais recente.'}</p>
          <button className="btn btn-red btn-block" onClick={onClose}>Voltar e gerar outro</button>
        </div>
      ) : (
        <div className="pix stack">
          <div className="row between"><span>Valor</span><strong className="display num pix-amount">{formatBRL(payment.amount)}</strong></div>
          <div className="pix-qr">{img ? <img src={img} alt="QR code Pix para pagamento" /> : <div className="spinner"><span /></div>}</div>
          <ol className="pix-steps muted">
            <li>Abra o app do seu banco e escolha Pix.</li>
            <li>Leia o QR code ou use o Pix copia e cola.</li>
            <li>Confirme o pagamento. Esta tela atualiza sozinha.</li>
          </ol>
          <button className="btn btn-yellow btn-block" onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={18} /> {copied ? 'Código copiado' : 'Copiar código Pix'}</button>
          <p className="muted pix-exp row"><Icon name="clock" size={16} /> Vale por <span className="num">{mm}:{ss}</span></p>
          {payment.provider === 'estatico' && <p className="muted pix-note">Assim que o Pix cair, a equipe confirma o pagamento e esta tela muda.</p>}
          {demo && (
            <button className="btn btn-ghost btn-block btn-sm" disabled={simulating} onClick={async () => {
              setSimulating(true)
              try { await api(`/payments/${payment.id}/simulate`, { body: {} }) } catch (e) { toast(e.message, 'red') }
              setSimulating(false)
            }}>Simular pagamento (modo demonstração)</button>
          )}
        </div>
      )}
    </Sheet>
  )
}

// ---------- acompanhamento ----------
export function StatusTimeline({ order }) {
  const flow = order.channel === 'entrega' ? DELIVERY_FLOW : PICKUP_FLOW
  const idx = flow.indexOf(order.status)
  const labels = { ...ORDER_STATUS, pronto: order.channel === 'retirada' ? 'Pronto para retirar' : 'Pronto, saindo já já', entregue: order.channel === 'retirada' ? 'Retirado' : 'Entregue' }
  return (
    <ol className="timeline">
      {flow.map((s, i) => (
        <li key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''} aria-current={i === idx ? 'step' : undefined}>
          <span className="tl-dot">{i < idx ? <Icon name="check" size={14} stroke={3} /> : null}</span>
          <span>{labels[s]}</span>
        </li>
      ))}
    </ol>
  )
}

// ---------- carrinho da rodada (itens ainda não enviados para o pedido compartilhado) ----------
export function RoundCart({ lines, order, me, onQty, onShares, onSend, sending, cta }) {
  const [editing, setEditing] = useState(null)
  const names = Object.fromEntries(order.participants.map((p) => [p.id, p.name]))
  const total = lines.reduce((s, l) => s + l.product.price * l.qty, 0)
  return (
    <div className="round stack">
      <ul className="cart-lines">
        {lines.map((l) => (
          <li key={l.key}>
            <div>
              <strong>{l.product.name}</strong>
              {l.notes && <small className="muted">{l.notes}</small>}
              <small className="muted">{l.shares?.length > 1 ? `dividido: ${l.shares.map((id) => names[id]).join(', ')}` : `para ${l.shares?.[0] && l.shares[0] !== me.id ? names[l.shares[0]] : 'você'}`}</small>
              {order.participants.length > 1 && <button className="link-btn" onClick={() => setEditing(l)}>Escolher quem paga</button>}
            </div>
            <Qty value={l.qty} onChange={(q) => onQty(l.key, q)} label={`Quantidade de ${l.product.name}`} />
          </li>
        ))}
      </ul>
      <button className="btn btn-red btn-lg btn-block" disabled={sending || !lines.length} onClick={onSend}>
        {cta} <span className="num">{formatBRL(total)}</span>
      </button>
      <ShareSheet
        item={editing && { ...editing, name: editing.product.name, unit_price: editing.product.price, shares: editing.shares?.length ? editing.shares : [me.id] }}
        order={order}
        onClose={() => setEditing(null)}
        onSave={(ids) => { onShares(editing.key, ids); setEditing(null) }}
      />
    </div>
  )
}

export function useRound() {
  const [lines, setLines] = useState([])
  return useMemo(() => ({
    lines,
    add(product, qty, notes, me) {
      const key = `${product.id}:${(notes || '').trim().toLowerCase()}`
      setLines((s) => {
        const f = s.find((l) => l.key === key)
        return f ? s.map((l) => (l.key === key ? { ...l, qty: Math.min(20, l.qty + qty) } : l)) : [...s, { key, product, qty, notes: (notes || '').trim(), shares: [me.id] }]
      })
    },
    setQty: (key, qty) => setLines((s) => (qty <= 0 ? s.filter((l) => l.key !== key) : s.map((l) => (l.key === key ? { ...l, qty } : l)))),
    setShares: (key, shares) => setLines((s) => s.map((l) => (l.key === key ? { ...l, shares } : l))),
    clear: () => setLines([]),
    payload: () => lines.map((l) => ({ product_id: l.product.id, qty: l.qty, notes: l.notes, shares: l.shares })),
  }), [lines])
}

export const etaText = (order) => {
  if (!order.paid_at) return null
  const eta = order.paid_at + (order.prep_minutes || 25) * 60000 + (order.channel === 'entrega' ? 15 * 60000 : 0)
  return `Previsão: ${clock(eta)}`
}
