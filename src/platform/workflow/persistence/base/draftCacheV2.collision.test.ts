import { describe, expect, it } from 'vitest'

import { createEmptyIndex, getEntryByPath, upsertEntry } from './draftCacheV2'

describe('R-78 draft cache collision aliasing', () => {
  it('characterizes R-78 draft cache aliasing for known colliding paths', () => {
    let index = createEmptyIndex()
    index = upsertEntry(index, 'workflows/ewip.json', {
      name: 'draft-a',
      isTemporary: true,
      updatedAt: 1
    }).index
    index = upsertEntry(index, 'workflows/4hbab.json', {
      name: 'draft-b',
      isTemporary: true,
      updatedAt: 2
    }).index

    // R-78 current-risk characterization: these paths share the same 32-bit draft key.
    // This is a fixed-input regression, not a property, so it is colocated here
    // rather than in draftCacheV2.property.test.ts.
    expect(index.order).toEqual(['684dbc71'])
    expect(Object.keys(index.entries)).toHaveLength(1)
    expect(getEntryByPath(index, 'workflows/ewip.json')).toMatchObject({
      name: 'draft-b',
      path: 'workflows/4hbab.json'
    })
  })
})
