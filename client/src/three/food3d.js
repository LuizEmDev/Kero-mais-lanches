// Comida em 3D, modelada por código: cada produto do cardápio vira uma cena com
// materiais físicos (PBR), luz de estúdio e sombra. Usado ao vivo no topo do cardápio
// e para gerar as imagens dos produtos (scripts/render-food.mjs).
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// ---------- utilidades ----------
let seed = 7
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
const rr = (a, b) => a + rnd() * (b - a)
export const resetSeed = (s = 7) => { seed = s }

function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return s - Math.floor(s)
}
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = x - xi, yf = y - yi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf)
  const l = (a, b, t) => a + (b - a) * t
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz)
  return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w)
}
const fbm = (x, y, z) => noise3(x, y, z) * 0.6 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.1

function canvasTex(size, draw, { color = true, repeat } = {}) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d'), size)
  const t = new THREE.CanvasTexture(c)
  if (color) t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  if (repeat) t.repeat.set(repeat, repeat)
  t.anisotropy = 4
  return t
}
// Textura de relevo granulada (pão, carne, empanado).
const bumpCache = {}
function grainBump(scale = 1, density = 2200, key = 'g') {
  const k = `${key}${scale}${density}`
  if (bumpCache[k]) return bumpCache[k]
  bumpCache[k] = canvasTex(256, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s)
    for (let i = 0; i < density; i++) {
      const v = Math.floor(rr(60, 200))
      g.fillStyle = `rgb(${v},${v},${v})`
      g.beginPath(); g.arc(rr(0, s), rr(0, s), rr(0.6, 2.4) * scale, 0, Math.PI * 2); g.fill()
    }
  }, { color: false, repeat: 3 })
  return bumpCache[k]
}

/** Desloca vértices com ruído (bordas irregulares de comida de verdade). */
function jitter(geo, amt = 0.03, freq = 3, yAmt = amt) {
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const n = fbm(x * freq + 10, y * freq, z * freq) - 0.5
    const len = Math.hypot(x, z) || 1
    p.setXYZ(i, x + (x / len) * n * amt * 2, y + n * yAmt, z + (z / len) * n * amt * 2)
  }
  geo.computeVertexNormals()
  return geo
}

function lathe(profile, seg = 72) {
  return new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), seg)
}

/** Cor por vértice em função da altura (douradinho no topo, mais claro embaixo). */
function gradientY(geo, bottom, top, y0, y1) {
  const p = geo.attributes.position
  const colors = new Float32Array(p.count * 3)
  const a = new THREE.Color(bottom), b = new THREE.Color(top), c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const t = THREE.MathUtils.clamp((p.getY(i) - y0) / (y1 - y0), 0, 1)
    const n = (fbm(p.getX(i) * 4, p.getY(i) * 4, p.getZ(i) * 4) - 0.5) * 0.25
    c.copy(a).lerp(b, THREE.MathUtils.clamp(t + n, 0, 1))
    colors.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

// Dupla face: as superfícies de revolução ficam corretas de qualquer ângulo.
const mat = (o) => new THREE.MeshPhysicalMaterial({ roughness: 0.6, side: THREE.DoubleSide, ...o })
const shadowy = (m) => { m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } }); return m }

// ---------- camadas do hambúrguer (cada uma com a base em y = 0) ----------
function bunTop() {
  const g = new THREE.Group()
  const prof = [[0, 0.66], [0.25, 0.65], [0.5, 0.6], [0.7, 0.5], [0.86, 0.36], [0.96, 0.2], [1.0, 0.08], [0.98, 0.0], [0.9, -0.02], [0, -0.02]]
  const geo = gradientY(jitter(lathe(prof), 0.012, 2.5), '#e59a45', '#9a4a12', 0.05, 0.6)
  g.add(new THREE.Mesh(geo, mat({ vertexColors: true, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.35, bumpMap: grainBump(0.8, 1600, 'bun'), bumpScale: 0.4, sheen: 0.4, sheenColor: new THREE.Color('#ffd9a0') })))
  // gergelim
  const seedGeo = new THREE.SphereGeometry(1, 10, 8)
  const seedMat = mat({ color: '#f6e7c1', roughness: 0.5 })
  const yAt = (r) => { for (let i = 1; i < prof.length; i++) if (r <= prof[i][0] && r >= prof[i - 1][0]) { const t = (r - prof[i - 1][0]) / (prof[i][0] - prof[i - 1][0]); return prof[i - 1][1] + (prof[i][1] - prof[i - 1][1]) * t } return 0.1 }
  for (let i = 0; i < 46; i++) {
    const r = Math.sqrt(rnd()) * 0.8, a = rnd() * Math.PI * 2
    const s = new THREE.Mesh(seedGeo, seedMat)
    s.scale.set(0.045, 0.016, 0.026)
    s.position.set(Math.cos(a) * r, yAt(r) + 0.004, Math.sin(a) * r)
    s.lookAt(s.position.clone().multiplyScalar(2).setY(s.position.y + 1.2))
    s.rotateZ(rr(0, Math.PI))
    g.add(s)
  }
  g.userData.h = 0.64
  return g
}

function bunHeel() {
  const g = new THREE.Group()
  const prof = [[0, 0], [0.86, 0], [0.95, 0.04], [0.99, 0.12], [0.97, 0.22], [0.93, 0.26], [0, 0.26]]
  const geo = gradientY(jitter(lathe(prof), 0.01, 2.5), '#a9561a', '#e39a48', 0, 0.26)
  g.add(new THREE.Mesh(geo, mat({ vertexColors: true, roughness: 0.5, clearcoat: 0.3, bumpMap: grainBump(0.8, 1600, 'bun'), bumpScale: 0.4 })))
  // miolo tostado na chapa
  const crumb = new THREE.Mesh(jitter(new THREE.CircleGeometry(0.93, 64), 0.01, 3, 0.004), mat({ color: '#e2a85c', roughness: 0.85, bumpMap: grainBump(1.2, 3000, 'crumb'), bumpScale: 1 }))
  crumb.rotation.x = -Math.PI / 2; crumb.position.y = 0.261
  g.add(crumb)
  g.userData.h = 0.26
  return g
}

function patty(color = '#4e2612', { crisp = false, r = 1.02 } = {}) {
  const prof = [[0, -0.11], [r - 0.1, -0.11], [r - 0.02, -0.07], [r + 0.01, 0], [r - 0.02, 0.07], [r - 0.1, 0.115], [0, 0.115]]
  const geo = jitter(lathe(prof, 80), crisp ? 0.04 : 0.03, crisp ? 6 : 4, 0.02)
  geo.translate(0, 0.115, 0)
  const m = new THREE.Mesh(geo, mat({ color, roughness: crisp ? 0.75 : 0.62, clearcoat: crisp ? 0.1 : 0.35, clearcoatRoughness: 0.5, bumpMap: grainBump(crisp ? 1.6 : 1, crisp ? 3500 : 2600, crisp ? 'crisp' : 'meat'), bumpScale: crisp ? 2.5 : 1.6 }))
  const g = new THREE.Group(); g.add(m); g.userData.h = 0.23
  return g
}

function cheese(color = '#ffae12') {
  const size = 1.78
  const geo = new THREE.PlaneGeometry(size, size, 56, 56)
  geo.rotateX(-Math.PI / 2)
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i)
    const r = Math.hypot(x, z)
    let y = 0.02
    if (r > 0.8) y -= Math.min(0.2, Math.pow(r - 0.8, 1.3) * 0.9) // queijo escorrendo pelas bordas
    p.setY(i, y + (noise3(x * 3, 0, z * 3) - 0.5) * 0.02)
  }
  geo.computeVertexNormals()
  const m = new THREE.Mesh(geo, mat({ color, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25, side: THREE.DoubleSide, sheen: 0.3 }))
  m.rotation.y = rr(0, Math.PI)
  const g = new THREE.Group(); g.add(m); g.userData.h = 0.035
  return g
}

function lettuce(color = '#4a8a2c') {
  const geo = new THREE.RingGeometry(0.001, 1.12, 160, 12)
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i)
    const r = Math.hypot(x, y), a = Math.atan2(y, x)
    const ruffle = (Math.sin(a * 11 + r * 4) * 0.035 + Math.sin(a * 27 + 1) * 0.015 + (noise3(x * 3, y * 3, 1) - 0.5) * 0.05) * Math.pow(r, 1.5)
    const rs = 1 + (noise3(Math.cos(a) * 2, Math.sin(a) * 2, 3) - 0.5) * 0.12 * r
    p.setXYZ(i, x * rs, y * rs, ruffle)
  }
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, 0.04, 0)
  geo.computeVertexNormals()
  gradientRadial(geo, '#c9dc8e', color)
  const m = new THREE.Mesh(geo, mat({ vertexColors: true, roughness: 0.5, clearcoat: 0.25, side: THREE.DoubleSide }))
  const g = new THREE.Group(); g.add(m); g.userData.h = 0.06
  return g
}
function gradientRadial(geo, inner, outer) {
  const p = geo.attributes.position
  const colors = new Float32Array(p.count * 3)
  const a = new THREE.Color(inner), b = new THREE.Color(outer), c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getZ(i))
    c.copy(a).lerp(b, THREE.MathUtils.clamp(r * 0.9 + (fbm(p.getX(i) * 5, 0, p.getZ(i) * 5) - 0.5) * 0.4, 0, 1))
    colors.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

let tomatoTex = null
function tomato() {
  tomatoTex = tomatoTex || canvasTex(256, (g, s) => {
    g.fillStyle = '#d8261a'; g.fillRect(0, 0, s, s)
    const c = s / 2
    g.fillStyle = '#f2584a'; g.beginPath(); g.arc(c, c, s * 0.42, 0, Math.PI * 2); g.fill()
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4
      g.fillStyle = '#ff8a6a'
      g.beginPath(); g.ellipse(c + Math.cos(a) * s * 0.22, c + Math.sin(a) * s * 0.22, s * 0.12, s * 0.08, a, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#ffd36b'
      for (let j = 0; j < 6; j++) { g.beginPath(); g.ellipse(c + Math.cos(a) * s * (0.17 + j * 0.018), c + Math.sin(a) * s * 0.2 + rr(-6, 6), 3, 2, a, 0, Math.PI * 2); g.fill() }
    }
    g.fillStyle = '#f7a08a'; g.beginPath(); g.arc(c, c, s * 0.07, 0, Math.PI * 2); g.fill()
  })
  const g = new THREE.Group()
  const side = mat({ color: '#c81e12', roughness: 0.25, clearcoat: 0.8 })
  const top = mat({ map: tomatoTex, roughness: 0.3, clearcoat: 0.6 })
  for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.07, 48), [side, top, top])
    const a = (k / 3) * Math.PI * 2 + 0.3
    m.position.set(Math.cos(a) * 0.5, 0.035, Math.sin(a) * 0.5)
    m.rotation.set(rr(-0.06, 0.06), rr(0, 6), rr(-0.06, 0.06))
    g.add(m)
  }
  g.userData.h = 0.07
  return g
}

let baconTex = null
function bacon() {
  baconTex = baconTex || canvasTex(256, (g, s) => {
    const bands = ['#7d1f12', '#b63a24', '#f0b7a0', '#a32e1c', '#e9a28a', '#8a2615', '#c4482c']
    let y = 0
    while (y < s) { const h = rr(10, 34); g.fillStyle = bands[Math.floor(rr(0, bands.length))]; g.fillRect(0, y, s, h); y += h }
    g.globalAlpha = 0.25
    for (let i = 0; i < 400; i++) { g.fillStyle = rnd() > 0.5 ? '#3a0d05' : '#fff0e0'; g.fillRect(rr(0, s), rr(0, s), rr(2, 10), 1.5) }
  })
  const g = new THREE.Group()
  for (let k = 0; k < 2; k++) {
    const geo = new THREE.PlaneGeometry(2.35, 0.3, 90, 4)
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i)
      p.setZ(i, Math.sin(x * 5 + k) * 0.05 + Math.sin(x * 11) * 0.015 + y * Math.sin(x * 3) * 0.15)
    }
    geo.rotateX(-Math.PI / 2)
    geo.computeVertexNormals()
    const m = new THREE.Mesh(geo, mat({ map: baconTex, roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide }))
    m.position.y = 0.04 + k * 0.025
    m.rotation.y = k ? 0.35 : -0.25
    g.add(m)
  }
  g.userData.h = 0.07
  return g
}

function egg() {
  const g = new THREE.Group()
  const shape = new THREE.Shape()
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2
    const r = 1.02 + (noise3(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 1) - 0.5) * 0.4
    i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  const white = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.03, bevelSegments: 4, curveSegments: 64 })
  white.rotateX(-Math.PI / 2)
  g.add(new THREE.Mesh(white, mat({ color: '#fffbf2', roughness: 0.28, clearcoat: 0.6, sheen: 0.4 })))
  const yolk = new THREE.Mesh(new THREE.SphereGeometry(0.3, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), mat({ color: '#ff9d00', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }))
  yolk.scale.y = 0.55; yolk.position.set(0.1, 0.05, -0.05)
  g.add(yolk)
  g.userData.h = 0.1
  return g
}

function onion() {
  const g = new THREE.Group()
  const m = mat({ color: '#7a3a2a', roughness: 0.3, clearcoat: 0.8 })
  for (let i = 0; i < 22; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(rr(0.1, 0.2), 0.03, 8, 24, rr(1.5, 3.5)), m)
    const r = Math.sqrt(rnd()) * 0.62, a = rnd() * 6.28
    t.position.set(Math.cos(a) * r, 0.03, Math.sin(a) * r)
    t.rotation.set(Math.PI / 2 + rr(-0.08, 0.08), 0, rr(0, 6.28))
    g.add(t)
  }
  g.userData.h = 0.08
  return g
}

const RECIPES = {
  classic: ['heel', 'patty', 'cheese', 'top'],
  salada: ['heel', 'patty', 'cheese', 'tomato', 'lettuce', 'top'],
  bacon: ['heel', 'patty', 'cheese', 'bacon', 'top'],
  egg: ['heel', 'patty', 'cheese', 'egg', 'top'],
  tudo: ['heel', 'patty', 'cheese', 'bacon', 'egg', 'tomato', 'lettuce', 'top'],
  double: ['heel', 'patty', 'cheese', 'patty', 'cheese', 'onion', 'top'],
  frango: ['heel', 'chicken', 'cheese-white', 'tomato', 'lettuce', 'top'],
  veggie: ['heel', 'veggie', 'cheese-white', 'tomato', 'arugula', 'top'],
}
const LAYER = {
  heel: bunHeel, top: bunTop, patty: () => patty(), chicken: () => patty('#c88334', { crisp: true, r: 1.06 }),
  veggie: () => patty('#9b7f3e', { crisp: true }), cheese: () => cheese(), 'cheese-white': () => cheese('#f5e9c8'),
  lettuce: () => lettuce(), arugula: () => lettuce('#2f6e22'), tomato, bacon, egg, onion,
}

/** Hambúrguer montado. layers[] guarda cada camada e a altura de repouso (para animar a montagem). */
export function burger(variant = 'classic') {
  const g = new THREE.Group()
  const layers = []
  let y = 0
  for (const name of RECIPES[variant] || RECIPES.classic) {
    const l = LAYER[name]()
    l.position.y = y
    l.rotation.y = rr(-0.3, 0.3)
    l.userData.restY = y
    g.add(l); layers.push(l)
    y += l.userData.h * (name.startsWith('cheese') ? 0.6 : 0.97)
  }
  g.userData.layers = layers
  return g
}

// ---------- outros produtos ----------
function hotdog(full) {
  const g = new THREE.Group()
  const bunGeo = gradientY(jitter(new THREE.CapsuleGeometry(0.42, 1.9, 12, 32), 0.015, 2), '#c97a2c', '#f2bb6f', -0.4, 0.3)
  bunGeo.rotateZ(Math.PI / 2); bunGeo.scale(1, 0.7, 1.05)
  const bunMat = mat({ vertexColors: true, roughness: 0.45, clearcoat: 0.45, bumpMap: grainBump(0.8, 1600, 'bun'), bumpScale: 0.4 })
  const left = new THREE.Mesh(bunGeo, bunMat); left.position.set(0, 0.3, -0.2); left.rotation.x = -0.35
  const right = new THREE.Mesh(bunGeo, bunMat); right.position.set(0, 0.3, 0.2); right.rotation.x = 0.35
  g.add(left, right)
  const sausageGeo = jitter(new THREE.CapsuleGeometry(0.2, 2.05, 12, 32), 0.006, 3)
  sausageGeo.rotateZ(Math.PI / 2)
  const sausage = new THREE.Mesh(sausageGeo, mat({ color: '#a33b1f', roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.2 }))
  sausage.position.y = 0.55
  g.add(sausage)
  const sauce = (color, phase, amp, y) => {
    const pts = []
    for (let i = 0; i <= 40; i++) { const x = -1.05 + (i / 40) * 2.1; pts.push(new THREE.Vector3(x, y + Math.sin(i * 0.3) * 0.01, Math.sin(i * 1.1 + phase) * amp)) }
    const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.035, 10), mat({ color, roughness: 0.25, clearcoat: 0.8 }))
    g.add(t)
  }
  sauce('#f2b705', 0, 0.12, 0.76)
  sauce('#c4180d', 1.6, 0.1, 0.78)
  if (full) {
    // purê, batata palha, milho e ervilha
    for (let i = 0; i < 120; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(rr(0.12, 0.22), 0.018, 0.018), mat({ color: '#f1bd45', roughness: 0.5 }))
      b.position.set(rr(-1, 1), rr(0.78, 0.9), rr(-0.2, 0.2)); b.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3))
      g.add(b)
    }
    const corn = mat({ color: '#ffd52e', roughness: 0.3, clearcoat: 0.6 }), pea = mat({ color: '#4f9a2f', roughness: 0.3, clearcoat: 0.6 })
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), i % 2 ? corn : pea)
      s.position.set(rr(-0.95, 0.95), rr(0.8, 0.86), rr(-0.18, 0.18))
      g.add(s)
    }
  } else {
    for (let i = 0; i < 40; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(rr(0.1, 0.18), 0.016, 0.016), mat({ color: '#f1bd45', roughness: 0.5 }))
      b.position.set(rr(-0.9, 0.9), rr(0.78, 0.84), rr(-0.15, 0.15)); b.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3))
      g.add(b)
    }
  }
  g.rotation.y = -0.5
  return g
}

let boxTex = null
function fries(cheddar) {
  const g = new THREE.Group()
  boxTex = boxTex || canvasTex(512, (c, s) => {
    c.fillStyle = '#d7261b'; c.fillRect(0, 0, s, s)
    c.strokeStyle = '#ffce1f'; c.lineWidth = s * 0.035
    c.beginPath(); for (let x = 0; x <= s; x += 2) c.lineTo(x, s * 0.62 + Math.sin((x / s) * Math.PI * 8) * s * 0.025); c.stroke()

  })
  const boxGeo = new THREE.CylinderGeometry(0.78, 0.55, 1.15, 4, 1, true)
  boxGeo.rotateY(Math.PI / 4); boxGeo.scale(1.15, 1, 0.75)
  const box = new THREE.Mesh(boxGeo, mat({ map: boxTex, roughness: 0.55, clearcoat: 0.3, side: THREE.DoubleSide }))
  box.position.y = 0.575
  g.add(box)
  const fryMat = mat({ color: '#f3b43c', roughness: 0.5, clearcoat: 0.25, bumpMap: grainBump(0.6, 900, 'fry'), bumpScale: 0.6 })
  for (let i = 0; i < 52; i++) {
    const h = rr(0.9, 1.35)
    const f = new THREE.Mesh(new RoundedBoxGeometry(0.085, h, 0.085, 2, 0.02), fryMat)
    f.position.set(rr(-0.55, 0.55), 0.35 + h / 2, rr(-0.28, 0.28))
    f.rotation.set(rr(-0.25, 0.25), rr(0, 3), rr(-0.3, 0.3))
    g.add(f)
  }
  if (cheddar) {
    const blob = new THREE.Mesh(jitter(new THREE.SphereGeometry(0.62, 48, 24), 0.12, 2.5, 0.06), mat({ color: '#ff9a0d', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }))
    blob.scale.set(0.75, 0.22, 0.5); blob.position.y = 1.45
    g.add(blob)
    for (let i = 0; i < 18; i++) {
      const b = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.06, 0.09, 2, 0.015), mat({ color: '#8f2a17', roughness: 0.4, clearcoat: 0.5 }))
      b.position.set(rr(-0.4, 0.4), rr(1.5, 1.56), rr(-0.22, 0.22)); b.rotation.set(rr(0, 3), rr(0, 3), 0)
      g.add(b)
    }
  }
  g.rotation.y = 0.35
  return g
}

function plate(r = 1.35) {
  const prof = [[0, 0], [r * 0.7, 0], [r * 0.75, 0.03], [r * 0.95, 0.09], [r, 0.12], [r * 0.98, 0.13], [r * 0.9, 0.1], [r * 0.7, 0.05], [0, 0.05]]
  return new THREE.Mesh(lathe(prof, 96), mat({ color: '#fbfaf6', roughness: 0.15, clearcoat: 1 }))
}
function dipBowl(sauceColor, x, z) {
  const g = new THREE.Group()
  const bowl = new THREE.Mesh(lathe([[0, 0], [0.26, 0], [0.32, 0.18], [0.3, 0.19], [0.24, 0.03], [0, 0.03]], 48), mat({ color: '#ffffff', roughness: 0.2, clearcoat: 1, side: THREE.DoubleSide }))
  const s = new THREE.Mesh(new THREE.CircleGeometry(0.29, 40), mat({ color: sauceColor, roughness: 0.15, clearcoat: 1 }))
  s.rotation.x = -Math.PI / 2; s.position.y = 0.14
  g.add(bowl, s); g.position.set(x, 0.05, z)
  return g
}

function rings() {
  const g = new THREE.Group()
  g.add(plate())
  const m = mat({ color: '#d5862b', roughness: 0.7, bumpMap: grainBump(1.8, 4000, 'crisp'), bumpScale: 3, clearcoat: 0.15 })
  const spots = [[-0.35, 0.2, 0.3, 0.1], [0.3, 0.25, 0.1, -0.2], [-0.05, 0.42, -0.35, 0.5], [0.15, 0.58, 0.15, 0.25]]
  for (const [x, y, z, tilt] of spots) {
    const t = new THREE.Mesh(jitter(new THREE.TorusGeometry(0.42, 0.15, 24, 64), 0.03, 6), m)
    t.rotation.set(Math.PI / 2 + tilt, 0, rr(0, 3)); t.position.set(x, y, z)
    g.add(t)
  }
  g.add(dipBowl('#5a170c', 0.85, 0.55))
  return g
}

function cassava() {
  const g = new THREE.Group()
  g.add(plate())
  for (let i = 0; i < 11; i++) {
    const geo = jitter(new RoundedBoxGeometry(0.2, 0.2, rr(1.0, 1.35), 3, 0.06), 0.03, 4)
    gradientY(geo, '#c97f22', '#f3cf7c', -0.1, 0.1)
    const s = new THREE.Mesh(geo, mat({ vertexColors: true, roughness: 0.55, clearcoat: 0.2, bumpMap: grainBump(0.8, 1500, 'fry'), bumpScale: 0.8 }))
    s.position.set(rr(-0.5, 0.5), 0.17 + (i > 6 ? 0.18 : 0), rr(-0.4, 0.4)); s.rotation.set(0, rr(0, 3.1), rr(-0.15, 0.15))
    g.add(s)
  }
  g.add(dipBowl('#f4ecd2', 0.85, 0.6))
  return g
}

let canTex = null
function can() {
  canTex = canTex || canvasTex(512, (c, s) => {
    c.fillStyle = '#d7261b'; c.fillRect(0, 0, s, s)
    c.fillStyle = '#ffce1f'; c.fillRect(0, s * 0.38, s, s * 0.2)
    c.fillStyle = '#ffffff'
    for (const cx of [s * 0.25, s * 0.75]) { const a = s * 0.03, b = s * 0.08, cy = s * 0.22; c.fillRect(cx - a, cy - b, a * 2, b * 2); c.fillRect(cx - b, cy - a, b * 2, a * 2) }
  })
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 64, 1, true), mat({ map: canTex, metalness: 0.6, roughness: 0.28, clearcoat: 1 }))
  body.position.y = 0.66
  const metal = mat({ color: '#d3d7da', metalness: 1, roughness: 0.25 })
  const top = new THREE.Mesh(lathe([[0, 1.3], [0.33, 1.3], [0.36, 1.33], [0.38, 1.32], [0.42, 1.26], [0.42, 1.25]], 64), metal)
  const bottom = new THREE.Mesh(lathe([[0.42, 0.07], [0.38, 0.02], [0.3, 0], [0, 0.02]], 64), metal)
  const tab = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 8, 24), metal)
  tab.rotation.x = Math.PI / 2; tab.position.set(0.12, 1.315, 0)
  const drops = mat({ color: '#ffffff', roughness: 0, transmission: 1, thickness: 0.05, ior: 1.33 })
  for (let i = 0; i < 40; i++) {
    const a = rr(-1.2, 1.2), d = new THREE.Mesh(new THREE.SphereGeometry(rr(0.012, 0.028), 10, 8), drops)
    d.position.set(Math.sin(a) * 0.425, rr(0.2, 1.15), Math.cos(a) * 0.425); d.scale.z = 0.5; d.lookAt(0, d.position.y, 0)
    g.add(d)
  }
  g.add(body, top, bottom, tab)
  return g
}

function glass(h = 1.35, rb = 0.36, rt = 0.5) {
  const prof = [[0, 0], [rb, 0], [rt, h], [rt - 0.03, h], [rb - 0.04, 0.08], [0, 0.08]]
  return new THREE.Mesh(lathe(prof, 72), mat({ color: '#ffffff', roughness: 0.04, transmission: 1, thickness: 0.08, ior: 1.5, side: THREE.DoubleSide, transparent: true }))
}
function liquid(level, color, opts = {}, h = 1.35, rb = 0.36, rt = 0.5) {
  const r = (y) => rb - 0.05 + ((rt - rb) * y) / h
  return new THREE.Mesh(lathe([[0, 0.09], [r(0.09), 0.09], [r(level), level], [0, level]], 64), mat({ color, roughness: 0.15, clearcoat: 0.6, ...opts }))
}
function straw(color, x = 0.15) {
  const tex = canvasTex(64, (c, s) => { c.fillStyle = '#fff'; c.fillRect(0, 0, s, s); c.fillStyle = color; for (let i = 0; i < 4; i++) { c.save(); c.translate(0, i * 16); c.fillRect(0, 0, s, 8); c.restore() } })
  tex.repeat.set(1, 6); tex.rotation = 0.5
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 16), mat({ map: tex, roughness: 0.3, clearcoat: 0.5 }))
  s.position.set(x, 1.25, 0); s.rotation.z = -0.22
  return s
}
function cup(kind) {
  const g = new THREE.Group()
  g.add(glass())
  if (kind === 'shake') {
    g.add(liquid(1.2, '#b77259', { roughness: 0.5, clearcoat: 0.2 }))
    const cream = mat({ color: '#fffaf0', roughness: 0.6, sheen: 0.6 })
    const sizes = [[0.42, 1.32], [0.33, 1.46], [0.23, 1.58], [0.12, 1.68]]
    for (const [r, y] of sizes) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.1, 16, 48), cream); t.rotation.x = Math.PI / 2; t.position.y = y; g.add(t) }
    const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 16), mat({ color: '#c3070f', roughness: 0.08, clearcoat: 1 }))
    cherry.position.y = 1.82; g.add(cherry)
    g.add(straw('#d7261b', 0.2))
  } else if (kind === 'acai') {
    g.add(liquid(1.22, '#3b0f45', { roughness: 0.35 }))
    const banana = canvasTex(128, (c, s) => { c.fillStyle = '#fbf1c4'; c.fillRect(0, 0, s, s); c.fillStyle = '#d9c27a'; c.beginPath(); c.arc(s / 2, s / 2, s * 0.12, 0, 7); c.fill() })
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 32), [mat({ color: '#f1e4a4' }), mat({ map: banana, roughness: 0.5 }), mat({ map: banana })])
      const a = i * 1.05; b.position.set(Math.cos(a) * 0.25, 1.27, Math.sin(a) * 0.25); b.rotation.set(rr(-0.4, 0.4), 0, rr(-0.4, 0.4))
      g.add(b)
    }
    for (let i = 0; i < 40; i++) {
      const gr = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.04, 0.05, 1, 0.01), mat({ color: '#b5783a', roughness: 0.8 }))
      gr.position.set(rr(-0.35, 0.35), 1.26, rr(-0.35, 0.35)); gr.rotation.set(rr(0, 3), rr(0, 3), 0)
      g.add(gr)
    }
  } else {
    g.add(liquid(1.18, '#ff8a00', { transmission: 0.08, thickness: 0.6, roughness: 0.12, clearcoat: 0.8 }))
    const orange = canvasTex(256, (c, s) => {
      c.fillStyle = '#ffb21a'; c.fillRect(0, 0, s, s); c.fillStyle = '#ffe09a'
      for (let k = 0; k < 10; k++) { c.save(); c.translate(s / 2, s / 2); c.rotate((k / 10) * Math.PI * 2); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, s * 0.42, -0.25, 0.25); c.closePath(); c.fillStyle = '#ffa20d'; c.fill(); c.restore() }
      c.strokeStyle = '#fff2cc'; c.lineWidth = 8; c.beginPath(); c.arc(s / 2, s / 2, s * 0.45, 0, 7); c.stroke()
    })
    const slice = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 48), [mat({ color: '#f39a10' }), mat({ map: orange, roughness: 0.3, clearcoat: 0.5 }), mat({ map: orange })])
    slice.rotation.x = Math.PI / 2; slice.rotation.y = 0.4; slice.position.set(-0.45, 1.3, 0.1)
    g.add(slice, straw('#2b1a0e'))
    for (let i = 0; i < 4; i++) { const ice = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.22, 0.22, 3, 0.05), mat({ color: '#ffffff', transmission: 1, roughness: 0.1, thickness: 0.3 })); ice.position.set(rr(-0.2, 0.2), 1.1 + i * 0.02, rr(-0.2, 0.2)); ice.rotation.set(rr(0, 1), rr(0, 1), 0); g.add(ice) }
  }
  return g
}

function bottle(water) {
  const g = new THREE.Group()
  const prof = water
    ? [[0, 0], [0.34, 0], [0.36, 0.05], [0.36, 1.05], [0.3, 1.25], [0.14, 1.4], [0.13, 1.5], [0, 1.5]]
    : [[0, 0], [0.42, 0], [0.48, 0.12], [0.46, 0.3], [0.48, 0.55], [0.48, 1.2], [0.4, 1.45], [0.2, 1.75], [0.14, 1.9], [0.13, 2.0], [0, 2.0]]
  const shell = new THREE.Mesh(lathe(prof), mat({ color: water ? '#e9f6ff' : '#cfe9c9', roughness: 0.05, transmission: 1, thickness: 0.05, ior: 1.45, side: THREE.DoubleSide, transparent: true }))
  const inner = prof.filter(([, y]) => y <= (water ? 1.3 : 1.62)).map(([x, y]) => [Math.max(0, x - 0.03), Math.max(0.02, y)])
  inner.push([0, inner[inner.length - 1][1]])
  const liq = new THREE.Mesh(lathe(inner, 64), mat({ color: water ? '#dff3ff' : '#c76d18', roughness: 0.05, transmission: water ? 1 : 0.55, thickness: 0.8, ior: 1.33, transparent: true }))
  const top = prof[prof.length - 1][1]
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 32), mat({ color: water ? '#1f6fc2' : '#1d8a34', roughness: 0.35, clearcoat: 0.5 }))
  cap.position.y = top + 0.06
  const label = canvasTex(512, (c, s) => {
    c.fillStyle = water ? '#ffffff' : '#1d8a34'; c.fillRect(0, 0, s, s)
    c.fillStyle = water ? '#1f6fc2' : '#ffce1f'; c.fillRect(0, s * 0.62, s, s * 0.12)
    c.fillStyle = water ? '#8cc8f0' : '#f4f4f4'
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(s * (k + 0.5) / 4, s * 0.38, s * 0.06, 0, 7); c.fill() }
  })
  const lr = water ? 0.365 : 0.485
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(lr, lr, water ? 0.45 : 0.55, 64, 1, true), mat({ map: label, roughness: 0.35, clearcoat: 0.6 }))
  lab.position.y = water ? 0.6 : 0.85
  g.add(liq, shell, cap, lab)
  return g
}

function pudding() {
  const g = new THREE.Group()
  g.add(plate())
  const body = new THREE.Mesh(gradientY(lathe([[0, 0.05], [0.75, 0.05], [0.72, 0.15], [0.6, 0.55], [0.55, 0.6], [0, 0.6]], 96), '#e9a73f', '#f7cf72', 0.05, 0.5), mat({ vertexColors: true, roughness: 0.25, clearcoat: 0.8, sheen: 0.3 }))
  const caramel = mat({ color: '#7d2e07', roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, transmission: 0.25, thickness: 0.3 })
  const capTop = new THREE.Mesh(lathe([[0, 0.62], [0.55, 0.62], [0.6, 0.57], [0.61, 0.55], [0, 0.55]], 96), caramel)
  g.add(body, capTop)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rr(0, 0.3), len = rr(0.12, 0.38)
    const d = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, len, 6, 12), caramel)
    const r = 0.6 + (0.62 - 0.55) * 0 + 0.0
    d.position.set(Math.cos(a) * (r + len * 0.12), 0.58 - len / 2, Math.sin(a) * (r + len * 0.12))
    d.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25)
    g.add(d)
  }
  const pool = new THREE.Mesh(jitter(new THREE.CircleGeometry(0.95, 64), 0.06, 3, 0), caramel)
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.055
  g.add(pool)
  return g
}

function brownie() {
  const g = new THREE.Group()
  g.add(plate())
  const geo = jitter(new RoundedBoxGeometry(1.15, 0.5, 1.0, 4, 0.06), 0.02, 4)
  const b = new THREE.Mesh(geo, mat({ color: '#3a1a0b', roughness: 0.75, bumpMap: grainBump(1.4, 3500, 'brownie'), bumpScale: 2.5 }))
  b.position.y = 0.3; b.rotation.y = 0.3
  const scoop = new THREE.Mesh(jitter(new THREE.SphereGeometry(0.42, 64, 32), 0.07, 3, 0.05), mat({ color: '#fff3d9', roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#ffffff') }))
  scoop.position.set(0.05, 0.85, 0); scoop.scale.y = 0.85
  const pts = []
  for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push(new THREE.Vector3(Math.cos(t * 9) * (0.42 - t * 0.12), 1.15 - t * 0.55, Math.sin(t * 9) * (0.42 - t * 0.12))) }
  const syrup = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.035, 10), mat({ color: '#2a0e04', roughness: 0.05, clearcoat: 1 }))
  syrup.position.x = 0.05
  g.add(b, scoop, syrup)
  return g
}

/** Monta o modelo de um item do cardápio pela chave de arte (ex.: "burger:tudo"). */
export function buildFood(art = 'burger:classic') {
  resetSeed(art.length * 31 + art.charCodeAt(art.length - 1))
  const [kind, variant] = art.split(':')
  let m
  switch (kind) {
    case 'burger': m = burger(variant); break
    case 'hotdog': m = hotdog(variant === 'full'); break
    case 'fries': m = fries(variant === 'cheddar'); break
    case 'rings': m = rings(); break
    case 'cassava': m = cassava(); break
    case 'can': m = can(); break
    case 'cup': m = cup(variant); break
    case 'bottle': m = bottle(false); break
    case 'water': m = bottle(true); break
    case 'pudding': m = pudding(); break
    case 'brownie': m = brownie(); break
    default: m = burger('classic')
  }
  return shadowy(m)
}

// ---------- estúdio: luz, sombra e câmera ----------
export function createStudio(canvas, { alpha = true, pixelRatio = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(pixelRatio)
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.9

  const key = new THREE.DirectionalLight('#fff4e2', 2.2)
  key.position.set(-3, 6, 4)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.radius = 6
  key.shadow.bias = -0.0004
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 })
  const rim = new THREE.DirectionalLight('#ffd8a8', 1.1)
  rim.position.set(4, 3, -4)
  scene.add(key, rim)

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.28 }))
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100)

  /** Enquadra o objeto: câmera um pouco acima, como foto de cardápio. */
  function frame(obj, { elevation = 0.42, fill = 1.0, offsetY = 0 } = {}) {
    const box = new THREE.Box3().setFromObject(obj)
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    ground.position.y = box.min.y
    const dist = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * fill
    const target = sphere.center.clone().add(new THREE.Vector3(0, offsetY, 0))
    camera.position.set(target.x, target.y + Math.sin(elevation) * dist, target.z + Math.cos(elevation) * dist)
    camera.lookAt(target)
    key.target.position.copy(sphere.center)
    key.target.updateMatrixWorld()
  }

  return { renderer, scene, camera, frame, THREE }
}
export { THREE }
