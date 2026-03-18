#!/usr/bin/env node
'use strict'

const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const os = require('os')

const CONFIG_PATH = path.join(os.homedir(), '.crombie-office', 'config.json')
const DEBOUNCE_LOCK = path.join(os.tmpdir(), 'crombie-office-thinking.lock')
const DEBOUNCE_MS = 2000

function readConfig () {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
  } catch {
    return null
  }
}

function sendEvent (serverUrl, payload) {
  try {
    const body = JSON.stringify(payload)
    const url = new URL('/event', serverUrl)
    const mod = url.protocol === 'https:' ? https : http
    const req = mod.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: '/event',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    })
    req.on('error', () => {}) // fail silently
    req.write(body)
    req.end()
  } catch {
    // fail silently — never block Claude Code
  }
}

function isThinkingDebounced () {
  try {
    const mtime = fs.statSync(DEBOUNCE_LOCK).mtimeMs
    return Date.now() - mtime < DEBOUNCE_MS
  } catch {
    return false
  }
}

function touchDebounceLock () {
  try {
    fs.writeFileSync(DEBOUNCE_LOCK, '')
  } catch {}
}

function buildEvent (hookInput, config) {
  const { hook_event_name: hookName, tool_name: toolName, tool_input: toolInput } = hookInput

  if (hookName === 'SessionStart') {
    return { dev: config.name, color: config.color, type: 'session_start', ts: Date.now() }
  }
  if (hookName === 'SessionStop') {
    return { dev: config.name, type: 'session_end', ts: Date.now() }
  }
  if (hookName === 'PreToolUse' && toolName === 'Agent') {
    const agent = (toolInput && toolInput.subagent_type) ? toolInput.subagent_type : 'unknown'
    return { dev: config.name, type: 'agent_start', agent, ts: Date.now() }
  }
  if (hookName === 'PostToolUse' && toolName === 'Agent') {
    return { dev: config.name, type: 'agent_end', ts: Date.now() }
  }
  if (hookName === 'PreToolUse' && toolName !== 'Agent') {
    if (isThinkingDebounced()) return null
    touchDebounceLock()
    return { dev: config.name, type: 'thinking', ts: Date.now() }
  }
  if (hookName === 'PostToolUse' && toolName === 'Bash') {
    const cmd = (toolInput && typeof toolInput.command === 'string') ? toolInput.command : ''
    if (/^git commit/.test(cmd)) {
      return { dev: config.name, type: 'commit', ts: Date.now() }
    }
  }
  return null
}

// Main — read stdin from Claude Code
let raw = ''
process.stdin.on('data', d => { raw += d })
process.stdin.on('end', () => {
  try {
    const hookInput = JSON.parse(raw)
    const config = readConfig()
    if (!config) process.exit(0)
    if (config.enabled === false) process.exit(0)
    const event = buildEvent(hookInput, config)
    if (!event) process.exit(0)
    sendEvent(config.serverUrl, event)
  } catch {
    // always fail silently
  }
  process.exit(0)
})
