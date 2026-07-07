import { describe, expect, it } from 'vitest'

import { useWorkspaceActivity } from './useWorkspaceActivity'

describe('useWorkspaceActivity', () => {
  it('paginates into fixed-size pages', () => {
    const { itemsPerPage, pagedItems } = useWorkspaceActivity('')
    expect(pagedItems.value).toHaveLength(itemsPerPage)
  })

  it('aggregates per-user totals and latest activity for the hover card', () => {
    const { pagedItems, userSummaries } = useWorkspaceActivity('')
    const sample = pagedItems.value[0]
    const summary = userSummaries.value.get(sample.userName)

    expect(summary).toBeDefined()
    // The rollup covers every event for the user, so it is at least one row.
    expect(summary!.totalCredits).toBeGreaterThanOrEqual(sample.credits)
    expect(summary!.lastActivity.getTime()).toBeGreaterThanOrEqual(
      sample.date.getTime()
    )
  })
})
