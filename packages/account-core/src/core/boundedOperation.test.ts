import { describe, expect, it } from 'vitest'

import { createBoundedOperation } from './boundedOperation.js'

describe('createBoundedOperation', () => {
  it('captures a handle that is live until the operation is abandoned', () => {
    const operation = createBoundedOperation()
    const handle = operation.capture()

    expect(handle.live()).toBe(true)
    operation.abandon()
    expect(
      handle.live(),
      'a captured attempt must not survive its own abandonment'
    ).toBe(false)
  })

  it('invalidates every outstanding handle when abandoned, not only the latest', () => {
    const operation = createBoundedOperation()
    const first = operation.capture()
    const second = operation.capture()

    operation.abandon()

    expect(first.live()).toBe(false)
    expect(
      second.live(),
      'one abandonment must drop all in-flight attempts, not just the newest'
    ).toBe(false)
  })

  it('leaves an earlier handle live when a later capture supersedes nothing', () => {
    const operation = createBoundedOperation()
    const earlier = operation.capture()
    operation.capture()

    expect(
      earlier.live(),
      'capture alone is not invalidation; only abandon ends prior attempts'
    ).toBe(true)
  })

  it('keeps each prior cycle dead while the latest capture stays live', () => {
    const operation = createBoundedOperation()

    const first = operation.capture()
    operation.abandon()
    const second = operation.capture()

    expect(first.live()).toBe(false)
    expect(second.live()).toBe(true)

    operation.abandon()
    const third = operation.capture()

    expect(
      second.live(),
      'each abandonment must end its own cycle, not only the first'
    ).toBe(false)
    expect(third.live()).toBe(true)
  })

  it('discards a result that resolves after the operation was abandoned mid-flight', async () => {
    const operation = createBoundedOperation()
    const handle = operation.capture()

    const pendingRead = (async () => {
      await Promise.resolve()
      return handle.live()
    })()
    operation.abandon()

    expect(
      await pendingRead,
      'work re-checked across an await must not publish once superseded'
    ).toBe(false)
  })
})
