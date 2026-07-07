import type { MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue, watch } from 'vue'

export interface ActivityEvent {
  id: string
  date: Date
  userName: string
  eventType: string
  detail: string
  credits: number
}

const ITEMS_PER_PAGE = 8

// Prototype mock: there is no usage-activity endpoint yet, so the event list is
// generated client-side and paginated in the browser.
const USERS = ['Yuta', 'Jane', 'Rob', 'Min', 'Alice', 'Priya', 'Diego']
const EVENT_TYPES = ['Cloud workflow', 'Partner node usage']
const DETAILS = ['1m 4s', '13m 4s', '59s', '1m 1s', '56s', '2m 12s', '48s']
const CREDITS = [514, 15, 512, 520, 513, 516, 88]

const HOUR_MS = 60 * 60 * 1000
const BASE = new Date('2026-02-25T18:30:00').getTime()

function mockActivity(): ActivityEvent[] {
  return Array.from({ length: 26 }, (_, i) => ({
    id: `act-${i}`,
    date: new Date(BASE - i * 7 * HOUR_MS),
    userName: USERS[i % USERS.length],
    eventType: EVENT_TYPES[i % EVENT_TYPES.length],
    detail: DETAILS[i % DETAILS.length],
    credits: CREDITS[i % CREDITS.length]
  }))
}

export type ActivitySortField =
  | 'date'
  | 'user'
  | 'eventType'
  | 'detail'
  | 'credits'

export function useWorkspaceActivity(search: MaybeRefOrGetter<string>) {
  const all = mockActivity()
  const page = ref(1)
  const sortField = ref<ActivitySortField>('date')
  const sortDirection = ref<'asc' | 'desc'>('desc')

  const filtered = computed(() => {
    const q = toValue(search).trim().toLowerCase()
    if (!q) return all
    return all.filter(
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
      if (sortField.value === 'detail')
        return dir * a.detail.localeCompare(b.detail)
      return dir * (a.date.getTime() - b.date.getTime())
    })
  })

  const total = computed(() => filtered.value.length)

  const pagedItems = computed(() => {
    const start = (page.value - 1) * ITEMS_PER_PAGE
    return sorted.value.slice(start, start + ITEMS_PER_PAGE)
  })

  function toggleSort(field: ActivitySortField) {
    if (sortField.value === field) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortField.value = field
      sortDirection.value = 'desc'
    }
  }

  watch(total, (count) => {
    const lastPage = Math.max(1, Math.ceil(count / ITEMS_PER_PAGE))
    if (page.value > lastPage) page.value = lastPage
  })

  return {
    page,
    total,
    itemsPerPage: ITEMS_PER_PAGE,
    pagedItems,
    sortField,
    sortDirection,
    toggleSort
  }
}
