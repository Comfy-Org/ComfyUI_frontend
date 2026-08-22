import { describe, expect, it } from 'vitest'

import { runAgentRefactor } from './refactor'
import type { AgentCliAdapter } from '../checks/agentCli'

const adapter: AgentCliAdapter = {
  label: 'Claude Code',
  command: 'claude',
  buildArgs: (prompt) => ['-p', prompt]
}

describe('runAgentRefactor', () => {
  it('reports success when the agent exits 0', () => {
    const result = runAgentRefactor({
      adapter,
      specPath: 'browser_tests/tests/foo.spec.ts',
      projectRoot: '/repo',
      spawn: () => ({ status: 0, signal: null })
    })
    expect(result).toEqual({ ran: true })
  })

  it('classifies spawnSync timeout (SIGTERM + ETIMEDOUT) as timedOut', () => {
    const timeoutError = Object.assign(new Error('ETIMEDOUT'), {
      code: 'ETIMEDOUT'
    })
    const result = runAgentRefactor({
      adapter,
      specPath: 'browser_tests/tests/foo.spec.ts',
      projectRoot: '/repo',
      spawn: () => ({
        status: null,
        signal: 'SIGTERM',
        error: timeoutError
      })
    })
    expect(result).toEqual({ ran: false, timedOut: true })
  })

  it('treats a bare SIGTERM with no ETIMEDOUT as a process failure, not a timeout', () => {
    const result = runAgentRefactor({
      adapter,
      specPath: 'browser_tests/tests/foo.spec.ts',
      projectRoot: '/repo',
      spawn: () => ({ status: null, signal: 'SIGTERM' })
    })
    expect(result).toEqual({ ran: false, error: undefined })
  })

  it('surfaces stderr when the agent exits non-zero', () => {
    const result = runAgentRefactor({
      adapter,
      specPath: 'browser_tests/tests/foo.spec.ts',
      projectRoot: '/repo',
      spawn: () => ({ status: 1, signal: null, stderr: 'boom' })
    })
    expect(result).toEqual({ ran: false, error: 'boom' })
  })

  it('surfaces a spawn error, e.g. the binary vanishing mid-run', () => {
    const result = runAgentRefactor({
      adapter,
      specPath: 'browser_tests/tests/foo.spec.ts',
      projectRoot: '/repo',
      spawn: () => ({
        status: null,
        signal: null,
        error: new Error('ENOENT')
      })
    })
    expect(result).toEqual({ ran: false, error: 'ENOENT' })
  })

  it('scopes the prompt to a single file and points at the guidance docs', () => {
    let capturedArgs: string[] = []
    runAgentRefactor({
      adapter: {
        ...adapter,
        buildArgs: (prompt) => {
          capturedArgs = [prompt]
          return ['-p', prompt]
        }
      },
      specPath: 'browser_tests/tests/foo.spec.ts',
      projectRoot: '/repo',
      spawn: () => ({ status: 0, signal: null })
    })
    expect(capturedArgs[0]).toContain('browser_tests/tests/foo.spec.ts')
    expect(capturedArgs[0]).toContain('docs/guidance/playwright.md')
    expect(capturedArgs[0]).toContain('Do not touch any other file')
  })
})
