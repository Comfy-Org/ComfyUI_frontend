import { describe, expect, it } from 'vitest'
import type {
  ContentCatalogRecord,
  ContentCatalogReview
} from '@comfyorg/ingest-types'

import { humanizeField } from './format'
import { buildQueue, contentRows } from './queue'

function record(
  uid: string,
  edit_version: string,
  data: Record<string, unknown>,
  extra: Partial<ContentCatalogRecord> = {}
): ContentCatalogRecord {
  return {
    uid,
    revision: 1,
    edit_version,
    kind: 'MODEL',
    slug: `/hub/models/${uid}`,
    enabled: true,
    visibility: 'PUBLIC',
    deleted: false,
    data,
    ...extra
  }
}

function review(
  live: ContentCatalogRecord[],
  draft: ContentCatalogRecord[]
): ContentCatalogReview {
  return {
    live: { revision_id: 1, generation: 1, items: live },
    draft: { revision_id: 2, generation: 1, items: draft },
    can_edit: true,
    can_apply: true,
    history: []
  }
}

describe('draft review queue', () => {
  it('groups nested differences under the field an editor recognises', () => {
    const before = record('seedream', 'a', {
      name: 'Seedream',
      capabilities: ['edit', 'image']
    })
    const after = record('seedream', 'b', {
      name: 'Seedream Pro',
      capabilities: ['edit', 'image', 'upscale']
    })
    const [item] = buildQueue(review([before], [after]), [])
    expect(item).toMatchObject({ change: 'updated', title: 'Seedream Pro' })
    expect(item.source === 'catalog' && item.fields).toEqual([
      {
        field: 'capabilities',
        before: ['edit', 'image'],
        after: ['edit', 'image', 'upscale'],
        added: ['upscale'],
        removed: []
      },
      {
        field: 'name',
        before: 'Seedream',
        after: 'Seedream Pro',
        added: [],
        removed: []
      }
    ])
  })

  it.for([
    {
      name: 'new',
      live: [],
      draft: [record('wan', 'a', { name: 'Wan' })]
    },
    {
      name: 'removed',
      live: [record('flux', 'a', { name: 'Flux' })],
      draft: [record('flux', 'b', { name: 'Flux' }, { deleted: true })]
    }
  ])('marks $name pages', ({ name, live, draft }) => {
    expect(buildQueue(review(live, draft), [])[0].change).toBe(name)
  })

  it('lists workflow submissions after catalog changes', () => {
    const queue = buildQueue(
      review([], [record('wan', 'a', { name: 'Wan' })]),
      [
        {
          uid: 'u',
          share_id: 'shr_1',
          version_id: 'v1',
          title: 'Relight',
          owner_uid: 'ava',
          description: 'Portrait relight',
          listed: true,
          submitted_at: '2026-10-07T11:20:00Z'
        }
      ]
    )
    expect(queue.map((item) => [item.source, item.id])).toEqual([
      ['catalog', 'wan'],
      ['submission', 'shr_1']
    ])
  })

  it.for([
    ['thumbnailUrl', 'Thumbnail url'],
    ['visible_from', 'Visible from'],
    ['name', 'Name']
  ])('labels %s as %s', ([field, label]) => {
    expect(humanizeField(field)).toBe(label)
  })
})

describe('all content', () => {
  it('lists live pages and flags the ones the draft changes', () => {
    const live = [
      record('wan', 'a', { name: 'Wan', provider: 'Alibaba' }),
      record('gone', 'a', { name: 'Gone' }, { deleted: true })
    ]
    expect(
      contentRows(review(live, [record('wan', 'b', { name: 'Wan 3' })]))
    ).toMatchObject([
      { uid: 'wan', title: 'Wan', provider: 'Alibaba', inDraft: true }
    ])
  })
})
