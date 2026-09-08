import { beforeEach, describe, expect, it, vi } from 'vitest'

import { perfMark, perfPoint } from './perfMark'

const { addBreadcrumb } = vi.hoisted(() => ({ addBreadcrumb: vi.fn() }))

vi.mock('@sentry/vue', () => ({ addBreadcrumb }))

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
