import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import { activityFixture } from '@/platform/workspace/fixtures/activityFixtures'

import { useWorkspaceActivity } from './useWorkspaceActivity'
import type { ActivityEvent } from './useWorkspaceActivity'

interface SetupOptions {
  search?: Ref<string>
  pageSize?: Ref<number>
  selfUserId?: Ref<string | null>
  source?: ActivityEvent[]
}

function setup(options: SetupOptions = {}) {
  const search = options.search ?? ref('')
  const pageSize = options.pageSize ?? ref(100)
  const selfUserId = options.selfUserId ?? ref<string | null>(null)
  const scope = effectScope()
  const api = scope.run(() =>
    useWorkspaceActivity(
      search,
      pageSize,
      selfUserId,
      options.source ?? activityFixture
    )
  )!
  return { ...api, search, pageSize, selfUserId, stop: () => scope.stop() }
}

describe('useWorkspaceActivity', () => {
  it('shows the whole ledger to an owner (no self scope)', () => {
    const { total } = setup()
    expect(total.value).toBe(activityFixture.length)
  })

  it('scopes a member to their own usage rows plus workspace credit inflows', () => {
    const { total, pagedItems } = setup({
      selfUserId: ref('user-ada')
    })
    // Ada's 4 usage rows + the 2 credited inflows (userName '')
    expect(total.value).toBe(6)
    const names = new Set(pagedItems.value.map((e) => e.userName))
    expect(names).toEqual(new Set(['Ada Lovelace', '']))
  })

  it('does not expose another member with the same display name', () => {
    const sameNameEvents: ActivityEvent[] = [
      {
        id: 'self',
        date: new Date('2026-07-14T09:32:00Z'),
        userId: 'user-ada',
        userName: 'Ada Lovelace',
        eventType: 'Cloud workflow run',
        detail: '1 run',
        credits: 100
      },
      {
        id: 'other',
        date: new Date('2026-07-14T09:31:00Z'),
        userId: 'user-other-ada',
        userName: 'Ada Lovelace',
        eventType: 'Partner node usage',
        detail: '1 run',
        credits: 200
      }
    ]

    const { pagedItems } = setup({
      selfUserId: ref('user-ada'),
      source: sameNameEvents
    })

    expect(pagedItems.value.map(({ id }) => id)).toEqual(['self'])
  })

  it('searches user name and event type only, not other columns', () => {
    const search = ref('')
    const { total } = setup({ search })

    search.value = 'ada'
    expect(total.value).toBe(4) // the 4 "Ada Lovelace" rows

    search.value = 'partner'
    expect(total.value).toBe(5) // the 5 "Partner node usage" rows

    search.value = '2 runs' // a detail value — not searched
    expect(total.value).toBe(0)
  })

  it('sorts by date descending by default and dispatches other fields', () => {
    const { pagedItems, sortField, toggleSort } = setup()

    expect(pagedItems.value[0].id).toBe('evt-01') // newest date

    toggleSort('credits')
    expect(sortField.value).toBe('credits')
    expect(pagedItems.value[0].id).toBe('evt-12') // 50000, highest

    toggleSort('credits') // flip to ascending
    expect(pagedItems.value[0].id).toBe('evt-09') // 760, lowest
  })

  it('sorts detail counts by their numeric value', () => {
    const source: ActivityEvent[] = [
      {
        id: 'two-runs',
        date: new Date('2026-07-14T09:32:00Z'),
        userId: 'user-ada',
        userName: 'Ada Lovelace',
        eventType: 'Partner node usage',
        detail: '2 runs',
        credits: 1
      },
      {
        id: 'ten-runs',
        date: new Date('2026-07-14T09:31:00Z'),
        userId: 'user-ada',
        userName: 'Ada Lovelace',
        eventType: 'Partner node usage',
        detail: '10 runs',
        credits: 1
      }
    ]
    const { pagedItems, toggleSort } = setup({ source })

    toggleSort('detail')
    expect(pagedItems.value.map(({ id }) => id)).toEqual([
      'ten-runs',
      'two-runs'
    ])

    toggleSort('detail')
    expect(pagedItems.value.map(({ id }) => id)).toEqual([
      'two-runs',
      'ten-runs'
    ])
  })

  it('slices to the current page size', () => {
    const { pagedItems, total } = setup({ pageSize: ref(5) })
    expect(total.value).toBe(activityFixture.length)
    expect(pagedItems.value).toHaveLength(5)
  })

  it('clamps the page when the filtered result shrinks past it', async () => {
    const search = ref('')
    const { page, search: s } = setup({ search, pageSize: ref(5) })

    page.value = 3 // valid: ceil(14 / 5) = 3 pages
    s.value = 'katherine' // narrows to 2 rows -> 1 page
    await nextTick()

    expect(page.value).toBe(1)
  })

  it('rolls up per-user totals excluding credit inflows', () => {
    const { userSummaries } = setup()
    const ada = userSummaries.value.get('user-ada')

    expect(ada?.totalCredits).toBe(1840 + 5120 + 4100 + 2950)
    expect(ada?.lastActivity).toEqual(new Date('2026-07-14T09:32:00Z'))
    // credited inflows (userName '') never appear in the rollups
    expect(userSummaries.value.has('')).toBe(false)
  })
})
