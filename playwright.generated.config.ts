import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e-generated',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4174', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4174', cwd: './generated-app', url: 'http://127.0.0.1:4174', timeout: 30_000 },
  projects: [{ name: 'generated-chromium', use: { ...devices['Desktop Chrome'] } }],
})
