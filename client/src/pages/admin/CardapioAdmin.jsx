import { useState } from 'react'
import { useStaffData } from '../../components/Staff.jsx'
import { Sheet, useToast } from '../../components/ui.jsx'
import FoodArt from '../../components/FoodArt.jsx'
import { api } from '../../lib/api.js'
import { staffToken } from '../../lib/local.js'
import { CATEGORIES } from '../../lib/hooks.js'
import { formatBRL } from '@shared/money.js'

const ARTS = ['burger:classic', 'burger:salada', 'burger:bacon', 'burger:egg', 'burger:tudo', 'burger:double', 'burger:frango', 'burger:veggie', 'hotdog:simple', 'hotdog:full', 'fries:plain', 'fries:cheddar', 'rings', 'cassava', 'can', 'cup:juice', 'cup:shake', 'cup:acai', 'bottle', 'water', 'pudding', 'brownie']
// Recorta a foto em quadrado (centro), reduz para 1000 px e comprime em WebP antes de enviar.
async function prepareImage(file) {
  const bmp = await createImageBitmap(file)
  const side = Math.min(bmp.width, bmp.height)
  const size = Math.min(1000, side)
  const c = document.createElement('canvas')
  c.width = c.height = size
  c.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size)
  const blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.86))
  if (blob && blob.type === 'image/webp') return blob
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.88))
}

const toCents = (v) => Math.round(Number(String(v).replace(/\./g, '').replace(',', '.')) * 100)
const toInput = (c) => (c / 100).toFixed(2).replace('.', ',')

export default function CardapioAdmin() {
  const { data, setData, reload } = useStaffData('/staff/products', { kinds: ['menu'] })
  const toast = useToast()
  const [edit, setEdit] = useState(null)

  const patch = async (p, body) => {
    setData((d) => d.map((x) => (x.id === p.id ? { ...x, ...body } : x)))
    try { await api(`/staff/products/${p.id}`, { method: 'PATCH', body, staff: true }) } catch (e) { toast(e.message, 'red'); reload() }
  }

  return (
    <div className="stack" style={{ '--gap': '20px' }}>
      <header className="row between wrap">
        <h1 className="display">Cardápio</h1>
        <button className="btn btn-red" onClick={() => setEdit({ name: '', description: '', price: 0, category: 'lanches', art: 'burger:classic', available: true })}>Novo item</button>
      </header>
      <p className="muted">Desligue um item quando acabar: ele some do pedido dos clientes na hora.</p>
      {CATEGORIES.map((c) => {
        const list = (data || []).filter((p) => p.category === c.id)
        if (!list.length) return null
        return (
          <section key={c.id} className="panel stack">
            <h2>{c.label}</h2>
            <ul className="admin-products">
              {list.map((p) => (
                <li key={p.id} className={p.available ? '' : 'off'}>
                  <div className="cart-art"><FoodArt art={p.art} image={p.image} /></div>
                  <button className="ap-name" onClick={() => setEdit(p)}><strong>{p.name}</strong><small className="muted num">{formatBRL(p.price)}</small></button>
                  <label className="switch">
                    <input type="checkbox" checked={p.available} onChange={(e) => patch(p, { available: e.target.checked })} />
                    <span aria-hidden="true" />
                    <span className="sr-only">{p.name} disponível</span>
                    <small>{p.available ? 'Disponível' : 'Esgotado'}</small>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      <EditSheet product={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload() }} />
    </div>
  )
}

function EditSheet({ product, onClose, onSaved }) {
  const [f, setF] = useState(null)
  const [error, setError] = useState(null)
  if (!product) return null
  const form = f && f._id === (product.id ?? 'new') ? f : { ...product, price: toInput(product.price), _id: product.id ?? 'new' }
  const set = (k, v) => setF({ ...form, [k]: v })
  const save = async (e) => {
    e.preventDefault()
    setError(null)
    const body = { name: form.name, description: form.description, price: toCents(form.price), category: form.category, art: form.art, available: form.available }
    try {
      if (product.id) await api(`/staff/products/${product.id}`, { method: 'PATCH', body, staff: true })
      else await api('/staff/products', { body, staff: true })
      setF(null); onSaved()
    } catch (err) { setError(err.message) }
  }
  return (
    <Sheet open onClose={() => { setF(null); onClose() }} title={product.id ? 'Editar item' : 'Novo item'}>
      <form className="stack" onSubmit={save}>
        {product.id ? <PhotoField product={product} onChange={onSaved} /> : <p className="muted">Depois de criar o item, abra de novo para enviar a foto real.</p>}
        <p className="field-label">Imagem 3D (usada enquanto não houver foto real)</p>
        <div className="art-pick">
          {ARTS.map((a) => <button type="button" key={a} aria-pressed={form.art === a} onClick={() => set('art', a)} aria-label={a}><FoodArt art={a} /></button>)}
        </div>
        <label className="field"><span>Nome</span><input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label className="field"><span>Descrição</span><textarea className="input" value={form.description} onChange={(e) => set('description', e.target.value)} /></label>
        <div className="grid-2">
          <label className="field"><span>Preço (R$)</span><input className="input num" inputMode="decimal" required value={form.price} onChange={(e) => set('price', e.target.value)} /></label>
          <label className="field"><span>Categoria</span>
            <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          </label>
        </div>
        {error && <p className="error-box">{error}</p>}
        <button className="btn btn-red btn-lg">{product.id ? 'Salvar alterações' : 'Criar item'}</button>
      </form>
    </Sheet>
  )
}

function PhotoField({ product, onChange }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const upload = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      const blob = await prepareImage(file)
      const res = await fetch(`/api/staff/products/${product.id}/image`, { method: 'PUT', headers: { 'Content-Type': blob.type, Authorization: `Bearer ${staffToken()}` }, body: blob })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não deu para enviar a foto.')
      toast('Foto real publicada no cardápio', 'green')
      onChange()
    } catch (e) { toast(e.message, 'red') }
    setBusy(false)
  }
  return (
    <section className="photo-field">
      <p className="field-label">Foto real do produto</p>
      <div className="photo-row">
        <div className="photo-preview"><FoodArt art={product.art} image={product.image} alt={product.name} /></div>
        <div className="stack" style={{ '--gap': '8px' }}>
          <p className="muted">{product.image ? 'Os clientes veem esta foto.' : 'Sem foto: os clientes veem a imagem 3D. Use uma foto com o lanche centralizado e boa luz.'}</p>
          <label className={`btn btn-yellow ${busy ? 'is-busy' : ''}`}>
            {busy ? 'Enviando...' : product.image ? 'Trocar foto' : 'Enviar foto'}
            <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          {product.image && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => {
              try { await api(`/staff/products/${product.id}/image`, { method: 'DELETE', staff: true }); toast('Foto removida. Voltou a imagem 3D.'); onChange() } catch (e) { toast(e.message, 'red') }
            }}>Remover foto</button>
          )}
        </div>
      </div>
    </section>
  )
}
