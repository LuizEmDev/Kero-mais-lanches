import{V as t}from"./index-XvuR26cC.js";import{b as a,r}from"./boot-CIMz6USm.js";var s={DB_FILE:":memory:"};const R=s.DB_FILE,N=new t(R);N.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");N.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  price INTEGER NOT NULL,
  art TEXT NOT NULL DEFAULT 'burger',
  tags TEXT NOT NULL DEFAULT '[]',
  available INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tables (
  number INTEGER PRIMARY KEY,
  seats INTEGER NOT NULL DEFAULT 4,
  token TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL,              -- mesa | entrega | retirada
  is_group INTEGER NOT NULL DEFAULT 0,
  table_number INTEGER,
  status TEXT NOT NULL,
  split_mode TEXT NOT NULL DEFAULT 'consumo',
  service_pct REAL NOT NULL DEFAULT 0,
  delivery_fee INTEGER NOT NULL DEFAULT 0,
  customer TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  paid_at INTEGER,
  closed_at INTEGER
);
CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS orders_table ON orders(table_number, status);

CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_id TEXT NOT NULL,
  token TEXT NOT NULL,
  is_host INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'novo', -- novo | preparando | pronto | entregue
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  ready_at INTEGER,
  done_at INTEGER
);
CREATE INDEX IF NOT EXISTS tickets_status ON tickets(status);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_id INTEGER REFERENCES tickets(id),
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  added_by INTEGER,
  shares TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  allocations TEXT NOT NULL,          -- { participantId: centavos }
  payer_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | pago | cancelado | expirado
  provider TEXT NOT NULL,
  provider_id TEXT,
  txid TEXT NOT NULL,
  brcode TEXT NOT NULL,
  qr_base64 TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  paid_at INTEGER,
  confirmed_by TEXT
);
CREATE INDEX IF NOT EXISTS payments_paid ON payments(status, paid_at);

CREATE TABLE IF NOT EXISTS calls (
  id INTEGER PRIMARY KEY,
  table_number INTEGER NOT NULL,
  order_id INTEGER,
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'aberto', -- aberto | atendido
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);
`);const d=(T,E)=>N.prepare(`PRAGMA table_info(${T})`).all().some(e=>e.name===E);d("products","image")||N.exec("ALTER TABLE products ADD COLUMN image TEXT");function O(T){N.exec("BEGIN");try{const E=T();return N.exec("COMMIT"),E}catch(E){throw N.exec("ROLLBACK"),E}}const n=(T,E=null)=>{const e=N.prepare("SELECT value FROM settings WHERE key = ?").get(T);return e?JSON.parse(e.value):E},U=(T,E)=>N.prepare("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(T,JSON.stringify(E)),L="ABCDEFGHJKMNPQRSTUVWXYZ23456789";function i(T=6){let E="";for(let e=0;e<T;e++)E+=L[a(L.length)];return E}const A=()=>r(18).toString("base64url");export{A as a,N as d,n as g,i as n,U as s,O as t};
