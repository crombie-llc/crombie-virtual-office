/**
 * Visual capture script — not assertions, just screenshots for agent review.
 *
 * Workflow:
 *   1. Start server:  npm run server   (port 4242)
 *   2. Start client:  npm run client   (port 3000)
 *   3. Run captures:  npm run capture --workspace=packages/visual-tests
 *   4. Agent reads PNGs from screenshots/output/ with the Read tool
 *   5. Agent adjusts layout, repeats
 */

import { test, type Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const SERVER_URL = 'http://localhost:4242'
const OUT_DIR = path.join(__dirname, 'output')

async function postEvent(payload: object) {
  const res = await fetch(`${SERVER_URL}/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`POST /event failed: ${res.status}`)
}

async function waitForOffice(page: Page) {
  // First signal (may be from React StrictMode's first mount — will be reset by second mount)
  await page.waitForFunction(() => (window as any).__officeReady === true, { timeout: 15_000 })
  // Wait to let StrictMode's cleanup+remount cycle complete (game destroyed and recreated)
  await page.waitForTimeout(300)
  // If StrictMode reset the flag, wait for the second (final) mount to finish
  const stillReady = await page.evaluate(() => (window as any).__officeReady === true)
  if (!stillReady) {
    await page.waitForFunction(() => (window as any).__officeReady === true, { timeout: 15_000 })
  }
  // Extra frame for tweens and texture uploads to settle
  await page.waitForTimeout(500)
}

async function capture(page: Page, name: string) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false })
  console.log(`  ✓ ${name}.png`)
}

// ── Reset server state before each scenario ──
async function resetState() {
  const res = await fetch(`${SERVER_URL}/reset`, { method: 'POST' })
  if (!res.ok) throw new Error(`POST /reset failed: ${res.status}`)
  // Give the server a moment to broadcast the empty state
  await new Promise(r => setTimeout(r, 300))
}

test('capture: empty office (floor only)', async ({ page }) => {
  await resetState()
  await page.goto('/')
  await waitForOffice(page)
  await capture(page, '01-empty-office')
})

test('capture: one dev online idle', async ({ page }) => {
  await resetState()
  await postEvent({ dev: 'alice', type: 'session_start', color: '#4a9eff', ts: Date.now() })
  await page.goto('/')
  await waitForOffice(page)
  await page.waitForTimeout(300)
  await capture(page, '02-one-dev-idle')
})

test('capture: one dev thinking', async ({ page }) => {
  await resetState()
  await postEvent({ dev: 'alice', type: 'session_start', color: '#4a9eff', ts: Date.now() })
  await postEvent({ dev: 'alice', type: 'thinking', ts: Date.now() })
  await page.goto('/')
  await waitForOffice(page)
  await page.waitForTimeout(300)
  await capture(page, '03-dev-thinking')
})

test('capture: dev with crombie-explorer mascot (robot)', async ({ page }) => {
  await resetState()
  await postEvent({ dev: 'alice', type: 'session_start', color: '#4a9eff', ts: Date.now() })
  await postEvent({ dev: 'alice', type: 'agent_start', agent: 'crombie-explorer', ts: Date.now() })
  await page.goto('/')
  await waitForOffice(page)
  await page.waitForTimeout(300)
  await capture(page, '04-mascot-robot-explorer')
})

test('capture: dev with crombie-worker mascot (robot)', async ({ page }) => {
  await resetState()
  await postEvent({ dev: 'bob', type: 'session_start', color: '#3fb950', ts: Date.now() })
  await postEvent({ dev: 'bob', type: 'agent_start', agent: 'crombie-worker', ts: Date.now() })
  await page.goto('/')
  await waitForOffice(page)
  await page.waitForTimeout(300)
  await capture(page, '05-mascot-robot-worker')
})

test('capture: three devs mixed states', async ({ page }) => {
  await resetState()
  await postEvent({ dev: 'alice', type: 'session_start', color: '#4a9eff', ts: Date.now() })
  await postEvent({ dev: 'alice', type: 'agent_start', agent: 'crombie-explorer', ts: Date.now() })
  await postEvent({ dev: 'bob', type: 'session_start', color: '#3fb950', ts: Date.now() })
  await postEvent({ dev: 'bob', type: 'thinking', ts: Date.now() })
  await postEvent({ dev: 'carol', type: 'session_start', color: '#bc8cff', ts: Date.now() })
  await postEvent({ dev: 'carol', type: 'session_end', ts: Date.now() })
  await page.goto('/')
  await waitForOffice(page)
  await page.waitForTimeout(300)
  await capture(page, '06-three-devs-mixed')
})

test('capture: all mascot types', async ({ page }) => {
  await resetState()
  const agents = [
    { dev: 'alice',  color: '#4a9eff', agent: 'crombie-explorer' },
    { dev: 'bob',    color: '#3fb950', agent: 'crombie-worker' },
    { dev: 'carol',  color: '#bc8cff', agent: 'crombie-architect' },
    { dev: 'dave',   color: '#f78166', agent: 'crombie-reviewer' },
    { dev: 'eve',    color: '#e3b341', agent: 'crombie-security' },
    { dev: 'frank',  color: '#39d0d8', agent: 'general-purpose' },
  ]
  for (const a of agents) {
    await postEvent({ dev: a.dev, type: 'session_start', color: a.color, ts: Date.now() })
    await postEvent({ dev: a.dev, type: 'agent_start', agent: a.agent, ts: Date.now() })
  }
  await page.goto('/')
  await waitForOffice(page)
  await page.waitForTimeout(300)
  await capture(page, '07-all-mascots')
})

test('capture: desk area zoomed in', async ({ page }) => {
  await resetState()
  await page.goto('/')
  await waitForOffice(page)
  // Zoom in with keyboard '+' 5 times to see desk detail
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Equal')
    await page.waitForTimeout(80)
  }
  await page.waitForTimeout(600)
  await capture(page, '09-desk-zoom')
})

test('capture: celebration burst', async ({ page }) => {
  await resetState()
  await postEvent({ dev: 'alice', type: 'session_start', color: '#4a9eff', ts: Date.now() })
  await page.goto('/')
  await waitForOffice(page)
  await postEvent({ dev: 'alice', type: 'commit', ts: Date.now() })
  await page.waitForTimeout(600) // catch confetti at peak
  await capture(page, '08-celebration')
})
