import { assert, describe, expect, it } from 'vitest'
import {
  filterFromQuery,
  filterQuery,
  stagingSnapshot,
  stagePayload,
  fieldDifferences,
  unfiltered
} from './staging-review'

import { fixtureReview } from './staging-fixture'
describe('catalog staging view model', () => {
  it.for([
    'unknown=x',
    'search=a&search=b',
    'author_uid=',
    'author_uid=has+space',
    'statuses=INVALID',
    'tags=',
    'change_id=',
    'change_id=a&change_id=b',
    'change_id=two+batches',
    'change_id=%C3%A9',
    'change_id=a%0A'
  ])('rejects an unsupported query %s', (query) => {
    expect(filterFromQuery(new URLSearchParams(query))).toBeUndefined()
  })
  it('preserves canonical account identity in author filtering and reviewed saves', () => {
    const author = 'fPc7irbKt2VLbuIkRrWuC5TH5lX2'
    expect(
      filterFromQuery(new URLSearchParams({ author_uid: author }))
    ).toEqual({ author_uid: author })
    const snapshot = fixtureReview()
    const first = snapshot.items[0]
    assert.isDefined(first)
    const items = [
      { ...first, content: { ...first.content, author_uid: author } }
    ]
    expect(
      stagingSnapshot({ ...snapshot, items })?.items[0]?.content.author_uid
    ).toBe(author)
    expect(
      stagingSnapshot({
        ...snapshot,
        items: [{ ...items[0], content: { ...first.content, uid: author } }]
      })
    ).toBeUndefined()
  })
  it('roundtrips declared repeated filters without silently dropping them', () => {
    const filter = {
      tags: ['demo', 'second'],
      statuses: ['NEW', 'APPROVED'],
      search: 'author'
    }
    const parsed = filterFromQuery(
      new URLSearchParams(
        'tags=demo&tags=second&statuses=NEW&statuses=APPROVED&search=author'
      )
    )
    expect(parsed).toEqual(filter)
    expect(parsed && filterFromQuery(filterQuery(parsed))).toEqual(filter)
    expect(unfiltered({ search: ' ' })).toBe(true)
    expect(unfiltered({ statuses: ['NEW'] })).toBe(false)
  })
  it('preserves the exact case-sensitive batch in queries and frozen discard scopes', () => {
    const filter = { change_id: 'Workflow-batch_1.2' }
    expect(filterFromQuery(filterQuery(filter))).toEqual(filter)
    expect(unfiltered(filter)).toBe(false)
    const snapshot = { ...fixtureReview(), filter }
    expect(stagingSnapshot(snapshot)?.filter).toEqual(filter)
    expect(stagePayload(snapshot, 'NEW', false).filter).toEqual(filter)
  })
  it('binds the exact review, complete count and digest to the decision', () => {
    const snapshot = fixtureReview()
    expect(stagePayload(snapshot, 'DEFERRED', true)).toEqual({
      review: {
        expected_live_rev: 1,
        expected_draft_rev: 7,
        expected_draft_generation: 5
      },
      filter: {},
      expected_count: 1,
      expected_selection_digest: 'a'.repeat(64),
      confirm_all: true,
      status: 'DEFERRED'
    })
  })
  it('shows nested changes and array removals, preserving inert literal keys', () => {
    const entry = fixtureReview().items[0]
    assert.isDefined(entry)
    entry.content.document = JSON.parse(
      '{"title":"After","examples":[{"title":"A"}],"labels":{"__proto__":"literal"}}'
    )
    expect(fieldDifferences(entry)).toEqual(
      expect.arrayContaining([
        { path: '$.title', before: '"Before"', after: '"After"' },
        { path: '$.examples[1]', before: '{"title":"B"}', after: undefined },
        {
          path: '$.labels',
          before: undefined,
          after: '{"__proto__":"literal"}'
        }
      ])
    )
    expect(Object.hasOwn(Object.prototype, 'literal')).toBe(false)
  })
  it('fails closed for unsafe revision numbers or absent selection digest', () => {
    const review = fixtureReview()
    expect(
      stagingSnapshot({
        ...review,
        state: {
          ...review.state,
          draft_generation: Number.MAX_SAFE_INTEGER + 1
        }
      })
    ).toBeUndefined()
    expect(stagingSnapshot({ ...review, selection_digest: '' })).toBeUndefined()
  })
})
