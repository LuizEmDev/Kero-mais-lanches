// Build da demonstração para o GitHub Pages: o servidor (regras de pedido, banco SQLite)
// roda no próprio navegador. Uso: npm run build:pages
import { defineConfig, mergeConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import base from './vite.config.js'

const shim = (f) => fileURLToPath(new URL(`./client/src/demo/${f}`, import.meta.url))

export default mergeConfig(base, defineConfig({
  base: process.env.PAGES_BASE || '/Kero-mais-lanches/',
  resolve: {
    alias: {
      'node:sqlite': shim('sqlite-shim.js'),
      'node:crypto': shim('crypto-shim.js'),
      'node:fs': shim('empty-shim.js'),
      'node:path': shim('empty-shim.js'),
    },
  },
  define: {
    'import.meta.env.VITE_STATIC_DEMO': 'true',
    'process.env': JSON.stringify({
      NODE_ENV: 'production',
      DB_FILE: ':memory:',
      DEMO_MODE: 'true',
      FIXED_TABLE_TOKENS: '1',
      // Chave fictícia: nenhum Pix gerado na demonstração pode ser pago de verdade.
      PIX_KEY: '00000000-0000-0000-0000-000000000000',
      PIX_MERCHANT_NAME: 'KERO MAIS DEMO',
      PIX_MERCHANT_CITY: 'SAO PAULO',
    }),
  },
  build: { outDir: fileURLToPath(new URL('./dist-pages', import.meta.url)), emptyOutDir: true },
}))
