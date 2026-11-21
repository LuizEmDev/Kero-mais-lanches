// Marca Kero+: a palavra "kero" e o "+" desenhado (nunca escrito "mais").
export function Plus({ size = 24, color = 'var(--pimenta)', className = '', title }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 40" role={title ? 'img' : 'presentation'} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d="M15 4h10v11h11v10H25v11H15V25H4V15h11z" fill={color} stroke={color} strokeWidth="5" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ size = 32, color = 'var(--chapa)', plus = 'var(--pimenta)', className = '' }) {
  return (
    <span className={`logo ${className}`} style={{ '--logo-size': `${size}px`, color }} aria-label="Kero+" role="img">
      <span aria-hidden="true" className="logo-word">kero</span>
      <Plus size={size * 0.78} color={plus} className="logo-plus" />
    </span>
  )
}
