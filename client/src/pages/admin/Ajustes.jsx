import { useEffect, useState } from 'react'
import { useStaffData } from '../../components/Staff.jsx'
import { useToast } from '../../components/ui.jsx'
import { api } from '../../lib/api.js'

const toInput = (c) => (c / 100).toFixed(2).replace('.', ',')
const toCents = (v) => Math.round(Number(String(v).replace(',', '.')) * 100)

export default function Ajustes() {
  const { data } = useStaffData('/staff/settings', { poll: 600000 })
  const toast = useToast()
  const [f, setF] = useState(null)
  useEffect(() => { if (data && !f) setF({ ...data, delivery_fee: toInput(data.delivery_fee) }) }, [data]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!f) return <div className="empty"><div className="spinner"><span /></div></div>
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault()
    try {
      await api('/staff/settings', { method: 'PATCH', staff: true, body: { ...f, delivery_fee: toCents(f.delivery_fee), service_pct: Number(f.service_pct), prep_minutes: Number(f.prep_minutes) } })
      toast('Ajustes salvos', 'green')
    } catch (err) { toast(err.message, 'red') }
  }
  return (
    <form className="stack settings" style={{ '--gap': '20px' }} onSubmit={save}>
      <header className="row between wrap"><h1 className="display">Ajustes</h1><button className="btn btn-red">Salvar ajustes</button></header>

      <section className="panel stack">
        <h2>Pix</h2>
        {data.pix_provider === 'mercadopago' ? (
          <p className="ok-box">Mercado Pago conectado. Cada Pix é confirmado sozinho pelo banco.</p>
        ) : (
          <p className="muted">Modo chave Pix: o QR code usa a chave abaixo e qualquer banco aceita. Como o banco não avisa a loja, confirme cada pagamento em Pedidos, “Confirmar Pix recebido”. Para confirmação automática, ligue o Mercado Pago (veja o README).</p>
        )}
        <label className="field"><span>Chave Pix</span><input className="input" value={f.pix_key} onChange={set('pix_key')} placeholder="CNPJ, e-mail, celular (+55...) ou chave aleatória" /></label>
        <div className="grid-2">
          <label className="field"><span>Nome no Pix</span><input className="input" maxLength={25} value={f.merchant_name} onChange={set('merchant_name')} /><small>Até 25 letras, sem acento.</small></label>
          <label className="field"><span>Cidade</span><input className="input" maxLength={15} value={f.merchant_city} onChange={set('merchant_city')} /></label>
        </div>
      </section>

      <section className="panel stack">
        <h2>Pedidos</h2>
        <div className="grid-2">
          <label className="field"><span>Taxa de entrega (R$)</span><input className="input num" inputMode="decimal" value={f.delivery_fee} onChange={set('delivery_fee')} /></label>
          <label className="field"><span>Taxa de serviço na mesa (%)</span><input className="input num" inputMode="numeric" value={f.service_pct} onChange={set('service_pct')} /></label>
        </div>
        <label className="field"><span>Tempo médio de preparo (min)</span><input className="input num" inputMode="numeric" value={f.prep_minutes} onChange={set('prep_minutes')} /><small>Usado na previsão que o cliente vê.</small></label>
      </section>

      <section className="panel stack">
        <h2>Loja</h2>
        <label className="field"><span>Nome</span><input className="input" value={f.name} onChange={set('name')} /></label>
        <label className="field"><span>Endereço</span><input className="input" value={f.address} onChange={set('address')} /></label>
        <div className="grid-2">
          <label className="field"><span>Telefone</span><input className="input" value={f.phone} onChange={set('phone')} /></label>
          <label className="field"><span>Horário</span><input className="input" value={f.hours} onChange={set('hours')} /></label>
        </div>
      </section>
    </form>
  )
}
