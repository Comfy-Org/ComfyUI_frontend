import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'

import { clone } from '@/scripts/utils'

describe('clone', () => {
  it('returns a structured-cloneable copy of a reactive proxy', () => {
    const copy = clone(reactive({ a: 1, nested: { b: [2, 3] } }))

    expect(copy).toEqual({ a: 1, nested: { b: [2, 3] } })
    expect(() => structuredClone(copy)).not.toThrow()
  })

  it('keeps structuredClone fidelity for plain data', () => {
    const date = new Date(0)

    expect(clone({ date }).date).toBeInstanceOf(Date)
  })
})
