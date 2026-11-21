// Ilustrações vetoriais dos produtos. Desenhadas por camadas para poderem ser animadas.
const C = {
  pao: '#f0a43a', paoLuz: '#f8c46a', gergelim: '#fff3d1', carne: '#6b3a1e', carneLuz: '#8a4d29',
  queijo: '#ffb81f', alface: '#4fae4f', alfaceEsc: '#36913c', tomate: '#e8361f', bacon: '#b8412a', baconLuz: '#e07a5c',
  ovo: '#fffaf0', gema: '#ffa31a', frango: '#d99347', veggie: '#c9a04a', tinta: '#2b1a0e',
}

export function burgerLayers(variant = 'classic') {
  const v = variant
  const L = [] // de baixo para cima: [nome, altura, desenho(y)]
  L.push(['pao-base', 26, (y) => <path d={`M34 ${y} H166 V${y + 8} Q166 ${y + 26} 146 ${y + 26} H54 Q34 ${y + 26} 34 ${y + 8} Z`} fill={C.pao} />])
  const carne = (name, color = C.carne, luz = C.carneLuz) => [name, 20, (y) => (
    <g><rect x="26" y={y} width="148" height="20" rx="10" fill={color} />
      <path d={`M48 ${y + 7} h22 M88 ${y + 12} h26 M130 ${y + 7} h20`} stroke={luz} strokeWidth="3" strokeLinecap="round" /></g>
  )]
  if (v === 'frango') L.push(carne('carne', C.frango, '#efb36f'))
  else if (v === 'veggie') L.push(carne('carne', C.veggie, '#e2bd6b'))
  else L.push(carne('carne'))
  const queijo = (name) => [name, 10, (y) => <path d={`M28 ${y} H172 L166 ${y + 8} H152 L146 ${y + 20} L139 ${y + 8} H104 L97 ${y + 22} L90 ${y + 8} H60 L54 ${y + 17} L48 ${y + 8} H34 Z`} fill={C.queijo} />]
  if (v !== 'frango') L.push(queijo('queijo'))
  if (v === 'double') { L.push(carne('carne-2')); L.push(queijo('queijo-2')) }
  if (v === 'bacon' || v === 'tudo') L.push(['bacon', 12, (y) => (
    <g><path d={`M30 ${y + 6} q12 -8 24 0 t24 0 t24 0 t24 0 t24 0 t20 0`} stroke={C.bacon} strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d={`M30 ${y + 6} q12 -8 24 0 t24 0 t24 0 t24 0 t24 0 t20 0`} stroke={C.baconLuz} strokeWidth="2.5" fill="none" strokeLinecap="round" /></g>
  )])
  if (v === 'egg' || v === 'tudo') L.push(['ovo', 16, (y) => (
    <g><ellipse cx="100" cy={y + 8} rx="62" ry="9" fill={C.ovo} /><ellipse cx="100" cy={y + 6} rx="17" ry="7" fill={C.gema} /></g>
  )])
  if (v === 'double') L.push(['cebola', 8, (y) => <path d={`M34 ${y + 4} q16 -6 32 0 t32 0 t32 0 t32 0`} stroke="#9b4d7a" strokeWidth="5" fill="none" strokeLinecap="round" />])
  if (['salada', 'tudo', 'frango', 'veggie'].includes(v)) {
    L.push(['tomate', 12, (y) => (
      <g><rect x="40" y={y} width="56" height="11" rx="5" fill={C.tomate} /><rect x="104" y={y} width="56" height="11" rx="5" fill={C.tomate} /></g>
    )])
    L.push(['alface', 12, (y) => (
      <path d={`M24 ${y + 8} q8 -10 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 v4 H24 Z`} fill={C.alface} stroke={C.alfaceEsc} strokeWidth="2" strokeLinejoin="round" />
    )])
  }
  L.push(['pao-topo', 56, (y) => (
    <g><path d={`M32 ${y + 56} Q30 ${y} 100 ${y} Q170 ${y} 168 ${y + 56} Z`} fill={C.pao} />
      <path d={`M48 ${y + 30} Q62 ${y + 12} 92 ${y + 10}`} stroke={C.paoLuz} strokeWidth="6" fill="none" strokeLinecap="round" />
      {[[70, 22, -20], [100, 16, 0], [128, 24, 20], [86, 34, -8], [116, 36, 12], [146, 40, 30], [58, 42, -30]].map(([x, dy, r], i) => (
        <ellipse key={i} cx={x} cy={y + dy} rx="4.5" ry="2.4" fill={C.gergelim} transform={`rotate(${r} ${x} ${y + dy})`} />
      ))}</g>
  )])
  return L
}

/** Empilha as camadas de baixo (y=base) para cima. gap separa as camadas (usado na explosão do hero). */
export function stackBurger(variant, { base = 176, gap = 0 } = {}) {
  const layers = burgerLayers(variant)
  let y = base
  return layers.map(([name, h, draw]) => {
    y -= h
    const node = { name, y, h, el: draw(y) }
    y -= gap
    return node
  })
}

function Burger({ variant }) {
  const layers = stackBurger(variant, { base: 178 })
  const top = layers[layers.length - 1].y
  const shift = (200 - (178 - top)) / 2 - top + 4
  return <g transform={`translate(0 ${shift * 0.6})`}>{layers.map((l, i) => <g key={l.name} className="fa-layer" style={{ '--i': i }}>{l.el}</g>)}</g>
}

function Hotdog({ full }) {
  return (
    <g transform="rotate(-8 100 110)">
      <rect x="18" y="96" width="164" height="44" rx="22" fill={C.pao} />
      <rect x="10" y="88" width="180" height="22" rx="11" fill="#b5412a" />
      <rect x="10" y="88" width="180" height="22" rx="11" fill="none" stroke="#d2604a" strokeWidth="3" strokeDasharray="10 14" />
      <rect x="24" y="76" width="152" height="26" rx="13" fill={C.paoLuz} />
      <path d="M30 88 l12 -8 l12 8 l12 -8 l12 8 l12 -8 l12 8 l12 -8 l12 8 l12 -8 l12 8 l12 -8 l12 8" fill="none" stroke="#ffce1f" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {full && <>
        <path d="M34 82 q10 -10 20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke={C.tomate} strokeWidth="5" strokeLinecap="round" />
        {Array.from({ length: 16 }, (_, i) => <rect key={i} x={30 + i * 9} y={68 + (i % 3) * 3} width="10" height="2.6" rx="1.3" fill="#f6c453" transform={`rotate(${(i * 37) % 60 - 30} ${35 + i * 9} 70)`} />)}
        {[44, 72, 104, 136, 160].map((x) => <circle key={x} cx={x} cy={76} r="3.2" fill="#ffd93b" />)}
        {[58, 90, 120, 150].map((x) => <circle key={x} cx={x} cy={79} r="3" fill="#67b84a" />)}
      </>}
    </g>
  )
}

function Fries({ cheddar }) {
  const sticks = [[62, 40, -10], [78, 30, -4], [94, 24, 2], [110, 28, 6], [126, 34, 10], [140, 44, 14], [70, 52, -14], [102, 44, 0], [134, 54, 8]]
  return (
    <g>
      {sticks.map(([x, y, r], i) => <rect key={i} x={x - 6} y={y} width="13" height="90" rx="4" fill={i % 2 ? '#ffd24a' : '#ffc21f'} transform={`rotate(${r} ${x} ${y + 90})`} />)}
      {cheddar && <path d="M52 96 Q100 70 150 96 L146 112 Q120 124 102 112 Q84 126 60 112 Z" fill="#ff9f1a" />}
      {cheddar && [70, 92, 116, 136].map((x) => <rect key={x} x={x} y={92 + (x % 3) * 3} width="8" height="6" rx="2" fill={C.bacon} />)}
      <path d="M44 100 H156 L144 184 H56 Z" fill={C.tomate} />
      <path d="M44 100 H156 L153 118 H47 Z" fill="#c2240f" />
      <path d="M52 150 q12 -10 24 0 t24 0 t24 0 t24 0" stroke="#ffce1f" strokeWidth="7" fill="none" strokeLinecap="round" />
    </g>
  )
}

function Rings() {
  return (
    <g>
      <ellipse cx="100" cy="166" rx="74" ry="12" fill="rgba(43,26,14,.12)" />
      {[[70, 118, 0], [128, 112, 0], [100, 76, 0]].map(([x, y], i) => (
        <g key={i}><circle cx={x} cy={y} r="36" fill="none" stroke="#e9a23b" strokeWidth="20" /><circle cx={x} cy={y} r="36" fill="none" stroke="#f6c66a" strokeWidth="5" strokeDasharray="4 10" /></g>
      ))}
      <path d="M150 150 q16 -4 22 10 q-12 14 -26 4 z" fill="#8a3418" />
    </g>
  )
}

function Cassava() {
  const s = [[56, 70, -30], [80, 56, -12], [108, 52, 8], [132, 62, 26], [68, 96, -20], [100, 86, 0], [128, 92, 18]]
  return <g>{s.map(([x, y, r], i) => <rect key={i} x={x - 9} y={y} width="20" height="78" rx="7" fill={i % 2 ? '#f3d38a' : '#ecc56a'} stroke="#d39f3d" strokeWidth="3" transform={`rotate(${r} ${x} ${y + 40})`} />)}
    <ellipse cx="100" cy="170" rx="70" ry="10" fill="rgba(43,26,14,.12)" /></g>
}

function Can() {
  return (
    <g>
      <ellipse cx="100" cy="176" rx="40" ry="8" fill="rgba(43,26,14,.14)" />
      <rect x="62" y="34" width="76" height="140" rx="14" fill={C.tomate} />
      <rect x="66" y="28" width="68" height="14" rx="7" fill="#c9c9c9" />
      <path d="M62 96 q38 -26 76 0 v26 q-38 -26 -76 0 z" fill="#fff" />
      <rect x="76" y="48" width="8" height="110" rx="4" fill="rgba(255,255,255,.28)" />
    </g>
  )
}

function Cup({ kind }) {
  const fill = { juice: '#ffa62b', shake: '#c98a6b', acai: '#5b2a6e' }[kind] || '#ffa62b'
  return (
    <g>
      <ellipse cx="100" cy="182" rx="40" ry="7" fill="rgba(43,26,14,.14)" />
      {kind === 'shake' && <><rect x="112" y="6" width="8" height="70" rx="4" fill={C.tomate} transform="rotate(14 116 40)" /><path d="M58 64 q4 -26 26 -22 q8 -18 28 -8 q22 -6 28 16 q12 6 2 18 H58 z" fill="#fff8ef" /><circle cx="104" cy="34" r="8" fill={C.tomate} /></>}
      {kind === 'juice' && <><rect x="110" y="10" width="8" height="70" rx="4" fill="#fff" stroke={C.tinta} strokeWidth="2" transform="rotate(12 114 44)" /><circle cx="140" cy="62" r="18" fill="#ffd24a" stroke="#f2a81a" strokeWidth="4" /></>}
      <path d="M56 64 H144 L132 180 H68 Z" fill="rgba(255,255,255,.75)" stroke="rgba(43,26,14,.25)" strokeWidth="3" />
      <path d="M60 84 H140 L131 176 H69 Z" fill={fill} />
      {kind === 'acai' && <><circle cx="84" cy="80" r="9" fill="#fff5c7" stroke="#e8d07c" strokeWidth="3" /><circle cx="112" cy="76" r="9" fill="#fff5c7" stroke="#e8d07c" strokeWidth="3" />
        {[72, 92, 100, 124, 132].map((x, i) => <circle key={x} cx={x} cy={70 + (i % 2) * 6} r="3.4" fill="#c98a3c" />)}</>}
      <rect x="74" y="92" width="7" height="72" rx="3.5" fill="rgba(255,255,255,.35)" />
    </g>
  )
}

function Bottle({ water }) {
  const body = water ? 'rgba(141,203,232,.75)' : '#2f8f3a'
  return (
    <g>
      <ellipse cx="100" cy="184" rx="34" ry="6" fill="rgba(43,26,14,.14)" />
      <rect x="88" y="10" width="24" height="14" rx="4" fill={water ? '#2b7fc2' : C.tomate} />
      <path d={`M90 24 h20 v20 q26 18 26 50 v80 q0 8 -8 8 h-56 q-8 0 -8 -8 v-80 q0 -32 26 -50 z`} fill={body} />
      <rect x="64" y="100" width="72" height="40" fill={water ? '#fff' : C.queijo} />
      <path d="M84 120 h32 M100 108 v24" stroke={water ? '#2b7fc2' : C.tomate} strokeWidth="6" strokeLinecap="round" />
    </g>
  )
}

function Pudding() {
  return (
    <g>
      <ellipse cx="100" cy="164" rx="80" ry="16" fill="#fff" stroke="rgba(43,26,14,.15)" strokeWidth="3" />
      <path d="M46 156 L62 82 Q100 70 138 82 L154 156 Q100 170 46 156 Z" fill="#ffd37a" />
      <path d="M62 82 Q100 70 138 82 Q140 96 128 100 Q120 116 112 98 Q100 104 88 98 Q80 118 72 98 Q60 96 62 82 Z" fill="#a4521a" />
      <path d="M52 158 Q100 172 148 158" stroke="#a4521a" strokeWidth="8" fill="none" strokeLinecap="round" />
    </g>
  )
}

function Brownie() {
  return (
    <g>
      <ellipse cx="100" cy="168" rx="76" ry="14" fill="#fff" stroke="rgba(43,26,14,.15)" strokeWidth="3" />
      <rect x="42" y="96" width="116" height="64" rx="10" fill="#5a2e17" />
      <path d="M42 108 h116" stroke="#7a4425" strokeWidth="6" />
      <circle cx="104" cy="84" r="30" fill="#fff6dc" />
      <path d="M74 86 q10 22 22 4 q12 26 22 -2 q10 12 14 2" fill="#fff6dc" />
      <path d="M80 70 q24 -14 46 6" stroke="#5a2e17" strokeWidth="7" fill="none" strokeLinecap="round" />
    </g>
  )
}

export default function FoodArt({ art = 'burger:classic', className = '', title }) {
  const [kind, variant] = art.split(':')
  let body
  switch (kind) {
    case 'burger': body = <Burger variant={variant || 'classic'} />; break
    case 'hotdog': body = <Hotdog full={variant === 'full'} />; break
    case 'fries': body = <Fries cheddar={variant === 'cheddar'} />; break
    case 'rings': body = <Rings />; break
    case 'cassava': body = <Cassava />; break
    case 'can': body = <Can />; break
    case 'cup': body = <Cup kind={variant} />; break
    case 'bottle': body = <Bottle />; break
    case 'water': body = <Bottle water />; break
    case 'pudding': body = <Pudding />; break
    case 'brownie': body = <Brownie />; break
    default: body = <Burger variant="classic" />
  }
  return (
    <svg viewBox="0 0 200 200" className={`food-art ${className}`} role={title ? 'img' : 'presentation'} aria-label={title} aria-hidden={title ? undefined : true}>
      {body}
    </svg>
  )
}
