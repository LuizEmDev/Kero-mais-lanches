import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { ToastProvider } from './components/ui.jsx'
import { TransitionProvider, TLink, ScrollTrigger } from './components/motion.jsx'
import { Logo } from './components/Brand.jsx'
import Home from './pages/Home.jsx'

const Cardapio = lazy(() => import('./pages/Cardapio.jsx'))
const Checkout = lazy(() => import('./pages/Checkout.jsx'))
const Pedido = lazy(() => import('./pages/Pedido.jsx'))
const Mesa = lazy(() => import('./pages/Mesa.jsx'))
const Conta = lazy(() => import('./pages/Conta.jsx'))
const Cozinha = lazy(() => import('./pages/Cozinha.jsx'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard.jsx'))
const Pedidos = lazy(() => import('./pages/admin/Pedidos.jsx'))
const Salao = lazy(() => import('./pages/admin/Salao.jsx'))
const CardapioAdmin = lazy(() => import('./pages/admin/CardapioAdmin.jsx'))
const Ajustes = lazy(() => import('./pages/admin/Ajustes.jsx'))

const TITLES = [
  [/^\/$/, 'Kero+ lanches'], [/^\/cardapio/, 'Cardápio | Kero+'], [/^\/checkout/, 'Finalizar pedido | Kero+'],
  [/^\/pedido/, 'Seu pedido | Kero+'], [/^\/mesa/, 'Mesa | Kero+'], [/^\/conta/, 'Minha conta | Kero+'],
  [/^\/cozinha/, 'Cozinha | Kero+'], [/^\/admin/, 'Painel | Kero+'],
]

function RouteEffects() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = (TITLES.find(([re]) => re.test(pathname)) || [, 'Kero+'])[1]
    const staff = pathname.startsWith('/cozinha') || pathname.startsWith('/admin')
    document.body.dataset.area = staff ? 'staff' : pathname.startsWith('/mesa') ? 'mesa' : 'site'
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }, [pathname])
  return null
}

function NotFound() {
  return (
    <div className="not-found">
      <Logo size={48} />
      <h1 className="display">Essa página não saiu da chapa</h1>
      <p>O endereço pode estar errado ou o pedido não existe mais.</p>
      <TLink to="/" className="btn btn-red btn-lg">Voltar ao início</TLink>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <TransitionProvider>
        <RouteEffects />
        <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
        <div id="conteudo">
          <Suspense fallback={<div className="route-loading"><div className="spinner"><span /></div></div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/cardapio" element={<Cardapio />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/pedido/:code" element={<Pedido />} />
              <Route path="/mesa/:numero" element={<Mesa />} />
              <Route path="/conta" element={<Conta />} />
              <Route path="/cozinha" element={<Cozinha />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="pedidos" element={<Pedidos />} />
                <Route path="salao" element={<Salao />} />
                <Route path="cardapio" element={<CardapioAdmin />} />
                <Route path="ajustes" element={<Ajustes />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </TransitionProvider>
    </ToastProvider>
  )
}
