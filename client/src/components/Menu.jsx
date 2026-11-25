import { useEffect, useMemo, useRef, useState } from 'react'
import FoodArt from './FoodArt.jsx'
import Icon from './Icon.jsx'
import { Sheet, Qty } from './ui.jsx'
import { Plus } from './Brand.jsx'
import { formatBRL } from '@shared/money.js'
import { CATEGORIES, reducedMotion } from '../lib/hooks.js'
import { toggleFavorite, useLocal } from '../lib/local.js'

export function ProductSheet({ product, onClose, onAdd, cta = 'Adicionar' }) {
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const btn = useRef(null)
  useEffect(() => { setQty(1); setNotes('') }, [product?.id])
  if (!product) return null
  return (
    <Sheet open={Boolean(product)} onClose={onClose} labelledBy="product-title">
      <div className="product-sheet">
        <button className="icon-btn product-sheet-close" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>
        <div className="product-sheet-art"><FoodArt art={product.art} image={product.image} alt={product.name} eager /></div>
        <h2 id="product-title" className="display">{product.name}</h2>
        <p className="muted">{product.description}</p>
        <label className="field">
          <span>Alguma observação?</span>
          <textarea className="input" maxLength={140} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: sem cebola, carne ao ponto" />
        </label>
        <div className="row between">
          <Qty value={qty} onChange={setQty} min={1} />
          <button ref={btn} className="btn btn-red btn-lg" onClick={() => { onAdd(product, qty, notes, btn.current); onClose() }}>
            {cta} <span className="num">{formatBRL(product.price * qty)}</span>
          </button>
        </div>
      </div>
    </Sheet>
  )
}

export function ProductRow({ product, onOpen, onQuickAdd, favorite }) {
  const btn = useRef(null)
  const soldOut = !product.available
  return (
    <article className={`product-row ${soldOut ? 'is-out' : ''}`}>
      <button className="product-row-main" onClick={() => !soldOut && onOpen(product)} disabled={soldOut} data-cursor={soldOut ? undefined : 'Ver'}>
        <div className="product-row-art"><FoodArt art={product.art} image={product.image} /></div>
        <div className="product-row-info">
          <h3>{product.name}</h3>
          <p className="muted">{product.description}</p>
          <div className="row wrap" style={{ '--gap': '6px' }}>
            <strong className="num">{formatBRL(product.price)}</strong>
            {soldOut ? <span className="tag tag-soft">Acabou por hoje</span> : product.tags.map((t) => <span key={t} className="tag">{t}</span>)}
          </div>
        </div>
      </button>
      <div className="product-row-actions">
        <button className={`icon-btn fav ${favorite ? 'on' : ''}`} aria-pressed={favorite} aria-label={favorite ? `Tirar ${product.name} dos favoritos` : `Favoritar ${product.name}`} onClick={() => toggleFavorite(product.id)}>
          <Icon name="heart" size={20} />
        </button>
        {!soldOut && (
          <button ref={btn} className="add-btn" aria-label={`Adicionar ${product.name}`} onClick={() => onQuickAdd(product, btn.current)}>
            <Plus size={22} color="currentColor" />
          </button>
        )}
      </div>
    </article>
  )
}

export function MenuBrowser({ menu, onAdd, cta, compact = false }) {
  const favorites = useLocal((s) => s.favorites)
  const [open, setOpen] = useState(null)
  const [q, setQ] = useState('')
  const [active, setActive] = useState('lanches')
  const sections = useRef({})

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (menu || []).filter((p) => !term || p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term))
  }, [menu, q])

  const cats = [
    ...(favorites.length && !q ? [{ id: 'favoritos', label: 'Favoritos' }] : []),
    ...CATEGORIES,
  ].filter((c) => c.id === 'favoritos' || filtered.some((p) => p.category === c.id))

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis[0]) setActive(vis[0].target.dataset.cat)
    }, { rootMargin: '-140px 0px -60% 0px' })
    Object.values(sections.current).forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [cats.length, filtered.length])

  const jump = (id) => {
    const el = sections.current[id]
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY - 130
    window.scrollTo({ top: y, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  if (!menu) return <div className="menu-skeleton" aria-busy="true">{Array.from({ length: 5 }, (_, i) => <div key={i} />)}</div>

  return (
    <div className={`menu ${compact ? 'menu-compact' : ''}`}>
      <div className="menu-bar">
        <label className="menu-search">
          <span className="sr-only">Buscar no cardápio</span>
          <input className="input" type="search" placeholder="Buscar: bacon, batata, açaí..." value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <nav className="menu-cats" aria-label="Categorias">
          {cats.map((c) => (
            <button key={c.id} className="chip" aria-pressed={active === c.id} onClick={() => jump(c.id)}>{c.label}</button>
          ))}
        </nav>
      </div>
      {!filtered.length && <div className="empty"><p>Nada com “{q}” no cardápio. Tente outra palavra.</p></div>}
      {cats.map((c) => {
        const list = c.id === 'favoritos' ? filtered.filter((p) => favorites.includes(p.id)) : filtered.filter((p) => p.category === c.id)
        if (!list.length) return null
        return (
          <section key={c.id} className="menu-section" data-cat={c.id} ref={(el) => (sections.current[c.id] = el)} aria-labelledby={`cat-${c.id}`}>
            <h2 id={`cat-${c.id}`} className="display menu-section-title">{c.label}</h2>
            <div className="menu-list">
              {list.map((p) => (
                <ProductRow key={p.id} product={p} favorite={favorites.includes(p.id)} onOpen={setOpen} onQuickAdd={(prod, el) => onAdd(prod, 1, '', el)} />
              ))}
            </div>
          </section>
        )
      })}
      <ProductSheet product={open} onClose={() => setOpen(null)} onAdd={onAdd} cta={cta} />
    </div>
  )
}
