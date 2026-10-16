import { describe, expect, it } from 'vitest'
import type { ContentCatalogRecord } from '@comfyorg/ingest-types'
import { contentDiff, fieldDiff } from './diff'

describe('readable content differences', () => {
  it('shows only changed nested paths, including unusual field names', () => {
    expect(
      fieldDiff(
        { name: 'Old', settings: { enabled: true, 'image-size': 512 } },
        { name: 'New', settings: { enabled: true, 'image-size': 1024 } }
      )
    ).toEqual([
      { path: '$.name', action: 'changed', before: 'Old', after: 'New' },
      {
        path: '$.settings["image-size"]',
        action: 'changed',
        before: 512,
        after: 1024
      }
    ])
  })

  it('aligns insertions and removals without marking shifted elements as edits', () => {
    expect(fieldDiff(['a', 'b', 'c'], ['x', 'a', 'c'])).toEqual([
      { path: '$[0]', action: 'added', after: 'x' },
      { path: '$[1]', action: 'removed', before: 'b' }
    ])
  })

  it('matches identified array items and shows changes inside their structures', () => {
    expect(
      fieldDiff(
        [{ id: 'prompt', settings: { default: 'Old' } }],
        [
          { id: 'image', required: false },
          { id: 'prompt', settings: { default: 'New' } }
        ],
        '$.inputs'
      )
    ).toEqual([
      {
        path: '$.inputs[0]',
        action: 'added',
        after: { id: 'image', required: false }
      },
      {
        path: '$.inputs[1].settings.default',
        action: 'changed',
        before: 'Old',
        after: 'New'
      }
    ])
  })

  it('does not confuse duplicate array values, null or missing fields', () => {
    expect(fieldDiff(['a', 'a'], ['a'])).toEqual([
      { path: '$[1]', action: 'removed', before: 'a' }
    ])
    expect(fieldDiff({ value: null }, {})).toEqual([
      { path: '$.value', action: 'removed', before: null }
    ])
    expect(fieldDiff({}, { value: {} })).toEqual([
      { path: '$.value', action: 'added', after: {} }
    ])
  })

  it('ignores edit metadata and treats a tombstone as a removed record', () => {
    const record: ContentCatalogRecord = {
      uid: 'model',
      revision: 1,
      edit_version: 'one',
      kind: 'MODEL',
      slug: '/hub/models/example',
      enabled: true,
      deleted: false,
      visibility: 'PUBLIC',
      data: { name: 'Example' }
    }
    expect(
      contentDiff(record, { ...record, revision: 2, edit_version: 'two' })
    ).toEqual([])
    const removed = contentDiff(record, { ...record, deleted: true })
    expect(removed.find((field) => field.path === '$.data.name')).toEqual({
      path: '$.data.name',
      action: 'removed',
      before: 'Example'
    })
    expect(removed.every((field) => field.action === 'removed')).toBe(true)
  })

  it('uses a bounded fallback for large arrays', () => {
    const before = Array.from({ length: 400 }, (_, i) => i)
    const after = [...before]
    after[399] = 500
    expect(fieldDiff(before, after)).toEqual([
      { path: '$[399]', action: 'changed', before: 399, after: 500 }
    ])
  })
})
