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
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ name, color, serverUrl, enabled: true }, null, 2))
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

// ── Subcommands ──

function cmdStatus () {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    const active = config.enabled !== false
    console.log(`\n🏢 Crombie Virtual Office status`)
    console.log(`   Name:    ${config.name}`)
    console.log(`   Color:   ${config.color}`)
    console.log(`   Server:  ${config.serverUrl}`)
    console.log(`   Active:  ${active ? '✅ enabled' : '⏸️  disabled (use "toggle" to re-enable)'}`)
    console.log()
  } catch {
    console.log('\n⚪ Not registered. Run without arguments to register.\n')
  }
}

function cmdToggle () {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    config.enabled = config.enabled === false ? true : false
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
    console.log(`\n${config.enabled ? '✅ Virtual office enabled' : '⏸️  Virtual office disabled'} for "${config.name}"\n`)
  } catch {
    console.error('\n❌ Not registered. Run without arguments to register.\n')
    process.exit(1)
  }
}

function cmdUnregister () {
  const hookCmd = `node "${HOOK_PATH}"`
  const hookTypes = ['PreToolUse', 'PostToolUse', 'SessionStart', 'SessionStop']

  // Remove hooks from ~/.claude/settings.json
  try {
    const settings = JSON.parse(fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf8'))
    for (const hookType of hookTypes) {
      if (!settings.hooks || !settings.hooks[hookType]) continue
      settings.hooks[hookType] = settings.hooks[hookType].filter(h =>
        !((typeof h === 'string' && h === hookCmd) ||
          (typeof h === 'object' && h.command === hookCmd))
      )
    }
    fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2))
    console.log(`✅ Hook removed from ${CLAUDE_SETTINGS_PATH}`)
  } catch {
    console.log('⚠️  Could not update Claude settings (already removed or not found).')
  }

  // Delete config file
  try {
    fs.unlinkSync(CONFIG_PATH)
    console.log(`✅ Config deleted from ${CONFIG_PATH}`)
  } catch {
    console.log('⚠️  Config file not found (already deleted).')
  }

  console.log('\n👋 Unregistered from Crombie Virtual Office.\n')
}

// ── Dispatch ──

const subcommand = process.argv[2]
if (subcommand === 'status') {
  cmdStatus()
} else if (subcommand === 'toggle') {
  cmdToggle()
} else if (subcommand === 'unregister') {
  cmdUnregister()
} else {
  main().catch(e => { console.error(e); process.exit(1) })
}

/**
 * Programmatic registration — for use by crombie-skills-setup or other tooling.
 * Skips the interactive prompts and writes config + installs hooks directly.
 *
 * @param {object} opts
 * @param {string} opts.name      Developer name (lowercase, max 50 chars)
 * @param {string} opts.color     Hex color string, e.g. '#4a9eff'
 * @param {string} [opts.serverUrl] Defaults to 'http://localhost:4242'
 */
async function registerProgrammatic ({ name, color, serverUrl = 'http://localhost:4242' } = {}) {
  if (!name || typeof name !== 'string') throw new Error('name is required')
  name = name.trim().toLowerCase()
  if (!name) throw new Error('name cannot be empty')
  if (name.length > 50) throw new Error('name too long (max 50 chars)')

  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error('color must be a #RRGGBB hex string, e.g. "#4a9eff"')
  }

  // Write config
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ name, color, serverUrl, enabled: true }, null, 2))

  // Patch Claude settings
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

  return { name, color, serverUrl, configPath: CONFIG_PATH }
}

module.exports = { registerProgrammatic, COLORS, CONFIG_PATH }
