import { describe, expect, it } from 'vitest'

import { createEmptyIndex, getEntryByPath, upsertEntry } from './draftCacheV2'

describe('draft cache hash collisions', () => {
  it('keeps known colliding paths as separate drafts', () => {
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

    expect(index.order).toEqual(['684dbc71', '684dbc71:workflows/4hbab.json'])
    expect(Object.keys(index.entries)).toHaveLength(2)
    expect(getEntryByPath(index, 'workflows/ewip.json')).toMatchObject({
      name: 'draft-a',
      path: 'workflows/ewip.json'
    })
    expect(getEntryByPath(index, 'workflows/4hbab.json')).toMatchObject({
      name: 'draft-b',
      path: 'workflows/4hbab.json'
    })
  })
})
