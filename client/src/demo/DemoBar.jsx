import { useState } from 'react'
import { resetDemo } from './sqlite-shim.js'

// Aviso da versão de demonstração publicada no GitHub Pages.
export default function DemoBar() {
  const [open, setOpen] = useState(() => { try { return sessionStorage.getItem('kero:demobar') !== '0' } catch { return true } })
  if (!open) return null
  return (
    <div className="demo-bar" role="note">
      <p>
        <strong>Demonstração.</strong> Tudo roda neste navegador: abra a cozinha e o painel em outras abas para ver os pedidos chegando.
        PIN da equipe: <strong>1234</strong>. Não pague os Pix: use “Simular pagamento”.
      </p>
      <div className="demo-bar-actions">
        <button onClick={() => { if (confirm('Apagar todos os pedidos e começar a demonstração do zero?')) { resetDemo(); try { localStorage.removeItem('kero:v1') } catch { /* */ } location.reload() } }}>Recomeçar</button>
        <button onClick={() => { setOpen(false); try { sessionStorage.setItem('kero:demobar', '0') } catch { /* */ } }} aria-label="Fechar aviso">Fechar</button>
      </div>
    </div>
  )
}
