import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { SiteHeader } from '../components/Site.jsx'
import { MenuBrowser } from '../components/Menu.jsx'
import { Sheet, useToast } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { ItemsByPerson, People, PixPayment, RoundCart, SplitSummary, StatusTimeline, etaText, useRound } from '../components/Order.jsx'
import { TLink } from '../components/motion.jsx'
import { useSharedOrder } from '../lib/useOrder.js'
import { useConfig, useMenu, clock } from '../lib/hooks.js'
import { rememberOrder, useLocal } from '../lib/local.js'
import { ORDER_STATUS, CHANNEL_LABEL } from '@shared/status.js'

export default function Pedido() {
  const { code: raw } = useParams()
  const code = raw.toUpperCase()
  const { order, error, me, join, act, pay } = useSharedOrder(code)
  const config = useConfig()
  const { menu } = useMenu()
  const toast = useToast()
  const profile = useLocal((s) => s.profile)
  const [name, setName] = useState(profile.name)
  const [adding, setAdding] = useState(false)
  const [payId, setPayId] = useState(null)
  const [busy, setBusy] = useState(false)
  const round = useRound()

  useEffect(() => {
    if (order && me) rememberOrder({ code, channel: order.channel, created_at: order.created_at, label: order.items.filter((i) => i.added_by === me.id).map((i) => i.name).slice(0, 3).join(', ') || 'Pedido em grupo' })
  }, [order?.code, me?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pedido individual aguardando pagamento: abre o Pix direto.
  useEffect(() => {
    if (!order || !me || payId || order.is_group || order.status !== 'aguardando_pagamento') return
    const pending = order.payments.find((p) => p.status === 'pendente')
    if (pending) setPayId(pending.id)
    else if (order.split.perParticipant[me.id]?.due > 0) run(async () => setPayId(await pay([me.id])))
  }, [order?.status, me?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn) => {
    setBusy(true)
    try { await fn() } catch (e) { toast(e.message, 'red') }
    setBusy(false)
  }

  if (error) return <Shell><div className="empty"><h1 className="display">Pedido não encontrado</h1><p>{error.message}</p><TLink className="btn btn-red" to="/">Ver o cardápio</TLink></div></Shell>
  if (!order) return <Shell><div className="empty"><div className="spinner"><span /></div></div></Shell>
  if (order.channel === 'mesa' && order.status !== 'finalizado') return <Navigate to={`/mesa/${order.table_number}`} replace />

  const host = order.participants.find((p) => p.is_host)
  const link = `${location.origin}${import.meta.env.BASE_URL}pedido/${order.code}`
  const share = async () => {
    const text = `Entra no nosso pedido da Kero+ e escolhe o seu lanche: ${link}`
    if (navigator.share) { try { await navigator.share({ title: 'Pedido Kero+', text, url: link }) } catch { /* cancelado */ } }
    else { try { await navigator.clipboard.writeText(link); toast('Link copiado') } catch { toast(link) } }
  }

  // Alguém abriu o link do grupo e ainda não entrou.
  if (!me) {
    const canJoin = order.status === 'aberto' || order.status === 'aguardando_pagamento'
    return (
      <Shell>
        <div className="join-card panel stack">
          <p className="tag">{CHANNEL_LABEL[order.channel]} em grupo</p>
          <h1 className="display">{host ? `${host.name} chamou você para o pedido` : 'Pedido em grupo'}</h1>
          {canJoin ? (
            <form className="stack" onSubmit={(e) => { e.preventDefault(); run(() => join(name)) }}>
              <label className="field"><span>Seu nome</span><input className="input" required maxLength={30} value={name} onChange={(e) => setName(e.target.value)} /></label>
              <button className="btn btn-red btn-lg btn-block" disabled={busy}>Entrar no pedido</button>
            </form>
          ) : (
            <><p>Status: {ORDER_STATUS[order.status]}</p><StatusTimeline order={order} /></>
          )}
        </div>
      </Shell>
    )
  }

  const open = order.status === 'aberto'
  const paying = order.status === 'aguardando_pagamento'
  const tracking = !open && !paying
  const myItems = order.items.filter((i) => i.added_by === me.id)

  return (
    <Shell>
      <div className="order-grid">
        <div className="stack" style={{ '--gap': '24px' }}>
          <header className="order-head">
            <p className="muted">Pedido <strong className="num">{order.code}</strong> {order.is_group ? 'em grupo' : ''} para {order.channel === 'entrega' ? 'entrega' : 'retirada no balcão'}</p>
            <h1 className="display">{ORDER_STATUS[order.status]}</h1>
            {tracking && <p className="muted">{etaText(order)}</p>}
          </header>

          {open && order.is_group && (
            <section className="panel invite">
              <h2>Chame o grupo</h2>
              <p className="muted">Quem abrir este link entra no pedido, escolhe o próprio lanche e paga a própria parte.</p>
              <div className="invite-link num">{link.replace(/^https?:\/\//, '')}</div>
              <div className="row wrap">
                <button className="btn btn-yellow" onClick={share}><Icon name="users" size={18} /> Compartilhar link</button>
                <button className="btn btn-ghost" onClick={async () => { try { await navigator.clipboard.writeText(link); toast('Link copiado') } catch { toast(link) } }}><Icon name="copy" size={18} /> Copiar link</button>
              </div>
            </section>
          )}

          {tracking && <section className="panel"><StatusTimeline order={order} /></section>}

          <section className="panel stack">
            <div className="row between wrap">
              <h2>Itens</h2>
              {open && <button className="btn btn-red btn-sm" onClick={() => setAdding(true)}>Adicionar itens</button>}
            </div>
            {order.is_group && <People order={order} me={me} />}
            <ItemsByPerson
              order={order} me={me}
              onRemove={(it) => run(() => act(`/items/${it.id}/delete`))}
              onShares={(it, ids) => run(() => act(`/items/${it.id}/shares`, { shares: ids }))}
            />
            {open && order.is_group && (
              me.is_host ? (
                <div className="stack" style={{ '--gap': '8px' }}>
                  <button className="btn btn-ghost btn-lg btn-block" disabled={busy || !order.items.length} onClick={() => run(() => act('/close'))}>
                    Todo mundo escolheu: fechar e pagar
                  </button>
                  <p className="muted" style={{ fontSize: '0.9rem' }}>Depois de fechar, ninguém adiciona mais itens. Cada pessoa paga a sua parte e o pedido vai para a cozinha quando o total for pago.</p>
                </div>
              ) : (
                <p className="muted">{myItems.length ? `Pronto. Quando ${host?.name || 'quem criou'} fechar o pedido, você paga a sua parte aqui.` : 'Escolha o seu lanche em “Adicionar itens”.'}</p>
              )
            )}
          </section>
        </div>

        <aside className="order-side">
          <section className="panel">
            <SplitSummary
              order={order} me={me}
              canPay={paying}
              onMode={open || paying ? (mode) => run(() => act('/split', { mode })) : null}
              onPay={(ids) => run(async () => setPayId(await pay(ids)))}
            />
            {open && order.is_group && <p className="muted" style={{ marginTop: 12, fontSize: '0.9rem' }}>O pagamento abre quando o pedido for fechado.</p>}
          </section>
          {order.customer?.address?.bairro && <p className="muted row" style={{ '--gap': '6px' }}><Icon name="pin" size={16} /> Entrega no bairro {order.customer.address.bairro}</p>}
          <p className="muted">Criado às {clock(order.created_at)}. Dúvidas? {config?.phone}</p>
        </aside>
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Adicionar ao pedido">
        <MenuBrowser compact menu={menu} cta="Escolher" onAdd={(p, qty, notes) => { round.add(p, qty, notes, me); toast(`${p.name} separado`) }} />
        {round.lines.length > 0 && (
          <div className="sheet-footer">
            <RoundCart
              lines={round.lines} order={order} me={me}
              onQty={round.setQty} onShares={round.setShares} sending={busy}
              cta="Adicionar ao pedido"
              onSend={() => run(async () => { await act('/items', { items: round.payload() }); round.clear(); setAdding(false); toast('Itens adicionados ao pedido', 'green') })}
            />
          </div>
        )}
      </Sheet>

      {payId && <PixPayment order={order} paymentId={payId} demo={config?.demo} onClose={() => setPayId(null)} />}
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div className="page-order">
      <SiteHeader tone="white" />
      <main className="container">{children}</main>
    </div>
  )
}

