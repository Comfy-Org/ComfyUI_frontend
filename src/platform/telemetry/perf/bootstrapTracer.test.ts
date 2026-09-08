import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  BootstrapCompleteMetadata,
  TelemetryDispatcher
} from '@/platform/telemetry/types'

import { BootstrapTracer } from './bootstrapTracer'
import type * as PerfMarkModule from './perfMark'

const {
  markViewLoaded,
  reportBootstrapToRum,
  trackBootstrapComplete,
  useTelemetry
} = vi.hoisted(() => {
  const trackBootstrapComplete =
    vi.fn<(metadata: BootstrapCompleteMetadata) => void>()
  return {
    markViewLoaded: vi.fn(),
    reportBootstrapToRum:
      vi.fn<(event: string, metadata: BootstrapCompleteMetadata) => void>(),
    trackBootstrapComplete,
    useTelemetry: vi.fn(
      (): Pick<TelemetryDispatcher, 'trackBootstrapComplete'> | null => ({
        trackBootstrapComplete
      })
    )
  }
})

vi.mock('@/platform/telemetry', () => ({ useTelemetry }))
vi.mock('./perfMark', async (importOriginal) => {
  const { perfMark, perfPoint } = await importOriginal<typeof PerfMarkModule>()
  return { perfMark, perfPoint, markViewLoaded, reportBootstrapToRum }
})

describe('bootstrapTracer', () => {
  beforeEach(() => {
    markViewLoaded.mockReset()
    reportBootstrapToRum.mockReset()
    trackBootstrapComplete.mockReset()
    useTelemetry.mockReset()
    useTelemetry.mockImplementation(() => ({ trackBootstrapComplete }))
  })

  it('records a phase under its own name, not a doubled prefix', async () => {
    const tracer = new BootstrapTracer()

    await tracer.settle('bootstrap/object-info', () => Promise.resolve('defs'))

    expect(tracer.summary().map((r) => r.name)).toEqual([
      'bootstrap/object-info'
    ])
  })

  it('records a phase whose work rejects and rethrows', async () => {
    const tracer = new BootstrapTracer()

    await expect(
      tracer.settle('bootstrap/settings', () =>
        Promise.reject(new Error('settings failed'))
      )
    ).rejects.toThrow('settings failed')

    expect(tracer.summary().map((r) => r.name)).toEqual(['bootstrap/settings'])
  })

  it('reports one event covering phases that finish after the store loads', async () => {
    const tracer = new BootstrapTracer()

    await tracer.settle('bootstrap/settings', () => Promise.resolve())
    await tracer.settle('bootstrap/object-info', () => Promise.resolve())
    await tracer.settle('bootstrap/extensions-setup', () => Promise.resolve())
    tracer.complete()

    expect(trackBootstrapComplete).toHaveBeenCalledOnce()
    const metadata = trackBootstrapComplete.mock.calls[0][0]
    expect(metadata.outcome).toBe('completed')
    expect(metadata.phase_count).toBe(3)
    expect(Object.keys(metadata.phases)).toEqual([
      'bootstrap/settings',
      'bootstrap/object-info',
      'bootstrap/extensions-setup'
    ])
    expect(metadata.total_ms).toBeGreaterThanOrEqual(0)
  })

  it('reports a failed startup, closing phases still open', () => {
    const tracer = new BootstrapTracer()

    tracer.startPhase('bootstrap/object-info')
    tracer.complete('failed')

    const metadata = trackBootstrapComplete.mock.calls[0][0]
    expect(metadata.outcome).toBe('failed')
    expect(Object.keys(metadata.phases)).toEqual(['bootstrap/object-info'])
  })

  it('reports only once', () => {
    const tracer = new BootstrapTracer()

    tracer.complete()
    tracer.complete('failed')

    expect(trackBootstrapComplete).toHaveBeenCalledOnce()
  })

  it('reports a startup still running at the watchdog deadline', async () => {
    const tracer = new BootstrapTracer()

    await tracer.settle('startup/remote-config', () => Promise.resolve())
    tracer.startPhase('auth-gate/user-store')
    tracer.armWatchdog(30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    const metadata = trackBootstrapComplete.mock.calls[0][0]
    expect(metadata.outcome).toBe('timed_out')
    expect(metadata.pending).toEqual(['auth-gate/user-store'])
    expect(Object.keys(metadata.phases)).toEqual(['startup/remote-config'])
  })

  it('reaches Datadog directly when the registry does not exist yet', async () => {
    useTelemetry.mockReturnValueOnce(null)
    const tracer = new BootstrapTracer()

    tracer.startPhase('startup/remote-config')
    tracer.armWatchdog(30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(reportBootstrapToRum.mock.calls).toMatchObject([
      [{ outcome: 'timed_out', pending: ['startup/remote-config'] }]
    ])
    expect(trackBootstrapComplete).not.toHaveBeenCalled()
    expect(markViewLoaded).not.toHaveBeenCalled()
  })

  it('reaches Datadog directly for a terminal outcome with no registry', () => {
    useTelemetry.mockReturnValue(null)

    new BootstrapTracer().complete()
    expect(markViewLoaded).toHaveBeenCalledOnce()

    markViewLoaded.mockReset()
    new BootstrapTracer().complete('failed')
    expect(markViewLoaded).not.toHaveBeenCalled()

    expect(reportBootstrapToRum.mock.calls).toMatchObject([
      [{ outcome: 'completed' }],
      [{ outcome: 'failed' }]
    ])
    expect(trackBootstrapComplete).not.toHaveBeenCalled()
  })

  it('still reports the terminal row after a watchdog row', async () => {
    const tracer = new BootstrapTracer()

    tracer.startPhase('auth-gate/user-store')
    tracer.armWatchdog(30_000)
    await vi.advanceTimersByTimeAsync(30_000)
    tracer.complete()

    expect(trackBootstrapComplete).toHaveBeenCalledTimes(2)
    expect(
      trackBootstrapComplete.mock.calls.map(([metadata]) => metadata.outcome)
    ).toEqual(['timed_out', 'completed'])
  })

  it('does not report a watchdog row once startup has completed', async () => {
    const tracer = new BootstrapTracer()

    tracer.armWatchdog(30_000)
    tracer.complete()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(trackBootstrapComplete).toHaveBeenCalledOnce()
  })
})
