// @vitest-environment node
import type { ChildProcess } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'

import { waitForStartup } from './dev-agent-supervisor'

describe('waitForStartup', () => {
  it('returns a child failure without waiting for HTTP readiness', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {}))
    )
    let stopped = false
    let requestExit: (code: number) => void = () => {}
    const exitRequested = new Promise<number>((resolve) => {
      requestExit = resolve
    })
    const child = {
      exitCode: null,
      signalCode: null
    } as unknown as ChildProcess
    const startup = waitForStartup(
      child,
      'http://127.0.0.1:8096/health',
      'Doc host',
      {
        exitRequested,
        requested: () => stopped
      }
    )

    stopped = true
    requestExit(9)

    await expect(startup).resolves.toBe(9)
  })
})
