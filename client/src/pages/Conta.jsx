import { useEffect, useState } from 'react'
import { SiteHeader, SiteFooter } from '../components/Site.jsx'
import FoodArt from '../components/FoodArt.jsx'
import Icon from '../components/Icon.jsx'
import { Sheet, useToast } from '../components/ui.jsx'
import { TLink, useGo } from '../components/motion.jsx'
import { api } from '../lib/api.js'
import { useMenu, dayLabel, clock } from '../lib/hooks.js'
import { cart, local, toggleFavorite, useLocal } from '../lib/local.js'
import { formatBRL } from '@shared/money.js'
import { ORDER_STATUS, CHANNEL_LABEL } from '@shared/status.js'

export default function Conta() {
  const account = useLocal()
  const { byId } = useMenu()
  const toast = useToast()
  const go = useGo()
  const [profile, setProfile] = useState(account.profile)
  const [details, setDetails] = useState({})
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    let off = false
    account.orders.slice(0, 12).forEach((o) => {
      api(`/orders/${o.code}`).then((d) => !off && setDetails((s) => ({ ...s, [o.code]: d }))).catch(() => !off && setDetails((s) => ({ ...s, [o.code]: null })))
    })
    return () => { off = true }
  }, [account.orders.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = (e) => {
    e.preventDefault()
    local.update(() => ({ profile }))
    toast('Dados salvos neste aparelho', 'green')
  }

  const repeat = (o) => {
    const me = account.sessions[o.code]
    const mine = o.items.filter((i) => !me || i.added_by === me.id)
    const ok = mine.filter((i) => byId[i.product_id]?.available)
    if (!ok.length) return toast('Os itens desse pedido não estão disponíveis agora.', 'red')
    ok.forEach((i) => cart.add(i.product_id, i.qty, i.notes))
    toast(ok.length < mine.length ? 'Alguns itens acabaram. O resto foi para a sacola.' : 'Itens na sacola')
    go('/checkout')
  }

  const favs = account.favorites.map((id) => byId[id]).filter(Boolean)

  return (
    <div className="page-account">
      <SiteHeader tone="white" />
      <main className="container account-grid">
        <header className="account-head">
          <h1 className="display">{account.profile.name ? `Oi, ${account.profile.name.split(' ')[0]}` : 'Meus pedidos'}</h1>
          <p className="muted">Sua conta fica guardada só neste aparelho: sem senha, sem cadastro. Seus dados preenchem o pedido sozinhos e o histórico fica aqui.</p>
        </header>

        <section className="panel stack account-orders">
          <h2>Seus pedidos</h2>
          {!account.orders.length && <div className="empty"><p>Você ainda não fez pedidos neste aparelho.</p><TLink to="/" className="btn btn-red">Fazer o primeiro</TLink></div>}
          <ul className="history">
            {account.orders.map((o) => {
              const d = details[o.code]
              const me = account.sessions[o.code]
              const mineTotal = d && me ? d.split.perParticipant[me.id]?.total : null
              const href = o.channel === 'mesa' && d && d.status !== 'finalizado' ? `/mesa/${d.table_number}` : `/pedido/${o.code}`
              return (
                <li key={o.code}>
                  <div>
                    <strong>{o.label || CHANNEL_LABEL[o.channel]}</strong>
                    <small className="muted">{CHANNEL_LABEL[o.channel]} <span className="num">{o.code}</span>, {dayLabel(o.created_at)} às {clock(o.created_at)}</small>
                  </div>
                  <div className="history-side">
                    {d === undefined ? <span className="muted">...</span> : d === null ? <span className="tag tag-soft">indisponível</span> : <span className="tag tag-soft">{ORDER_STATUS[d.status]}</span>}
                    {mineTotal ? <span className="num">{formatBRL(mineTotal)}</span> : null}
                  </div>
                  <div className="row wrap" style={{ '--gap': '8px' }}>
                    {d && <TLink to={href} className="btn btn-sm btn-ghost">Ver pedido</TLink>}
                    {d && d.items.length > 0 && <button className="btn btn-sm btn-yellow" onClick={() => repeat(d)}><Icon name="repeat" size={16} /> Pedir de novo</button>}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <aside className="stack account-side" style={{ '--gap': '18px' }}>
          <form className="panel stack" onSubmit={saveProfile}>
            <h2>Seus dados</h2>
            <label className="field"><span>Nome</span><input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
            <label className="field"><span>Celular</span><input className="input" inputMode="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label>
            <label className="field"><span>E-mail</span><input className="input" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
            <button className="btn btn-red">Salvar dados</button>
          </form>

          <section className="panel stack">
            <h2>Endereços</h2>
            {!account.addresses.length && <p className="muted">Os endereços que você usar na entrega aparecem aqui.</p>}
            <ul className="addr-list">
              {account.addresses.map((a, i) => (
                <li key={i}>
                  <span><strong>{a.rua}, {a.numero}</strong> {a.complemento}<br /><small className="muted">{a.bairro}</small></span>
                  <button className="icon-btn" aria-label={`Remover endereço ${a.rua}`} onClick={() => local.update((s) => ({ addresses: s.addresses.filter((_, j) => j !== i) }))}><Icon name="trash" size={18} /></button>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel stack">
            <h2>Favoritos</h2>
            {!favs.length && <p className="muted">Toque no coração de um lanche no cardápio para guardar aqui.</p>}
            <ul className="fav-list">
              {favs.map((p) => (
                <li key={p.id}>
                  <div className="cart-art"><FoodArt art={p.art} image={p.image} /></div>
                  <span>{p.name}<small className="num muted">{formatBRL(p.price)}</small></span>
                  <button className="icon-btn" aria-label={`Colocar ${p.name} na sacola`} disabled={!p.available} onClick={() => { cart.add(p.id); toast(`${p.name} na sacola`) }}><Icon name="bag" size={18} /></button>
                  <button className="icon-btn" aria-label={`Tirar ${p.name} dos favoritos`} onClick={() => toggleFavorite(p.id)}><Icon name="close" size={18} /></button>
                </li>
              ))}
            </ul>
          </section>

          <button className="btn btn-ghost" onClick={() => setConfirmReset(true)}>Apagar dados deste aparelho</button>
        </aside>
      </main>
      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="Apagar dados?">
        <div className="stack">
          <p>Seu nome, endereços, favoritos, sacola e histórico de pedidos somem deste aparelho. Pedidos em andamento continuam na loja.</p>
          <button className="btn btn-red btn-block" onClick={() => { local.reset(); setProfile(local.get().profile); setConfirmReset(false); toast('Dados apagados') }}>Apagar dados</button>
          <button className="btn btn-ghost btn-block" onClick={() => setConfirmReset(false)} data-autofocus>Manter dados</button>
        </div>
      </Sheet>
      <SiteFooter />
    </div>
  )
}
