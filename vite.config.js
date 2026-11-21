import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('./client', import.meta.url)),
  plugins: [react()],
  resolve: { alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) } },
  server: { fs: { allow: ['..'] } },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
})
