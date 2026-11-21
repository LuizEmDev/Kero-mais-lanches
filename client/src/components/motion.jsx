import { createContext, useCallback, useContext, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { Plus } from './Brand.jsx'
import { reducedMotion } from '../lib/hooks.js'

gsap.registerPlugin(ScrollTrigger)

// ---------- transição entre páginas: cortina vermelha + amarela com o "+" ----------
const NavCtx = createContext(null)

export function TransitionProvider({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const red = useRef(null)
  const yellow = useRef(null)
  const plus = useRef(null)
  const busy = useRef(false)
  const pending = useRef(false)

  const go = useCallback((to) => {
    if (busy.current) return
    if (reducedMotion()) { navigate(to); return }
    busy.current = true
    pending.current = true
    gsap.timeline({ defaults: { ease: 'expo.inOut' } })
      .set([red.current, yellow.current], { yPercent: 100, visibility: 'visible' })
      .to(red.current, { yPercent: 0, duration: 0.6 })
      .to(yellow.current, { yPercent: 0, duration: 0.6 }, 0.08)
      .fromTo(plus.current, { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(2)' }, 0.35)
      .add(() => { window.scrollTo(0, 0); navigate(to) })
  }, [navigate])

  useEffect(() => {
    if (!pending.current) return
    pending.current = false
    requestAnimationFrame(() => {
      gsap.timeline({ defaults: { ease: 'expo.inOut' }, onComplete: () => { busy.current = false; gsap.set([red.current, yellow.current], { visibility: 'hidden' }) } })
        .to(plus.current, { scale: 0, rotate: 90, duration: 0.35, ease: 'back.in(2)' })
        .to(yellow.current, { yPercent: -100, duration: 0.6 }, 0.15)
        .to(red.current, { yPercent: -100, duration: 0.6 }, 0.23)
    })
  }, [location.pathname])

  return (
    <NavCtx.Provider value={go}>
      {children}
      <div className="curtain curtain-red" ref={red} aria-hidden="true" />
      <div className="curtain curtain-yellow" ref={yellow} aria-hidden="true">
        <span ref={plus}><Plus size={120} /></span>
      </div>
    </NavCtx.Provider>
  )
}

export const useGo = () => useContext(NavCtx)

export function TLink({ to, children, onClick, ...rest }) {
  const go = useGo()
  return (
    <a
      href={to}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        go(to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}

// ---------- rolagem suave (Lenis) sincronizada com o ScrollTrigger ----------
let lenis = null
export const getLenis = () => lenis
export function useSmoothScroll() {
  useEffect(() => {
    if (reducedMotion()) return
    lenis = new Lenis({ lerp: 0.11, smoothWheel: true })
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (t) => lenis?.raf(t * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => { gsap.ticker.remove(tick); lenis?.destroy(); lenis = null }
  }, [])
}

// ---------- botão magnético ----------
export function Magnetic({ children, strength = 0.35 }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion() || !window.matchMedia('(pointer: fine)').matches) return
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' })
    const move = (e) => {
      const r = el.getBoundingClientRect()
      xTo((e.clientX - (r.left + r.width / 2)) * strength)
      yTo((e.clientY - (r.top + r.height / 2)) * strength)
    }
    const leave = () => { xTo(0); yTo(0) }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave) }
  }, [strength])
  return <span className="magnetic" ref={ref}>{children}</span>
}

// ---------- cursor: um "+" que cresce sobre o que dá para clicar ----------
export function Cursor() {
  const ref = useRef(null)
  const label = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion() || !window.matchMedia('(pointer: fine)').matches) return
    document.documentElement.classList.add('has-cursor')
    const xTo = gsap.quickTo(el, 'x', { duration: 0.35, ease: 'power3' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.35, ease: 'power3' })
    let shown = false
    const move = (e) => {
      if (!shown) { gsap.to(el, { autoAlpha: 1, duration: 0.2 }); shown = true }
      xTo(e.clientX); yTo(e.clientY)
      const target = e.target.closest?.('[data-cursor], a, button')
      const text = target?.getAttribute?.('data-cursor') || ''
      el.classList.toggle('is-hover', Boolean(target))
      el.classList.toggle('has-label', Boolean(text))
      if (label.current.textContent !== text) label.current.textContent = text
    }
    const out = () => { gsap.to(el, { autoAlpha: 0, duration: 0.2 }); shown = false }
    window.addEventListener('pointermove', move)
    document.addEventListener('pointerleave', out)
    return () => {
      document.documentElement.classList.remove('has-cursor')
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', out)
    }
  }, [])
  return (
    <div className="cursor" ref={ref} aria-hidden="true">
      <span className="cursor-dot"><Plus size={18} color="currentColor" /></span>
      <span className="cursor-label" ref={label} />
    </div>
  )
}

// ---------- faixa corrida que acelera e inverte com a rolagem ----------
export function Marquee({ children, speed = 60, className = '' }) {
  const track = useRef(null)
  useEffect(() => {
    const el = track.current
    if (!el || reducedMotion()) return
    let x = 0
    let dir = -1
    const tick = (_t, dt) => {
      const v = lenis?.velocity || 0
      if (Math.abs(v) > 0.5) dir = v > 0 ? -1 : 1
      const half = el.scrollWidth / 2
      x += dir * (speed + Math.min(Math.abs(v) * 40, 900)) * (dt / 1000)
      if (x <= -half) x += half
      if (x > 0) x -= half
      gsap.set(el, { x, skewX: gsap.utils.clamp(-8, 8, -v * 0.6) })
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [speed])
  return (
    <div className={`marquee ${className}`}>
      <div className="marquee-track" ref={track}>
        <div className="marquee-group">{children}</div>
        <div className="marquee-group" aria-hidden="true">{children}</div>
      </div>
    </div>
  )
}

// ---------- quebra texto em letras para animar ----------
export function SplitChars({ text, className = '' }) {
  return (
    <span className={className} aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} className="char-mask" aria-hidden="true"><span className="char">{ch === ' ' ? ' ' : ch}</span></span>
      ))}
    </span>
  )
}

export { gsap, ScrollTrigger }
