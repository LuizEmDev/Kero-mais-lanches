import { useState } from 'react'
import { SiteHeader, SiteFooter, CartDrawer, useCartLines } from '../components/Site.jsx'
import { Plus } from '../components/Brand.jsx'
import FoodArt from '../components/FoodArt.jsx'
import Icon from '../components/Icon.jsx'
import { MenuBrowser } from '../components/Menu.jsx'
import { useConfig, useMenu } from '../lib/hooks.js'
import { useRoom } from '../lib/socket.js'
import { cart, local, useLocal } from '../lib/local.js'
import { announceAdd } from '../lib/cartSlip.js'
import { formatBRL } from '@shared/money.js'

const HIGHLIGHTS = ['Kero+ Duplo', 'X-Tudo', 'Dogão completo', 'Batata cheddar e bacon', 'Milkshake', 'Açaí 300 ml']
const HERO = 'Kero+ Duplo'

// A página inicial é o cardápio: o cliente chega e já pede.
export default function Home() {
  const { menu, reload } = useMenu()
  const config = useConfig()
  const channel = useLocal((s) => s.channel || 'entrega')
  const group = useLocal((s) => Boolean(s.groupIntent))
  const { count, subtotal } = useCartLines()
  const [open, setOpen] = useState(false)
  useRoom('menu', { menu: reload })

  const add = (p, qty = 1, notes = '') => {
    cart.add(p.id, qty, notes)
    announceAdd(p, qty)
  }
  const highlights = (menu || []).filter((p) => HIGHLIGHTS.includes(p.name) && p.available)
  const hero = (menu || []).find((p) => p.name === HERO)
  const eta = config ? config.prep_minutes + (channel === 'entrega' ? 15 : 0) : null

  return (
    <div className="home">
      <section className="hero">
        <SiteHeader tone="yellow" />
        <div className="hero-grid container">
          <div className="hero-copy">
            <h1 className="hero-word display" aria-label="Kero+ cardápio">
              <span aria-hidden="true">kero</span>
              <span className="hero-plus" aria-hidden="true"><Plus size={200} className="hero-plus-svg" /></span>
            </h1>
            <p className="hero-lede">Escolha, pague no Pix e acompanhe o preparo por aqui.</p>

            <div className="order-mode">
              <div className="seg seg-lg" role="group" aria-label="Como você quer receber">
                <button aria-pressed={channel === 'entrega'} onClick={() => local.update(() => ({ channel: 'entrega' }))}><Icon name="bike" size={20} /> Entrega</button>
                <button aria-pressed={channel === 'retirada'} onClick={() => local.update(() => ({ channel: 'retirada' }))}><Icon name="store" size={20} /> Retirada</button>
              </div>
              <button className="group-toggle" aria-pressed={group} onClick={() => local.update((s) => ({ groupIntent: !s.groupIntent }))}>
                <span className="gt-box" aria-hidden="true">{group && <Icon name="check" size={16} stroke={3} />}</span>
                <span><strong>Pedido em grupo</strong><small>cada pessoa escolhe e paga a sua parte</small></span>
              </button>
            </div>

            <ul className="hero-facts">
              {eta && <li><Icon name="clock" size={18} /> {channel === 'entrega' ? `Chega em cerca de ${eta} min` : `Pronto em cerca de ${eta} min`}</li>}
              {config && <li><Icon name={channel === 'entrega' ? 'bike' : 'store'} size={18} /> {channel === 'entrega' ? `Entrega ${formatBRL(config.delivery_fee)}` : 'Retirada sem taxa'}</li>}
              {config && <li><Icon name="clock" size={18} /> {config.hours}</li>}
            </ul>
            <p className="hero-mesa"><Icon name="qr" size={18} /> Está numa mesa? Leia o QR code dela para pedir direto para a cozinha.</p>
          </div>

          {/* A foto entra com ajuste de foco; o vapor lembra que sai quente da chapa. */}
          <figure className="hero-photo">
            <div className="hero-photo-frame">
              <img src={hero?.image || `${import.meta.env.BASE_URL}food/hero.webp`} alt={hero ? `${hero.name}: ${hero.description}` : 'Hambúrguer da Kero+'} />
              <div className="steam" aria-hidden="true"><i /><i /><i /></div>
            </div>
            {hero && (
              <figcaption className="hero-ticket">
                <span className="ticket-kicker">Lanche da casa</span>
                <strong>{hero.name}</strong>
                <span className="row between">
                  <span className="num">{formatBRL(hero.price)}</span>
                  <button className="add-btn" aria-label={`Adicionar ${hero.name}`} onClick={() => add(hero)}><Plus size={22} color="currentColor" /></button>
                </span>
              </figcaption>
            )}
          </figure>
        </div>
      </section>

      <main className="container order-main">
        {highlights.length > 0 && (
          <section className="highlights" aria-labelledby="hl-title">
            <h2 id="hl-title" className="display">Mais pedidos</h2>
            <div className="hl-row">
              {highlights.map((p) => (
                <article key={p.id} className="hl-card">
                  <div className="hl-art"><FoodArt art={p.art} image={p.image} alt={p.name} /></div>
                  <div className="hl-body">
                    <h3 className="display">{p.name}</h3>
                    <div className="row between">
                      <strong className="num">{formatBRL(p.price)}</strong>
                      <button className="add-btn" aria-label={`Adicionar ${p.name}`} onClick={() => add(p)}><Plus size={22} color="currentColor" /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        <MenuBrowser menu={menu} cta="Adicionar" onAdd={(p, qty, notes) => add(p, qty, notes)} />
      </main>

      {count > 0 && (
        <div className="bottom-bar">
          <button className="btn btn-red btn-lg btn-block" onClick={() => setOpen(true)}>
            Ver sacola ({count}) <span className="num">{formatBRL(subtotal)}</span>
          </button>
        </div>
      )}
      <CartDrawer open={open} onClose={() => setOpen(false)} />
      <SiteFooter />
    </div>
  )
}
