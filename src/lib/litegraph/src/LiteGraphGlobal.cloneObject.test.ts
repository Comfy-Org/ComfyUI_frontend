import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'

describe('LiteGraph.cloneObject', () => {
  it('clones a reactive proxy into plain data', () => {
    const source = reactive({ a: 1, nested: { b: [2, 3] } })

    const copy = LiteGraph.cloneObject(source)

    expect(copy).toEqual({ a: 1, nested: { b: [2, 3] } })
    expect(() => structuredClone(copy)).not.toThrow()
  })

  it('clones a plain object holding a nested proxy', () => {
    const copy = LiteGraph.cloneObject({ inner: reactive({ c: 'x' }) })

    expect(() => structuredClone(copy)).not.toThrow()
    expect(copy).toEqual({ inner: { c: 'x' } })
  })
})
