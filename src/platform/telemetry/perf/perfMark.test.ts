import { beforeEach, describe, expect, it, vi } from 'vitest'

import { markViewLoaded, perfMark, perfPoint } from './perfMark'

const { addBreadcrumb, addTiming, reportError, setViewLoadingTime } =
  vi.hoisted(() => ({
    addBreadcrumb: vi.fn(),
    addTiming: vi.fn(),
    reportError: vi.fn(),
    setViewLoadingTime: vi.fn()
  }))

vi.mock('@sentry/vue', () => ({ addBreadcrumb }))
vi.mock('@datadog/browser-rum', () => ({
  datadogRum: { addTiming, addAction: vi.fn(), setViewLoadingTime }
}))
vi.mock('@/platform/telemetry/reportError', () => ({ reportError }))

describe('perfMark', () => {
  beforeEach(() => {
    addBreadcrumb.mockReset()
    addTiming.mockReset()
    reportError.mockReset()
    setViewLoadingTime.mockReset()
  })

  it('publishes the phase boundary under a RUM-safe timing name', () => {
    perfMark('bootstrap/object-info').stop()

    expect(addTiming).toHaveBeenCalledWith('bootstrap.object-info')
  })

  it('reports a failing RUM sink once rather than per phase', () => {
    const error = new Error('RUM unavailable')
    addTiming.mockImplementation(() => {
      throw error
    })
    setViewLoadingTime.mockImplementation(() => {
      throw error
    })

    perfMark('bootstrap/object-info').stop()
    perfMark('bootstrap/extensions').stop()
    expect(() => markViewLoaded()).not.toThrow()

    expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
      errorType: 'failure_publishing_startup_telemetry',
      tags: { operation: 'add_timing' }
    })
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
