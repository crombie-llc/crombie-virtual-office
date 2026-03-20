import http from 'http'
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { StateManager } from './state.js'
import { parseEvent } from './events.js'
import { BroadcastServer } from './ws.js'

const PORT = parseInt(process.env.PORT ?? '4242', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*'
const OFFICE_SECRET = process.env.OFFICE_SECRET ?? ''

if (!OFFICE_SECRET) {
  console.warn('[security] OFFICE_SECRET not set — /event and /reset are unprotected')
}

const app = express()

// Security headers
app.use(helmet())

app.use(express.json({ limit: '16kb' }))

// CORS
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  next()
})

// Auth middleware — validates Bearer token when OFFICE_SECRET is configured
function requireSecret(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!OFFICE_SECRET) return next()
  const auth = req.headers.authorization ?? ''
  if (auth === `Bearer ${OFFICE_SECRET}`) return next()
  res.sendStatus(401)
}

// Rate limit — 120 event POSTs per minute per IP (2 per second burst)
const eventLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
})

const state = new StateManager()

app.options('/event', (_req, res) => { res.sendStatus(204) })

app.post('/event', eventLimiter, requireSecret, (req, res) => {
  const event = parseEvent(req.body)
  if (!event) return res.sendStatus(400)
  state.applyEvent(event)
  res.sendStatus(204)
})

app.get('/state', (_req, res) => {
  res.json(state.getAll())
})

app.options('/reset', (_req, res) => { res.sendStatus(204) })

app.post('/reset', requireSecret, (req, res) => {
  state.reset()
  broadcast.broadcastRaw(JSON.stringify({ type: 'full_state', state: state.getAll() }))
  res.sendStatus(204)
})

const server = http.createServer(app)
const broadcast = new BroadcastServer(server, CORS_ORIGIN)

state.setOnPatch((patches) => broadcast.broadcast(patches))

broadcast.onConnect((ws) => {
  ws.send(JSON.stringify({ type: 'full_state', state: state.getAll() }))
})

server.listen(PORT, () => {
  console.log(`Crombie Office server running`)
  console.log(`  HTTP: http://localhost:${PORT}`)
  console.log(`  WS:   ws://localhost:${PORT}  (same port, upgrade)`)
})
