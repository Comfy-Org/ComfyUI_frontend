import { spawnSync } from 'node:child_process'

import { getPnpmInvocation } from './test-browser-local.utils'

const args = ['test:browser', ...process.argv.slice(2)]
const invocation = getPnpmInvocation(args)
const configuredUrl = process.env.PLAYWRIGHT_TEST_URL
const result = spawnSync(invocation.command, invocation.args, {
  env: {
    ...process.env,
    PLAYWRIGHT_TEST_URL:
      configuredUrl && configuredUrl.trim()
        ? configuredUrl
        : 'http://localhost:5173'
  },
  shell: invocation.shell,
  stdio: 'inherit'
})

if (result.error) throw result.error
process.exitCode = result.status ?? 1
