// Avisa o cabeçalho que um item entrou na sacola: ele "imprime" uma comanda com o item.
export const cartEvents = new EventTarget()
export function announceAdd(product, qty = 1) {
  cartEvents.dispatchEvent(new CustomEvent('add', { detail: { name: product.name, qty, price: product.price, at: Date.now() } }))
}
