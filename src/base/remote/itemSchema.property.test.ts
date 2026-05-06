import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { mapToDropdownItem } from '@/base/remote/itemSchema'

describe('mapToDropdownItem property tests', () => {
  it('mapping is total and stable for arbitrary string fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string(),
          name: fc.string()
        }),
        (raw) => {
          const schema = {
            value_field: 'id',
            label_field: 'name',
            preview_type: 'image' as const
          }
          const a = mapToDropdownItem(raw, schema)
          const b = mapToDropdownItem(raw, schema)
          expect(a).toEqual(b)
          expect(typeof a.id).toBe('string')
          expect(typeof a.name).toBe('string')
        }
      )
    )
  })

  it('id is non-empty when value_field is present in raw', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.string()
        }),
        (raw) => {
          const schema = {
            value_field: 'id',
            label_field: 'name',
            preview_type: 'image' as const
          }
          const item = mapToDropdownItem(raw, schema)
          expect(item.id.length).toBeGreaterThan(0)
        }
      )
    )
  })
})
