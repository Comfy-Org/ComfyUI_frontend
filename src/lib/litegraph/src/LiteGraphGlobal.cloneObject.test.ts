import { describe, expect, it } from 'vitest'
import { isProxy, reactive } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'

// litegraph.js#1158 / frontend#4696 proposed swapping this JSON clone for
// structuredClone. Review rejected it because custom nodes hand in proxies;
// these tests pin that tolerance.
describe('LiteGraph.cloneObject', () => {
  it('clones a reactive proxy into plain data', () => {
    const source = reactive({ a: 1, nested: { b: [2, 3] } })

    const copy = LiteGraph.cloneObject(source)

    expect(copy).toEqual({ a: 1, nested: { b: [2, 3] } })
    expect(isProxy(copy)).toBe(false)
    expect(() => structuredClone(copy)).not.toThrow()
  })

  it('clones a plain object holding a nested proxy', () => {
    const copy = LiteGraph.cloneObject({ inner: reactive({ c: 'x' }) })

    expect(() => structuredClone(copy)).not.toThrow()
    expect(copy).toEqual({ inner: { c: 'x' } })
  })
})
