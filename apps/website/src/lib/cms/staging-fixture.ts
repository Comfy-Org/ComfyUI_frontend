import { stagingSnapshot } from './staging-review'

// Explicit local test data; never used as a production response fallback.
export function fixtureReview() {
  const content = {
    uid: '00000000-0000-4000-8000-000000000010',
    revision_uid: '00000000-0000-4000-8000-000000000011',
    type: 'workflow',
    author_uid: '00000000-0000-4000-8000-000000000004',
    document: {
      title: 'Review fixture',
      tags: ['demo'],
      examples: [{ title: 'A' }]
    },
    is_deleted: false
  }
  const snapshot = stagingSnapshot({
    state: {
      live_rev: 1,
      draft_rev: 7,
      draft_generation: 5,
      next_rev: 8,
      previous_live_rev: null
    },
    items: [
      {
        content,
        before: {
          ...content,
          document: {
            title: 'Before',
            examples: [{ title: 'A' }, { title: 'B' }]
          }
        },
        status: 'NEW',
        decision: 'NEW',
        summary: 'Modified: title, tags, examples'
      }
    ],
    filter: {},
    unresolved_count: 1,
    selection_digest: 'a'.repeat(64)
  })
  if (!snapshot) throw new Error('Invalid test review')
  return snapshot
}
