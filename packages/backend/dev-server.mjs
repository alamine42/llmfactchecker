import { config as loadEnv } from 'dotenv'
loadEnv()

import { createServer } from 'http'
import { parse } from 'url'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 7707

// Dynamic import for TypeScript handlers
async function loadHandler(handlerPath) {
  try {
    // Use tsx to run TypeScript
    const module = await import(handlerPath)
    return module.default
  } catch (err) {
    console.error(`Error loading handler ${handlerPath}:`, err)
    return null
  }
}

const server = createServer(async (req, res) => {
  const parsedUrl = parse(req.url, true)
  const pathname = parsedUrl.pathname

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Fingerprint')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Route API requests
  if (pathname.startsWith('/api/')) {
    const route = pathname.replace('/api/', '').replace(/\/$/, '')
    const handlerPath = resolve(__dirname, `api/${route}.ts`)

    if (existsSync(handlerPath)) {
      try {
        const handler = await loadHandler(handlerPath)
        if (handler) {
          // Create mock Vercel request/response
          const vercelReq = {
            method: req.method,
            url: req.url,
            headers: req.headers,
            query: parsedUrl.query,
            body: null,
          }

          // Parse body for POST requests
          if (req.method === 'POST') {
            const body = await new Promise((resolve) => {
              let data = ''
              req.on('data', chunk => data += chunk)
              req.on('end', () => {
                try {
                  resolve(JSON.parse(data))
                } catch {
                  resolve(data)
                }
              })
            })
            vercelReq.body = body
          }

          const vercelRes = {
            statusCode: 200,
            headers: {},
            setHeader(name, value) {
              this.headers[name] = value
            },
            status(code) {
              this.statusCode = code
              return this
            },
            json(data) {
              res.writeHead(this.statusCode, {
                'Content-Type': 'application/json',
                ...this.headers
              })
              res.end(JSON.stringify(data))
            },
            send(data) {
              res.writeHead(this.statusCode, this.headers)
              res.end(data)
            }
          }

          await handler(vercelReq, vercelRes)
          return
        }
      } catch (err) {
        console.error('Handler error:', err)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Internal server error', message: err.message }))
        return
      }
    }
  }

  // 404 for unmatched routes
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`> Dev server ready at http://localhost:${PORT}`)
})
