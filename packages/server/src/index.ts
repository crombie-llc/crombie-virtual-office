import http from 'http'
import express from 'express'
import { StateManager } from './state.js'
import { parseEvent } from './events.js'
import { BroadcastServer } from './ws.js'

const PORT = 4242

const app = express()
app.use(express.json())
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  next()
})

const state = new StateManager()

app.options('/event', (_req, res) => { res.sendStatus(204) })

app.post('/event', (req, res) => {
  const event = parseEvent(req.body)
  if (!event) return res.sendStatus(400)
  state.applyEvent(event)
  res.sendStatus(204)
})

app.get('/state', (_req, res) => {
  res.json(state.getAll())
})

const server = http.createServer(app)
const broadcast = new BroadcastServer(server)

state.setOnPatch((patches) => broadcast.broadcast(patches))

broadcast.onConnect((ws) => {
  ws.send(JSON.stringify({ type: 'full_state', state: state.getAll() }))
})

server.listen(PORT, () => {
  console.log(`Crombie Office server running`)
  console.log(`  HTTP: http://localhost:${PORT}`)
  console.log(`  WS:   ws://localhost:${PORT}  (same port, upgrade)`)
})
