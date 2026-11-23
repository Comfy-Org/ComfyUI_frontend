import { describe, expect, it } from 'vitest'

import {
  readJobMemory,
  resolveJobStart,
  writeJobMemory
} from '@/components/queue/queueStatusJobMemory'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value)
  }
}

const throwingStorage: Storage = {
  ...memoryStorage(),
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  }
}

describe('queueStatusJobMemory', () => {
  it('reads back what it wrote', () => {
    const storage = memoryStorage()
    writeJobMemory({ a: { name: 'Portrait batch', startedAt: 1000 } }, storage)
    expect(readJobMemory(storage)).toEqual({
      a: { name: 'Portrait batch', startedAt: 1000 }
    })
  })

  it.for([
    { label: 'nothing stored', storage: memoryStorage() },
    {
      label: 'unparseable JSON',
      storage: memoryStorage({ 'Comfy.QueueStatus.Jobs': '{nope' })
    },
    {
      label: 'the wrong shape',
      storage: memoryStorage({
        'Comfy.QueueStatus.Jobs': JSON.stringify({ a: { startedAt: 'soon' } })
      })
    },
    { label: 'storage that throws', storage: throwingStorage }
  ])('reads an empty memory from $label', ({ storage }) => {
    expect(readJobMemory(storage)).toEqual({})
  })

  it('swallows a storage that refuses writes', () => {
    expect(() =>
      writeJobMemory({ a: { startedAt: 1 } }, throwingStorage)
    ).not.toThrow()
  })

  it('keeps only the newest fifty jobs', () => {
    const storage = memoryStorage()
    const memory = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [
        `job-${index}`,
        { startedAt: index }
      ])
    )
    writeJobMemory(memory, storage)
    const kept = Object.keys(readJobMemory(storage))
    expect(kept).toHaveLength(50)
    expect(kept[0]).toBe('job-10')
    expect(kept.at(-1)).toBe('job-59')
  })

  it.for([
    { serverStart: 10, rememberedStart: 20, expected: 10 },
    { serverStart: undefined, rememberedStart: 20, expected: 20 },
    { serverStart: undefined, rememberedStart: undefined, expected: 30 }
  ])(
    'starts the clock at $expected from server $serverStart, remembered $rememberedStart',
    ({ serverStart, rememberedStart, expected }) => {
      expect(resolveJobStart({ serverStart, rememberedStart, now: 30 })).toBe(
        expected
      )
    }
  )
})
