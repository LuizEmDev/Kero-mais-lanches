import { useRef, useState } from 'react'

// Gráficos simples em SVG: uma cor para a medida (pimenta) e marcas de referência em tinta.
// Toda barra tem dica no hover e no foco do teclado, e todo gráfico tem versão em tabela.

function niceMax(v) {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}

export function BarChart({ data, value, label, format, refValue, refLabel, height = 220, title, highlight }) {
  const wrap = useRef(null)
  const [tip, setTip] = useState(null)
  const [table, setTable] = useState(false)
  const W = 640, H = height, padL = 52, padB = 26, padT = 10
  const values = data.map(value)
  const refs = refValue ? data.map(refValue) : []
  const max = niceMax(Math.max(1, ...values, ...refs))
  const bw = (W - padL) / data.length
  const barW = Math.max(4, Math.min(28, bw - 4))
  const y = (v) => padT + (H - padT - padB) * (1 - v / max)
  const ticks = [0, max / 2, max]
  const every = Math.ceil(data.length / 8)

  const show = (i, e) => {
    const r = wrap.current.getBoundingClientRect()
    const x = e?.clientX ? e.clientX - r.left : ((padL + i * bw + bw / 2) / W) * r.width
    setTip({ i, x: Math.min(Math.max(x, 70), r.width - 70) })
  }

  return (
    <figure className="chart">
      <figcaption className="row between">
        <span className="chart-title">{title}</span>
        <span className="row" style={{ '--gap': '14px' }}>
          {refValue && (
            <span className="legend">
              <span className="legend-item"><i className="key-rect" /> {highlight || 'Valor'}</span>
              <span className="legend-item"><i className="key-line" /> {refLabel}</span>
            </span>
          )}
          <button className="link-btn" onClick={() => setTable(!table)}>{table ? 'Ver gráfico' : 'Ver tabela'}</button>
        </span>
      </figcaption>
      {table ? (
        <table className="chart-table">
          <thead><tr><th>{'Período'}</th><th>{highlight || 'Valor'}</th>{refValue && <th>{refLabel}</th>}</tr></thead>
          <tbody>{data.map((d, i) => <tr key={i}><td>{label(d)}</td><td className="num">{format(values[i])}</td>{refValue && <td className="num">{format(refs[i])}</td>}</tr>)}</tbody>
        </table>
      ) : (
        <div className="chart-wrap" ref={wrap} onPointerLeave={() => setTip(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={title}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="grid" />
                <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="axis num">{format(t, true)}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const v = values[i]
              const x = padL + i * bw + (bw - barW) / 2
              const top = y(v)
              const h = Math.max(0, H - padB - top)
              const r = Math.min(4, barW / 2, h)
              return (
                <g key={i} className={`bar ${tip?.i === i ? 'on' : ''}`}>
                  {h > 0 && <path d={`M${x} ${H - padB} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + barW - r} Q${x + barW} ${top} ${x + barW} ${top + r} V${H - padB} Z`} />}
                  {refValue && refs[i] > 0 && <line x1={x - 3} x2={x + barW + 3} y1={y(refs[i])} y2={y(refs[i])} className="ref" />}
                  <rect x={padL + i * bw} y={padT} width={bw} height={H - padT} fill="transparent" tabIndex={0}
                    aria-label={`${label(d)}: ${format(v)}${refValue ? `, ${refLabel}: ${format(refs[i])}` : ''}`}
                    onPointerMove={(e) => show(i, e)} onFocus={() => show(i)} onBlur={() => setTip(null)} />
                  {i % every === 0 && <text x={padL + i * bw + bw / 2} y={H - 8} textAnchor="middle" className="axis">{label(d, true)}</text>}
                </g>
              )
            })}
            <line x1={padL} x2={W} y1={H - padB} y2={H - padB} className="baseline" />
          </svg>
          {tip && (
            <div className="tooltip" style={{ left: tip.x }}>
              <strong className="num">{format(values[tip.i])}</strong>
              <span>{label(data[tip.i])}</span>
              {refValue && <span className="tip-ref"><i className="key-line" /> {refLabel}: <span className="num">{format(refs[tip.i])}</span></span>}
            </div>
          )}
        </div>
      )}
    </figure>
  )
}

export function HBars({ rows, title, format, sub }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <figure className="chart">
      <figcaption className="chart-title">{title}</figcaption>
      {!rows.length ? <p className="muted">Sem vendas no período.</p> : (
        <ul className="hbars">
          {rows.map((r) => (
            <li key={r.key} tabIndex={0} aria-label={`${r.label}: ${format(r.value)}${sub ? `, ${sub(r)}` : ''}`}>
              <span className="hb-label">{r.label}</span>
              <span className="hb-track"><span className="hb-fill" style={{ width: `${(r.value / max) * 100}%` }} /></span>
              <span className="hb-value num">{format(r.value)}{sub && <small>{sub(r)}</small>}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  )
}
