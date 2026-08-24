import { describe, expect, it, vi } from 'vitest'

import { parseChangeSummary, runAgentRefactor } from './refactor'
import type { AgentCliAdapter } from '../checks/agentCli'

const adapter: AgentCliAdapter = {
  label: 'Claude Code',
  command: 'claude',
  buildArgs: (prompt) => ['-p', prompt]
}

describe('parseChangeSummary', () => {
  it('extracts the text between the change markers', () => {
    const stdout = [
      'agent noise',
      '===CHANGES===',
      'Renamed the test and removed one duplicate click.',
      '===END CHANGES===',
      'trailing noise'
    ].join('\n')
    expect(parseChangeSummary(stdout)).toBe(
      'Renamed the test and removed one duplicate click.'
    )
  })

  it('returns undefined when the markers are missing', () => {
    expect(parseChangeSummary('no markers here')).toBeUndefined()
    expect(parseChangeSummary('===CHANGES===\nunterminated')).toBeUndefined()
  })

  it('returns undefined when the summary is empty', () => {
    expect(
      parseChangeSummary('===CHANGES===\n   \n===END CHANGES===')
    ).toBeUndefined()
  })
})

describe('runAgentRefactor', () => {
  it('reports success when the agent exits 0', async () => {
    const result = await runAgentRefactor({
      adapter,
      specPath: 'browser_tests/tests/foo.spec.ts',
      projectRoot: '/repo',
      spawn: async () => ({ status: 0, signal: null })
    })
    expect(result).toEqual({ ran: true })
  })

  it('returns the agent-written summary when the agent provides one', async () => {
    const result = await runAgentRefactor({
      adapter,
      specPath: 'browser_tests/tests/foo.spec.ts',
      projectRoot: '/repo',
      spawn: async () => ({
        status: 0,
        signal: null,
        stdout: '===CHANGES===\nTidied naming only.\n===END CHANGES==='
      })
    })
    expect(result).toEqual({ ran: true, summary: 'Tidied naming only.' })
  })

  it('classifies a timeout (SIGTERM + ETIMEDOUT) as timedOut', async () => {
    const timeoutError = Object.assign(new Error('ETIMEDOUT'), {
      code: 'ETIMEDOUT'
    })
    const result = await runAgentRefactor({
      adapter,
      specPath: 'browser_tests/tests/foo.spec.ts',
      projectRoot: '/repo',
      spawn: async () => ({
        status: null,
        signal: 'SIGTERM',
        error: timeoutError
      })
    })
    expect(result).toEqual({ ran: false, timedOut: true })
  })

  it('treats a bare SIGTERM with no ETIMEDOUT as a process failure, not a timeout', async () => {
    const result = await runAgentRefactor({
      adapter,
      specPath: 'browser_tests/tests/foo.spec.ts',
      projectRoot: '/repo',
      spawn: async () => ({ status: null, signal: 'SIGTERM' })
    })
    expect(result).toEqual({ ran: false, error: undefined })
  })

  it('surfaces stderr when the agent exits non-zero', async () => {
    const result = await runAgentRefactor({
      adapter,
      specPath: 'browser_tests/tests/foo.spec.ts',
      projectRoot: '/repo',
      spawn: async () => ({ status: 1, signal: null, stderr: 'boom' })
    })
    expect(result).toEqual({ ran: false, error: 'boom' })
  })

  it('surfaces a spawn error, e.g. the binary vanishing mid-run', async () => {
    const result = await runAgentRefactor({
      adapter,
      specPath: 'browser_tests/tests/foo.spec.ts',
      projectRoot: '/repo',
      spawn: async () => ({
        status: null,
        signal: null,
        error: new Error('ENOENT')
      })
    })
    expect(result).toEqual({ ran: false, error: 'ENOENT' })
  })

  it('reports elapsed time to onProgress while the agent works', async () => {
    vi.useFakeTimers()
    try {
      let finish = (): void => {}
      const pending = new Promise<{
        status: number | null
        signal: NodeJS.Signals | null
        stdout?: string
      }>((resolve) => {
        finish = () => resolve({ status: 0, signal: null, stdout: '' })
      })
      const elapsed: number[] = []
      const resultPromise = runAgentRefactor({
        adapter,
        specPath: 'browser_tests/tests/foo.spec.ts',
        projectRoot: '/repo',
        spawn: () => pending,
        onProgress: (ms) => elapsed.push(ms)
      })
      await vi.advanceTimersByTimeAsync(11_000)
      finish()
      const result = await resultPromise
      expect(elapsed).toEqual([5_000, 10_000])
      expect(result.ran).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops progress reporting once the agent finishes', async () => {
    vi.useFakeTimers()
    try {
      const elapsed: number[] = []
      const resultPromise = runAgentRefactor({
        adapter,
        specPath: 'browser_tests/tests/foo.spec.ts',
        projectRoot: '/repo',
        spawn: async () => ({ status: 0, signal: null }),
        onProgress: (ms) => elapsed.push(ms)
      })
      await resultPromise
      await vi.advanceTimersByTimeAsync(30_000)
      expect(elapsed).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('scopes the prompt to a single file and points at the guidance docs', async () => {
    let capturedArgs: string[] = []
    await runAgentRefactor({
      adapter: {
        ...adapter,
        buildArgs: (prompt) => {
          capturedArgs = [prompt]
          return ['-p', prompt]
        }
      },
      specPath: 'browser_tests/tests/foo.spec.ts',
      projectRoot: '/repo',
      spawn: async () => ({ status: 0, signal: null })
    })
    expect(capturedArgs[0]).toContain('browser_tests/tests/foo.spec.ts')
    expect(capturedArgs[0]).toContain('docs/guidance/playwright.md')
    expect(capturedArgs[0]).toContain('Do not touch any other file')
    expect(capturedArgs[0]).toContain('===CHANGES===')
    expect(capturedArgs[0]).toContain('Preserve every action the user recorded')
  })
})
