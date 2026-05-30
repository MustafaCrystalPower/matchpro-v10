import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv() reads .env at config-time — required because process.env is NOT
  // auto-populated by Vite for vite.config.ts.  Using '' as prefix loads ALL vars.
  const env = loadEnv(mode, process.cwd(), '')

  // WhatsApp gateway URL comes from .env (never hardcoded)
  const waGatewayUrl = env.VITE_WA_GATEWAY_URL || 'https://api.wa-gateway.local'

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/*.png', 'icons/*.svg', 'manifest.json', 'favicon.svg'],
        // Use a custom service worker that handles Push events
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        manifest: false, // Use the full public/manifest.json (v10 version with shortcuts)
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
        },
      }),
    ],
    server: {
      host: '0.0.0.0',
      port: 5173,
      // true = allow ALL hostnames — required for sandbox/tunnel/reverse-proxy environments
      // In Vite 8, use boolean true (not the string 'all') to bypass host validation
      allowedHosts: true,
      proxy: {
        // ── MatchPro Express Backend (GPT classification + WA polling) ───
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (_err, _req, res) => {
              try {
                if (res && !res.headersSent) {
                  (res as any).writeHead(503, { 'Content-Type': 'application/json' })
                  ;(res as any).end(JSON.stringify({ error: 'backend_unavailable', message: 'Express backend not running — start with: cd server && pm2 start ecosystem.config.cjs' }))
                }
              } catch {}
            })
          },
        },
        // ── Socket.IO WebSocket proxy ──────────────────────────────────────
        '/socket.io': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          ws: true,
        },
        // ── Market Intelligence API ──────────────────────────────────────
        '/proxy/api': {
          target: 'http://20.69.29.54:3070',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/proxy\/api/, '/api'),
          timeout: 3000,
          proxyTimeout: 3000,
          // Return JSON 502 when market API is offline (TCP timeout, ECONNREFUSED, etc.)
          configure: (proxy) => {
            const send502 = (_err: any, _req: any, res: any) => {
              try {
                if (res && !res.headersSent) {
                  (res as any).writeHead(502, { 'Content-Type': 'application/json' })
                  ;(res as any).end(JSON.stringify({ error: 'upstream_unavailable', source: 'demo', message: 'Market API offline — using demo data' }))
                }
              } catch {}
            }
            proxy.on('error', send502)
            // Destroy the upstream socket after 3s if TCP connect hangs
            proxy.on('proxyReq', (proxyReq: any, _req: any, res: any) => {
              const timer = setTimeout(() => {
                try { proxyReq.destroy() } catch {}
                send502(null, _req, res)
              }, 3000)
              proxyReq.on('response', () => clearTimeout(timer))
              proxyReq.on('error',    () => clearTimeout(timer))
            })
          },
        },
        // ── WhatsApp Messaging Gateway ───────────────────────────────────
        '/waproxy': {
          target: waGatewayUrl,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/waproxy/, ''),
          timeout: 15000,
          // Return JSON error instead of HTML when gateway is unreachable
          configure: (proxy) => {
            proxy.on('error', (_err, _req, res) => {
              if (res && !res.headersSent) {
                (res as any).writeHead(502, { 'Content-Type': 'application/json' })
                ;(res as any).end(JSON.stringify({ error: 'gateway_unreachable', message: 'Check VITE_WA_GATEWAY_URL in .env and gateway credentials in Settings' }))
              }
            })
          },
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      allowedHosts: true,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('react')) return 'react-vendor'
            if (id.includes('recharts')) return 'recharts'
            if (id.includes('framer-motion')) return 'framer-motion'
          },
        },
      },
    },
  }
})
