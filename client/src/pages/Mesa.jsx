import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Logo } from '../components/Brand.jsx'
import Icon from '../components/Icon.jsx'
import { MenuBrowser } from '../components/Menu.jsx'
import { Sheet, useToast } from '../components/ui.jsx'
import { Avatar, ItemsByPerson, PixPayment, RoundCart, SplitSummary, useRound } from '../components/Order.jsx'
import { api } from '../lib/api.js'
import { useSharedOrder } from '../lib/useOrder.js'
import { useConfig, useMedia, useMenu } from '../lib/hooks.js'
import { useRoom } from '../lib/socket.js'
import { local, rememberOrder, useLocal } from '../lib/local.js'
import { formatBRL } from '@shared/money.js'
import { CALL_REASONS } from '@shared/status.js'
import { gsap } from '../components/motion.jsx'

function useTableToken(n) {
  const [params] = useSearchParams()
  const fromUrl = params.get('t')
  const saved = useLocal((s) => s.tables?.[n])
  useEffect(() => {
    if (fromUrl && fromUrl !== saved) local.update((s) => ({ tables: { ...(s.tables || {}), [n]: fromUrl } }))
  }, [fromUrl, saved, n])
  return fromUrl || saved || null
}

export default function Mesa() {
  const { numero } = useParams()
  const n = Number(numero)
  const token = useTableToken(n)
  const [code, setCode] = useState(null)
  const [error, setError] = useState(null)

  const openSession = () => {
    if (!token) { setError('Leia o QR code que está na mesa para abrir a comanda.'); return }
    api(`/tables/${n}/session`, { body: { table_token: token } }).then((r) => { setCode(r.code); setError(null) }).catch((e) => setError(e.message))
  }
  useEffect(openSession, [n, token]) // eslint-disable-line react-hooks/exhaustive-deps
  // Se a equipe fechar a mesa, a próxima comanda abre sozinha.
  useRoom(`table:${n}`, { table: (t) => { if (t.code !== code && t.status !== 'finalizado') setCode(t.code) } })

  if (error) {
    return (
      <div className="page-mesa mesa-error">
        <Logo size={44} />
        <h1 className="display">Mesa {n}</h1>
        <p>{error}</p>
      </div>
    )
  }
  if (!code) return <div className="page-mesa mesa-error"><div className="spinner"><span /></div></div>
  return <Comanda key={code} code={code} n={n} token={token} onNew={openSession} />
}

function Comanda({ code, n, token, onNew }) {
  const { order, me, join, act, pay } = useSharedOrder(code)
  const { menu, reload } = useMenu()
  const config = useConfig()
  const toast = useToast()
  const profile = useLocal((s) => s.profile)
  const wide = useMedia('(min-width: 980px)')
  const [tab, setTab] = useState('cardapio')
  const [name, setName] = useState(profile.name)
  const [calling, setCalling] = useState(false)
  const [payId, setPayId] = useState(null)
  const [busy, setBusy] = useState(false)
  const round = useRound()
  const tabBadge = useRef(null)
  const lastCalls = useRef(null)

  useRoom('menu', { menu: reload })

  useEffect(() => {
    if (order && me) rememberOrder({ code, channel: 'mesa', created_at: order.created_at, label: `Mesa ${n}` })
  }, [order?.code, me?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Avisa quando a equipe atende o chamado.
  useEffect(() => {
    if (!order) return
    const open = order.calls.filter((c) => c.status === 'aberto').map((c) => c.id)
    if (lastCalls.current) {
      const resolved = lastCalls.current.filter((id) => !open.includes(id))
      if (resolved.length) toast('A equipe recebeu seu chamado e está a caminho', 'green')
    }
    lastCalls.current = open
  }, [order?.calls]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn) => {
    setBusy(true)
    try { await fn() } catch (e) { toast(e.message, 'red') }
    setBusy(false)
  }

  if (!order) return <div className="page-mesa mesa-error"><div className="spinner"><span /></div></div>

  if (order.status === 'finalizado' || order.status === 'cancelado') {
    return (
      <div className="page-mesa mesa-error">
        <Logo size={44} />
        <h1 className="display">Conta fechada</h1>
        <p>Valeu pela visita à Kero+. Volte sempre.</p>
        <button className="btn btn-red btn-lg" onClick={onNew}>Abrir nova comanda nesta mesa</button>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="page-mesa mesa-join">
        <Logo size={40} />
        <div className="join-card panel stack">
          <p className="tag">Mesa {n}</p>
          <h1 className="display">Boas-vindas à Kero+</h1>
          <p className="muted">{order.participants.length ? `${order.participants.map((p) => p.name).join(', ')} já ${order.participants.length > 1 ? 'estão' : 'está'} na mesa.` : 'Você é a primeira pessoa da mesa.'} Coloque seu nome para pedir e pagar a sua parte.</p>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); run(async () => { await join(name, { table_token: token }); local.update((s) => ({ profile: { ...s.profile, name } })) }) }}>
            <label className="field"><span>Seu nome</span><input className="input" required maxLength={30} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /></label>
            <button className="btn btn-red btn-lg btn-block" disabled={busy}>Entrar na comanda</button>
          </form>
        </div>
      </div>
    )
  }

  const open = order.status === 'aberto'
  const openCalls = order.calls.filter((c) => c.status === 'aberto')
  const sent = order.items.length

  const send = () => run(async () => {
    await act('/items', { items: round.payload() })
    round.clear()
    toast('Pedido enviado para a cozinha', 'green')
    if (!wide) setTab('comanda')
    if (tabBadge.current) gsap.fromTo(tabBadge.current, { scale: 1.6 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' })
  })

  const call = (reason) => run(async () => {
    await api(`/tables/${n}/calls`, { body: { table_token: token, reason, name: me.name } })
    setCalling(false)
    toast('Chamado enviado. A equipe foi avisada.')
  })

  const menuPane = (
    <div className="mesa-menu">
      {!open && <p className="error-box">A conta foi pedida. Para pedir mais, toque em “Pedir mais” na comanda.</p>}
      <MenuBrowser compact menu={menu} cta="Separar" onAdd={(p, qty, notes) => { if (!open) return toast('Reabra a comanda para pedir mais.', 'red'); round.add(p, qty, notes, me); toast(`${p.name} separado. Envie quando terminar.`) }} />
    </div>
  )

  const comandaPane = (
    <div className="mesa-comanda stack" style={{ '--gap': '18px' }}>
      <section className="panel stack">
        <h2>Comanda da mesa</h2>
        <ItemsByPerson order={order} me={me} showStatus
          onRemove={(it) => run(() => act(`/items/${it.id}/delete`))}
          onShares={(it, ids) => run(() => act(`/items/${it.id}/shares`, { shares: ids }))} />
      </section>
      <section className="panel">
        <SplitSummary order={order} me={me} canPay={sent > 0}
          onMode={(mode) => run(() => act('/split', { mode }))}
          onService={(on) => run(() => act('/service', { on }))}
          onPay={(ids) => run(async () => setPayId(await pay(ids)))} />
        <div className="stack" style={{ '--gap': '8px', marginTop: 16 }}>
          {open ? (
            <button className="btn btn-ghost btn-block" disabled={!sent || busy} onClick={() => run(() => act('/close'))}>Fechar a conta (ninguém pede mais)</button>
          ) : (
            <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => run(() => act('/reopen'))}>Pedir mais</button>
          )}
        </div>
      </section>
    </div>
  )

  return (
    <div className="page-mesa">
      <header className="mesa-top">
        <Logo size={28} />
        <div className="mesa-title">
          <strong className="display">Mesa {n}</strong>
          <div className="avatars">{order.participants.slice(0, 6).map((p) => <Avatar key={p.id} p={p} size={26} ring={p.id === me.id} />)}</div>
        </div>
        <button className={`call-btn ${openCalls.length ? 'is-on' : ''}`} onClick={() => setCalling(true)} aria-label="Chamar atendente">
          <Icon name="bell" /> <span>{openCalls.length ? 'Chamado' : 'Chamar'}</span>
        </button>
      </header>

      {openCalls.length > 0 && (
        <div className="call-banner" role="status">
          <Icon name="bell" size={18} /> {openCalls.map((c) => CALL_REASONS[c.reason]).join(' e ')}: a equipe já foi avisada.
        </div>
      )}

      {wide ? (
        <div className="mesa-split container">{menuPane}<aside className="mesa-aside">{comandaPane}</aside></div>
      ) : (
        <div className="container">{tab === 'cardapio' ? menuPane : comandaPane}</div>
      )}

      {round.lines.length > 0 && (
        <div className="round-dock">
          <details className="round-details" open={wide}>
            <summary><strong>Seu pedido</strong> <span className="num">{round.lines.reduce((s, l) => s + l.qty, 0)} {round.lines.length === 1 && round.lines[0].qty === 1 ? 'item' : 'itens'}</span></summary>
            <RoundCart lines={round.lines} order={order} me={me} onQty={round.setQty} onShares={round.setShares} sending={busy} onSend={send} cta="Enviar para a cozinha" />
          </details>
        </div>
      )}

      {!wide && (
        <nav className="mesa-tabs" aria-label="Seções da mesa">
          <button aria-pressed={tab === 'cardapio'} onClick={() => setTab('cardapio')}><Icon name="list" /> Cardápio</button>
          <button aria-pressed={tab === 'comanda'} onClick={() => setTab('comanda')}>
            <Icon name="table" /> Comanda <span ref={tabBadge} className="badge num">{formatBRL(order.split.due)}</span>
          </button>
        </nav>
      )}

      <Sheet open={calling} onClose={() => setCalling(false)} title="Chamar atendente">
        <div className="stack">
          <p className="muted">Escolha o motivo. Avisamos a equipe na hora.</p>
          <div className="call-grid">
            {Object.entries(CALL_REASONS).map(([k, label]) => {
              const isOpen = openCalls.some((c) => c.reason === k)
              return (
                <button key={k} className="choice" disabled={busy || isOpen} onClick={() => call(k)}>
                  <strong>{label}</strong>{isOpen && <small>já avisado</small>}
                </button>
              )
            })}
          </div>
        </div>
      </Sheet>

      {payId && <PixPayment order={order} paymentId={payId} demo={config?.demo} onClose={() => setPayId(null)} />}
    </div>
  )
}
