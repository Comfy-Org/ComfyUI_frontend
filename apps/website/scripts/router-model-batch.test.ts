import { setTimeout } from 'node:timers/promises'
import { describe, expect, it, vi } from 'vitest'

import { createStartGate, mapConcurrent } from './router-model-batch'

vi.mock(import('node:timers/promises'), { spy: true })

describe('createStartGate', () => {
  it('spaces concurrent starts at the configured rate', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const second = Promise.withResolvers<void>()
    const third = Promise.withResolvers<void>()
    vi.mocked(setTimeout)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise)
    const wait = createStartGate(2)
    const signal = new AbortController().signal
    const starts: number[] = []
    const pending = [0, 1, 2].map(async () => {
      await wait(signal)
      starts.push(Date.now())
    })
    await pending[0]
    expect(starts).toEqual([1_000])
    expect(setTimeout).toHaveBeenNthCalledWith(1, 500, undefined, { signal })
    expect(setTimeout).toHaveBeenNthCalledWith(2, 1_000, undefined, { signal })
    now.mockReturnValue(1_500)
    second.resolve()
    await pending[1]
    expect(starts).toEqual([1_000, 1_500])
    now.mockReturnValue(2_000)
    third.resolve()
    await Promise.all(pending)
    expect(starts).toEqual([1_000, 1_500, 2_000])
  })

  it.for([0, -1, Infinity, NaN])('rejects rate %s', (rate) => {
    expect(() => createStartGate(rate)).toThrow(
      'Starts per second must be positive'
    )
  })

  it('cancels a queued start without admitting it', async () => {
    const wait = createStartGate(1)
    const controller = new AbortController()
    await wait(controller.signal)
    const queued = wait(controller.signal)
    controller.abort()
    await expect(queued).rejects.toMatchObject({ name: 'AbortError' })
    await expect(wait(controller.signal)).rejects.toMatchObject({
      name: 'AbortError'
    })
  })
})

describe('mapConcurrent', () => {
  it('bounds simultaneous work and preserves input order', async () => {
    const gates = Array.from({ length: 4 }, () => Promise.withResolvers<void>())
    const started: number[] = []
    const thirdStarted = Promise.withResolvers<void>()
    const result = mapConcurrent([0, 1, 2, 3], 2, async (item) => {
      started.push(item)
      if (item === 2) thirdStarted.resolve()
      await gates[item].promise
      return `result-${item}`
    })
    expect(started).toEqual([0, 1])
    gates[1].resolve()
    await thirdStarted.promise
    expect(started).toEqual([0, 1, 2])
    gates[0].resolve()
    gates[2].resolve()
    gates[3].resolve()
    await expect(result).resolves.toEqual([
      'result-0',
      'result-1',
      'result-2',
      'result-3'
    ])
  })

  it('stops scheduling on an operational failure but drains active workers', async () => {
    const active = Promise.withResolvers<void>()
    const failed = Promise.withResolvers<void>()
    const started: number[] = []
    let settled = false
    const result = mapConcurrent([0, 1, 2], 2, async (item) => {
      started.push(item)
      if (item === 0) {
        failed.resolve()
        throw new Error('Cannot record evidence')
      }
      await active.promise
    }).catch((error: unknown) => {
      settled = true
      return error
    })
    await failed.promise
    expect(settled).toBe(false)
    active.resolve()
    expect(await result).toEqual(new Error('Cannot record evidence'))
    expect(started).toEqual([0, 1])
  })

  it('rejects invalid concurrency without executing any case', async () => {
    const executed: string[] = []
    await expect(
      mapConcurrent(['paid-case'], 0, async (item) => executed.push(item))
    ).rejects.toThrow('Concurrency must be a positive integer')
    expect(executed).toEqual([])
  })
})
