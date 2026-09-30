import { spawnSync } from 'node:child_process'

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const result = spawnSync(command, ['test:browser', ...process.argv.slice(2)], {
  env: {
    ...process.env,
    PLAYWRIGHT_TEST_URL:
      process.env.PLAYWRIGHT_TEST_URL ?? 'http://localhost:5173'
  },
  stdio: 'inherit'
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
