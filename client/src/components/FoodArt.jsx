// Foto do produto: a enviada pela loja ou a foto padrão do item (client/public/food).
export const artSrc = (art = 'burger:classic') => `${import.meta.env.BASE_URL}food/${art.replace(':', '-')}.webp`

export default function FoodArt({ art, image, alt = '', eager = false, className = '' }) {
  return (
    <img
      className={`food-art ${className}`}
      src={image || artSrc(art)}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable="false"
    />
  )
}
