import { assert, describe, expect, it } from 'vitest'
import { canonicalQueue } from './canonical-queue'
import { fixtureReview } from './staging-fixture'

describe('canonical records in Mar’s queue', () => {
  it.for([
    ['model', 'MODEL'],
    ['workflow', 'WORKFLOW'],
    ['app', 'APP'],
    ['media', 'MEDIA'],
    ['template_set', 'TEMPLATE_SET']
  ] as const)('retains the exact %s record as %s', ([type, kind]) => {
    const item = fixtureReview().items[0]
    assert.exists(item)
    item.content.type = type
    item.content.document.change_id = 'workfl_1016'
    const previewSrc =
      '/preview-media/7/00000000-0000-4000-8000-000000000020/00000000-0000-4000-8000-000000000021'
    item.presentation = { preview: { kind: 'video', src: previewSrc } }
    const [row] = canonicalQueue([item])
    assert.exists(row)
    expect(row).toMatchObject({
      id: item.content.uid,
      kind,
      title: 'Review fixture',
      change: 'updated',
      changeID: 'workfl_1016',
      thumbnail: previewSrc
    })
    expect(row.canonical).toBe(item)
    expect(item.decision).toBe('NEW')
  })

  it.for([undefined, null, 123])(
    'ignores non-text change IDs (%s)',
    (value) => {
      const item = fixtureReview().items[0]
      assert.exists(item)
      if (value === undefined) delete item.content.document.change_id
      else item.content.document.change_id = value
      expect(canonicalQueue([item])[0]?.changeID).toBeUndefined()
    }
  )

  it('keeps tombstones as removals even when the original resource never went Live', () => {
    const item = fixtureReview().items[0]
    assert.exists(item)
    delete item.before
    expect(canonicalQueue([item]).map((row) => row.change)).toEqual(['new'])
    item.content.is_deleted = true
    expect(canonicalQueue([item]).map((row) => row.change)).toEqual(['removed'])
  })

  it('credits the author by canonical account ID, never as the provider name', () => {
    const item = fixtureReview().items[0]
    assert.exists(item)
    const [row] = canonicalQueue([item])
    assert.exists(row)
    expect(row.authorUID).toBe(item.content.author_uid)
    expect(row.provider).toBeUndefined()
    item.content.document.provider = 'Black Forest Labs'
    expect(canonicalQueue([item])[0]).toMatchObject({
      provider: 'Black Forest Labs',
      authorUID: item.content.author_uid
    })
  })
})
