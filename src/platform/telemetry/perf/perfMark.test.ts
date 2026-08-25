import { describe, expect, it, vi } from 'vitest'

import { bootstrapTracer } from './bootstrapTracer'
import { perfMark, perfPoint } from './perfMark'

vi.mock('@sentry/vue', () => {
  throw new Error('Sentry unavailable')
})

describe('bootstrap performance tracing', () => {
  it('degrades to no-op tracing without the Performance API', () => {
    vi.stubGlobal('performance', undefined)

    const span = perfMark('bootstrap/test')
    const phase = bootstrapTracer.startPhase('startup/remote-config')

    expect(span.startMs).toBe(0)
    expect(span.stop()).toBe(0)
    expect(phase.stop()).toBe(0)
    expect(() => perfPoint('bootstrap/milestone/test')).not.toThrow()
    expect(bootstrapTracer.summary()).toEqual([])
  })

  it('handles rejected Sentry imports after recording a point', async () => {
    const mark = vi.fn()
    vi.stubGlobal('performance', { mark })

    expect(() => perfPoint('bootstrap/milestone/test')).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mark).toHaveBeenCalledWith('bootstrap/milestone/test')
  })
})
