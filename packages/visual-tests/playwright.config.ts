import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './screenshots',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  // No parallelism — captures run sequentially to share server state
  workers: 1,
})
