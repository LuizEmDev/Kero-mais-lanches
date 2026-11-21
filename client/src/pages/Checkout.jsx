import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SiteHeader, useCartLines } from '../components/Site.jsx'
import FoodArt from '../components/FoodArt.jsx'
import Icon from '../components/Icon.jsx'
import { TLink } from '../components/motion.jsx'
import { api } from '../lib/api.js'
import { useConfig } from '../lib/hooks.js'
import { cart, local, rememberOrder, sessions, useLocal } from '../lib/local.js'
import { formatBRL } from '@shared/money.js'

const emptyAddr = { cep: '', rua: '', numero: '', complemento: '', bairro: '', referencia: '' }
const maskPhone = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`
}

export default function Checkout() {
  const navigate = useNavigate()
  const config = useConfig()
  const account = useLocal()
  const { lines, subtotal, count, unavailable, loaded } = useCartLines()
  const [channel, setChannelState] = useState(account.channel || 'entrega')
  const setChannel = (c) => { setChannelState(c); local.update(() => ({ channel: c })) }
  const [group, setGroup] = useState(Boolean(account.groupIntent))
  const [profile, setProfile] = useState(account.profile)
  const [addrIdx, setAddrIdx] = useState(account.addresses.length ? 0 : -1)
  const [addr, setAddr] = useState(emptyAddr)
  const [save, setSave] = useState(true)
  const [cepState, setCepState] = useState('')
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)

  const address = addrIdx >= 0 ? account.addresses[addrIdx] : addr
  const fee = channel === 'entrega' ? config?.delivery_fee || 0 : 0

  useEffect(() => {
    const cep = addr.cep.replace(/\D/g, '')
    if (cep.length !== 8) return
    let off = false
    setCepState('buscando')
    fetch(`https://viacep.com.br/ws/${cep}/json/`).then((r) => r.json()).then((d) => {
      if (off) return
      if (d.erro) { setCepState('nao'); return }
      setAddr((a) => ({ ...a, rua: d.logradouro || a.rua, bairro: d.bairro || a.bairro }))
      setCepState('ok')
    }).catch(() => !off && setCepState(''))
    return () => { off = true }
  }, [addr.cep])

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      const body = {
        channel, is_group: group,
        customer: { ...profile, address: channel === 'entrega' ? address : undefined },
        participant: { name: profile.name, device_id: local.get().deviceId },
        items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty, notes: l.notes })),
      }
      const { order, participant } = await api('/orders', { body })
      sessions.save(order.code, participant)
      rememberOrder({ code: order.code, channel, created_at: order.created_at, label: lines.map((l) => l.product.name).slice(0, 3).join(', ') })
      if (save) {
        local.update((s) => {
          const exists = channel === 'entrega' && addrIdx < 0 && address.rua
          return { profile, addresses: exists ? [address, ...s.addresses].slice(0, 5) : s.addresses }
        })
      }
      local.update(() => ({ groupIntent: false }))
      cart.clear()
      navigate(`/pedido/${order.code}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (loaded && !count) {
    return (
      <div className="page-checkout">
        <SiteHeader tone="white" />
        <div className="container empty">
          <h1 className="display">Sacola vazia</h1>
          <p>Escolha seus lanches no cardápio para continuar.</p>
          <TLink to="/" className="btn btn-red btn-lg">Ver o cardápio</TLink>
        </div>
      </div>
    )
  }

  return (
    <div className="page-checkout">
      <SiteHeader tone="white" />
      <form className="container checkout-grid" onSubmit={submit}>
        <div className="stack" style={{ '--gap': '28px' }}>
          <h1 className="display">Finalizar pedido</h1>

          <fieldset className="panel-line">
            <legend>Como você quer receber?</legend>
            <div className="choice-grid">
              <button type="button" className="choice" aria-pressed={channel === 'entrega'} onClick={() => setChannel('entrega')}>
                <Icon name="bike" size={28} /><strong>Entrega</strong><small className="num">{formatBRL(config?.delivery_fee || 0)}</small>
              </button>
              <button type="button" className="choice" aria-pressed={channel === 'retirada'} onClick={() => setChannel('retirada')}>
                <Icon name="store" size={28} /><strong>Retirar no balcão</strong><small>sem taxa</small>
              </button>
            </div>
          </fieldset>

          <fieldset className="panel-line">
            <legend>Quem vai pagar?</legend>
            <div className="choice-grid">
              <button type="button" className="choice" aria-pressed={!group} onClick={() => setGroup(false)}>
                <Icon name="user" size={28} /><strong>Só eu</strong><small>pago tudo agora</small>
              </button>
              <button type="button" className="choice" aria-pressed={group} onClick={() => setGroup(true)}>
                <Icon name="users" size={28} /><strong>Em grupo</strong><small>cada um paga a sua parte</small>
              </button>
            </div>
            {group && <p className="muted">Depois de confirmar, você recebe um link para mandar no grupo. Cada pessoa adiciona o próprio lanche e paga a sua parte. A taxa de entrega é dividida igualmente.</p>}
          </fieldset>

          <fieldset className="panel-line stack">
            <legend>Seus dados</legend>
            <label className="field"><span>Nome</span><input className="input" required autoComplete="name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
            <div className="grid-2">
              <label className="field"><span>Celular com DDD</span><input className="input" required inputMode="tel" autoComplete="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: maskPhone(e.target.value) })} placeholder="(11) 99999-0000" /></label>
              <label className="field"><span>E-mail <small>(opcional)</small></span><input className="input" type="email" autoComplete="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
            </div>
          </fieldset>

          {channel === 'entrega' && (
            <fieldset className="panel-line stack">
              <legend>Endereço de entrega</legend>
              {account.addresses.length > 0 && (
                <div className="stack" style={{ '--gap': '8px' }}>
                  {account.addresses.map((a, i) => (
                    <label key={i} className={`addr-option ${addrIdx === i ? 'on' : ''}`}>
                      <input type="radio" name="addr" checked={addrIdx === i} onChange={() => setAddrIdx(i)} />
                      <span><strong>{a.rua}, {a.numero}</strong>{a.complemento ? ` ${a.complemento}` : ''}<br /><small className="muted">{a.bairro}</small></span>
                    </label>
                  ))}
                  <label className={`addr-option ${addrIdx === -1 ? 'on' : ''}`}>
                    <input type="radio" name="addr" checked={addrIdx === -1} onChange={() => setAddrIdx(-1)} />
                    <span><strong>Outro endereço</strong></span>
                  </label>
                </div>
              )}
              {addrIdx === -1 && (
                <>
                  <div className="grid-2">
                    <div className="field"><label htmlFor="cep"><span>CEP</span></label><input id="cep" className="input" inputMode="numeric" autoComplete="postal-code" aria-describedby="cep-help" value={addr.cep} onChange={(e) => setAddr({ ...addr, cep: e.target.value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2') })} />
                      <small id="cep-help" aria-live="polite">{cepState === 'buscando' ? 'Buscando endereço...' : cepState === 'nao' ? 'CEP não encontrado. Preencha a rua à mão.' : 'Preenche a rua e o bairro sozinho.'}</small></div>
                    <label className="field"><span>Bairro</span><input className="input" required value={addr.bairro} onChange={(e) => setAddr({ ...addr, bairro: e.target.value })} /></label>
                  </div>
                  <label className="field"><span>Rua</span><input className="input" required autoComplete="address-line1" value={addr.rua} onChange={(e) => setAddr({ ...addr, rua: e.target.value })} /></label>
                  <div className="grid-2">
                    <label className="field"><span>Número</span><input className="input" required value={addr.numero} onChange={(e) => setAddr({ ...addr, numero: e.target.value })} /></label>
                    <label className="field"><span>Complemento</span><input className="input" value={addr.complemento} onChange={(e) => setAddr({ ...addr, complemento: e.target.value })} placeholder="Apto, bloco" /></label>
                  </div>
                  <label className="field"><span>Ponto de referência</span><input className="input" value={addr.referencia} onChange={(e) => setAddr({ ...addr, referencia: e.target.value })} /></label>
                </>
              )}
            </fieldset>
          )}

          <label className="row check-line"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> Salvar meus dados neste aparelho para a próxima vez</label>
        </div>

        <aside className="checkout-summary panel">
          <h2 className="display">Seu pedido</h2>
          <ul className="summary-lines">
            {lines.map((l) => (
              <li key={l.key}>
                <div className="cart-art"><FoodArt art={l.product.art} /></div>
                <span><span className="num">{l.qty}×</span> {l.product.name}{l.notes && <small className="muted">{l.notes}</small>}</span>
                <span className="num">{formatBRL(l.product.price * l.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="totals">
            <div><dt>Itens</dt><dd className="num">{formatBRL(subtotal)}</dd></div>
            <div><dt>{channel === 'entrega' ? 'Entrega' : 'Retirada'}</dt><dd className="num">{fee ? formatBRL(fee) : 'grátis'}</dd></div>
            <div className="grand"><dt>{group ? 'Sua parte agora' : 'Total'}</dt><dd className="num">{formatBRL(subtotal + fee)}</dd></div>
          </dl>
          {group && <p className="muted" style={{ fontSize: '0.9rem' }}>O valor de cada um é calculado quando o grupo terminar de escolher.</p>}
          {unavailable.length > 0 && <p className="error-box">Algum item acabou. Volte à sacola e remova para continuar.</p>}
          {error && <p className="error-box" role="alert">{error}</p>}
          {config && !config.pix_ready && <p className="error-box">A loja ainda não ativou o Pix. Configure a chave em Admin, Ajustes.</p>}
          <button className="btn btn-red btn-lg btn-block" disabled={sending || unavailable.length > 0}>
            {sending ? 'Enviando...' : group ? 'Criar pedido em grupo' : 'Ir para o pagamento Pix'}
          </button>
        </aside>
      </form>
    </div>
  )
}
