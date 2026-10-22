// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { smokeCommand, standaloneEnv } from './dev-agent-commands'
import { parseOptions } from './dev-agent-options'

describe('smokeCommand', () => {
  it('prints the supplied frontend URL and dedicated harness project', () => {
    expect(smokeCommand('http://127.0.0.1:7654')).toBe(
      'PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=http://127.0.0.1:7654 pnpm exec playwright test agentHarnessSmoke --project=agent-harness'
    )
  })
})

describe('standaloneEnv', () => {
  const options = parseOptions([])

  // An inherited mode would silently select the retired direct-write path
  // while the harness claims the shared-document one.
  it.for([undefined, 'off', 'on', 'require'])(
    'leaves the mode unselected when the shell has AGENT_CRDT_MODE=%s',
    (mode) => {
      const env = standaloneEnv(options, '/tmp/agent-data', 'token', {
        PATH: '/usr/bin',
        ...(mode === undefined ? {} : { AGENT_CRDT_MODE: mode })
      })

      expect(env).not.toHaveProperty('AGENT_CRDT_MODE')
      expect(env.PATH).toBe('/usr/bin')
      expect(env.AGENT_STANDALONE).toBe('true')
    }
  )
})
