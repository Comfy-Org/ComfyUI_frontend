import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue, watch } from 'vue'

export interface ActivityEvent {
  id: string
  date: Date
  userName: string
  eventType: string
  detail: string
  credits: number
  /** The partner node used, for 'Partner node usage' events. */
  partnerNode?: string
  /** True for credit inflows (auto-reload, top-up) vs. usage outflows. */
  credited?: boolean
}

export interface UserSummary {
  totalCredits: number
  lastActivity: Date
}

export type ActivitySortField =
  | 'date'
  | 'user'
  | 'eventType'
  | 'detail'
  | 'credits'

/**
 * Headless state for the workspace Activity ledger: role-scoped filtering,
 * search, sort, auto-paginated slicing, and per-user rollups.
 *
 * `source` is the data seam. It defaults to an empty list, so the ledger renders
 * its empty state until a caller supplies events; the per-workspace usage API
 * that will feed it is tracked in FE-1249. Swapping in real data means passing a
 * populated ref/getter here — every downstream computed stays untouched.
 */
export function useWorkspaceActivity(
  search: MaybeRefOrGetter<string>,
  pageSize: MaybeRefOrGetter<number>,
  selfName: MaybeRefOrGetter<string | null> = null,
  source: MaybeRefOrGetter<ActivityEvent[]> = []
) {
  const page = ref(1)
  const perPage = computed(() => Math.max(1, toValue(pageSize)))
  const sortField = ref<ActivitySortField>('date')
  const sortDirection = ref<'asc' | 'desc'>('desc')

  // Members only see their own usage; credit inflows stay workspace-level.
  const base = computed<ActivityEvent[]>(() => {
    const events = toValue(source)
    const self = toValue(selfName)
    if (!self) return events
    return events.filter((event) => event.credited || event.userName === self)
  })

  const filtered = computed(() => {
    const q = toValue(search).trim().toLowerCase()
    if (!q) return base.value
    return base.value.filter(
      (event) =>
        event.userName.toLowerCase().includes(q) ||
        event.eventType.toLowerCase().includes(q)
    )
  })

  const sorted = computed(() => {
    const dir = sortDirection.value === 'asc' ? 1 : -1
    return [...filtered.value].sort((a, b) => {
      if (sortField.value === 'credits') return dir * (a.credits - b.credits)
      if (sortField.value === 'user')
        return dir * a.userName.localeCompare(b.userName)
      if (sortField.value === 'eventType')
        return dir * a.eventType.localeCompare(b.eventType)
      if (sortField.value === 'detail') {
        const aCount = Number.parseInt(a.detail, 10)
        const bCount = Number.parseInt(b.detail, 10)
        if (!Number.isNaN(aCount) && !Number.isNaN(bCount))
          return dir * (aCount - bCount)
        return dir * a.detail.localeCompare(b.detail)
      }
      return dir * (a.date.getTime() - b.date.getTime())
    })
  })

  const total = computed(() => filtered.value.length)

  const pagedItems = computed(() => {
    const start = (page.value - 1) * perPage.value
    return sorted.value.slice(start, start + perPage.value)
  })

  function toggleSort(field: ActivitySortField) {
    if (sortField.value === field) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortField.value = field
      sortDirection.value = 'desc'
    }
  }

  watch([total, perPage], ([count]) => {
    const lastPage = Math.max(1, Math.ceil(count / perPage.value))
    if (page.value > lastPage) page.value = lastPage
  })

  // Per-user rollups behind the User hover card: lifetime credits and the most
  // recent event, aggregated across the whole (unpaged) list.
  const userSummaries = computed(() => {
    const map = new Map<string, UserSummary>()
    for (const event of base.value) {
      if (event.credited) continue
      const existing = map.get(event.userName)
      if (!existing) {
        map.set(event.userName, {
          totalCredits: event.credits,
          lastActivity: event.date
        })
      } else {
        existing.totalCredits += event.credits
        if (event.date > existing.lastActivity)
          existing.lastActivity = event.date
      }
    }
    return map
  })

  return {
    page,
    total,
    itemsPerPage: perPage,
    pagedItems,
    sortField,
    sortDirection,
    toggleSort,
    userSummaries
  }
}
