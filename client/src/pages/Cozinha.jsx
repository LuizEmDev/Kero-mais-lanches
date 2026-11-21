import { useEffect, useRef, useState } from 'react'
import { Logo } from '../components/Brand.jsx'
import Icon from '../components/Icon.jsx'
import { useToast } from '../components/ui.jsx'
import { StaffGate, useStaffData, beep, unlockAudio } from '../components/Staff.jsx'
import { api } from '../lib/api.js'
import { useNow, minutesSince, clock, useMedia } from '../lib/hooks.js'
import { clearStaffToken } from '../lib/local.js'

const COLS = [
  { id: 'novo', label: 'Na fila', action: 'Começar', next: 'preparando' },
  { id: 'preparando', label: 'Na chapa', action: 'Pronto', next: 'pronto' },
  { id: 'pronto', label: 'Prontos', next: 'entregue' },
]
const doneLabel = (t) => (t.channel === 'entrega' ? 'Despachar' : t.channel === 'retirada' ? 'Retirado' : 'Levado à mesa')
const title = (t) => (t.channel === 'mesa' ? `Mesa ${t.table_number}` : t.channel === 'entrega' ? 'Entrega' : 'Retirada')

export default function Cozinha() {
  return <StaffGate title="Painel da cozinha"><Kitchen /></StaffGate>
}

function Kitchen() {
  const { data, reload, setData } = useStaffData('/staff/tickets', { kinds: ['ticket', 'payment', 'order', 'kitchen'], poll: 20000 })
  const now = useNow(15000)
  const toast = useToast()
  const [sound, setSound] = useState(false)
  const [tab, setTab] = useState('novo')
  const wide = useMedia('(min-width: 900px)')
  const seen = useRef(null)

  useEffect(() => {
    if (!data) return
    const ids = data.filter((t) => t.status === 'novo').map((t) => t.id)
    if (seen.current && ids.some((id) => !seen.current.includes(id))) {
      if (sound) beep()
      toast('Pedido novo na fila')
    }
    seen.current = ids
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const move = async (t, status) => {
    setData((d) => d.map((x) => (x.id === t.id ? { ...x, status } : x)))
    try { await api(`/staff/tickets/${t.id}/status`, { body: { status }, staff: true }) } catch (e) { toast(e.message, 'red'); reload() }
  }

  const list = (data || []).filter((t) => t.status !== 'entregue')
  const done = (data || []).filter((t) => t.status === 'entregue').sort((a, b) => b.done_at - a.done_at).slice(0, 4)
  const cols = wide ? COLS : COLS.filter((c) => c.id === tab)

  return (
    <div className="kitchen">
      <header className="kitchen-top">
        <Logo size={30} color="var(--branco)" plus="var(--gema)" />
        <h1 className="display">Cozinha</h1>
        <span className="num kitchen-clock">{clock(now)}</span>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <button className={`btn btn-sm ${sound ? 'btn-yellow' : 'btn-ghost on-dark'}`} onClick={() => { unlockAudio(); setSound(!sound); if (!sound) beep([660]) }} aria-pressed={sound}>
            <Icon name="sound" size={18} /> {sound ? 'Som ligado' : 'Ligar som'}
          </button>
          <button className="icon-btn on-dark" aria-label="Tela cheia" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}><Icon name="expand" /></button>
          <button className="icon-btn on-dark" aria-label="Sair" onClick={clearStaffToken}><Icon name="logout" /></button>
        </div>
      </header>
      {!wide && (
        <nav className="kitchen-tabs seg" aria-label="Colunas">
          {COLS.map((c) => <button key={c.id} aria-pressed={tab === c.id} onClick={() => setTab(c.id)}>{c.label} <span className="num">{list.filter((t) => t.status === c.id).length}</span></button>)}
        </nav>
      )}
      <div className="kitchen-cols" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
        {cols.map((c) => {
          const tickets = list.filter((t) => t.status === c.id)
          return (
            <section key={c.id} className={`kcol kcol-${c.id}`} aria-label={c.label}>
              {wide && <h2>{c.label} <span className="num">{tickets.length}</span></h2>}
              {!tickets.length && <p className="kcol-empty">{c.id === 'novo' ? 'Nenhum pedido esperando.' : c.id === 'preparando' ? 'Chapa livre.' : 'Nada esperando para sair.'}</p>}
              {tickets.map((t) => {
                const mins = minutesSince(t.created_at, now)
                const late = mins >= 20 ? 'late' : mins >= 12 ? 'warn' : ''
                return (
                  <article key={t.id} className={`ticket ${late}`}>
                    <header>
                      <div>
                        <strong className="display">{title(t)}</strong>
                        <small>{t.channel === 'mesa' ? `${t.round}º pedido da mesa` : `${t.customer_name || ''} #${t.code}`}</small>
                      </div>
                      <span className="ticket-time num">{mins} min</span>
                    </header>
                    <ul>
                      {t.items.map((i, k) => (
                        <li key={k}>
                          <span className="ticket-qty num">{i.qty}</span>
                          <span>{i.name}{i.notes && <em>{i.notes}</em>}{t.channel === 'mesa' && i.who && <small>{i.who}</small>}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="ticket-actions">
                      {c.id === 'preparando' && <button className="btn btn-sm btn-ghost" onClick={() => move(t, 'novo')}>Voltar</button>}
                      <button className={`btn ${c.id === 'pronto' ? 'btn-yellow' : 'btn-red'} btn-block`} onClick={() => move(t, c.next)}>{c.action || doneLabel(t)}</button>
                    </div>
                  </article>
                )
              })}
            </section>
          )
        })}
      </div>
      {done.length > 0 && (
        <footer className="kitchen-done">
          <span>Saíram agora:</span>
          {done.map((t) => <button key={t.id} className="chip on-dark" onClick={() => move(t, 'pronto')} title="Desfazer: voltar para prontos">{title(t)} {t.channel !== 'mesa' ? `#${t.code}` : ''}</button>)}
        </footer>
      )}
    </div>
  )
}
