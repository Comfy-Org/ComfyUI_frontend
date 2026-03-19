import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import {
  createEmptyIndex,
  removeEntry,
  touchOrder,
  upsertEntry
} from './draftCacheV2'

const arbPath = fc
  .stringMatching(/^[a-z0-9]{1,20}$/)
  .map((s) => `workflows/${s}.json`)

const arbMeta = fc.record({
  name: fc.string({ minLength: 1, maxLength: 10 }),
  isTemporary: fc.boolean(),
  updatedAt: fc.nat()
})

describe('draftCacheV2 properties', () => {
  it('order length never exceeds limit after arbitrary upserts', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(arbPath, arbMeta), {
          minLength: 1,
          maxLength: 50
        }),
        fc.integer({ min: 1, max: 10 }),
        (operations, limit) => {
          let index = createEmptyIndex()
          for (const [path, meta] of operations) {
            index = upsertEntry(index, path, meta, limit).index
          }
          expect(index.order.length).toBeLessThanOrEqual(limit)
        }
      )
    )
  })

  it('order and entries keys are always the same set', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(arbPath, arbMeta), {
          minLength: 1,
          maxLength: 30
        }),
        (operations) => {
          let index = createEmptyIndex()
          for (const [path, meta] of operations) {
            index = upsertEntry(index, path, meta).index
          }
          const orderSet = new Set(index.order)
          const entriesSet = new Set(Object.keys(index.entries))
          expect(orderSet).toEqual(entriesSet)
        }
      )
    )
  })

  it('order never contains duplicates', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(arbPath, arbMeta), {
          minLength: 1,
          maxLength: 30
        }),
        (operations) => {
          let index = createEmptyIndex()
          for (const [path, meta] of operations) {
            index = upsertEntry(index, path, meta).index
          }
          expect(new Set(index.order).size).toBe(index.order.length)
        }
      )
    )
  })

  it('upserting same path twice results in exactly one entry', () => {
    fc.assert(
      fc.property(arbPath, arbMeta, arbMeta, (path, meta1, meta2) => {
        let index = createEmptyIndex()
        index = upsertEntry(index, path, meta1).index
        index = upsertEntry(index, path, meta2).index
        const count = index.order.length
        expect(count).toBe(1)
      })
    )
  })

  it('remove after upsert leaves empty index', () => {
    fc.assert(
      fc.property(arbPath, arbMeta, (path, meta) => {
        let index = createEmptyIndex()
        index = upsertEntry(index, path, meta).index
        index = removeEntry(index, path).index
        expect(index.order).toHaveLength(0)
        expect(Object.keys(index.entries)).toHaveLength(0)
      })
    )
  })

  it('touchOrder always places key at end', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 8 }), {
          minLength: 1,
          maxLength: 10
        }),
        fc.string({ minLength: 1, maxLength: 8 }),
        (order, key) => {
          const result = touchOrder(order, key)
          expect(result[result.length - 1]).toBe(key)
        }
      )
    )
  })

  it('upserted entry is always the most recent (last in order)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(arbPath, arbMeta), {
          minLength: 1,
          maxLength: 20
        }),
        (operations) => {
          let index = createEmptyIndex()
          let lastPath = ''
          for (const [path, meta] of operations) {
            lastPath = path
            index = upsertEntry(index, path, meta).index
          }
          const lastEntry = index.entries[index.order[index.order.length - 1]]
          expect(lastEntry.path).toBe(lastPath)
        }
      )
    )
  })

  it('evicted entries are the oldest in LRU order and current key is never evicted', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(arbPath, arbMeta), {
          minLength: 1,
          maxLength: 50
        }),
        fc.integer({ min: 1, max: 10 }),
        (operations, limit) => {
          let index = createEmptyIndex()
          for (const [path, meta] of operations) {
            const orderBefore = [...index.order]
            const { index: newIndex, evicted } = upsertEntry(
              index,
              path,
              meta,
              limit
            )

            // Current key must never be evicted
            const currentKey = newIndex.order[newIndex.order.length - 1]
            for (const key of evicted) {
              expect(key).not.toBe(currentKey)
            }

            // Evicted keys must come from the old order
            if (evicted.length > 0) {
              const evictedSet = new Set(evicted)
              for (const key of evicted) {
                expect(orderBefore).toContain(key)
              }
              // Non-evicted keys preserve their relative order
              const remaining = orderBefore.filter((k) => !evictedSet.has(k))
              const newOrderWithoutCurrent = newIndex.order.filter(
                (k) => k !== currentKey
              )
              const remainingWithoutCurrent = remaining.filter(
                (k) => k !== currentKey
              )
              expect(newOrderWithoutCurrent).toEqual(remainingWithoutCurrent)
            }

            index = newIndex
          }
        }
      )
    )
  })
})
