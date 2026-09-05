// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { smokeCommand } from './dev-agent-commands'

describe('smokeCommand', () => {
  it('prints the supplied frontend URL and dedicated harness project', () => {
    expect(smokeCommand('http://127.0.0.1:7654')).toBe(
      'PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=http://127.0.0.1:7654 pnpm exec playwright test agentHarnessSmoke --project=agent-harness'
    )
  })
})
