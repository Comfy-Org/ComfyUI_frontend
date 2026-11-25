import { describe, expect, expectTypeOf, it } from 'vitest'

import type { SavableValue } from './savableValue'
import { savedCopier, savedRecord } from './savedCopy'

describe('a saved copy', () => {
  it('is what a workflow saves, typed as saved data and not as the value copied', () => {
    const copy = savedCopier()('m', new Date(0))

    expect(copy).toBe('1970-01-01T00:00:00.000Z')
    expectTypeOf(copy).toEqualTypeOf<SavableValue | undefined>()
  })

  it.for([
    { name: 'an object', copy: { a: 1 }, fields: { a: 1 } },
    { name: 'a list', copy: [1], fields: undefined },
    { name: 'text', copy: 'a', fields: undefined },
    { name: 'null', copy: null, fields: undefined },
    { name: 'nothing', copy: undefined, fields: undefined }
  ])('reads $name as fields only when it is an object', ({ copy, fields }) => {
    expect(savedRecord(copy)).toEqual(fields)
  })
})
