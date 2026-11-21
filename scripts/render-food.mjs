// Gera as imagens 3D dos produtos em client/public/food/*.webp.
// Uso: node scripts/render-food.mjs [arte...]   (sem argumentos, gera todas)
import { createServer } from 'vite'
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const B = { elevation: 0.2, fill: 0.95 }
const ARTS = {
  'burger:classic': B, 'burger:salada': B, 'burger:bacon': B, 'burger:egg': B, 'burger:tudo': B, 'burger:double': B,
  'burger:frango': B, 'burger:veggie': B, 'hotdog:simple': { elevation: 0.55 }, 'hotdog:full': { elevation: 0.55 },
  'fries:plain': {}, 'fries:cheddar': {}, rings: { elevation: 0.7 }, cassava: { elevation: 0.7 }, can: { elevation: 0.3 },
  'cup:juice': { elevation: 0.3 }, 'cup:shake': { elevation: 0.3 }, 'cup:acai': { elevation: 0.45 }, bottle: { elevation: 0.25 },
  water: { elevation: 0.25 }, pudding: { elevation: 0.55 }, brownie: { elevation: 0.5 },
}
// Playwright não é dependência do site: só é preciso para gerar as imagens (npm i -D playwright).
const { chromium } = createRequire(import.meta.url)('playwright')
const only = process.argv.slice(2)
const root = fileURLToPath(new URL('..', import.meta.url))
const out = fileURLToPath(new URL('../client/public/food/', import.meta.url))
mkdirSync(out, { recursive: true })

const vite = await createServer({ configFile: `${root}vite.config.js`, server: { port: 5199, strictPort: false }, logLevel: 'error' })
await vite.listen()
const url = vite.resolvedUrls.local[0]
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage()
page.on('pageerror', (e) => console.error('erro na página:', e.message))
await page.goto(`${url}render-food.html`)
await page.waitForFunction(() => window.ready, null, { timeout: 60000 })
for (const [art, opts] of Object.entries(ARTS)) {
  if (only.length && !only.includes(art)) continue
  const t = Date.now()
  const data = await page.evaluate(([a, o]) => window.renderFood(a, o), [art, opts])
  const file = `${art.replace(':', '-')}.webp`
  writeFileSync(out + file, Buffer.from(data.split(',')[1], 'base64'))
  console.log(`${file} ${Date.now() - t}ms`)
}
await browser.close()
await vite.close()
