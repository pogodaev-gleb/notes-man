import { defineConfig } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

// The fixture vault must exist before the web server starts, so it is built here
// rather than in globalSetup (which runs after webServer in Playwright).
const vault = path.join(process.cwd(), '.e2e-vault')
fs.rmSync(vault, { recursive: true, force: true })
for (const folder of ['0-Inbox', '1-Projects', '2-Areas', '3-Resources', '4-Archive']) {
  fs.mkdirSync(path.join(vault, folder), { recursive: true })
}
fs.writeFileSync(
  path.join(vault, '0-Inbox', '2026-10-30-startnotiz.md'),
  '# Startnotiz\n\nEin Text über Kartoffeln.\n',
)

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx next dev -p 3100',
    url: 'http://localhost:3100/api/tree',
    env: { VAULT_PATH: vault },
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
