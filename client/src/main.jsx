import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles/base.css'
import './styles/site.css'
import './styles/app.css'
import './styles/staff.css'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

async function start() {
  // Versão de demonstração (GitHub Pages): o servidor roda dentro do navegador.
  if (import.meta.env.VITE_STATIC_DEMO) await (await import('./demo/boot.js')).boot()
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}
start()
