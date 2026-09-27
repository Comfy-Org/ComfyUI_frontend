import { describe, expect, it, vi } from 'vitest'

import { assert } from '@/base/assert'

import { runCleanupsInReverse } from './crdtSession'

describe('runCleanupsInReverse', () => {
  it('runs every registered cleanup, in reverse order, even after an earlier one throws', () => {
    const order: string[] = []
    // Registered first, so it runs LAST (reverse order) -- the one that
    // must still run despite the throw below it in execution order.
    const registeredFirst = vi.fn(() => order.push('registered-first'))
    // Registered second, so it runs in the MIDDLE of execution order: a
    // regression back to swallow-and-stop would skip `registeredFirst`
    // entirely once this one throws.
    const registeredSecond = vi.fn(() => {
      order.push('registered-second')
      throw new Error('registered-second cleanup failed')
    })
    const registeredThird = vi.fn(() => order.push('registered-third'))

    expect(() =>
      runCleanupsInReverse([registeredFirst, registeredSecond, registeredThird])
    ).toThrow()

    expect(registeredFirst).toHaveBeenCalledOnce()
    expect(registeredSecond).toHaveBeenCalledOnce()
    expect(registeredThird).toHaveBeenCalledOnce()
    expect(order).toEqual([
      'registered-third',
      'registered-second',
      'registered-first'
    ])
  })

  it('rethrows a single thrown error unchanged', () => {
    const failure = new Error('teardown failed')
    const cleanups = [
      vi.fn(),
      vi.fn(() => {
        throw failure
      })
    ]

    let caught: unknown
    try {
      runCleanupsInReverse(cleanups)
    } catch (error) {
      caught = error
    }

    expect(caught).toBe(failure)
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

    assert(caught instanceof AggregateError, 'expected an AggregateError')
    expect(caught.errors).toEqual([second, first])
  })

  it('does nothing when every cleanup succeeds', () => {
    const cleanups = [vi.fn(), vi.fn(), vi.fn()]

    expect(() => runCleanupsInReverse(cleanups)).not.toThrow()
    expect(cleanups.map((cleanup) => cleanup.mock.calls.length)).toEqual([
      1, 1, 1
    ])
  })
})
