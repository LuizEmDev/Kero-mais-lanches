// Liga a versão de demonstração (GitHub Pages): SQLite em WebAssembly + regras do servidor no navegador.
import initSqlJs from 'sql.js/dist/sql-wasm.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { setSqlJs, flush, reloadFromStorage } from './sqlite-shim.js'
import { fakeIO, listenOtherTabs } from './socket.js'

let handler = null

export async function boot() {
  setSqlJs(await initSqlJs({ locateFile: () => wasmUrl }))
  const { attachIO } = await import('../../../server/bus.js')
  attachIO(fakeIO(flush))
  const { seed } = await import('../../../server/seed.js')
  seed({ demo: true })
  flush()
  handler = (await import('./router.js')).handle
  listenOtherTabs(reloadFromStorage)
  // O fetch da API é atendido aqui mesmo; o resto (imagens, fontes) segue normal.
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url
    const path = url.startsWith('http') ? new URL(url).pathname : url
    if (!path.startsWith('/api/')) return realFetch(input, init)
    let body = init.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { /* corpo não-JSON */ } }
    const { status, data } = await handler((init.method || 'GET').toUpperCase(), path + (url.includes('?') ? url.slice(url.indexOf('?')) : ''), { body, headers: init.headers || {} })
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  }
}
