import { randomBytes } from 'node:crypto'
import { db, tx, getSetting, setSetting } from './db.js'
import { newCode } from './ids.js'

const MENU = [
  // categoria, nome, descrição, preço (centavos), arte, tags
  ['lanches', 'Kero+ Duplo', 'Dois blends de 150 g, cheddar duplo, cebola caramelizada e o molho da casa no brioche.', 3890, 'burger:double', ['da casa']],
  ['lanches', 'X-Tudo', 'Blend 150 g, presunto, queijo, ovo, bacon, salsicha, milho, alface e tomate. Vem com fome.', 3490, 'burger:tudo', ['mais pedido']],
  ['lanches', 'X-Bacon', 'Blend 150 g, bacon crocante, queijo prato e maionese da casa.', 2890, 'burger:bacon', []],
  ['lanches', 'X-Salada', 'Blend 150 g, queijo prato, alface americana, tomate e maionese da casa.', 2590, 'burger:salada', []],
  ['lanches', 'X-Egg', 'Blend 150 g, ovo na chapa com gema mole, queijo prato e maionese.', 2690, 'burger:egg', []],
  ['lanches', 'X-Burger', 'O clássico: blend 150 g, queijo prato e maionese da casa no pão brioche.', 2290, 'burger:classic', []],
  ['lanches', 'X-Frango', 'Filé de frango grelhado, queijo, alface, tomate e maionese de ervas.', 2690, 'burger:frango', []],
  ['lanches', 'Veggie Kero', 'Burger de grão-de-bico, queijo coalho, rúcula, tomate e maionese de alho.', 2990, 'burger:veggie', ['vegetariano']],
  ['dogs', 'Dogão completo', 'Duas salsichas, purê, vinagrete, milho, ervilha, batata palha e queijo ralado.', 2290, 'hotdog:full', ['mais pedido']],
  ['dogs', 'Dogão simples', 'Salsicha, molho de tomate da casa, batata palha e mostarda.', 1690, 'hotdog:simple', []],
  ['porcoes', 'Batata frita', '300 g de batata crocante com sal e páprica.', 1990, 'fries:plain', []],
  ['porcoes', 'Batata cheddar e bacon', '400 g de batata com cheddar cremoso e bacon picado.', 2990, 'fries:cheddar', ['pra dividir']],
  ['porcoes', 'Anéis de cebola', '12 anéis empanados com molho barbecue.', 2490, 'rings', []],
  ['porcoes', 'Mandioca frita', '400 g de mandioca sequinha com maionese de alho.', 2290, 'cassava', []],
  ['bebidas', 'Refrigerante lata', 'Coca-Cola, Guaraná ou Sprite. 350 ml.', 690, 'can', []],
  ['bebidas', 'Suco natural', 'Laranja, limão, maracujá ou abacaxi com hortelã. 500 ml.', 1190, 'cup:juice', []],
  ['bebidas', 'Milkshake', 'Chocolate, morango ou ovomaltine. 400 ml.', 1890, 'cup:shake', []],
  ['bebidas', 'Guaraná 2 L', 'Para a mesa inteira.', 1490, 'bottle', ['pra dividir']],
  ['bebidas', 'Água mineral', 'Com ou sem gás. 500 ml.', 450, 'water', []],
  ['sobremesas', 'Pudim de leite', 'Fatia generosa com calda de caramelo.', 1290, 'pudding', []],
  ['sobremesas', 'Brownie com sorvete', 'Brownie quente, sorvete de creme e calda de chocolate.', 1990, 'brownie', []],
  ['sobremesas', 'Açaí 300 ml', 'Com banana, granola e leite condensado.', 1790, 'cup:acai', []],
]

export function seed({ demo = false } = {}) {
  const hasMenu = db.prepare('SELECT COUNT(*) AS n FROM products').get().n > 0
  if (!hasMenu) {
    const ins = db.prepare('INSERT INTO products(name, description, category, price, art, tags, position) VALUES (?,?,?,?,?,?,?)')
    tx(() => MENU.forEach(([cat, name, desc, price, art, tags], i) => ins.run(name, desc, cat, price, art, JSON.stringify(tags), i)))
  }
  const hasTables = db.prepare('SELECT COUNT(*) AS n FROM tables').get().n > 0
  if (!hasTables) {
    const ins = db.prepare('INSERT INTO tables(number, seats, token) VALUES (?,?,?)')
    tx(() => {
      for (let n = 1; n <= 12; n++) ins.run(n, n % 3 === 0 ? 6 : 4, randomBytes(6).toString('base64url'))
    })
  }
  if (getSetting('store') === null) {
    setSetting('store', {
      name: 'Kero+ Lanches',
      pix_key: process.env.PIX_KEY || '',
      merchant_name: process.env.PIX_MERCHANT_NAME || 'KERO MAIS LANCHES',
      merchant_city: process.env.PIX_MERCHANT_CITY || 'SAO PAULO',
      delivery_fee: 600,
      service_pct: 10,
      prep_minutes: 25,
      address: 'Rua das Chapas, 120, Centro',
      phone: '(11) 99999-0000',
      hours: 'Terça a domingo, 18h às 23h30',
    })
  }
  if (demo && !getSetting('demo_seeded', false)) {
    seedHistory()
    setSetting('demo_seeded', true)
  }
}

// Histórico fictício de 21 dias para o dashboard não nascer vazio no modo demonstração.
function seedHistory() {
  const products = db.prepare('SELECT * FROM products').all()
  const rand = mulberry32(42)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const DAY = 86400000
  const now = Date.now()
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const insOrder = db.prepare(`INSERT INTO orders(code, channel, is_group, table_number, status, split_mode, service_pct, delivery_fee, customer, created_at, updated_at, paid_at, closed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  const insPart = db.prepare('INSERT INTO participants(order_id, name, device_id, token, is_host, created_at) VALUES (?,?,?,?,?,?)')
  const insTicket = db.prepare('INSERT INTO tickets(order_id, round, status, created_at, started_at, ready_at, done_at) VALUES (?,?,?,?,?,?,?)')
  const insItem = db.prepare('INSERT INTO order_items(order_id, ticket_id, product_id, name, unit_price, qty, notes, added_by, shares, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
  const insPay = db.prepare(`INSERT INTO payments(order_id, public_id, amount, allocations, payer_name, status, provider, txid, brcode, created_at, expires_at, paid_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
  const names = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Heitor', 'Iara', 'João', 'Luana', 'Marcos']
  // Peso por hora (18h-23h): pico entre 20h e 21h.
  const hours = [18, 19, 19, 20, 20, 20, 21, 21, 21, 22, 22, 23]

  tx(() => {
    for (let d = 21; d >= 0; d--) {
      const dayStart = today.getTime() - d * DAY
      const dow = new Date(dayStart).getDay()
      if (dow === 1) continue // segunda: fechado
      const weekend = dow === 0 || dow === 5 || dow === 6
      let count = Math.round((weekend ? 46 : 28) + rand() * 14)
      for (let i = 0; i < count; i++) {
        const created = dayStart + pick(hours) * 3600000 + Math.floor(rand() * 59) * 60000
        if (created > now - 20 * 60000) continue
        const r = rand()
        const channel = r < 0.45 ? 'mesa' : r < 0.85 ? 'entrega' : 'retirada'
        const people = channel === 'mesa' ? 1 + Math.floor(rand() * 4) : rand() < 0.2 ? 2 + Math.floor(rand() * 2) : 1
        const fee = channel === 'entrega' ? 600 : 0
        const pct = channel === 'mesa' ? 10 : 0
        const prep = (10 + Math.floor(rand() * 18)) * 60000
        const status = channel === 'mesa' ? 'finalizado' : 'entregue'
        const o = insOrder.run(newCode(), channel, people > 1 ? 1 : 0, channel === 'mesa' ? 1 + Math.floor(rand() * 12) : null, status, 'consumo', pct, fee,
          JSON.stringify({ name: pick(names) }), created, created + prep + 3600000, created + prep, created + prep + 3600000)
        const orderId = Number(o.lastInsertRowid)
        const pids = []
        for (let p = 0; p < people; p++) pids.push(Number(insPart.run(orderId, names[(i + p) % names.length], 'demo', 'demo', p === 0 ? 1 : 0, created).lastInsertRowid))
        const t = insTicket.run(orderId, 1, 'entregue', created, created + 60000, created + prep, created + prep + 120000)
        const ticketId = Number(t.lastInsertRowid)
        const alloc = {}
        let total = 0
        for (const pid of pids) {
          const n = 1 + Math.floor(rand() * 2.2)
          let mine = 0
          for (let k = 0; k < n; k++) {
            const pr = rand() < 0.55 ? pick(products.filter((x) => x.category === 'lanches' || x.category === 'dogs')) : pick(products)
            const qty = rand() < 0.15 ? 2 : 1
            insItem.run(orderId, ticketId, pr.id, pr.name, pr.price, qty, '', pid, JSON.stringify([pid]), created)
            mine += pr.price * qty
          }
          mine += Math.round((mine * pct) / 100)
          alloc[pid] = mine
          total += mine
        }
        if (fee) { alloc[pids[0]] += fee; total += fee }
        insPay.run(orderId, randomBytes(8).toString('hex'), total, JSON.stringify(alloc), '', 'pago', 'demo', 'DEMO', '', created, created + 1800000, created + 60000)
      }
    }
  })
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
