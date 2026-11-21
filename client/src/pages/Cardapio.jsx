import { useSearchParams } from 'react-router-dom'
import { SiteHeader, SiteFooter, useCartLines, CartDrawer } from '../components/Site.jsx'
import { MenuBrowser, flyToCart } from '../components/Menu.jsx'
import { useToast } from '../components/ui.jsx'
import { Cursor } from '../components/motion.jsx'
import { useMenu, useConfig } from '../lib/hooks.js'
import { useRoom } from '../lib/socket.js'
import { cart } from '../lib/local.js'
import { formatBRL } from '@shared/money.js'
import { useEffect, useState } from 'react'
import { local } from '../lib/local.js'

export default function Cardapio() {
  const { menu, reload } = useMenu()
  const config = useConfig()
  const toast = useToast()
  const [params] = useSearchParams()
  const group = params.get('grupo') === '1'
  const { count, subtotal } = useCartLines()
  const [open, setOpen] = useState(false)
  useRoom('menu', { menu: reload })
  useEffect(() => { if (group) local.update(() => ({ groupIntent: true })) }, [group])

  return (
    <div className="page-menu">
      <Cursor />
      <SiteHeader tone="white" />
      <header className="page-head container">
        <h1 className="display">Cardápio</h1>
        <p className="muted">{config?.hours}. Entrega em cerca de {config ? config.prep_minutes + 15 : 40} minutos.</p>
        {group && <p className="group-banner">Pedido em grupo: escolha o seu lanche agora. Na próxima tela você recebe um link para o resto do grupo entrar e escolher o deles.</p>}
      </header>
      <div className="container">
        <MenuBrowser menu={menu} cta="Adicionar" onAdd={(p, qty, notes, el) => { cart.add(p.id, qty, notes); flyToCart(el); toast(`${p.name} na sacola`) }} />
      </div>
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
