import { describe, expect, it } from 'vitest'

import { mapConcurrent } from './router-model-batch'

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
