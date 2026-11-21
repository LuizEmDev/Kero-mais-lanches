import express from 'express'
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Server } from 'socket.io'
import { seed } from './seed.js'
import api, { DEMO, UPLOAD_DIR } from './api.js'
import { attachIO } from './bus.js'
import { verifyToken, staffPin } from './auth.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const prod = process.env.NODE_ENV === 'production'
const PORT = Number(process.env.PORT || 3000)

seed({ demo: DEMO })

const app = express()
app.set('trust proxy', 1)
app.disable('x-powered-by')
const http = createServer(app)
const io = new Server(http)
attachIO(io)

io.on('connection', (socket) => {
  socket.on('join', ({ room, token } = {}) => {
    if (typeof room !== 'string') return
    if (room === 'staff') {
      if (verifyToken(token)) socket.join('staff')
      else socket.emit('auth:error')
      return
    }
    if (/^(order:[A-Z0-9]{4,10}|table:\d{1,3}|menu)$/.test(room)) socket.join(room)
  })
  socket.on('leave', ({ room } = {}) => typeof room === 'string' && socket.leave(room))
})

app.use('/api', api)
// Fotos enviadas pela loja.
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', fallthrough: false }))

if (process.env.NODE_ENV === 'test') {
  // Testes de API: sem front-end.
} else if (prod) {
  const dist = join(root, 'client/dist')
  if (!existsSync(dist)) throw new Error('Rode "npm run build" antes de "npm start".')
  app.use(express.static(dist, { index: false, maxAge: '1y', immutable: true }))
  app.get('/{*path}', (_req, res) => res.sendFile(join(dist, 'index.html'), { maxAge: 0 }))
} else {
  const { createServer: createVite } = await import('vite')
  const vite = await createVite({ configFile: join(root, 'vite.config.js'), server: { middlewareMode: true, hmr: { server: http } }, appType: 'spa' })
  app.use(vite.middlewares)
}

http.listen(PORT, () => {
  console.log(`Kero+ rodando em http://localhost:${PORT}`)
  if (!process.env.STAFF_PIN) console.log(`PIN da equipe: ${staffPin()} (defina STAFF_PIN para trocar)`)
  if (DEMO) console.log('Modo demonstração ligado: botão "Simular pagamento" e histórico fictício no dashboard.')
})
