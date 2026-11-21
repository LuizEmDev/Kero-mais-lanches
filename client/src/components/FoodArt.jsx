// Imagem do produto: a foto real enviada pela loja ou, até lá, a renderização 3D do item.
export const artSrc = (art = 'burger:classic') => `/food/${art.replace(':', '-')}.webp`

export default function FoodArt({ art, image, alt = '', eager = false, className = '' }) {
  return (
    <img
      className={`food-art ${image ? 'is-photo' : 'is-3d'} ${className}`}
      src={image || artSrc(art)}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable="false"
    />
  )
}
