#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')
const readline = require('readline')

const CONFIG_DIR = path.join(os.homedir(), '.crombie-office')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')
const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json')
const HOOK_PATH = path.join(__dirname, 'office-hook.js')

const COLORS = {
  purple: '#bc8cff',
  blue:   '#4a9eff',
  green:  '#3fb950',
  red:    '#f78166',
  yellow: '#e3b341',
  teal:   '#39d0d8'
}

function ask (rl, question) {
  return new Promise(resolve => rl.question(question, resolve))
}

async function main () {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  console.log('\n🏢 Crombie Virtual Office — Registration\n')

  const name = (await ask(rl, 'Your name (shown in the office): ')).trim().toLowerCase()
  if (!name) { console.error('Name required.'); process.exit(1) }
  if (name.length > 50) { console.error('Name too long (max 50 chars).'); process.exit(1) }

  console.log('\nAvatar color:')
  Object.entries(COLORS).forEach(([k, v], i) => console.log(`  ${i + 1}. ${k} (${v})`))
  const colorIdx = parseInt(await ask(rl, 'Pick a number (1-6): '), 10) - 1
  const colorName = Object.keys(COLORS)[colorIdx]
  if (!colorName) { console.error('Invalid choice.'); process.exit(1) }
  const color = COLORS[colorName]

  const serverUrl = (await ask(rl, 'Server URL [http://localhost:4242]: ')).trim() || 'http://localhost:4242'

  rl.close()

  // Write config
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ name, color, serverUrl }, null, 2))
  console.log(`\n✅ Config saved to ${CONFIG_PATH}`)

  // Patch ~/.claude/settings.json
  let settings = {}
  try { settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf8')) } catch {}

  const hookCmd = `node "${HOOK_PATH}"`
  const hookTypes = ['PreToolUse', 'PostToolUse', 'SessionStart', 'SessionStop']

  if (!settings.hooks) settings.hooks = {}

  for (const hookType of hookTypes) {
    if (!settings.hooks[hookType]) settings.hooks[hookType] = []
    const already = settings.hooks[hookType].some(h =>
      (typeof h === 'string' && h === hookCmd) ||
      (typeof h === 'object' && h.command === hookCmd)
    )
    if (!already) {
      settings.hooks[hookType].push({ command: hookCmd, timeout: 5000 })
    }
  }

  fs.mkdirSync(path.dirname(CLAUDE_SETTINGS_PATH), { recursive: true })
  fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2))
  console.log(`✅ Hook installed in ${CLAUDE_SETTINGS_PATH}`)
  console.log(`\n🎉 You're registered as "${name}" (${colorName})`)
  console.log(`   Start the server and open http://localhost:3000 to see the office.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
