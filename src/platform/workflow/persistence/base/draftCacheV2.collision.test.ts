import { describe, expect, it } from 'vitest'

import {
  createEmptyIndex,
  getEntryByPath,
  moveEntry,
  removeEntry,
  upsertEntry
} from './draftCacheV2'
import { hashPath } from './hashUtil'

const PATH_A = 'workflows/ewip.json'
const PATH_B = 'workflows/4hbab.json'

function withBothDrafts() {
  let index = createEmptyIndex()
  index = upsertEntry(index, PATH_A, {
    name: 'draft-a',
    isTemporary: true,
    updatedAt: 1
  }).index
  index = upsertEntry(index, PATH_B, {
    name: 'draft-b',
    isTemporary: true,
    updatedAt: 2
  }).index
  return index
}

// These two paths share the same 32-bit `hashPath` value. Fixed inputs, so
// this is colocated here rather than in draftCacheV2.property.test.ts.
describe('draft cache hash collisions', () => {
  it('confirms the fixture paths really do collide', () => {
    expect(hashPath(PATH_A)).toBe(hashPath(PATH_B))
  })

  it('keeps colliding paths as separate drafts', () => {
    const index = withBothDrafts()

    expect(Object.keys(index.entries)).toHaveLength(2)
    expect(getEntryByPath(index, PATH_A)).toMatchObject({
      name: 'draft-a',
      path: PATH_A
    })
    expect(getEntryByPath(index, PATH_B)).toMatchObject({
      name: 'draft-b',
      path: PATH_B
    })
  })

  it('removes only the named colliding draft', () => {
    const index = withBothDrafts()

    const { index: afterRemove, removedKey } = removeEntry(index, PATH_A)

    expect(removedKey).not.toBeNull()
    expect(getEntryByPath(afterRemove, PATH_A)).toBeNull()
    expect(getEntryByPath(afterRemove, PATH_B)).toMatchObject({
      name: 'draft-b',
      path: PATH_B
    })
  })

  it('renames a colliding draft without displacing its neighbour', () => {
    const index = withBothDrafts()

    const moved = moveEntry(index, PATH_B, 'workflows/renamed.json', 'renamed')

    expect(moved).not.toBeNull()
    expect(
      getEntryByPath(moved!.index, 'workflows/renamed.json')
    ).toMatchObject({ name: 'renamed', path: 'workflows/renamed.json' })
    expect(getEntryByPath(moved!.index, PATH_A)).toMatchObject({
      name: 'draft-a',
      path: PATH_A
    })
    expect(getEntryByPath(moved!.index, PATH_B)).toBeNull()
  })

  it('refuses a rename onto a colliding path that has its own draft', () => {
    const index = withBothDrafts()

    expect(moveEntry(index, PATH_B, PATH_A, 'draft-a')).toBeNull()
  })
})
