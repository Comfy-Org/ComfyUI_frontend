import { describe, expect, it } from 'vitest'
import { fixtureReview } from './staging-fixture'
import { matchesCheckedReview } from './checked-review'
import { checkedReviewBody, checkedPublishBody } from './staging-review'

describe('exact checked candidate', () => {
  it('does not require stored approval or a fully decided queue', () => {
    const before = fixtureReview()
    const final = {
      state: before.state,
      changes: before.items,
      deferred: [],
      selection_digest: 'b'.repeat(64),
      publish_enabled: true
    }
    expect(
      matchesCheckedReview(before, final, [before.items[0]!.content.uid])
    ).toBe(true)
  })
  it.each([
    'state',
    'save',
    'duplicate',
    'extra',
    'missing',
    'also excluded'
  ] as const)('refuses a changed %s', (variant) => {
    const before = fixtureReview()
    const final = {
      state: structuredClone(before.state),
      changes: structuredClone(before.items),
      deferred: [],
      selection_digest: 'b'.repeat(64),
      publish_enabled: true
    }
    const cases = {
      state: () => final.state.draft_generation++,
      save: () =>
        (final.changes[0]!.content.revision_uid =
          '00000000-0000-4000-8000-000000000099'),
      duplicate: () => final.changes.push(final.changes[0]!),
      extra: () =>
        (final.changes[0]!.content.uid =
          '00000000-0000-4000-8000-000000000099'),
      missing: () => final.changes.pop(),
      'also excluded': () => Object.assign(final, { deferred: final.changes })
    }
    cases[variant]()
    expect(
      matchesCheckedReview(before, final, [before.items[0]!.content.uid])
    ).toBe(false)
  })
  it.each([
    [],
    null,
    ['bad'],
    [
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000010'
    ]
  ])('rejects invalid checked IDs %j before forwarding', (selected_uids) => {
    const review = {
      expected_live_rev: 1,
      expected_draft_rev: 7,
      expected_draft_generation: 5
    }
    expect(checkedReviewBody.safeParse({ review, selected_uids }).success).toBe(
      false
    )
    expect(
      checkedPublishBody.safeParse({
        review,
        selected_uids,
        expected_selection_digest: 'b'.repeat(64)
      }).success
    ).toBe(false)
  })
})
