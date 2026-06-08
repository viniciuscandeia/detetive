/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs   from 'fs'
import path from 'path'

/**
 * Dev-only middleware: POST /api/save-log
 *   ?archive=1  → writes ./logs/partida_TIMESTAMP.json  (final snapshot)
 *   (default)   → overwrites ./logs/current_game.json   (live, every action)
 */
function saveLogPlugin() {
  return {
    name: 'save-log',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/save-log', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const logsDir = path.resolve(process.cwd(), 'logs')
            if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
            const isArchive = (req.url ?? '').includes('archive=1')
            const filename  = isArchive
              ? `partida_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`
              : 'current_game.json'
            fs.writeFileSync(path.join(logsDir, filename), body, 'utf-8')
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, file: filename }))
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ ok: false, error: String(e) }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  base: '/detetive/',
  plugins: [react(), saveLogPlugin()],
  test: {
    globals: true,
    environment: 'happy-dom',
  },
})
