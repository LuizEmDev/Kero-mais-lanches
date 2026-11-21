import { useLayoutEffect, useRef, useState } from 'react'
import { SiteHeader, SiteFooter } from '../components/Site.jsx'
import { Plus } from '../components/Brand.jsx'
import FoodArt, { stackBurger } from '../components/FoodArt.jsx'
import { Sheet, useToast } from '../components/ui.jsx'
import { Magnetic, Marquee, SplitChars, TLink, gsap, ScrollTrigger, useSmoothScroll, Cursor } from '../components/motion.jsx'
import { flyToCart } from '../components/Menu.jsx'
import { reducedMotion, useMenu, useMedia } from '../lib/hooks.js'
import { cart } from '../lib/local.js'
import { formatBRL } from '@shared/money.js'

const DUPLO_LABELS = {
  'pao-topo': 'Brioche selado na manteiga',
  cebola: 'Cebola caramelizada devagar',
  'queijo-2': 'Cheddar derretido na chapa',
  'carne-2': 'Segundo blend de 150 g',
  queijo: 'Mais cheddar, porque sim',
  carne: 'Blend da casa, 150 g',
  'pao-base': 'Base que segura o molho',
}
const GAP = 30

function HeroBurger({ variant = 'tudo', className = '', svgRef }) {
  const layers = stackBurger(variant, { base: 250 })
  return (
    <svg ref={svgRef} viewBox="0 0 200 260" className={className} aria-hidden="true">
      <ellipse className="layer-shadow" cx="100" cy="252" rx="78" ry="7" fill="rgba(43,26,14,.18)" />
      {layers.map((l) => <g key={l.name} className="layer" data-name={l.name}>{l.el}</g>)}
    </svg>
  )
}

function ExplodedBurger() {
  const layers = stackBurger('double', { base: 400 })
  const n = layers.length
  return { layers, n, viewBox: '0 55 200 355' }
}

export default function Home() {
  useSmoothScroll()
  const root = useRef(null)
  const heroBurger = useRef(null)
  const explodeSvg = useRef(null)
  const track = useRef(null)
  const [mesaInfo, setMesaInfo] = useState(false)
  const { menu } = useMenu()
  const toast = useToast()
  const wide = useMedia('(min-width: 900px)')
  const exploded = ExplodedBurger()
  // Sem animação, o lanche já aparece aberto para as legendas baterem com as camadas.
  const [staticExplode] = useState(() => reducedMotion())
  // A abertura com contador só aparece na primeira visita da sessão e nunca com movimento reduzido.
  const [intro] = useState(() => {
    if (reducedMotion()) return false
    try { return !sessionStorage.getItem('kero:intro') } catch { return false }
  })

  const highlights = (menu || []).filter((p) => ['Kero+ Duplo', 'X-Tudo', 'Dogão completo', 'Batata cheddar e bacon', 'Milkshake', 'Açaí 300 ml', 'Veggie Kero'].includes(p.name))

  useLayoutEffect(() => {
    if (reducedMotion()) return
    const ctx = gsap.context(() => {
      // 1. Abertura: letras sobem, o "+" gira e o lanche se monta camada por camada.
      const layers = gsap.utils.toArray('.hero-burger .layer')
      const first = intro
      try { sessionStorage.setItem('kero:intro', '1') } catch { /* sem storage */ }
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: first ? 0.1 : 0 })
      if (first) {
        tl.fromTo('.preloader-count', { textContent: 0 }, { textContent: 100, duration: 0.9, ease: 'power2.inOut', snap: { textContent: 1 } })
          .to('.preloader-plus', { rotate: 180, duration: 0.9, ease: 'power2.inOut' }, 0)
          .to('.preloader', { yPercent: -100, duration: 0.8, ease: 'expo.inOut' })
      }
      tl.from('.hero-word .char', { yPercent: 110, duration: 1.1, stagger: 0.06 }, first ? '-=0.35' : 0)
        .from('.hero-plus', { scale: 0, rotate: -180, duration: 1.1, ease: 'back.out(1.8)' }, '<0.3')
        .from(layers, { y: -320, opacity: 0, duration: 0.7, ease: 'bounce.out', stagger: 0.09 }, '<0.1')
        .from('.layer-shadow', { scaleX: 0.2, opacity: 0, transformOrigin: '50% 50%', duration: 0.8 }, '<')
        .from('.hero-foot > *', { y: 30, opacity: 0, duration: 0.9, stagger: 0.1 }, '-=0.6')
        .from('.site-header', { y: -30, opacity: 0, duration: 0.8 }, '<')

      // O lanche do hero balança de leve com a rolagem até sair da tela.
      gsap.to('.hero-burger', { yPercent: 22, rotate: -6, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
      gsap.to('.hero-word', { yPercent: -18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
    }, root)
    return () => ctx.revert()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Seções guiadas pela rolagem. Refeitas quando o cardápio carrega ou a tela muda de largura.
  useLayoutEffect(() => {
    if (reducedMotion()) return
    const ctx = gsap.context(() => {
      // 2. Explosão: o Kero+ Duplo se abre em camadas e cada ingrediente ganha nome.
      const ex = gsap.utils.toArray('.explode-svg .layer')
      const labels = gsap.utils.toArray('.explode-label')
      const exTl = gsap.timeline({
        scrollTrigger: { trigger: '.explode', start: 'top top', end: '+=160%', scrub: 0.6, pin: '.explode-pin', anticipatePin: 1 },
      })
      // O lanche fechado começa centralizado no palco e desce enquanto as camadas se separam.
      exTl.fromTo('.explode-svg', { yPercent: -26 }, { yPercent: 0, ease: 'power2.inOut', duration: 1 }, 0)
      ex.forEach((el, i) => exTl.to(el, { y: -i * GAP, ease: 'power2.inOut', duration: 1 }, 0))
      exTl.from(labels, { opacity: 0, x: (i) => (i % 2 ? 40 : -40), stagger: 0.08, duration: 0.5 }, 0.35)
      exTl.from('.explode-cta', { opacity: 0, y: 20, duration: 0.4 }, 0.9)

      // 3. Destaques em rolagem horizontal no desktop.
      if (wide && track.current) {
        const dist = () => track.current.scrollWidth - window.innerWidth + 48
        gsap.to(track.current, {
          x: () => -dist(), ease: 'none',
          scrollTrigger: { trigger: '.highlights', start: 'top top', end: () => `+=${dist()}`, scrub: 0.5, pin: true, invalidateOnRefresh: true },
        })
      }

      // 4. Passo a passo da mesa: o celular troca de tela conforme o passo em foco.
      gsap.utils.toArray('.step').forEach((step, i) => {
        ScrollTrigger.create({
          trigger: step, start: 'top 60%', end: 'bottom 40%',
          onToggle: (self) => { if (self.isActive) root.current?.querySelector('.phone')?.setAttribute('data-step', String(i)) },
        })
      })

      // 5. Comanda em família: cada parte é "paga" em sequência.
      gsap.from('.receipt-line', { opacity: 0, x: -24, stagger: 0.12, duration: 0.6, ease: 'power3.out', scrollTrigger: { trigger: '.receipt', start: 'top 75%' } })
      gsap.from('.receipt-stamp', { scale: 2.4, opacity: 0, rotate: -30, duration: 0.6, ease: 'back.out(2)', scrollTrigger: { trigger: '.receipt', start: 'top 55%' } })
      ScrollTrigger.refresh()
    }, root)
    return () => ctx.revert()
  }, [wide, highlights.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const quickAdd = (p, el) => {
    cart.add(p.id, 1)
    flyToCart(el)
    toast(`${p.name} na sacola`)
  }

  const exLabels = exploded.layers.map((l, i) => {
    const center = l.y + l.h / 2 - i * GAP
    return { name: l.name, top: ((center - 55) / 355) * 100, side: i % 2 ? 'right' : 'left' }
  })

  return (
    <div ref={root} className="home">
      <Cursor />
      {intro && (
        <div className="preloader" aria-hidden="true">
          <span className="preloader-plus"><Plus size={84} /></span>
          <span className="preloader-count display num">0</span>
        </div>
      )}

      <section className="hero">
        <SiteHeader tone="yellow" />
        <h1 className="hero-word display" aria-label="Kero+ lanches">
          <SplitChars text="kero" />
          <span className="hero-plus"><Plus size={200} className="hero-plus-svg" /></span>
        </h1>
        <HeroBurger className="hero-burger" svgRef={heroBurger} />
        <div className="hero-foot">
          <p className="hero-lede">Hambúrguer na chapa, dogão e porção para dividir. Peça da mesa pelo celular ou receba em casa.</p>
          <div className="row wrap hero-ctas">
            <Magnetic><TLink to="/cardapio" className="btn btn-red btn-lg" data-cursor="Pedir">Pedir para entrega</TLink></Magnetic>
            <Magnetic><button className="btn btn-ghost btn-lg" onClick={() => setMesaInfo(true)}>Estou na mesa</button></Magnetic>
          </div>
        </div>
      </section>

      <section className="explode" aria-labelledby="explode-title">
        <div className="explode-pin container">
          <div className="explode-copy">
            <h2 id="explode-title" className="display">Kero+ Duplo, camada por camada</h2>
            <p className="muted">Tudo montado na hora, na frente da chapa.{staticExplode ? '' : ' Role para abrir o lanche.'}</p>
            <div className="explode-cta row wrap">
              <strong className="display num explode-price">{formatBRL(3890)}</strong>
              {menu && <button className="btn btn-red" onClick={(e) => { const p = menu.find((m) => m.name === 'Kero+ Duplo'); if (p) quickAdd(p, e.currentTarget) }}>Colocar na sacola</button>}
            </div>
          </div>
          <div className="explode-stage">
            <svg ref={explodeSvg} viewBox={exploded.viewBox} className="explode-svg" aria-hidden="true">
              {exploded.layers.map((l, i) => <g key={l.name} className="layer" transform={staticExplode ? `translate(0 ${-i * GAP})` : undefined}>{l.el}</g>)}
            </svg>
            <ul className="explode-labels">
              {exLabels.map((l) => (
                <li key={l.name} className={`explode-label side-${l.side}`} style={{ top: `${l.top}%` }}>{DUPLO_LABELS[l.name]}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Marquee className="band-red">
        {['na chapa', 'no pão brioche', 'na sua mesa', 'na sua casa', 'no Pix'].map((t) => (
          <span key={t} className="marquee-item display">{t}<Plus size={44} color="var(--gema)" /></span>
        ))}
      </Marquee>

      <section className="highlights" aria-labelledby="hl-title">
        <div className="highlights-inner">
          <div className="highlights-head container">
            <h2 id="hl-title" className="display">Os que mais saem da chapa</h2>
            <TLink to="/cardapio" className="btn btn-ghost">Ver o cardápio inteiro</TLink>
          </div>
          <div className="highlights-viewport">
            <div className="highlights-track" ref={track}>
              {highlights.map((p, i) => (
                <article key={p.id} className={`hl-card ${i % 2 ? 'hl-white' : 'hl-yellow'}`}>
                  <div className="hl-art"><FoodArt art={p.art} /></div>
                  <div className="hl-info">
                    <h3 className="display">{p.name}</h3>
                    <p>{p.description}</p>
                    <div className="row between">
                      <strong className="num">{formatBRL(p.price)}</strong>
                      <button className="add-btn add-btn-lg" aria-label={`Adicionar ${p.name}`} onClick={(e) => quickAdd(p, e.currentTarget)} data-cursor="Quero">
                        <Plus size={26} color="currentColor" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mesa-how container" aria-labelledby="mesa-title">
        <div className="mesa-phone-col">
          <div className="phone" data-step="0" aria-hidden="true">
            <div className="phone-screen s0"><div className="qr-fake" /><p>Mesa 7</p></div>
            <div className="phone-screen s1"><p className="ph-title">Quem está na mesa?</p>{['Ana', 'Beto', 'Caio'].map((n) => <span key={n} className="ph-pill">{n}</span>)}</div>
            <div className="phone-screen s2"><p className="ph-title">Enviado para a cozinha</p><div className="ph-line"><span>X-Bacon</span><span className="tag">na chapa</span></div><div className="ph-line"><span>Batata cheddar</span><span className="tag">na fila</span></div></div>
            <div className="phone-screen s3"><p className="ph-title">Sua parte</p><p className="display ph-big num">R$ 41,58</p><span className="ph-pix">Pagar com Pix</span></div>
          </div>
        </div>
        <div className="mesa-steps">
          <h2 id="mesa-title" className="display">Na mesa, sem esperar garçom</h2>
          <ol className="steps">
            <li className="step"><h3>Leia o QR code da mesa</h3><p className="muted">A câmera do celular abre a comanda da sua mesa. Não precisa baixar app.</p></li>
            <li className="step"><h3>Cada um entra com seu nome</h3><p className="muted">Todo mundo da mesa vê a mesma comanda, no próprio celular.</p></li>
            <li className="step"><h3>O pedido vai direto para a cozinha</h3><p className="muted">Você acompanha quando o lanche entra na chapa e quando fica pronto. Precisa de algo? Chame o atendente pelo celular.</p></li>
            <li className="step"><h3>Cada um paga a sua parte no Pix</h3><p className="muted">Divida por consumo ou igualmente. Dá para pagar a parte de outra pessoa também.</p></li>
          </ol>
        </div>
      </section>

      <section className="family" aria-labelledby="family-title">
        <div className="container family-grid">
          <div className="stack" style={{ '--gap': '20px' }}>
            <h2 id="family-title" className="display">Pedido em família, conta separada</h2>
            <p>Crie um pedido de entrega e mande o link no grupo. Cada pessoa escolhe o próprio lanche e paga a sua parte. Quando todo mundo paga, o pedido vai para a chapa e sai junto.</p>
            <div className="row wrap">
              <TLink to="/cardapio?grupo=1" className="btn btn-red btn-lg">Criar pedido em grupo</TLink>
            </div>
          </div>
          <div className="receipt" aria-label="Exemplo de conta dividida">
            <p className="receipt-head display">Pedido K7Q4MX</p>
            {[['Mãe', 'X-Salada, suco e 1/3 da entrega', 'R$ 39,80'], ['Pai', 'X-Tudo, refri e 1/3 da entrega', 'R$ 43,80'], ['Lia', 'Dogão, milkshake e 1/3 da entrega', 'R$ 43,80']].map(([n, d, v]) => (
              <div className="receipt-line" key={n}><div><strong>{n}</strong><small>{d}</small></div><span className="num">{v}</span></div>
            ))}
            <div className="receipt-stamp">pago <Plus size={22} color="currentColor" /></div>
          </div>
        </div>
      </section>

      <SiteFooter />

      <Sheet open={mesaInfo} onClose={() => setMesaInfo(false)} title="Pedir da mesa">
        <div className="stack">
          <p>Cada mesa tem um QR code. Abra a câmera do celular e aponte para ele: a comanda da sua mesa abre aqui no site.</p>
          <p className="muted">Não achou o QR code? Peça ajuda no balcão.</p>
          <button className="btn btn-red btn-block" onClick={() => setMesaInfo(false)} data-autofocus>Entendi</button>
        </div>
      </Sheet>
    </div>
  )
}
