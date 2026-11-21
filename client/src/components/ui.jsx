import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'

export function Sheet({ open, onClose, title, children, labelledBy }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.documentElement.style.overflow = 'hidden'
    setTimeout(() => ref.current?.querySelector('[data-autofocus], input, button')?.focus(), 30)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = ''
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()} data-lenis-prevent>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy || 'sheet-title'} ref={ref}>
        {title && (
          <div className="sheet-head">
            <h2 id="sheet-title">{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

const ToastCtx = createContext(() => {})
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((text, tone = '') => {
    const id = Math.random()
    setItems((s) => [...s.slice(-2), { id, text, tone }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3800)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

export function Qty({ value, onChange, min = 0, max = 20, label = 'quantidade' }) {
  return (
    <div className="qty" role="group" aria-label={label}>
      <button type="button" className="icon-btn" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Diminuir" disabled={value <= min}><Icon name="minus" size={18} /></button>
      <span className="num" aria-live="polite">{value}</span>
      <button type="button" className="icon-btn" onClick={() => onChange(Math.min(max, value + 1))} aria-label="Aumentar" disabled={value >= max}><Icon name="plus" size={18} /></button>
    </div>
  )
}

export function Spinner({ label = 'Carregando' }) {
  return <div className="spinner" role="status" aria-label={label}><span /></div>
}
