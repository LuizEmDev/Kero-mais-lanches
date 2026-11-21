import { useLayoutEffect, useRef, useState } from 'react'
import { SiteHeader, SiteFooter, CartDrawer, useCartLines } from '../components/Site.jsx'
import { Plus } from '../components/Brand.jsx'
import FoodArt from '../components/FoodArt.jsx'
import Hero3D from '../components/Hero3D.jsx'
import Icon from '../components/Icon.jsx'
import { useToast } from '../components/ui.jsx'
import { Marquee, SplitChars, gsap, useSmoothScroll, Cursor } from '../components/motion.jsx'
import { MenuBrowser, flyToCart } from '../components/Menu.jsx'
import { reducedMotion, useConfig, useMenu } from '../lib/hooks.js'
import { useRoom } from '../lib/socket.js'
import { cart, local, useLocal } from '../lib/local.js'
import { formatBRL } from '@shared/money.js'

const HIGHLIGHTS = ['Kero+ Duplo', 'X-Tudo', 'Dogão completo', 'Batata cheddar e bacon', 'Milkshake', 'Açaí 300 ml']

// A página inicial é o cardápio: o cliente chega e já pede.
export default function Home() {
  useSmoothScroll()
  const root = useRef(null)
  const { menu, reload } = useMenu()
  const config = useConfig()
  const toast = useToast()
  const channel = useLocal((s) => s.channel || 'entrega')
  const group = useLocal((s) => Boolean(s.groupIntent))
  const { count, subtotal } = useCartLines()
  const [open, setOpen] = useState(false)
  useRoom('menu', { menu: reload })

  // A abertura com contador só aparece na primeira visita da sessão e nunca com movimento reduzido.
  const [intro] = useState(() => {
    if (reducedMotion()) return false
    try { return !sessionStorage.getItem('kero:intro') } catch { return false }
  })

  useLayoutEffect(() => {
    if (reducedMotion()) return
    const ctx = gsap.context(() => {
      try { sessionStorage.setItem('kero:intro', '1') } catch { /* sem storage */ }
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      if (intro) {
        tl.fromTo('.preloader-count', { textContent: 0 }, { textContent: 100, duration: 0.8, ease: 'power2.inOut', snap: { textContent: 1 } })
          .to('.preloader-plus', { rotate: 180, duration: 0.8, ease: 'power2.inOut' }, 0)
          .to('.preloader', { yPercent: -100, duration: 0.7, ease: 'expo.inOut' })
      }
      // Letras sobem, o "+" gira e o lanche se monta camada por camada.
      tl.from('.hero-word .char', { yPercent: 110, duration: 1, stagger: 0.05 }, intro ? '-=0.3' : 0)
        .from('.hero-plus', { scale: 0, rotate: -180, duration: 1, ease: 'back.out(1.8)' }, '<0.25')
        .from('.hero-copy > *', { y: 24, opacity: 0, duration: 0.8, stagger: 0.08 }, '-=0.7')

    }, root)
    return () => ctx.revert()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const add = (p, qty, notes, el) => {
    cart.add(p.id, qty, notes)
    flyToCart(el)
    toast(`${p.name} na sacola`)
  }
  const highlights = (menu || []).filter((p) => HIGHLIGHTS.includes(p.name) && p.available)
  const eta = config ? config.prep_minutes + (channel === 'entrega' ? 15 : 0) : null

  return (
    <div ref={root} className="home">
      <Cursor />
      {intro && (
        <div className="preloader" aria-hidden="true">
          <span className="preloader-plus"><Plus size={84} /></span>
          <span className="preloader-count display num">0</span>
        </div>
      )}

      <section className="hero">
        <SiteHeader tone="yellow" />
        <div className="hero-grid container">
          <div className="hero-copy">
            <h1 className="hero-word display" aria-label="Kero+ cardápio">
              <SplitChars text="kero" />
              <span className="hero-plus"><Plus size={200} className="hero-plus-svg" /></span>
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
          <div className="hero-burger-wrap"><Hero3D delay={intro ? 1.5 : 0.35} scrollTrigger=".hero" /></div>
        </div>
      </section>

      <Marquee className="band-red">
        {['na chapa', 'no pão brioche', 'no Pix', 'na sua casa', 'na sua mesa'].map((t) => (
          <span key={t} className="marquee-item display">{t}<Plus size={34} color="var(--gema)" /></span>
        ))}
      </Marquee>

      <main className="container order-main">
        {highlights.length > 0 && (
          <section className="highlights" aria-labelledby="hl-title">
            <h2 id="hl-title" className="display">Mais pedidos</h2>
            <div className="hl-row">
              {highlights.map((p, i) => (
                <article key={p.id} className={`hl-card ${i % 2 ? 'hl-white' : 'hl-yellow'}`}>
                  <div className="hl-art"><FoodArt art={p.art} image={p.image} /></div>
                  <h3 className="display">{p.name}</h3>
                  <div className="row between">
                    <strong className="num">{formatBRL(p.price)}</strong>
                    <button className="add-btn" aria-label={`Adicionar ${p.name}`} onClick={(e) => add(p, 1, '', e.currentTarget)} data-cursor="Quero">
                      <Plus size={22} color="currentColor" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        <MenuBrowser menu={menu} cta="Adicionar" onAdd={add} />
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
