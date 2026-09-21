import { describe, expect, it, vi } from 'vitest'

import { runCleanupsInReverse } from './crdtSession'

describe('runCleanupsInReverse', () => {
  it('runs every registered cleanup, in reverse order, even after an earlier one throws', () => {
    const order: number[] = []
    const first = vi.fn(() => {
      order.push(1)
      throw new Error('first cleanup failed')
    })
    const second = vi.fn(() => order.push(2))
    const third = vi.fn(() => order.push(3))

    expect(() => runCleanupsInReverse([first, second, third])).toThrow()

    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
    expect(third).toHaveBeenCalledOnce()
    // Reverse registration order: the last-registered cleanup runs first.
    expect(order).toEqual([3, 2, 1])
  })

  it('rethrows a single thrown error unchanged', () => {
    const failure = new Error('teardown failed')
    const cleanups = [
      vi.fn(),
      vi.fn(() => {
        throw failure
      })
    ]

    expect(() => runCleanupsInReverse(cleanups)).toThrow(failure)
  })

  it('aggregates multiple thrown errors into an AggregateError carrying every cause', () => {
    const first = new Error('first teardown failed')
    const second = new Error('second teardown failed')
    const cleanups = [
      () => {
        throw first
      },
      () => {
        throw second
      }
    ]

    let caught: unknown
    try {
      runCleanupsInReverse(cleanups)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(AggregateError)
    // Reverse registration order: the last-registered cleanup's error is
    // caught first.
    expect((caught as AggregateError).errors).toEqual([second, first])
  })

  it('does nothing when every cleanup succeeds', () => {
    const cleanups = [vi.fn(), vi.fn(), vi.fn()]

    expect(() => runCleanupsInReverse(cleanups)).not.toThrow()
    for (const cleanup of cleanups) expect(cleanup).toHaveBeenCalledOnce()
  })
})
