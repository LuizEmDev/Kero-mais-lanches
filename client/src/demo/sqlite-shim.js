// Substitui "node:sqlite" na versão de demonstração: o mesmo SQLite, compilado para
// WebAssembly (sql.js), com a mesma API síncrona usada pelo servidor.
// O banco fica salvo no navegador e é compartilhado entre as abas.
const KEY = 'kero:demo-db'
let SQL = null
let instance = null
let dirty = false

export function setSqlJs(s) { SQL = s }

function load() {
  try {
    const b64 = localStorage.getItem(KEY)
    if (!b64) return null
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  } catch { return null }
}

export function flush() {
  if (!dirty || !instance) return
  dirty = false
  try {
    const bytes = instance.db.export()
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    localStorage.setItem(KEY, btoa(bin))
  } catch { /* sem espaço ou modo privado: segue só em memória */ }
}

/** Outra aba mudou o banco: recarrega a cópia salva. */
export function reloadFromStorage() {
  const bytes = load()
  if (bytes && instance) {
    instance.cache.forEach((st) => st.free()); instance.cache.clear()
    instance.lastId?.free(); instance.lastId = null
    instance.db.close(); instance.db = new SQL.Database(bytes)
  }
}

export function resetDemo() { try { localStorage.removeItem(KEY) } catch { /* */ } }

const markDirty = () => {
  if (dirty) return
  dirty = true
  queueMicrotask(flush)
}
const norm = (params) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? Number(p) : p))

class Statement {
  constructor(owner, sql) { this.owner = owner; this.sql = sql }
  // Reaproveita o statement compilado (o seed insere milhares de linhas).
  #prep(params) {
    const cache = this.owner.cache
    let st = cache.get(this.sql)
    if (!st) { st = this.owner.db.prepare(this.sql); cache.set(this.sql, st) }
    st.reset()
    if (params.length) st.bind(norm(params))
    return st
  }
  get(...params) { const s = this.#prep(params); const row = s.step() ? s.getAsObject() : undefined; s.reset(); return row }
  all(...params) { const s = this.#prep(params); const rows = []; while (s.step()) rows.push(s.getAsObject()); s.reset(); return rows }
  run(...params) {
    const s = this.#prep(params); s.step(); s.reset()
    const changes = this.owner.db.getRowsModified()
    let id = 0
    if (this.isInsert ??= /^\s*INSERT/i.test(this.sql)) {
      const q = this.owner.lastId ??= this.owner.db.prepare('SELECT last_insert_rowid()')
      q.step(); id = q.get()[0]; q.reset()
    }
    markDirty()
    return { changes, lastInsertRowid: id }
  }
}

export class DatabaseSync {
  constructor() {
    this.lastId = null
    this.cache = new Map()
    if (!SQL) throw new Error('sql.js não iniciado')
    const bytes = load()
    this.db = bytes ? new SQL.Database(bytes) : new SQL.Database()
    instance = this
  }
  exec(sql) { this.db.exec(sql); if (!/^\s*(PRAGMA|BEGIN)/i.test(sql)) markDirty() }
  prepare(sql) { return new Statement(this, sql) }
}
