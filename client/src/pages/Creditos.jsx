import { useEffect, useState } from 'react'
import { SiteHeader, SiteFooter } from '../components/Site.jsx'
import { artSrc } from '../components/FoodArt.jsx'

// Créditos das fotos padrão do cardápio (exigidos pelas licenças Creative Commons).
export default function Creditos() {
  const [credits, setCredits] = useState(null)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}food/credits.json`).then((r) => r.json()).then(setCredits).catch(() => setCredits({}))
  }, [])
  return (
    <div className="page-account">
      <SiteHeader tone="white" />
      <main className="container credits">
        <h1 className="display">Créditos das fotos</h1>
        <p className="muted">As fotos padrão do cardápio são de fotógrafos do Wikimedia Commons, usadas conforme a licença de cada uma. Quando a loja envia a foto do próprio lanche, ela substitui a foto padrão.</p>
        <ul className="credits-list">
          {credits && Object.entries(credits).map(([art, c]) => (
            <li key={art}>
              <img src={artSrc(art)} alt="" loading="lazy" />
              <div>
                <strong>{c.title}</strong>
                <span>Foto: {c.author}</span>
                <span>Licença: {c.license}. <a href={c.source} target="_blank" rel="noreferrer">Ver original</a></span>
              </div>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  )
}
