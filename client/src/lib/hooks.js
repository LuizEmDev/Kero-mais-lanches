import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

let menuCache = null
let configCache = null
export function useMenu() {
  const [menu, setMenu] = useState(menuCache)
  const reload = useCallback(() => api('/menu').then((m) => { menuCache = m; setMenu(m) }).catch(() => {}), [])
  useEffect(() => { reload() }, [reload])
  return { menu, reload, byId: Object.fromEntries((menu || []).map((p) => [p.id, p])) }
}
export function useConfig() {
  const [config, setConfig] = useState(configCache)
  useEffect(() => { api('/config').then((c) => { configCache = c; setConfig(c) }).catch(() => {}) }, [])
  return config
}

export function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), interval); return () => clearInterval(t) }, [interval])
  return now
}

export function useMedia(query) {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches
  const [m, setM] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const f = () => setM(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [query])
  return m
}

export const CATEGORIES = [
  { id: 'lanches', label: 'Lanches' },
  { id: 'dogs', label: 'Dogões' },
  { id: 'porcoes', label: 'Porções' },
  { id: 'bebidas', label: 'Bebidas' },
  { id: 'sobremesas', label: 'Sobremesas' },
]

export const minutesSince = (t, now = Date.now()) => Math.max(0, Math.floor((now - t) / 60000))
export const clock = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
export const dayLabel = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
