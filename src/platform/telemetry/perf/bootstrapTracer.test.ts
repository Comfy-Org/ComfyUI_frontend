import type { DatadogRum } from '@datadog/browser-rum'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TelemetryEvents } from '@/platform/telemetry/types'
import { useTelemetry as sharedUseTelemetry } from '@/platform/telemetry'

import { BootstrapTracer } from './bootstrapTracer'

const { addAction, addTiming, rumInstalled, setViewLoadingTime } = vi.hoisted(
  () => ({
    addAction: vi.fn(),
    addTiming: vi.fn(),
    rumInstalled: { value: true },
    setViewLoadingTime: vi.fn()
  })
)

vi.mock(import('@/platform/telemetry/rumContext'), () => ({
  getDatadogRum: () =>
    rumInstalled.value
      ? fromPartial<DatadogRum>({ addAction, addTiming, setViewLoadingTime })
      : undefined
}))
vi.mock(import('@/platform/telemetry'))

describe('bootstrapTracer', () => {
  beforeEach(() => {
    rumInstalled.value = true
    const telemetry = sharedUseTelemetry()
    if (!telemetry) throw new Error('Expected telemetry mock')
    vi.mocked(sharedUseTelemetry).mockReturnValue(telemetry)
  })

  it('records a phase under its own name, not a doubled prefix', async () => {
    const tracer = new BootstrapTracer()

    await tracer.settle('bootstrap/object-info', () => Promise.resolve('defs'))

    expect(tracer.summary().map((r) => r.name)).toEqual([
      'bootstrap/object-info'
    ])
    expect(addTiming).toHaveBeenCalledExactlyOnceWith('bootstrap.object-info')
  })

  it('records extension loading subphases inside the aggregate load phase', async () => {
    const tracer = new BootstrapTracer()
    // happy-dom reports a constant performance.measure() duration, so
    // containment is read from mark order rather than from durations.
    const mark = vi.spyOn(performance, 'mark')

    await tracer.settle('bootstrap/extensions-load', async () => {
      await vi.advanceTimersByTimeAsync(5)
      await tracer.settle('bootstrap/extensions-load-core', () =>
        vi.advanceTimersByTimeAsync(40)
      )
      await tracer.settle('bootstrap/extensions-load-custom', () =>
        vi.advanceTimersByTimeAsync(7)
      )
    })

    expect(mark.mock.calls.map(([name]) => name)).toEqual([
      'bootstrap/extensions-load:start',
      'bootstrap/extensions-load-core:start',
      'bootstrap/extensions-load-core:end',
      'bootstrap/extensions-load-custom:start',
      'bootstrap/extensions-load-custom:end',
      'bootstrap/extensions-load:end'
    ])

    const rows = tracer.summary()
    expect(rows.map((r) => r.name)).toEqual([
      'bootstrap/extensions-load',
      'bootstrap/extensions-load-core',
      'bootstrap/extensions-load-custom'
    ])
    expect(rows.map((r) => r.startMs)).toEqual([0, 5, 45])
    expect(addTiming).toHaveBeenCalledWith('bootstrap.extensions-load-core')
    expect(addTiming).toHaveBeenCalledWith('bootstrap.extensions-load-custom')
  })

  it('publishes milestones under RUM-safe timing names', () => {
    new BootstrapTracer().milestone('stores-ready')

    expect(addTiming).toHaveBeenCalledExactlyOnceWith(
      'bootstrap.milestone.stores-ready'
    )
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
    const telemetry = sharedUseTelemetry()
    if (!telemetry) throw new Error('Expected telemetry mock')
    const tracer = new BootstrapTracer()

    await tracer.settle('bootstrap/settings', () => Promise.resolve())
    await tracer.settle('bootstrap/object-info', () => Promise.resolve())
    await tracer.settle('bootstrap/extensions-setup', () => Promise.resolve())
    tracer.complete()

    expect(telemetry.trackBootstrapComplete).toHaveBeenCalledOnce()
    const metadata = vi.mocked(telemetry.trackBootstrapComplete).mock
      .calls[0][0]
    expect(metadata.outcome).toBe('completed')
    expect(metadata.phase_count).toBe(3)
    expect(Object.keys(metadata.phases)).toEqual([
      'bootstrap/settings',
      'bootstrap/object-info',
      'bootstrap/extensions-setup'
    ])
    expect(metadata.total_ms).toBeGreaterThanOrEqual(0)
    expect(addAction).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.BOOTSTRAP_COMPLETE,
      metadata
    )
    expect(setViewLoadingTime).toHaveBeenCalledOnce()
  })

  it('reports the wall-clock time no phase covers, counting overlaps once', async () => {
    const telemetry = sharedUseTelemetry()
    if (!telemetry) throw new Error('Expected telemetry mock')
    const tracer = new BootstrapTracer()

    await vi.advanceTimersByTimeAsync(10)
    tracer.recordSinceTimeOrigin('startup/entry-modules')
    const settings = tracer.startPhase('bootstrap/settings')
    await vi.advanceTimersByTimeAsync(50)
    const workflows = tracer.startPhase('bootstrap/workflows')
    await vi.advanceTimersByTimeAsync(50)
    settings.stop()
    await vi.advanceTimersByTimeAsync(50)
    workflows.stop()
    await vi.advanceTimersByTimeAsync(40)
    tracer.complete()

    const metadata = vi.mocked(telemetry.trackBootstrapComplete).mock
      .calls[0][0]
    expect(metadata).toMatchObject({
      total_ms: 200,
      untraced_ms: 40,
      phases: {
        'startup/entry-modules': 10,
        'bootstrap/settings': 100,
        'bootstrap/workflows': 100
      }
    })
  })

  it('reports a failed startup, closing phases still open', () => {
    const telemetry = sharedUseTelemetry()
    if (!telemetry) throw new Error('Expected telemetry mock')
    const tracer = new BootstrapTracer()

    tracer.startPhase('bootstrap/object-info')
    tracer.complete('failed')

    const metadata = vi.mocked(telemetry.trackBootstrapComplete).mock
      .calls[0][0]
    expect(metadata.outcome).toBe('failed')
    expect(Object.keys(metadata.phases)).toEqual(['bootstrap/object-info'])
    expect(addAction).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.BOOTSTRAP_COMPLETE,
      metadata
    )
    expect(setViewLoadingTime).not.toHaveBeenCalled()
  })

  it('exposes the startup outcome once it is known', () => {
    const tracer = new BootstrapTracer()
    const before = tracer.outcome

    tracer.complete('failed')
    tracer.complete()

    expect([before, tracer.outcome]).toEqual(['pending', 'failed'])
  })

  it('reports only once', () => {
    const telemetry = sharedUseTelemetry()
    if (!telemetry) throw new Error('Expected telemetry mock')
    const tracer = new BootstrapTracer()

    tracer.complete()
    tracer.complete('failed')

    expect(telemetry.trackBootstrapComplete).toHaveBeenCalledOnce()
  })

  it('reports a startup still running at the watchdog deadline', async () => {
    const telemetry = sharedUseTelemetry()
    if (!telemetry) throw new Error('Expected telemetry mock')
    const tracer = new BootstrapTracer()

    await tracer.settle('startup/remote-config', () => Promise.resolve())
    tracer.startPhase('auth-gate/user-store')
    tracer.armWatchdog(30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    const metadata = vi.mocked(telemetry.trackBootstrapComplete).mock
      .calls[0][0]
    expect(metadata.outcome).toBe('timed_out')
    expect(metadata.pending).toEqual(['auth-gate/user-store'])
    expect(Object.keys(metadata.phases)).toEqual(['startup/remote-config'])
    expect(setViewLoadingTime).not.toHaveBeenCalled()
  })

  it('reaches Datadog directly when the registry does not exist yet', async () => {
    const telemetry = sharedUseTelemetry()
    if (!telemetry) throw new Error('Expected telemetry mock')
    vi.mocked(sharedUseTelemetry).mockReturnValueOnce(null)
    const tracer = new BootstrapTracer()

    tracer.startPhase('startup/remote-config')
    tracer.armWatchdog(30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(addAction.mock.calls).toMatchObject([
      [
        TelemetryEvents.BOOTSTRAP_COMPLETE,
        { outcome: 'timed_out', pending: ['startup/remote-config'] }
      ]
    ])
    expect(telemetry.trackBootstrapComplete).not.toHaveBeenCalled()
    expect(setViewLoadingTime).not.toHaveBeenCalled()
  })

  it('reaches Datadog directly for a terminal outcome with no registry', () => {
    const telemetry = sharedUseTelemetry()
    if (!telemetry) throw new Error('Expected telemetry mock')
    vi.mocked(sharedUseTelemetry).mockReturnValue(null)

    new BootstrapTracer().complete()
    new BootstrapTracer().complete('failed')

    expect(addAction.mock.calls).toMatchObject([
      [TelemetryEvents.BOOTSTRAP_COMPLETE, { outcome: 'completed' }],
      [TelemetryEvents.BOOTSTRAP_COMPLETE, { outcome: 'failed' }]
    ])
    expect(telemetry.trackBootstrapComplete).not.toHaveBeenCalled()
    expect(setViewLoadingTime).toHaveBeenCalledOnce()
  })

  it('publishes nothing to RUM when the SDK is not installed', async () => {
    rumInstalled.value = false
    const tracer = new BootstrapTracer()

    await tracer.settle('bootstrap/settings', () => Promise.resolve())
    tracer.complete()

    expect(addTiming).not.toHaveBeenCalled()
    expect(addAction).not.toHaveBeenCalled()
    expect(setViewLoadingTime).not.toHaveBeenCalled()
  })

  it('still reports the terminal row after a watchdog row', async () => {
    const telemetry = sharedUseTelemetry()
    if (!telemetry) throw new Error('Expected telemetry mock')
    const tracer = new BootstrapTracer()

    tracer.startPhase('auth-gate/user-store')
    tracer.armWatchdog(30_000)
    await vi.advanceTimersByTimeAsync(30_000)
    tracer.complete()

    expect(telemetry.trackBootstrapComplete).toHaveBeenCalledTimes(2)
    expect(
      vi
        .mocked(telemetry.trackBootstrapComplete)
        .mock.calls.map(([metadata]) => metadata.outcome)
    ).toEqual(['timed_out', 'completed'])
  })

  it('suspends cancellation reporting and lets a replacement complete', async () => {
    const tracer = new BootstrapTracer()
    tracer.armWatchdog()
    tracer.suspendWatchdog()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(addAction).not.toHaveBeenCalled()

    tracer.resumeWatchdog()
    tracer.complete()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(addAction).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.BOOTSTRAP_COMPLETE,
      expect.objectContaining({ outcome: 'completed' })
    )
  })

  it('reports a stalled replacement after cancellation', async () => {
    const tracer = new BootstrapTracer()
    tracer.armWatchdog()
    tracer.suspendWatchdog()
    tracer.resumeWatchdog()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(addAction).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.BOOTSTRAP_COMPLETE,
      expect.objectContaining({ outcome: 'timed_out' })
    )
  })

  it('reports only one timeout across suspended replacement editors', async () => {
    const tracer = new BootstrapTracer()
    tracer.armWatchdog()
    await vi.advanceTimersByTimeAsync(30_000)
    tracer.suspendWatchdog()
    tracer.resumeWatchdog()
    await vi.advanceTimersByTimeAsync(30_000)
    tracer.suspendWatchdog()
    tracer.resumeWatchdog()
    await vi.advanceTimersByTimeAsync(30_000)
    tracer.complete()

    expect(
      addAction.mock.calls.map(([, metadata]) => metadata.outcome)
    ).toEqual(['timed_out', 'completed'])
  })

  it('does not report another timeout when explicitly rearmed', async () => {
    const tracer = new BootstrapTracer()
    tracer.armWatchdog()
    await vi.advanceTimersByTimeAsync(30_000)
    tracer.armWatchdog()
    await vi.advanceTimersByTimeAsync(30_000)
    tracer.complete('failed')

    expect(
      addAction.mock.calls.map(([, metadata]) => metadata.outcome)
    ).toEqual(['timed_out', 'failed'])
  })

  it('keeps the original watchdog deadline when already active', async () => {
    const tracer = new BootstrapTracer()
    tracer.armWatchdog()
    await vi.advanceTimersByTimeAsync(20_000)
    tracer.resumeWatchdog()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(addAction).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.BOOTSTRAP_COMPLETE,
      expect.objectContaining({ outcome: 'timed_out' })
    )
  })

  it('does not report a watchdog row once startup has completed', async () => {
    const telemetry = sharedUseTelemetry()
    if (!telemetry) throw new Error('Expected telemetry mock')
    const tracer = new BootstrapTracer()

    tracer.armWatchdog(30_000)
    tracer.complete()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(telemetry.trackBootstrapComplete).toHaveBeenCalledOnce()
  })
})
