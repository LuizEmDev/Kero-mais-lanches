import { useState } from 'react'
import { Logo, Plus } from './Brand.jsx'
import Icon from './Icon.jsx'
import FoodArt from './FoodArt.jsx'
import { Sheet, Qty } from './ui.jsx'
import { TLink, useGo } from './motion.jsx'
import { cart, useLocal } from '../lib/local.js'
import { useMenu, useConfig } from '../lib/hooks.js'
import { formatBRL } from '@shared/money.js'

export function useCartLines() {
  const items = useLocal((s) => s.cart)
  const { byId, menu } = useMenu()
  const lines = items.map((c) => ({ ...c, product: byId[c.product_id] })).filter((l) => l.product)
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0)
  const count = lines.reduce((s, l) => s + l.qty, 0)
  const unavailable = lines.filter((l) => !l.product.available)
  return { lines, subtotal, count, unavailable, loaded: Boolean(menu) }
}

export function SiteHeader({ tone = 'yellow' }) {
  const [open, setOpen] = useState(false)
  const { count } = useCartLines()
  return (
    <>
      <header className={`site-header tone-${tone}`}>
        <TLink to="/" className="site-logo" aria-label="Kero+ início" data-cursor="Início"><Logo size={34} /></TLink>
        <nav className="site-nav" aria-label="Principal">
          <TLink to="/">Cardápio</TLink>
          <TLink to="/conta">Meus pedidos</TLink>
        </nav>
        <button id="cart-target" className="cart-btn" onClick={() => setOpen(true)} aria-label={`Sacola, ${count} ${count === 1 ? 'item' : 'itens'}`}>
          <Icon name="bag" />
          <span className="num">{count}</span>
        </button>
      </header>
      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function CartDrawer({ open, onClose }) {
  const { lines, subtotal, unavailable } = useCartLines()
  const config = useConfig()
  const go = useGo()
  return (
    <Sheet open={open} onClose={onClose} title="Sua sacola">
      {!lines.length ? (
        <div className="empty">
          <p>Sua sacola está vazia. Escolha um lanche no cardápio.</p>
          <button className="btn btn-red" onClick={() => { onClose(); go('/') }}>Ver o cardápio</button>
        </div>
      ) : (
        <div className="stack">
          <ul className="cart-lines">
            {lines.map((l) => (
              <li key={l.key} className={!l.product.available ? 'is-out' : ''}>
                <div className="cart-art"><FoodArt art={l.product.art} image={l.product.image} /></div>
                <div>
                  <strong>{l.product.name}</strong>
                  {l.notes && <small className="muted">{l.notes}</small>}
                  {!l.product.available && <small className="tag tag-red">Acabou por hoje</small>}
                  <div className="num muted">{formatBRL(l.product.price * l.qty)}</div>
                </div>
                <Qty value={l.qty} onChange={(q) => cart.setQty(l.key, q)} label={`Quantidade de ${l.product.name}`} />
              </li>
            ))}
          </ul>
          <div className="row between"><span>Subtotal</span><strong className="num">{formatBRL(subtotal)}</strong></div>
          {config && <p className="muted" style={{ fontSize: '0.9rem' }}>Entrega: {formatBRL(config.delivery_fee)}. Retirada no balcão não paga taxa.</p>}
          {unavailable.length > 0 && <p className="error-box">Tire da sacola o que acabou para continuar.</p>}
          <button className="btn btn-red btn-lg btn-block" disabled={unavailable.length > 0} onClick={() => { onClose(); go('/checkout') }}>
            Continuar para o pagamento
          </button>
        </div>
      )}
    </Sheet>
  )
}

export function SiteFooter() {
  const config = useConfig()
  return (
    <footer className="site-footer on-red">
      <div className="container footer-grid">
        <div className="stack">
          <Logo size={64} color="var(--branco)" plus="var(--gema)" />
          <p>{config?.hours || 'Terça a domingo, 18h às 23h30'}</p>
          <p>{config?.address}</p>
          <p>{config?.phone}</p>
        </div>
        <nav className="footer-links" aria-label="Rodapé">
          <TLink to="/">Cardápio</TLink>
          <TLink to="/conta">Meus pedidos</TLink>
          <a href="/cozinha">Cozinha</a>
          <a href="/admin">Painel da loja</a>
        </nav>
      </div>
      <div className="footer-word display" aria-hidden="true"><span>kero</span><Plus size={100} color="var(--gema)" /></div>
    </footer>
  )
}
