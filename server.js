import express from 'express'
import { createServer as createViteServer } from 'vite'
import fetch from 'node-fetch'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const API_BASE = 'http://20.69.29.54:3070'

async function main() {
  const app = express()
  app.use(express.json())

  // CORS proxy for market intelligence API
  app.use('/proxy/api', async (req, res) => {
    try {
      const targetUrl = API_BASE + req.path + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '')
      const options = {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000
      }
      if (req.method === 'POST' && req.body) {
        options.body = JSON.stringify(req.body)
      }
      const response = await fetch(targetUrl, options)
      const data = await response.json()
      res.set('Access-Control-Allow-Origin', '*')
      res.json(data)
    } catch (err) {
      res.status(503).json({ error: 'API unavailable', message: err.message })
    }
  })

  // In development, use Vite dev server
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    })
    app.use(vite.ssrFixStacktrace)
    app.use(vite.middlewares)
  } else {
    // Serve production build
    app.use(express.static(path.join(__dirname, 'dist')))
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'))
    })
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`)
  })
}

main().catch(console.error)
