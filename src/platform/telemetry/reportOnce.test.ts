import { describe, expect, it, vi } from 'vitest'

import { createOnceReporter } from './reportOnce'

describe('createOnceReporter', () => {
  it('reports a key once, however often it recurs', () => {
    const report = vi.fn()
    const reportOnce = createOnceReporter(10)

    reportOnce('a', report)
    reportOnce('a', report)
    reportOnce('b', report)

    expect(report).toHaveBeenCalledTimes(2)
  })

  it('stops reporting once the budget of distinct keys is spent', () => {
    const report = vi.fn()
    const reportOnce = createOnceReporter(2)

    for (const key of ['a', 'b', 'c', 'd']) reportOnce(key, report)

    expect(report).toHaveBeenCalledTimes(2)
  })

  it('gives each reporter its own budget', () => {
    const report = vi.fn()
    const spent = createOnceReporter(1)
    const fresh = createOnceReporter(1)

    spent('a', report)
    spent('b', report)
    fresh('c', report)

    expect(report).toHaveBeenCalledTimes(2)
  })
})
