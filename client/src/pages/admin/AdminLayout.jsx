import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { Logo } from '../../components/Brand.jsx'
import Icon from '../../components/Icon.jsx'
import { useToast } from '../../components/ui.jsx'
import { StaffGate, beep, unlockAudio } from '../../components/Staff.jsx'
import { useRoom } from '../../lib/socket.js'
import { clearStaffToken } from '../../lib/local.js'

const LINKS = [
  ['/admin', 'Visão geral', 'chart', true],
  ['/admin/pedidos', 'Pedidos', 'list'],
  ['/admin/salao', 'Salão', 'table'],
  ['/admin/cardapio', 'Cardápio', 'bag'],
  ['/admin/ajustes', 'Ajustes', 'gear'],
]

export default function AdminLayout() {
  return <StaffGate title="Painel da loja"><Shell /></StaffGate>
}

function Shell() {
  const toast = useToast()
  const armed = useRef(false)
  useEffect(() => {
    const arm = () => { unlockAudio(); armed.current = true }
    window.addEventListener('pointerdown', arm, { once: true })
    return () => window.removeEventListener('pointerdown', arm)
  }, [])
  // Chamados de mesa e pedidos novos aparecem em qualquer tela do painel.
  useRoom('staff', {
    staff: (ev) => {
      if (ev.kind === 'call:new') { toast('Uma mesa chamou o atendente. Veja no Salão.', 'red'); if (armed.current) beep([988, 784, 988]) }
      if (ev.kind === 'order:new') toast('Pedido novo de entrega ou retirada')
    },
    'auth:error': clearStaffToken,
  })
  return (
    <div className="admin">
      <aside className="admin-nav">
        <Logo size={30} />
        <nav aria-label="Painel">
          {LINKS.map(([to, label, icon, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'on' : '')}><Icon name={icon} /> <span>{label}</span></NavLink>
          ))}
          <a href={`${import.meta.env.BASE_URL}cozinha`} target="_blank" rel="noreferrer"><Icon name="chef" /> <span>Cozinha</span></a>
        </nav>
        <button className="link-btn admin-out" onClick={clearStaffToken}><Icon name="logout" size={18} /> Sair</button>
      </aside>
      <main className="admin-main"><Outlet /></main>
    </div>
  )
}
