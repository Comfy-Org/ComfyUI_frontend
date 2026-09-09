import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  BootstrapCompleteMetadata,
  TelemetryDispatcher
} from '@/platform/telemetry/types'

import { BootstrapTracer } from './bootstrapTracer'

const {
  reportError,
  trackBootstrapComplete,
  trackEarlyBootstrapComplete,
  useTelemetry
} = vi.hoisted(() => {
  const trackBootstrapComplete =
    vi.fn<(metadata: BootstrapCompleteMetadata) => void>()
  return {
    reportError: vi.fn(),
    trackBootstrapComplete,
    trackEarlyBootstrapComplete:
      vi.fn<(metadata: BootstrapCompleteMetadata) => void>(),
    useTelemetry: vi.fn(
      (): Pick<TelemetryDispatcher, 'trackBootstrapComplete'> | null => ({
        trackBootstrapComplete
      })
    )
  }
})

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock<unknown>(import('@/platform/telemetry'), () => ({ useTelemetry }))
vi.mock(import('@/platform/telemetry/reportError'), () => ({ reportError }))
vi.mock<unknown>(
  import('@/platform/telemetry/providers/cloud/DatadogRumTelemetryProvider'),
  () => ({
    DatadogRumTelemetryProvider: class {
      trackBootstrapComplete = trackEarlyBootstrapComplete
    }
  })
)

describe('bootstrapTracer', () => {
  beforeEach(() => {
    reportError.mockReset()
    trackBootstrapComplete.mockReset()
    trackEarlyBootstrapComplete.mockReset()
    useTelemetry.mockClear()
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

  it('reports an early timeout before the telemetry registry exists', async () => {
    useTelemetry.mockReturnValueOnce(null)
    const tracer = new BootstrapTracer()

    tracer.startPhase('startup/remote-config')
    tracer.armWatchdog(30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    await vi.waitFor(() => {
      expect(trackEarlyBootstrapComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'timed_out',
          pending: ['startup/remote-config']
        })
      )
    })
  })

  it('reports an early telemetry fallback failure', async () => {
    const error = new Error('Datadog unavailable')
    useTelemetry.mockReturnValueOnce(null)
    trackEarlyBootstrapComplete.mockImplementationOnce(() => {
      throw error
    })
    const tracer = new BootstrapTracer()

    tracer.armWatchdog(30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    await vi.waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(error, {
        errorType: 'bootstrap_telemetry_fallback_failure'
      })
    })
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
