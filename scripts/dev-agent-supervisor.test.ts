// @vitest-environment node
import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'

import { supervise, waitForStartup } from './dev-agent-supervisor'

vi.mock('node:fs/promises', () => ({ rm: vi.fn() }))

class FakeChild extends EventEmitter {
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null

  constructor(readonly pid = 100) {
    super()
  }

  exit(code: number): void {
    this.exitCode = code
    this.emit('exit', code)
  }
}

describe('supervise state', () => {
  it('keeps the first child exit code as the lifecycle result', async () => {
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('missing'), { code: 'ESRCH' })
    })
    const first = new FakeChild(100)
    const second = new FakeChild(101)
    const supervisor = supervise('/tmp/agent-data')
    supervisor.watch(first as unknown as ChildProcess)
    supervisor.watch(second as unknown as ChildProcess)

    second.exit(17)
    first.exit(0)

    await expect(supervisor.exitRequested).resolves.toBe(17)
    expect(supervisor.requested()).toBe(true)
    await expect(supervisor.stop(17)).resolves.toBe(17)
  })
})

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

  it('preserves a fatal exit when HTTP becomes ready at the same boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 200 }))
    )
    const child = {
      exitCode: null,
      signalCode: null
    } as unknown as ChildProcess

    await expect(
      waitForStartup(child, 'http://127.0.0.1:6207', 'Vite', {
        exitRequested: Promise.resolve(7),
        requested: () => true
      })
    ).resolves.toBe(7)
  })
})

describe('supervise teardown', () => {
  it('kills an orphaned process group before deleting its data', async () => {
    vi.useFakeTimers()
    let alive = true
    const signals: NodeJS.Signals[] = []
    vi.spyOn(process, 'kill').mockImplementation((_pid, signal) => {
      if (signal === 0 && !alive) {
        throw Object.assign(new Error('missing'), { code: 'ESRCH' })
      }
      if (signal === 'SIGTERM' || signal === 'SIGKILL') signals.push(signal)
      if (signal === 'SIGKILL') alive = false
      return true
    })
    const child = new FakeChild()
    const supervisor = supervise('/tmp/agent-data')
    supervisor.watch(child as unknown as ChildProcess)
    child.exit(0)

    const stopped = supervisor.stop(1)
    await vi.advanceTimersByTimeAsync(3000)

    await expect(stopped).resolves.toBe(1)
    expect(signals).toEqual(['SIGTERM', 'SIGKILL'])
    expect(rm).toHaveBeenCalledWith('/tmp/agent-data', {
      force: true,
      recursive: true
    })
  })

  it('preserves data when a process group survives escalation', async () => {
    vi.useFakeTimers()
    vi.spyOn(process, 'kill').mockReturnValue(true)
    const child = new FakeChild()
    const supervisor = supervise('/tmp/agent-data')
    supervisor.watch(child as unknown as ChildProcess)
    child.exit(0)

    const stopped = supervisor.stop(1).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(3000)

    await expect(stopped).resolves.toMatchObject({
      message: 'Process groups 100 are still running; preserved /tmp/agent-data'
    })
    expect(rm).not.toHaveBeenCalled()
  })
})
