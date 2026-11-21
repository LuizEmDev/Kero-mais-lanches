import { useEffect, useRef, useState } from 'react'
import { gsap, ScrollTrigger } from './motion.jsx'
import { artSrc } from './FoodArt.jsx'
import { reducedMotion } from '../lib/hooks.js'

/**
 * Hambúrguer 3D ao vivo: monta camada por camada, gira devagar, segue o ponteiro
 * e abre as camadas com a rolagem. Enquanto o 3D carrega (ou se o aparelho não
 * tiver WebGL / pedir menos movimento), mostra a renderização estática.
 */
export default function Hero3D({ art = 'burger:tudo', delay = 0.3, scrollTrigger }) {
  const wrap = useRef(null)
  const canvasRef = useRef(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (reducedMotion()) return
    let disposed = false
    let cleanup = () => {}
    import('../three/food3d.js').then(({ buildFood, createStudio }) => {
      if (disposed || !canvasRef.current) return
      let studio
      try { studio = createStudio(canvasRef.current, { alpha: true, pixelRatio: Math.min(window.devicePixelRatio || 1, 1.75) }) } catch { return }
      const { renderer, scene, camera, frame } = studio
      const food = buildFood(art)
      const layers = food.userData.layers || []
      const pivot = new studio.THREE.Group()
      pivot.add(food)
      scene.add(pivot)
      frame(food, { elevation: 0.3, fill: 0.98, offsetY: 0.1 })

      const resize = () => {
        const r = wrap.current?.getBoundingClientRect()
        if (!r || !r.width) return
        renderer.setSize(r.width, r.height, false)
        camera.aspect = r.width / r.height
        camera.updateProjectionMatrix()
      }
      resize()
      const ro = new ResizeObserver(resize)
      ro.observe(wrap.current)

      // Montagem: cada camada cai do alto, de baixo para cima.
      const state = { spin: 0, open: 0, tiltX: 0, tiltY: 0 }
      layers.forEach((l) => { l.position.y = l.userData.restY + 6 })
      pivot.rotation.y = -1.4
      const tl = gsap.timeline({ delay, onStart: () => setLive(true) })
      layers.forEach((l, i) => tl.to(l.position, { y: l.userData.restY, duration: 0.75, ease: 'bounce.out' }, i * 0.11))
      tl.to(pivot.rotation, { y: 0, duration: 1.8, ease: 'expo.out' }, 0)

      // Rolagem: as camadas se afastam (lanche "aberto") enquanto o topo sai da tela.
      const st = ScrollTrigger.create({
        trigger: scrollTrigger || wrap.current, start: 'top top', end: 'bottom top', scrub: 0.6,
        onUpdate: (self) => { state.open = self.progress },
      })

      const onMove = (e) => {
        gsap.to(state, { tiltY: (e.clientX / window.innerWidth - 0.5) * 0.9, tiltX: (e.clientY / window.innerHeight - 0.5) * 0.25, duration: 1.2, ease: 'power3.out' })
      }
      window.addEventListener('pointermove', onMove)

      let visible = true
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting })
      io.observe(wrap.current)

      const tick = (_t, dt) => {
        if (!visible) return
        state.spin += (dt / 1000) * 0.22
        if (!tl.isActive()) layers.forEach((l, i) => { l.position.y = l.userData.restY + i * 0.32 * state.open })
        food.rotation.y = state.spin + state.tiltY
        food.rotation.x = state.tiltX
        renderer.render(scene, camera)
      }
      gsap.ticker.add(tick)

      cleanup = () => {
        gsap.ticker.remove(tick)
        tl.kill(); st.kill(); ro.disconnect(); io.disconnect()
        window.removeEventListener('pointermove', onMove)
        scene.traverse((o) => { o.geometry?.dispose?.(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose?.()) })
        renderer.dispose()
      }
    }).catch(() => {})
    return () => { disposed = true; cleanup() }
  }, [art, delay, scrollTrigger])

  return (
    <div className={`hero-3d ${live ? 'is-live' : ''}`} ref={wrap}>
      <img className="hero-3d-still" src={artSrc(art)} alt="" aria-hidden="true" />
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  )
}
