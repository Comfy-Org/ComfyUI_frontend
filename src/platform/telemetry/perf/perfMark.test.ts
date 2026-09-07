import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BootstrapCompleteMetadata } from '@/platform/telemetry/types'

import { perfMark, perfPoint } from './perfMark'

const { addBreadcrumb, trackBootstrapComplete } = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  trackBootstrapComplete: vi.fn()
}))

vi.mock('@sentry/vue', () => ({ addBreadcrumb }))
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackBootstrapComplete })
}))

/** The tracer is a singleton that reports once, so each test needs its own. */
async function freshTracer() {
  vi.resetModules()
  return (await import('./bootstrapTracer')).bootstrapTracer
}

describe('perfMark', () => {
  beforeEach(() => {
    addBreadcrumb.mockReset()
  })

  it('degrades to no-op tracing without the Performance API', async () => {
    vi.stubGlobal('performance', undefined)

    const span = perfMark('bootstrap/test')

    expect(span.startMs).toBe(0)
    expect(span.stop()).toBe(0)
    expect(() => perfPoint('bootstrap/milestone/test')).not.toThrow()
  })

  it('suppresses Sentry breadcrumb failures', () => {
    addBreadcrumb.mockImplementation(() => {
      throw new Error('Sentry unavailable')
    })

    const span = perfMark('bootstrap/test')

    expect(() => span.stop()).not.toThrow()
    expect(() => perfPoint('bootstrap/milestone/test')).not.toThrow()
  })

  it('measures once when stop is called repeatedly', () => {
    const measure = vi.fn(() => ({ duration: 7 }))
    vi.stubGlobal('performance', { mark: vi.fn(), measure, now: () => 0 })

    const span = perfMark('bootstrap/test-idempotent')
    const first = span.stop()

    expect(first).toBe(7)
    expect(span.stop()).toBe(first)
    expect(measure).toHaveBeenCalledOnce()
  })
})

describe('bootstrapTracer', () => {
  beforeEach(() => {
    addBreadcrumb.mockReset()
    trackBootstrapComplete.mockReset()
  })

  it('records a phase under its own name, not a doubled prefix', async () => {
    const tracer = await freshTracer()

    await tracer.settle('bootstrap/object-info', () => Promise.resolve('defs'))

    expect(tracer.summary().map((r) => r.name)).toEqual([
      'bootstrap/object-info'
    ])
  })

  it('records a phase whose work rejects and rethrows', async () => {
    const tracer = await freshTracer()

    await expect(
      tracer.settle('bootstrap/settings', () =>
        Promise.reject(new Error('settings failed'))
      )
    ).rejects.toThrow('settings failed')

    expect(tracer.summary().map((r) => r.name)).toEqual(['bootstrap/settings'])
  })

  it('reports one event covering phases that finish after the store loads', async () => {
    const tracer = await freshTracer()

    await tracer.settle('bootstrap/settings', () => Promise.resolve())
    await tracer.settle('bootstrap/object-info', () => Promise.resolve())
    await tracer.settle('bootstrap/extensions-setup', () => Promise.resolve())
    tracer.complete()

    expect(trackBootstrapComplete).toHaveBeenCalledOnce()
    const metadata = trackBootstrapComplete.mock
      .calls[0][0] as BootstrapCompleteMetadata
    expect(metadata.outcome).toBe('completed')
    expect(metadata.phase_count).toBe(3)
    expect(Object.keys(metadata.phases)).toEqual([
      'bootstrap/settings',
      'bootstrap/object-info',
      'bootstrap/extensions-setup'
    ])
    expect(metadata.total_ms).toBeGreaterThanOrEqual(0)
  })

  it('reports a failed startup, closing phases still open', async () => {
    const tracer = await freshTracer()

    tracer.startPhase('bootstrap/object-info')
    tracer.complete('failed')

    const metadata = trackBootstrapComplete.mock
      .calls[0][0] as BootstrapCompleteMetadata
    expect(metadata.outcome).toBe('failed')
    expect(Object.keys(metadata.phases)).toEqual(['bootstrap/object-info'])
  })

  it('reports only once', async () => {
    const tracer = await freshTracer()

    tracer.complete()
    tracer.complete('failed')

    expect(trackBootstrapComplete).toHaveBeenCalledOnce()
  })

  it('reports a startup still running at the watchdog deadline', async () => {
    const tracer = await freshTracer()

    await tracer.settle('startup/remote-config', () => Promise.resolve())
    tracer.startPhase('auth-gate/user-store')
    tracer.armWatchdog(30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    const metadata = trackBootstrapComplete.mock
      .calls[0][0] as BootstrapCompleteMetadata
    expect(metadata.outcome).toBe('timed_out')
    expect(metadata.pending).toEqual(['auth-gate/user-store'])
    expect(Object.keys(metadata.phases)).toEqual(['startup/remote-config'])
  })

  it('still reports the terminal row after a watchdog row', async () => {
    const tracer = await freshTracer()

    tracer.startPhase('auth-gate/user-store')
    tracer.armWatchdog(30_000)
    await vi.advanceTimersByTimeAsync(30_000)
    tracer.complete()

    expect(trackBootstrapComplete).toHaveBeenCalledTimes(2)
    expect(
      trackBootstrapComplete.mock.calls.map(
        ([m]) => (m as BootstrapCompleteMetadata).outcome
      )
    ).toEqual(['timed_out', 'completed'])
  })

  it('does not report a watchdog row once startup has completed', async () => {
    const tracer = await freshTracer()

    tracer.armWatchdog(30_000)
    tracer.complete()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(trackBootstrapComplete).toHaveBeenCalledOnce()
  })
})
